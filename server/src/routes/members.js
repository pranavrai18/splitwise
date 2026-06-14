const express = require('express');
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');
const { createAuditLog } = require('../middleware/audit');

const router = express.Router();

/**
 * GET /api/groups/:id/members
 * List all members of a group with their timeline
 */
router.get('/:id/members', authenticate, async (req, res) => {
  try {
    const memberships = await prisma.membership.findMany({
      where: { groupId: req.params.id },
      include: {
        user: { select: { id: true, name: true, email: true } }
      },
      orderBy: { joinDate: 'asc' }
    });

    const members = memberships.map(m => ({
      id: m.id,
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      joinDate: m.joinDate,
      leaveDate: m.leaveDate,
      isActive: !m.leaveDate || new Date(m.leaveDate) >= new Date()
    }));

    res.json(members);
  } catch (error) {
    console.error('List members error:', error);
    res.status(500).json({ error: 'Failed to fetch members.' });
  }
});

/**
 * POST /api/groups/:id/members
 * Add a member to the group
 */
router.post('/:id/members', authenticate, async (req, res) => {
  try {
    const { userId, email, joinDate, role = 'member' } = req.body;

    let targetUserId = userId;

    // If email provided instead of userId, look up user
    if (!targetUserId && email) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(404).json({ error: 'User not found with that email.' });
      }
      targetUserId = user.id;
    }

    if (!targetUserId) {
      return res.status(400).json({ error: 'userId or email is required.' });
    }

    // Check if already an active member
    const existing = await prisma.membership.findFirst({
      where: {
        userId: targetUserId,
        groupId: req.params.id,
        leaveDate: null
      }
    });

    if (existing) {
      return res.status(409).json({ error: 'User is already an active member of this group.' });
    }

    const membership = await prisma.membership.create({
      data: {
        userId: targetUserId,
        groupId: req.params.id,
        role,
        joinDate: joinDate ? new Date(joinDate) : new Date()
      },
      include: {
        user: { select: { id: true, name: true, email: true } }
      }
    });

    await createAuditLog({
      userId: req.user.id,
      groupId: req.params.id,
      entityType: 'membership',
      entityId: membership.id,
      action: 'create',
      afterData: membership
    });

    res.status(201).json(membership);
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ error: 'Failed to add member.' });
  }
});

/**
 * PUT /api/groups/:id/members/:memberId
 * Update membership (e.g., set leave date)
 */
router.put('/:id/members/:memberId', authenticate, async (req, res) => {
  try {
    const { leaveDate, role } = req.body;

    const existing = await prisma.membership.findUnique({
      where: { id: req.params.memberId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Membership not found.' });
    }

    const updated = await prisma.membership.update({
      where: { id: req.params.memberId },
      data: {
        ...(leaveDate !== undefined && { leaveDate: leaveDate ? new Date(leaveDate) : null }),
        ...(role && { role })
      },
      include: {
        user: { select: { id: true, name: true, email: true } }
      }
    });

    await createAuditLog({
      userId: req.user.id,
      groupId: req.params.id,
      entityType: 'membership',
      entityId: updated.id,
      action: 'update',
      beforeData: existing,
      afterData: updated
    });

    res.json(updated);
  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({ error: 'Failed to update membership.' });
  }
});

module.exports = router;
