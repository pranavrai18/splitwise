const express = require('express');
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');
const { createAuditLog } = require('../middleware/audit');

const router = express.Router();

/**
 * GET /api/groups/:id/settlements
 * List all settlements for a group
 */
router.get('/:id/settlements', authenticate, async (req, res) => {
  try {
    const settlements = await prisma.settlement.findMany({
      where: { groupId: req.params.id },
      include: {
        fromUser: { select: { id: true, name: true, email: true } },
        toUser: { select: { id: true, name: true, email: true } }
      },
      orderBy: { settledAt: 'desc' }
    });

    res.json(settlements);
  } catch (error) {
    console.error('List settlements error:', error);
    res.status(500).json({ error: 'Failed to fetch settlements.' });
  }
});

/**
 * POST /api/groups/:id/settlements
 * Record a settlement payment (separate from expenses)
 */
router.post('/:id/settlements', authenticate, async (req, res) => {
  try {
    const {
      fromUserId,
      toUserId,
      amount,
      currency = 'INR',
      exchangeRate = 1,
      notes,
      settledAt
    } = req.body;

    if (!fromUserId || !toUserId || !amount) {
      return res.status(400).json({ error: 'fromUserId, toUserId, and amount are required.' });
    }

    if (fromUserId === toUserId) {
      return res.status(400).json({ error: 'Cannot settle with yourself.' });
    }

    const baseAmount = parseFloat(amount) * parseFloat(exchangeRate);

    const settlement = await prisma.settlement.create({
      data: {
        groupId: req.params.id,
        fromUserId,
        toUserId,
        amount: parseFloat(amount),
        currency,
        exchangeRate: parseFloat(exchangeRate),
        baseAmount,
        notes,
        settledAt: settledAt ? new Date(settledAt) : new Date()
      },
      include: {
        fromUser: { select: { id: true, name: true } },
        toUser: { select: { id: true, name: true } }
      }
    });

    await createAuditLog({
      userId: req.user.id,
      groupId: req.params.id,
      entityType: 'settlement',
      entityId: settlement.id,
      action: 'create',
      afterData: settlement
    });

    res.status(201).json(settlement);
  } catch (error) {
    console.error('Create settlement error:', error);
    res.status(500).json({ error: 'Failed to create settlement.' });
  }
});

module.exports = router;
