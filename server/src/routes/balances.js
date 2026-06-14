const express = require('express');
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');
const { computeGroupBalances, simplifyDebts, getUserLedger } = require('../services/balanceEngine');

const router = express.Router();

/**
 * GET /api/groups/:id/balances
 * Get full balance breakdown for all members
 */
router.get('/:id/balances', authenticate, async (req, res) => {
  try {
    const balances = await computeGroupBalances(req.params.id);
    const group = await prisma.group.findUnique({
      where: { id: req.params.id },
      select: { baseCurrency: true }
    });

    res.json({
      groupId: req.params.id,
      baseCurrency: group?.baseCurrency || 'INR',
      balances
    });
  } catch (error) {
    console.error('Get balances error:', error);
    res.status(500).json({ error: 'Failed to compute balances.' });
  }
});

/**
 * GET /api/groups/:id/balances/simplified
 * Get simplified debt settlements (minimum transactions)
 * This is what Aisha wants: "Who pays whom, how much, done."
 */
router.get('/:id/balances/simplified', authenticate, async (req, res) => {
  try {
    const balances = await computeGroupBalances(req.params.id);
    const settlements = simplifyDebts(balances);
    const group = await prisma.group.findUnique({
      where: { id: req.params.id },
      select: { baseCurrency: true }
    });

    res.json({
      groupId: req.params.id,
      baseCurrency: group?.baseCurrency || 'INR',
      settlements,
      totalTransactions: settlements.length
    });
  } catch (error) {
    console.error('Get simplified balances error:', error);
    res.status(500).json({ error: 'Failed to compute simplified debts.' });
  }
});

/**
 * GET /api/groups/:id/balances/:userId/ledger
 * Get detailed ledger for a specific user (Rohan's requirement)
 * Shows every expense contributing to their balance
 */
router.get('/:id/balances/:userId/ledger', authenticate, async (req, res) => {
  try {
    const ledger = await getUserLedger(req.params.id, req.params.userId);
    res.json(ledger);
  } catch (error) {
    console.error('Get user ledger error:', error);
    res.status(500).json({ error: 'Failed to fetch user ledger.' });
  }
});

module.exports = router;
