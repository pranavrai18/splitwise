/**
 * Split Calculator Service
 * Handles all split type calculations: equal, unequal, percentage, share/ratio
 */

/**
 * Calculate individual shares based on split type
 * 
 * @param {number} totalAmount - Total expense amount
 * @param {string} splitType - 'equal' | 'unequal' | 'percentage' | 'share'
 * @param {Array} participants - Array of participant objects
 * @param {object} splitDetails - Split-specific details (amounts, percentages, ratios)
 * @returns {Array} Array of { userId, shareAmount, sharePercentage?, shareUnits? }
 */
function calculateSplits(totalAmount, splitType, participants, splitDetails = {}) {
  switch (splitType) {
    case 'equal':
      return calculateEqualSplit(totalAmount, participants);
    case 'unequal':
      return calculateUnequalSplit(totalAmount, participants, splitDetails);
    case 'percentage':
      return calculatePercentageSplit(totalAmount, participants, splitDetails);
    case 'share':
      return calculateShareSplit(totalAmount, participants, splitDetails);
    default:
      throw new Error(`Unknown split type: ${splitType}`);
  }
}

/**
 * Equal split — divide evenly among all participants
 */
function calculateEqualSplit(totalAmount, participants) {
  const count = participants.length;
  if (count === 0) throw new Error('At least one participant required');

  const perPerson = Math.round((totalAmount / count) * 100) / 100;

  // Handle rounding — give the remainder to the first participant
  const remainder = Math.round((totalAmount - perPerson * count) * 100) / 100;

  return participants.map((p, index) => ({
    userId: p.userId,
    shareAmount: index === 0 ? perPerson + remainder : perPerson,
    sharePercentage: Math.round((100 / count) * 100) / 100
  }));
}

/**
 * Unequal split — exact amounts specified for each participant
 */
function calculateUnequalSplit(totalAmount, participants, splitDetails) {
  const { amounts } = splitDetails;
  if (!amounts || Object.keys(amounts).length === 0) {
    throw new Error('Amounts required for unequal split');
  }

  const totalShares = Object.values(amounts).reduce((sum, a) => sum + a, 0);
  if (Math.abs(totalShares - totalAmount) > 0.01) {
    throw new Error(`Share amounts (${totalShares}) don't match total (${totalAmount})`);
  }

  return participants.map(p => ({
    userId: p.userId,
    shareAmount: amounts[p.userId] || 0,
    sharePercentage: Math.round(((amounts[p.userId] || 0) / totalAmount) * 10000) / 100
  }));
}

/**
 * Percentage split — each participant has a percentage
 */
function calculatePercentageSplit(totalAmount, participants, splitDetails) {
  const { percentages } = splitDetails;
  if (!percentages || Object.keys(percentages).length === 0) {
    throw new Error('Percentages required for percentage split');
  }

  const totalPercentage = Object.values(percentages).reduce((sum, p) => sum + p, 0);
  if (Math.abs(totalPercentage - 100) > 0.01) {
    throw new Error(`Percentages must sum to 100% (got ${totalPercentage}%)`);
  }

  return participants.map(p => {
    const pct = percentages[p.userId] || 0;
    return {
      userId: p.userId,
      shareAmount: Math.round((totalAmount * pct / 100) * 100) / 100,
      sharePercentage: pct
    };
  });
}

/**
 * Share/ratio split — participants have different weights
 * e.g., Rohan 2 shares, Priya 1 share → Rohan pays 2/3, Priya pays 1/3
 */
function calculateShareSplit(totalAmount, participants, splitDetails) {
  const { shares } = splitDetails;
  if (!shares || Object.keys(shares).length === 0) {
    throw new Error('Share units required for share/ratio split');
  }

  const totalShares = Object.values(shares).reduce((sum, s) => sum + s, 0);
  if (totalShares === 0) throw new Error('Total shares cannot be zero');

  const perUnit = totalAmount / totalShares;

  return participants.map(p => {
    const units = shares[p.userId] || 0;
    return {
      userId: p.userId,
      shareAmount: Math.round((perUnit * units) * 100) / 100,
      shareUnits: units,
      sharePercentage: Math.round((units / totalShares) * 10000) / 100
    };
  });
}

/**
 * Parse split details from CSV format
 * e.g., "Rohan 700; Priya 400; Meera 400" → { Rohan: 700, Priya: 400, Meera: 400 }
 */
function parseSplitDetailsFromCSV(splitType, splitDetailsStr, participantNames) {
  if (!splitDetailsStr || splitDetailsStr.trim() === '') {
    return {};
  }

  const parts = splitDetailsStr.split(';').map(s => s.trim());
  const result = {};

  for (const part of parts) {
    // Match patterns like "Name 700" or "Name 30%" or "Name 2"
    const match = part.match(/^(.+?)\s+([\d.]+)(%?)$/);
    if (match) {
      const name = match[1].trim();
      const value = parseFloat(match[2]);
      result[name] = value;
    }
  }

  return result;
}

module.exports = {
  calculateSplits,
  calculateEqualSplit,
  calculateUnequalSplit,
  calculatePercentageSplit,
  calculateShareSplit,
  parseSplitDetailsFromCSV
};
