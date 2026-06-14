const express = require('express');
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');
const { createAuditLog } = require('../middleware/audit');
const { calculateSplits } = require('../services/splitCalculator');

const router = express.Router();

/**
 * GET /api/groups/:id/expenses
 * List expenses for a group (paginated)
 */
router.get('/:id/expenses', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, startDate, endDate } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      groupId: req.params.id,
      isDeleted: false,
      ...(search && {
        description: { contains: search, mode: 'insensitive' }
      }),
      ...(startDate && endDate && {
        expenseDate: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      })
    };

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          paidBy: { select: { id: true, name: true, email: true } },
          participants: {
            include: {
              user: { select: { id: true, name: true, email: true } }
            }
          }
        },
        orderBy: { expenseDate: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.expense.count({ where })
    ]);

    res.json({
      expenses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('List expenses error:', error);
    res.status(500).json({ error: 'Failed to fetch expenses.' });
  }
});

/**
 * POST /api/groups/:id/expenses
 * Create a new expense with participant splits
 */
router.post('/:id/expenses', authenticate, async (req, res) => {
  try {
    const {
      amount,
      currency = 'INR',
      exchangeRate = 1,
      description,
      expenseDate,
      splitType,
      participants,
      splitDetails = {},
      notes
    } = req.body;

    if (!amount || !description || !expenseDate || !splitType || !participants?.length) {
      return res.status(400).json({
        error: 'amount, description, expenseDate, splitType, and participants are required.'
      });
    }

    const baseAmount = parseFloat(amount) * parseFloat(exchangeRate);

    // Calculate splits
    const splits = calculateSplits(
      parseFloat(amount) * parseFloat(exchangeRate),
      splitType,
      participants,
      splitDetails
    );

    // Validate participants are active members on the expense date
    const activeMembers = await prisma.membership.findMany({
      where: {
        groupId: req.params.id,
        userId: { in: participants.map(p => p.userId) },
        joinDate: { lte: new Date(expenseDate) },
        OR: [
          { leaveDate: null },
          { leaveDate: { gte: new Date(expenseDate) } }
        ]
      }
    });

    const activeMemberIds = new Set(activeMembers.map(m => m.userId));
    const invalidParticipants = participants.filter(p => !activeMemberIds.has(p.userId));

    if (invalidParticipants.length > 0) {
      return res.status(400).json({
        error: 'Some participants are not active members on the expense date.',
        invalidParticipants: invalidParticipants.map(p => p.userId)
      });
    }

    // Create expense with participants in a transaction
    const expense = await prisma.$transaction(async (tx) => {
      const newExpense = await tx.expense.create({
        data: {
          groupId: req.params.id,
          paidById: req.user.id,
          amount: parseFloat(amount),
          currency,
          exchangeRate: parseFloat(exchangeRate),
          baseAmount,
          description,
          expenseDate: new Date(expenseDate),
          splitType,
          notes
        }
      });

      // Create participant records
      await tx.expenseParticipant.createMany({
        data: splits.map(s => ({
          expenseId: newExpense.id,
          userId: s.userId,
          shareAmount: s.shareAmount,
          sharePercentage: s.sharePercentage || null,
          shareUnits: s.shareUnits || null
        }))
      });

      return tx.expense.findUnique({
        where: { id: newExpense.id },
        include: {
          paidBy: { select: { id: true, name: true } },
          participants: {
            include: { user: { select: { id: true, name: true } } }
          }
        }
      });
    });

    await createAuditLog({
      userId: req.user.id,
      groupId: req.params.id,
      entityType: 'expense',
      entityId: expense.id,
      action: 'create',
      afterData: expense
    });

    res.status(201).json(expense);
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ error: error.message || 'Failed to create expense.' });
  }
});

/**
 * GET /api/groups/:groupId/expenses/:id (also mounted at base)
 */
router.get('/:groupId/expenses/:id', authenticate, async (req, res) => {
  try {
    const expense = await prisma.expense.findUnique({
      where: { id: req.params.id },
      include: {
        paidBy: { select: { id: true, name: true, email: true } },
        participants: {
          include: { user: { select: { id: true, name: true, email: true } } }
        }
      }
    });

    if (!expense || expense.isDeleted) {
      return res.status(404).json({ error: 'Expense not found.' });
    }

    res.json(expense);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch expense.' });
  }
});

/**
 * PUT /api/groups/:groupId/expenses/:id
 * Update an expense (with full audit trail)
 */
router.put('/:groupId/expenses/:id', authenticate, async (req, res) => {
  try {
    const existing = await prisma.expense.findUnique({
      where: { id: req.params.id },
      include: { participants: true }
    });

    if (!existing || existing.isDeleted) {
      return res.status(404).json({ error: 'Expense not found.' });
    }

    const {
      amount,
      currency,
      exchangeRate,
      description,
      expenseDate,
      splitType,
      participants,
      splitDetails,
      notes
    } = req.body;

    const newAmount = amount !== undefined ? parseFloat(amount) : parseFloat(existing.amount);
    const newRate = exchangeRate !== undefined ? parseFloat(exchangeRate) : parseFloat(existing.exchangeRate);
    const newBaseAmount = newAmount * newRate;

    const expense = await prisma.$transaction(async (tx) => {
      // Update the expense
      const updated = await tx.expense.update({
        where: { id: req.params.id },
        data: {
          ...(amount !== undefined && { amount: newAmount }),
          ...(currency && { currency }),
          ...(exchangeRate !== undefined && { exchangeRate: newRate }),
          baseAmount: newBaseAmount,
          ...(description && { description }),
          ...(expenseDate && { expenseDate: new Date(expenseDate) }),
          ...(splitType && { splitType }),
          ...(notes !== undefined && { notes })
        }
      });

      // If participants changed, recalculate splits
      if (participants && participants.length > 0 && splitType) {
        const splits = calculateSplits(newBaseAmount, splitType || existing.splitType, participants, splitDetails || {});

        // Delete old participants and create new ones
        await tx.expenseParticipant.deleteMany({ where: { expenseId: req.params.id } });
        await tx.expenseParticipant.createMany({
          data: splits.map(s => ({
            expenseId: req.params.id,
            userId: s.userId,
            shareAmount: s.shareAmount,
            sharePercentage: s.sharePercentage || null,
            shareUnits: s.shareUnits || null
          }))
        });
      }

      return tx.expense.findUnique({
        where: { id: req.params.id },
        include: {
          paidBy: { select: { id: true, name: true } },
          participants: {
            include: { user: { select: { id: true, name: true } } }
          }
        }
      });
    });

    await createAuditLog({
      userId: req.user.id,
      groupId: req.params.groupId,
      entityType: 'expense',
      entityId: expense.id,
      action: 'update',
      beforeData: existing,
      afterData: expense
    });

    res.json(expense);
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ error: error.message || 'Failed to update expense.' });
  }
});

/**
 * DELETE /api/groups/:groupId/expenses/:id
 * Soft-delete an expense
 */
router.delete('/:groupId/expenses/:id', authenticate, async (req, res) => {
  try {
    const existing = await prisma.expense.findUnique({
      where: { id: req.params.id },
      include: { participants: true }
    });

    if (!existing || existing.isDeleted) {
      return res.status(404).json({ error: 'Expense not found.' });
    }

    await prisma.expense.update({
      where: { id: req.params.id },
      data: { isDeleted: true }
    });

    await createAuditLog({
      userId: req.user.id,
      groupId: req.params.groupId,
      entityType: 'expense',
      entityId: req.params.id,
      action: 'delete',
      beforeData: existing
    });

    res.json({ message: 'Expense deleted successfully.' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ error: 'Failed to delete expense.' });
  }
});

module.exports = router;
