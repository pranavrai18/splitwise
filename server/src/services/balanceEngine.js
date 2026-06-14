const prisma = require('../utils/prisma');

/**
 * Balance Engine
 * Computes group balances and simplified debt settlements using graph minimization.
 */

/**
 * Compute raw balances for every user in a group.
 * balance = total_paid - total_owed
 * Positive = others owe you. Negative = you owe others.
 */
async function computeGroupBalances(groupId) {
  // Get all non-deleted expenses with participants
  const expenses = await prisma.expense.findMany({
    where: { groupId, isDeleted: false },
    include: {
      paidBy: { select: { id: true, name: true } },
      participants: {
        include: { user: { select: { id: true, name: true } } }
      }
    }
  });

  // Get all settlements
  const settlements = await prisma.settlement.findMany({
    where: { groupId },
    include: {
      fromUser: { select: { id: true, name: true } },
      toUser: { select: { id: true, name: true } }
    }
  });

  // Track per-user: totalPaid, totalOwed
  const balances = {}; // userId -> { userId, name, totalPaid, totalOwed, balance }

  // Helper to initialize user entry
  const ensureUser = (userId, name) => {
    if (!balances[userId]) {
      balances[userId] = { userId, name, totalPaid: 0, totalOwed: 0, balance: 0 };
    }
  };

  // Process expenses
  for (const expense of expenses) {
    const payerId = expense.paidById;
    const payerName = expense.paidBy.name;
    const baseAmount = parseFloat(expense.baseAmount);

    ensureUser(payerId, payerName);
    balances[payerId].totalPaid += baseAmount;

    for (const participant of expense.participants) {
      const shareAmount = parseFloat(participant.shareAmount);
      ensureUser(participant.userId, participant.user.name);
      balances[participant.userId].totalOwed += shareAmount;
    }
  }

  // Process settlements: from pays to → from's totalPaid increases, to's totalOwed increases
  for (const settlement of settlements) {
    const amount = parseFloat(settlement.baseAmount);
    ensureUser(settlement.fromUserId, settlement.fromUser.name);
    ensureUser(settlement.toUserId, settlement.toUser.name);

    balances[settlement.fromUserId].totalPaid += amount;
    balances[settlement.toUserId].totalOwed += amount;
  }

  // Calculate net balance
  for (const userId of Object.keys(balances)) {
    balances[userId].balance = Math.round((balances[userId].totalPaid - balances[userId].totalOwed) * 100) / 100;
    balances[userId].totalPaid = Math.round(balances[userId].totalPaid * 100) / 100;
    balances[userId].totalOwed = Math.round(balances[userId].totalOwed * 100) / 100;
  }

  return Object.values(balances);
}

/**
 * Simplified Debt Settlement — minimum number of transactions.
 * Uses greedy algorithm on creditors/debtors.
 * 
 * Input: array of { userId, name, balance }
 * Output: array of { from: {id, name}, to: {id, name}, amount }
 */
function simplifyDebts(balances) {
  // Separate into creditors (positive balance) and debtors (negative balance)
  const creditors = balances
    .filter(b => b.balance > 0.01) // owed money
    .map(b => ({ ...b, remaining: b.balance }))
    .sort((a, b) => b.remaining - a.remaining);

  const debtors = balances
    .filter(b => b.balance < -0.01) // owes money
    .map(b => ({ ...b, remaining: Math.abs(b.balance) }))
    .sort((a, b) => b.remaining - a.remaining);

  const transactions = [];

  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];
    const settleAmount = Math.min(creditor.remaining, debtor.remaining);

    if (settleAmount > 0.01) {
      transactions.push({
        from: { id: debtor.userId, name: debtor.name },
        to: { id: creditor.userId, name: creditor.name },
        amount: Math.round(settleAmount * 100) / 100
      });
    }

    creditor.remaining -= settleAmount;
    debtor.remaining -= settleAmount;

    if (creditor.remaining < 0.01) ci++;
    if (debtor.remaining < 0.01) di++;
  }

  return transactions;
}

/**
 * Get individual ledger — all expenses that contribute to a user's balance.
 * This is what Rohan wants: "Show me exactly which expenses make up my ₹2,300."
 */
async function getUserLedger(groupId, userId) {
  const expenses = await prisma.expense.findMany({
    where: {
      groupId,
      isDeleted: false,
      OR: [
        { paidById: userId },
        { participants: { some: { userId } } }
      ]
    },
    include: {
      paidBy: { select: { id: true, name: true } },
      participants: {
        include: { user: { select: { id: true, name: true } } }
      }
    },
    orderBy: { expenseDate: 'desc' }
  });

  const ledger = expenses.map(expense => {
    const baseAmount = parseFloat(expense.baseAmount);
    const myParticipation = expense.participants.find(p => p.userId === userId);
    const myShare = myParticipation ? parseFloat(myParticipation.shareAmount) : 0;

    let netEffect = 0;
    if (expense.paidById === userId) {
      // I paid — others owe me (total - my share)
      netEffect = baseAmount - myShare;
    } else if (myParticipation) {
      // Someone else paid, I owe my share
      netEffect = -myShare;
    }

    return {
      id: expense.id,
      description: expense.description,
      expenseDate: expense.expenseDate,
      amount: parseFloat(expense.amount),
      currency: expense.currency,
      baseAmount,
      paidBy: expense.paidBy,
      myShare,
      netEffect: Math.round(netEffect * 100) / 100,
      splitType: expense.splitType,
      participantCount: expense.participants.length
    };
  });

  // Also get settlements involving this user
  const settlements = await prisma.settlement.findMany({
    where: {
      groupId,
      OR: [
        { fromUserId: userId },
        { toUserId: userId }
      ]
    },
    include: {
      fromUser: { select: { id: true, name: true } },
      toUser: { select: { id: true, name: true } }
    },
    orderBy: { settledAt: 'desc' }
  });

  const settlementLedger = settlements.map(s => ({
    id: s.id,
    type: 'settlement',
    description: `Settlement: ${s.fromUser.name} → ${s.toUser.name}`,
    date: s.settledAt,
    amount: parseFloat(s.amount),
    currency: s.currency,
    baseAmount: parseFloat(s.baseAmount),
    netEffect: s.fromUserId === userId
      ? parseFloat(s.baseAmount)  // I paid someone, reduces my debt
      : -parseFloat(s.baseAmount) // Someone paid me
  }));

  return { expenses: ledger, settlements: settlementLedger };
}

/**
 * Get pairwise balances: how much does each user owe each other user
 */
async function getPairwiseBalances(groupId) {
  const expenses = await prisma.expense.findMany({
    where: { groupId, isDeleted: false },
    include: {
      paidBy: { select: { id: true, name: true } },
      participants: {
        include: { user: { select: { id: true, name: true } } }
      }
    }
  });

  // pairwise[A][B] = how much B owes A
  const pairwise = {};

  const ensure = (a, b) => {
    if (!pairwise[a]) pairwise[a] = {};
    if (!pairwise[a][b]) pairwise[a][b] = 0;
  };

  for (const expense of expenses) {
    const payerId = expense.paidById;

    for (const participant of expense.participants) {
      if (participant.userId !== payerId) {
        ensure(payerId, participant.userId);
        pairwise[payerId][participant.userId] += parseFloat(participant.shareAmount);
      }
    }
  }

  return pairwise;
}

module.exports = {
  computeGroupBalances,
  simplifyDebts,
  getUserLedger,
  getPairwiseBalances
};
