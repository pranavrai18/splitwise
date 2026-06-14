const { cleanAmount, parseDate, normalizeName } = require('./csvParser');

/**
 * Anomaly Detection Pipeline
 * Runs 9 detectors against parsed CSV rows to find every issue.
 */

const KNOWN_MEMBERS = ['Aisha', 'Rohan', 'Priya', 'Meera', 'Dev', 'Sam'];

/**
 * Run all anomaly detectors on parsed CSV rows
 * @param {Array} rows - Parsed CSV rows
 * @param {object} options - { knownMembers, memberTimelines }
 * @returns {Array} Array of anomaly objects
 */
function detectAnomalies(rows, options = {}) {
  const knownMembers = options.knownMembers || KNOWN_MEMBERS;
  const anomalies = [];

  // Run all detectors
  anomalies.push(...detectNameMismatches(rows, knownMembers));
  anomalies.push(...detectDateIssues(rows));
  anomalies.push(...detectAmountIssues(rows));
  anomalies.push(...detectCurrencyIssues(rows));
  anomalies.push(...detectSplitErrors(rows));
  anomalies.push(...detectDuplicates(rows));
  anomalies.push(...detectSettlements(rows));
  anomalies.push(...detectMembershipViolations(rows, options.memberTimelines || {}));
  anomalies.push(...detectNonGroupMembers(rows, knownMembers));

  // Sort by row number, then severity
  const severityOrder = { critical: 0, medium: 1, low: 2 };
  anomalies.sort((a, b) => {
    if (a.rowNumber !== b.rowNumber) return a.rowNumber - b.rowNumber;
    return (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99);
  });

  return anomalies;
}

/**
 * 1. Name Normalizer — detect case mismatches, trailing spaces, name variants
 */
function detectNameMismatches(rows, knownMembers) {
  const anomalies = [];
  const lowerMap = {};
  knownMembers.forEach(n => { lowerMap[n.toLowerCase().trim()] = n; });

  for (const row of rows) {
    // Check paid_by
    if (row.paid_by) {
      const { normalized, issues } = normalizeName(row.paid_by);
      const matchKey = normalized.toLowerCase().replace(/\s+\S$/,''); // strip trailing initial

      if (issues.includes('whitespace') || issues.includes('case_mismatch')) {
        const bestMatch = lowerMap[row.paid_by.trim().toLowerCase()] || lowerMap[matchKey];
        anomalies.push({
          rowNumber: row.rowNumber,
          type: 'name_mismatch',
          severity: 'medium',
          description: `Payer "${row.paid_by}" should be "${bestMatch || normalized}"`,
          suggestedAction: `Normalize to "${bestMatch || normalized}"`,
          originalData: { paid_by: row.paid_by },
          correctedData: { paid_by: bestMatch || normalized }
        });
      }

      if (issues.includes('possible_variant')) {
        // Check if it looks like "Priya S" → "Priya"
        const firstName = normalized.split(' ')[0];
        if (lowerMap[firstName.toLowerCase()]) {
          anomalies.push({
            rowNumber: row.rowNumber,
            type: 'name_mismatch',
            severity: 'medium',
            description: `Payer "${row.paid_by}" may be a variant of "${lowerMap[firstName.toLowerCase()]}"`,
            suggestedAction: `Normalize to "${lowerMap[firstName.toLowerCase()]}"`,
            originalData: { paid_by: row.paid_by },
            correctedData: { paid_by: lowerMap[firstName.toLowerCase()] }
          });
        }
      }
    } else {
      // Missing payer
      anomalies.push({
        rowNumber: row.rowNumber,
        type: 'missing_field',
        severity: 'critical',
        description: `Missing payer for "${row.description}" (₹${row.amount})`,
        suggestedAction: 'Flag for user input — cannot determine who paid',
        originalData: row,
        correctedData: null
      });
    }
  }

  return anomalies;
}

/**
 * 2. Date Validator — invalid formats, ambiguous dates
 */
function detectDateIssues(rows) {
  const anomalies = [];

  for (const row of rows) {
    const { date, ambiguous, originalFormat } = parseDate(row.date);

    if (!date) {
      anomalies.push({
        rowNumber: row.rowNumber,
        type: 'invalid_format',
        severity: 'critical',
        description: `Invalid date format: "${row.date}"`,
        suggestedAction: 'Correct date manually',
        originalData: { date: row.date },
        correctedData: null
      });
    } else if (originalFormat === 'Mon-DD') {
      anomalies.push({
        rowNumber: row.rowNumber,
        type: 'invalid_format',
        severity: 'critical',
        description: `Non-standard date format: "${row.date}" — interpreted as ${date.toISOString().split('T')[0]}`,
        suggestedAction: `Convert to standard format: ${date.getDate().toString().padStart(2,'0')}-${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getFullYear()}`,
        originalData: { date: row.date },
        correctedData: { date: date.toISOString().split('T')[0] }
      });
    } else if (ambiguous) {
      // Day ≤ 12 and month ≤ 12 — could be DD-MM or MM-DD
      const day = date.getDate();
      const month = date.getMonth() + 1;
      if (day <= 12 && month <= 12 && day !== month) {
        anomalies.push({
          rowNumber: row.rowNumber,
          type: 'date_ambiguous',
          severity: 'critical',
          description: `Ambiguous date: "${row.date}" — is this ${day}/${month} or ${month}/${day}?`,
          suggestedAction: `Assuming DD-MM-YYYY format: ${date.toISOString().split('T')[0]}. Please confirm.`,
          originalData: { date: row.date },
          correctedData: { date: date.toISOString().split('T')[0] }
        });
      }
    }
  }

  return anomalies;
}

/**
 * 3. Amount Validator — commas, zero, negatives, floating point precision
 */
function detectAmountIssues(rows) {
  const anomalies = [];

  for (const row of rows) {
    const rawAmount = row.amount;
    const cleaned = cleanAmount(rawAmount);

    // Comma in number
    if (rawAmount && rawAmount.includes(',')) {
      anomalies.push({
        rowNumber: row.rowNumber,
        type: 'invalid_format',
        severity: 'medium',
        description: `Amount contains comma: "${rawAmount}" — parsed as ${cleaned}`,
        suggestedAction: `Clean to ${cleaned}`,
        originalData: { amount: rawAmount },
        correctedData: { amount: cleaned }
      });
    }

    // Zero amount
    if (cleaned === 0) {
      anomalies.push({
        rowNumber: row.rowNumber,
        type: 'zero_amount',
        severity: 'medium',
        description: `Zero amount for "${row.description}". ${row.notes || ''}`,
        suggestedAction: 'Flag for deletion — placeholder entry with no value',
        originalData: row,
        correctedData: null
      });
    }

    // Negative amount
    if (cleaned !== null && cleaned < 0) {
      anomalies.push({
        rowNumber: row.rowNumber,
        type: 'negative_amount',
        severity: 'medium',
        description: `Negative amount: ${cleaned} for "${row.description}" — likely a refund`,
        suggestedAction: 'Keep as refund (negative expense reduces balances)',
        originalData: { amount: rawAmount },
        correctedData: { amount: cleaned }
      });
    }

    // Floating point precision (more than 2 decimal places)
    if (cleaned !== null && cleaned.toString().includes('.')) {
      const decimals = cleaned.toString().split('.')[1];
      if (decimals && decimals.length > 2) {
        const rounded = Math.round(cleaned * 100) / 100;
        anomalies.push({
          rowNumber: row.rowNumber,
          type: 'floating_point',
          severity: 'medium',
          description: `Amount ${cleaned} has excessive precision — rounded to ${rounded}`,
          suggestedAction: `Round to ${rounded}`,
          originalData: { amount: cleaned },
          correctedData: { amount: rounded }
        });
      }
    }

    // Missing / null amount
    if (cleaned === null && rawAmount !== undefined) {
      anomalies.push({
        rowNumber: row.rowNumber,
        type: 'missing_field',
        severity: 'critical',
        description: `Invalid or missing amount: "${rawAmount}"`,
        suggestedAction: 'Flag for user input',
        originalData: { amount: rawAmount },
        correctedData: null
      });
    }
  }

  return anomalies;
}

/**
 * 4. Currency Validator — missing currencies, USD without exchange rate
 */
function detectCurrencyIssues(rows) {
  const anomalies = [];

  for (const row of rows) {
    const currency = (row.currency || '').trim();

    if (!currency) {
      anomalies.push({
        rowNumber: row.rowNumber,
        type: 'currency_missing',
        severity: 'medium',
        description: `Missing currency for "${row.description}"`,
        suggestedAction: 'Default to INR',
        originalData: { currency: row.currency },
        correctedData: { currency: 'INR' }
      });
    } else if (currency.toUpperCase() === 'USD') {
      anomalies.push({
        rowNumber: row.rowNumber,
        type: 'currency_missing',
        severity: 'medium',
        description: `USD expense "${row.description}" ($${row.amount}) — no exchange rate recorded. Will use default rate.`,
        suggestedAction: `Convert using default rate (₹${process.env.DEFAULT_USD_TO_INR_RATE || 84.50}/USD)`,
        originalData: { currency: 'USD', amount: row.amount },
        correctedData: { currency: 'USD', exchangeRate: parseFloat(process.env.DEFAULT_USD_TO_INR_RATE || 84.50) }
      });
    }
  }

  return anomalies;
}

/**
 * 5. Split Validator — percentages that don't sum to 100%, conflicting metadata
 */
function detectSplitErrors(rows) {
  const anomalies = [];

  for (const row of rows) {
    const splitType = (row.split_type || '').trim().toLowerCase();
    const splitDetails = (row.split_details || '').trim();

    if (splitType === 'percentage' && splitDetails) {
      // Parse percentages: "Aisha 30%; Rohan 30%; Priya 30%; Meera 20%"
      const parts = splitDetails.split(';').map(s => s.trim());
      let totalPct = 0;
      for (const part of parts) {
        const match = part.match(/([\d.]+)%?$/);
        if (match) totalPct += parseFloat(match[1]);
      }

      if (Math.abs(totalPct - 100) > 0.01) {
        anomalies.push({
          rowNumber: row.rowNumber,
          type: 'percentage_error',
          severity: 'critical',
          description: `Percentages sum to ${totalPct}% (should be 100%) for "${row.description}"`,
          suggestedAction: `Adjust percentages to sum to 100%`,
          originalData: { split_details: splitDetails, totalPercentage: totalPct },
          correctedData: null
        });
      }
    }

    // Check for conflicting metadata (split_type says equal but details provided)
    if (splitType === 'equal' && splitDetails) {
      // Check if the details actually represent equal splits
      const parts = splitDetails.split(';').map(s => s.trim());
      const values = parts.map(p => {
        const match = p.match(/([\d.]+)$/);
        return match ? parseFloat(match[1]) : null;
      }).filter(v => v !== null);

      const allEqual = values.every(v => v === values[0]);
      if (!allEqual) {
        anomalies.push({
          rowNumber: row.rowNumber,
          type: 'conflicting_metadata',
          severity: 'medium',
          description: `split_type is "equal" but split_details has unequal values: "${splitDetails}"`,
          suggestedAction: 'Resolve conflict — use equal split or change to share/unequal',
          originalData: { split_type: splitType, split_details: splitDetails },
          correctedData: null
        });
      } else if (allEqual) {
        anomalies.push({
          rowNumber: row.rowNumber,
          type: 'conflicting_metadata',
          severity: 'low',
          description: `split_type is "equal" with redundant equal share details: "${splitDetails}"`,
          suggestedAction: 'Keep as equal split, ignore redundant details',
          originalData: { split_type: splitType, split_details: splitDetails },
          correctedData: { split_type: 'equal' }
        });
      }
    }

    // Unequal split — verify amounts sum to total
    if (splitType === 'unequal' && splitDetails) {
      const amount = cleanAmountLocal(row.amount);
      const parts = splitDetails.split(';').map(s => s.trim());
      let totalShares = 0;
      for (const part of parts) {
        const match = part.match(/([\d.]+)$/);
        if (match) totalShares += parseFloat(match[1]);
      }

      if (amount !== null && Math.abs(totalShares - amount) > 0.01) {
        anomalies.push({
          rowNumber: row.rowNumber,
          type: 'math_error',
          severity: 'critical',
          description: `Unequal split amounts sum to ${totalShares} but expense total is ${amount}`,
          suggestedAction: 'Adjust split amounts to match total',
          originalData: { amount, split_details: splitDetails, splitTotal: totalShares },
          correctedData: null
        });
      }
    }
  }

  return anomalies;
}

// Local helper (avoid circular import)
function cleanAmountLocal(amountStr) {
  if (!amountStr || amountStr.toString().trim() === '') return null;
  const cleaned = amountStr.toString().replace(/[,"]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * 6. Duplicate Detector — fuzzy match on date, amount, description similarity
 */
function detectDuplicates(rows) {
  const anomalies = [];
  const seen = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const amount = cleanAmountLocal(row.amount);
    const date = row.date;
    const desc = (row.description || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

    for (const prev of seen) {
      // Same date and same amount
      if (prev.date === date && prev.amount === amount && amount !== null && amount !== 0) {
        // Check description similarity
        const similarity = calculateSimilarity(desc, prev.desc);

        if (similarity > 0.5) {
          anomalies.push({
            rowNumber: row.rowNumber,
            type: 'duplicate',
            severity: 'critical',
            description: `Probable duplicate of Row ${prev.rowNumber}: "${prev.originalDesc}" ↔ "${row.description}" (same date, same amount ₹${amount}, ${Math.round(similarity * 100)}% similar)`,
            suggestedAction: `Merge: keep Row ${prev.rowNumber}${prev.notes ? ' (has notes)' : ''}, remove Row ${row.rowNumber}`,
            originalData: { thisRow: row, duplicateOfRow: prev.rowNumber },
            correctedData: { action: 'merge', keepRow: prev.rowNumber, removeRow: row.rowNumber }
          });
        }
      }
    }

    seen.push({
      rowNumber: row.rowNumber,
      date,
      amount,
      desc,
      originalDesc: row.description,
      notes: row.notes
    });
  }

  return anomalies;
}

/**
 * Simple string similarity (Jaccard on words)
 */
function calculateSimilarity(a, b) {
  const wordsA = new Set(a.split(/\s+/));
  const wordsB = new Set(b.split(/\s+/));

  const intersection = [...wordsA].filter(w => wordsB.has(w));
  const union = new Set([...wordsA, ...wordsB]);

  return union.size === 0 ? 0 : intersection.length / union.size;
}

/**
 * 7. Settlement Detector — detect payments logged as expenses
 */
function detectSettlements(rows) {
  const anomalies = [];

  const settlementKeywords = ['paid back', 'settled', 'settlement', 'deposit', 'repaid', 'transfer'];

  for (const row of rows) {
    const desc = (row.description || '').toLowerCase();
    const notes = (row.notes || '').toLowerCase();
    const splitType = (row.split_type || '').trim();
    const splitWith = (row.split_with || '').trim();

    // Check for settlement keywords in description or notes
    const isSettlement = settlementKeywords.some(kw => desc.includes(kw) || notes.includes(kw));

    // Check for no split type and only one recipient
    const participantCount = splitWith ? splitWith.split(';').length : 0;
    const hasNoSplitType = !splitType || splitType === '';

    // Check for notes mentioning "settlement"
    const notesHintSettlement = notes.includes('settlement') || notes.includes('not an expense');

    if (isSettlement || (hasNoSplitType && participantCount === 1) || notesHintSettlement) {
      const participants = splitWith.split(';').map(s => s.trim()).filter(Boolean);
      anomalies.push({
        rowNumber: row.rowNumber,
        type: 'settlement_misclassified',
        severity: 'critical',
        description: `Likely a settlement, not an expense: "${row.description}" — ${row.paid_by} → ${participants.join(', ')} ₹${row.amount}`,
        suggestedAction: `Convert to settlement: ${row.paid_by} pays ${participants[0] || '?'} ₹${row.amount}`,
        originalData: row,
        correctedData: {
          type: 'settlement',
          fromUser: row.paid_by,
          toUser: participants[0] || null,
          amount: cleanAmountLocal(row.amount)
        }
      });
    }
  }

  return anomalies;
}

/**
 * 8. Membership Validator — check participants against active memberships on expense date
 */
function detectMembershipViolations(rows, memberTimelines) {
  const anomalies = [];

  // Default timelines based on CSV analysis
  const timelines = {
    'Aisha': { joinDate: new Date('2026-01-01'), leaveDate: null },
    'Rohan': { joinDate: new Date('2026-01-01'), leaveDate: null },
    'Priya': { joinDate: new Date('2026-01-01'), leaveDate: null },
    'Meera': { joinDate: new Date('2026-01-01'), leaveDate: new Date('2026-03-31') },
    'Dev':   { joinDate: new Date('2026-01-01'), leaveDate: null },
    'Sam':   { joinDate: new Date('2026-04-08'), leaveDate: null },
    ...memberTimelines
  };

  for (const row of rows) {
    const { date: expenseDate } = parseDate(row.date);
    if (!expenseDate) continue;

    const participants = (row.split_with || '').split(';').map(s => s.trim()).filter(Boolean);

    for (const participant of participants) {
      // Normalize participant name for lookup
      const normalizedName = participant.charAt(0).toUpperCase() + participant.slice(1).toLowerCase();
      const timeline = timelines[normalizedName] || timelines[participant];

      if (timeline) {
        const joinDate = new Date(timeline.joinDate);
        const leaveDate = timeline.leaveDate ? new Date(timeline.leaveDate) : null;

        // Check if member was active on expense date
        if (expenseDate < joinDate) {
          anomalies.push({
            rowNumber: row.rowNumber,
            type: 'membership_violation',
            severity: 'critical',
            description: `${participant} was not yet a member on ${row.date} (joined ${joinDate.toISOString().split('T')[0]})`,
            suggestedAction: `Remove ${participant} from split and recalculate`,
            originalData: { participant, expenseDate: row.date, joinDate: joinDate.toISOString().split('T')[0] },
            correctedData: { removeParticipant: participant }
          });
        }

        if (leaveDate && expenseDate > leaveDate) {
          anomalies.push({
            rowNumber: row.rowNumber,
            type: 'membership_violation',
            severity: 'critical',
            description: `${participant} had already left by ${row.date} (left ${leaveDate.toISOString().split('T')[0]})`,
            suggestedAction: `Remove ${participant} from split and recalculate`,
            originalData: { participant, expenseDate: row.date, leaveDate: leaveDate.toISOString().split('T')[0] },
            correctedData: { removeParticipant: participant }
          });
        }
      }
    }
  }

  return anomalies;
}

/**
 * 9. Non-Group Member Detector — participants not in known member list
 */
function detectNonGroupMembers(rows, knownMembers) {
  const anomalies = [];
  const lowerMembers = new Set(knownMembers.map(m => m.toLowerCase()));

  for (const row of rows) {
    const participants = (row.split_with || '').split(';').map(s => s.trim()).filter(Boolean);

    for (const participant of participants) {
      const normalized = participant.toLowerCase().replace(/\s+\S$/, ''); // strip trailing initial

      if (!lowerMembers.has(participant.toLowerCase()) && !lowerMembers.has(normalized)) {
        anomalies.push({
          rowNumber: row.rowNumber,
          type: 'non_group_member',
          severity: 'medium',
          description: `"${participant}" is not a recognized group member`,
          suggestedAction: `Create as temporary participant or absorb share into another member`,
          originalData: { participant, description: row.description },
          correctedData: null
        });
      }
    }
  }

  return anomalies;
}

module.exports = {
  detectAnomalies,
  detectNameMismatches,
  detectDateIssues,
  detectAmountIssues,
  detectCurrencyIssues,
  detectSplitErrors,
  detectDuplicates,
  detectSettlements,
  detectMembershipViolations,
  detectNonGroupMembers
};
