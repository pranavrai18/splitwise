const prisma = require('../utils/prisma');
const { parseCSV, cleanAmount, parseDate } = require('../utils/csvParser');
const { detectAnomalies } = require('../utils/anomalyDetector');
const { calculateSplits, parseSplitDetailsFromCSV } = require('./splitCalculator');

/**
 * Import Engine
 * Handles the complete CSV import workflow:
 * 1. Upload → 2. Parse → 3. Validate → 4. Detect anomalies →
 * 5. Review → 6. User approval → 7. Commit
 */

/**
 * Process a CSV import: parse, validate, detect anomalies
 * Returns import record with anomalies for user review
 */
async function processImport(importId, csvContent, groupId, uploadedById) {
  try {
    // Step 2: Parse CSV
    const { rows, headers } = parseCSV(csvContent);

    // Update import with parsed data
    await prisma.import.update({
      where: { id: importId },
      data: {
        totalRows: rows.length,
        rawData: rows,
        status: 'validating'
      }
    });

    // Step 3 & 4: Validate and detect anomalies
    const anomalies = detectAnomalies(rows);

    // Step 5: Store anomalies for review
    if (anomalies.length > 0) {
      await prisma.importAnomaly.createMany({
        data: anomalies.map(a => ({
          importId,
          rowNumber: a.rowNumber,
          type: a.type,
          severity: a.severity,
          description: a.description,
          suggestedAction: a.suggestedAction,
          originalData: a.originalData || {},
          correctedData: a.correctedData || null
        }))
      });
    }

    // Update import status
    await prisma.import.update({
      where: { id: importId },
      data: {
        status: 'reviewing',
        anomalyCount: anomalies.length,
        processedRows: rows.length
      }
    });

    return { rowCount: rows.length, anomalyCount: anomalies.length };
  } catch (error) {
    await prisma.import.update({
      where: { id: importId },
      data: { status: 'failed' }
    });
    throw error;
  }
}

/**
 * Commit an approved import — create expenses and settlements
 * Only processes rows that aren't flagged for rejection
 */
async function commitImport(importId, groupId, userId) {
  const importRecord = await prisma.import.findUnique({
    where: { id: importId },
    include: { anomalies: true }
  });

  if (!importRecord) throw new Error('Import not found');
  if (importRecord.status === 'committed') throw new Error('Import already committed');

  const rows = importRecord.rawData;
  const anomalies = importRecord.anomalies;

  // Build sets of rows to skip / convert / merge
  const skipRows = new Set();
  const convertToSettlement = new Set();
  const mergeTargets = new Map(); // rowNumber → keepRowNumber

  for (const anomaly of anomalies) {
    const decision = anomaly.userDecision || 'accept';

    if (decision === 'reject') {
      skipRows.add(anomaly.rowNumber);
    } else if (decision === 'accept' || decision === 'convert') {
      if (anomaly.type === 'settlement_misclassified') {
        convertToSettlement.add(anomaly.rowNumber);
        skipRows.add(anomaly.rowNumber); // Don't process as expense
      }
      if (anomaly.type === 'duplicate' && anomaly.correctedData?.removeRow) {
        skipRows.add(anomaly.correctedData.removeRow);
      }
      if (anomaly.type === 'zero_amount') {
        skipRows.add(anomaly.rowNumber);
      }
    } else if (decision === 'ignore') {
      // Keep as-is
    }
  }

  // Get anomaly corrections indexed by row
  const corrections = {};
  for (const anomaly of anomalies) {
    if (anomaly.userDecision === 'accept' && anomaly.correctedData) {
      if (!corrections[anomaly.rowNumber]) corrections[anomaly.rowNumber] = {};
      Object.assign(corrections[anomaly.rowNumber], anomaly.correctedData);
    }
  }

  // Get group members for name → userId mapping
  const memberships = await prisma.membership.findMany({
    where: { groupId },
    include: { user: { select: { id: true, name: true } } }
  });

  const nameToUserId = {};
  for (const m of memberships) {
    nameToUserId[m.user.name.toLowerCase()] = m.user.id;
  }

  const createdExpenses = [];
  const createdSettlements = [];
  const errors = [];

  // Process in transaction
  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      if (skipRows.has(row.rowNumber)) continue;

      try {
        // Apply corrections
        const corrected = { ...row, ...(corrections[row.rowNumber] || {}) };

        // Resolve payer
        const payerName = (corrected.paid_by || '').trim();
        const payerId = nameToUserId[payerName.toLowerCase()];

        if (!payerId) {
          errors.push({ rowNumber: row.rowNumber, error: `Unknown payer: ${payerName}` });
          continue;
        }

        // Parse amount
        const amount = cleanAmount(String(corrected.amount));
        if (amount === null || amount === 0) {
          errors.push({ rowNumber: row.rowNumber, error: `Invalid amount: ${corrected.amount}` });
          continue;
        }

        // Parse date
        const { date: expenseDate } = parseDate(corrected.date);
        if (!expenseDate) {
          errors.push({ rowNumber: row.rowNumber, error: `Invalid date: ${corrected.date}` });
          continue;
        }

        // Handle settlement conversion
        if (convertToSettlement.has(row.rowNumber)) {
          const toNames = (corrected.split_with || '').split(';').map(s => s.trim()).filter(Boolean);
          const toUserId = toNames.length > 0 ? nameToUserId[toNames[0].toLowerCase()] : null;

          if (toUserId) {
            const currency = (corrected.currency || 'INR').toUpperCase();
            const exchangeRate = currency === 'USD' ? parseFloat(process.env.DEFAULT_USD_TO_INR_RATE || 84.5) : 1;

            const settlement = await tx.settlement.create({
              data: {
                groupId,
                fromUserId: payerId,
                toUserId,
                amount: Math.abs(amount),
                currency,
                exchangeRate,
                baseAmount: Math.abs(amount) * exchangeRate,
                notes: corrected.notes || corrected.description,
                importId,
                settledAt: expenseDate
              }
            });
            createdSettlements.push(settlement);
          }
          continue;
        }

        // Regular expense
        const currency = (corrected.currency || 'INR').toUpperCase().trim();
        const exchangeRate = currency === 'USD'
          ? (corrected.exchangeRate || parseFloat(process.env.DEFAULT_USD_TO_INR_RATE || 84.5))
          : 1;
        const baseAmount = Math.abs(amount) * exchangeRate;

        // Parse participants
        const participantNames = (corrected.split_with || '').split(';').map(s => s.trim()).filter(Boolean);
        const participants = participantNames
          .map(name => {
            const uid = nameToUserId[name.toLowerCase()];
            return uid ? { userId: uid, name } : null;
          })
          .filter(Boolean);

        if (participants.length === 0) {
          errors.push({ rowNumber: row.rowNumber, error: 'No valid participants found' });
          continue;
        }

        // Determine split type and calculate splits
        const splitType = (corrected.split_type || 'equal').toLowerCase().trim();
        let splitDetails = {};

        if (splitType !== 'equal' && corrected.split_details) {
          const parsedDetails = parseSplitDetailsFromCSV(splitType, corrected.split_details, participantNames);

          if (splitType === 'unequal') {
            const amounts = {};
            for (const [name, val] of Object.entries(parsedDetails)) {
              const uid = nameToUserId[name.toLowerCase()];
              if (uid) amounts[uid] = val;
            }
            splitDetails = { amounts };
          } else if (splitType === 'percentage') {
            const percentages = {};
            for (const [name, val] of Object.entries(parsedDetails)) {
              const uid = nameToUserId[name.toLowerCase()];
              if (uid) percentages[uid] = val;
            }
            splitDetails = { percentages };
          } else if (splitType === 'share') {
            const shares = {};
            for (const [name, val] of Object.entries(parsedDetails)) {
              const uid = nameToUserId[name.toLowerCase()];
              if (uid) shares[uid] = val;
            }
            splitDetails = { shares };
          }
        }

        let splits;
        try {
          splits = calculateSplits(baseAmount, splitType, participants, splitDetails);
        } catch (splitError) {
          // Fall back to equal split on calculation error
          splits = participants.map(p => ({
            userId: p.userId,
            shareAmount: Math.round((baseAmount / participants.length) * 100) / 100
          }));
        }

        // Create expense
        const expense = await tx.expense.create({
          data: {
            groupId,
            paidById: payerId,
            amount: Math.abs(amount),
            currency,
            exchangeRate,
            baseAmount,
            description: corrected.description || 'Imported expense',
            expenseDate,
            splitType,
            notes: corrected.notes || null,
            importId
          }
        });

        // Create participants
        await tx.expenseParticipant.createMany({
          data: splits.map(s => ({
            expenseId: expense.id,
            userId: s.userId,
            shareAmount: s.shareAmount,
            sharePercentage: s.sharePercentage || null,
            shareUnits: s.shareUnits || null
          }))
        });

        createdExpenses.push(expense);
      } catch (rowError) {
        errors.push({ rowNumber: row.rowNumber, error: rowError.message });
      }
    }
  }, {
    maxWait: 15000,
    timeout: 60000
  });

  // Update import status
  await prisma.import.update({
    where: { id: importId },
    data: {
      status: 'committed',
      processedRows: createdExpenses.length + createdSettlements.length
    }
  });

  return {
    expensesCreated: createdExpenses.length,
    settlementsCreated: createdSettlements.length,
    errors,
    total: rows.length,
    skipped: skipRows.size
  };
}

module.exports = { processImport, commitImport };
