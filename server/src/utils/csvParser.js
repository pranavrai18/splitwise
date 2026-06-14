const { parse } = require('csv-parse/sync');

/**
 * CSV Parser Utility
 * Parses raw CSV content into structured rows.
 */

/**
 * Parse CSV string into array of row objects
 * @param {string} csvContent - Raw CSV string
 * @returns {{ rows: Array, headers: string[] }}
 */
function parseCSV(csvContent) {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    relax_quotes: true
  });

  // Get headers from first record
  const headers = records.length > 0 ? Object.keys(records[0]) : [];

  // Add original row numbers (1-indexed, +1 for header row)
  const rows = records.map((record, index) => ({
    rowNumber: index + 2, // +2 because row 1 is header
    ...record
  }));

  return { rows, headers };
}

/**
 * Clean a numeric amount string
 * Handles: "1,200" → 1200, "899.995" → 899.995, "" → null
 */
function cleanAmount(amountStr) {
  if (!amountStr || amountStr.trim() === '') return null;

  // Remove commas and quotes
  const cleaned = amountStr.replace(/[,"]/g, '').trim();
  const num = parseFloat(cleaned);

  return isNaN(num) ? null : num;
}

/**
 * Parse a date string in various formats
 * Handles: "01-02-2026", "Mar-14", "04-05-2026"
 * Returns { date: Date|null, ambiguous: boolean, originalFormat: string }
 */
function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') {
    return { date: null, ambiguous: false, originalFormat: 'empty' };
  }

  const trimmed = dateStr.trim();

  // Format: DD-MM-YYYY
  const ddmmyyyy = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (ddmmyyyy) {
    const day = parseInt(ddmmyyyy[1]);
    const month = parseInt(ddmmyyyy[2]);
    const year = parseInt(ddmmyyyy[3]);

    // Check if date could be ambiguous (day and month both <= 12)
    const ambiguous = day <= 12 && month <= 12 && day !== month;

    const date = new Date(year, month - 1, day);
    return { date, ambiguous, originalFormat: 'DD-MM-YYYY' };
  }

  // Format: Mon-DD (e.g., "Mar-14")
  const monDD = trimmed.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{1,2})$/i);
  if (monDD) {
    const monthNames = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    const month = monthNames[monDD[1].toLowerCase()];
    const day = parseInt(monDD[2]);
    // Assume year 2026 (from CSV context)
    const date = new Date(2026, month, day);
    return { date, ambiguous: false, originalFormat: 'Mon-DD' };
  }

  // Fallback: try native parsing
  const fallback = new Date(trimmed);
  if (!isNaN(fallback.getTime())) {
    return { date: fallback, ambiguous: true, originalFormat: 'unknown' };
  }

  return { date: null, ambiguous: false, originalFormat: 'invalid' };
}

/**
 * Normalize a user name
 * "priya" → "Priya", "Priya S" → "Priya S" (flagged), "rohan " → "Rohan"
 */
function normalizeName(name) {
  if (!name || name.trim() === '') return { normalized: '', issues: ['empty'] };

  const trimmed = name.trim();
  const issues = [];

  // Check for trailing/leading whitespace
  if (name !== trimmed) {
    issues.push('whitespace');
  }

  // Check for case issues (all lowercase or mixed)
  const properCase = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  if (trimmed !== properCase && !trimmed.includes(' ')) {
    issues.push('case_mismatch');
  }

  // Check for name variants (contains space — might be "Priya S")
  if (trimmed.includes(' ') && !trimmed.includes("'")) {
    issues.push('possible_variant');
  }

  return { normalized: trimmed.charAt(0).toUpperCase() + trimmed.slice(1), issues };
}

module.exports = { parseCSV, cleanAmount, parseDate, normalizeName };
