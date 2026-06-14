const express = require('express');
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');
const { createAuditLog } = require('../middleware/audit');

const router = express.Router();

/**
 * GET /api/groups
 * List all groups the current user belongs to
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const memberships = await prisma.membership.findMany({
      where: { userId: req.user.id },
      include: {
        group: {
          include: {
            memberships: {
              include: { user: { select: { id: true, name: true, email: true } } },
              where: { leaveDate: null }
            },
            _count: { select: { expenses: { where: { isDeleted: false } } } }
          }
        }
      }
    });

    const groups = memberships.map(m => ({
      ...m.group,
      myRole: m.role,
      myJoinDate: m.joinDate,
      myLeaveDate: m.leaveDate,
      memberCount: m.group.memberships.length,
      expenseCount: m.group._count.expenses
    }));

    res.json(groups);
  } catch (error) {
    console.error('List groups error:', error);
    res.status(500).json({ error: 'Failed to fetch groups.' });
  }
});

/**
 * POST /api/groups
 * Create a new group
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, baseCurrency = 'INR' } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Group name is required.' });
    }

    const group = await prisma.$transaction(async (tx) => {
      // Create the group
      const newGroup = await tx.group.create({
        data: {
          name,
          baseCurrency,
          createdById: req.user.id
        }
      });

      // Add creator as admin member
      await tx.membership.create({
        data: {
          userId: req.user.id,
          groupId: newGroup.id,
          role: 'admin',
          joinDate: new Date()
        }
      });

      return newGroup;
    });

    await createAuditLog({
      userId: req.user.id,
      groupId: group.id,
      entityType: 'group',
      entityId: group.id,
      action: 'create',
      afterData: group
    });

    res.status(201).json(group);
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Failed to create group.' });
  }
});

/**
 * GET /api/groups/:id
 * Get group details
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const group = await prisma.group.findUnique({
      where: { id: req.params.id },
      include: {
        memberships: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { joinDate: 'asc' }
        },
        _count: {
          select: {
            expenses: { where: { isDeleted: false } },
            settlements: true
          }
        }
      }
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found.' });
    }

    res.json(group);
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ error: 'Failed to fetch group.' });
  }
});

/**
 * PUT /api/groups/:id
 * Update group name / settings
 */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { name, baseCurrency } = req.body;

    const existing = await prisma.group.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Group not found.' });
    }

    const updated = await prisma.group.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(baseCurrency && { baseCurrency })
      }
    });

    await createAuditLog({
      userId: req.user.id,
      groupId: updated.id,
      entityType: 'group',
      entityId: updated.id,
      action: 'update',
      beforeData: existing,
      afterData: updated
    });

    res.json(updated);
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({ error: 'Failed to update group.' });
  }
});

/**
 * DELETE /api/groups/:id
 * Delete a group (soft — marks all expenses deleted)
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const group = await prisma.group.findUnique({ where: { id: req.params.id } });
    if (!group) {
      return res.status(404).json({ error: 'Group not found.' });
    }

    await prisma.$transaction([
      prisma.expense.updateMany({
        where: { groupId: req.params.id },
        data: { isDeleted: true }
      }),
      prisma.group.delete({ where: { id: req.params.id } })
    ]);

    await createAuditLog({
      userId: req.user.id,
      groupId: group.id,
      entityType: 'group',
      entityId: group.id,
      action: 'delete',
      beforeData: group
    });

    res.json({ message: 'Group deleted successfully.' });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({ error: 'Failed to delete group.' });
  }
});

module.exports = router;
