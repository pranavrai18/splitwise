# SCOPE.md — Anomaly Detection & Handling Policy

## CSV Analysis Summary

**Source File**: `Expenses Export.csv`
**Total Rows**: 43 data rows (Row 2–44)
**Anomalies Detected**: 22
**Critical**: 10 | **Medium**: 10 | **Low**: 2

---

## Anomaly Registry

### 🔴 Critical Anomalies (10)

| # | Row | Type | Description | Handling Policy |
|---|-----|------|-------------|----------------|
| 1 | 6 | Duplicate | "dinner - marina bites" duplicates Row 5 "Dinner at Marina Bites" (same date, payer, amount ₹3200) | **Merge**: Keep Row 5 (proper casing, has notes). Delete Row 6 upon user approval. |
| 2 | 13 | Missing Field | Empty `paid_by` for "House cleaning supplies" ₹780 | **Block**: Cannot import without payer. User must specify who paid. |
| 3 | 14 | Settlement Misclassified | "Rohan paid Aisha back" ₹5000, no split_type, notes say "this is a settlement not an expense??" | **Convert**: Create Settlement record (Rohan → Aisha ₹5000) instead of expense. |
| 4 | 15 | Percentage Error | Percentages sum to 110% (30+30+30+20) for "Pizza Friday" | **Flag**: Ask user to correct. Likely Meera should be 10%. |
| 5 | 24-25 | Duplicate | Row 24 "Dinner at Thalassa" ₹2400 by Aisha vs Row 25 "Thalassa dinner" ₹2450 by Rohan. Row 25 notes: "Aisha also logged this I think hers is wrong" | **Merge**: Keep Row 25 (₹2450 by Rohan as per note). Delete Row 24. |
| 6 | 27 | Invalid Date | `Mar-14` instead of `DD-MM-YYYY` format | **Fix**: Parse as `14-03-2026` (within Goa trip timeline). |
| 7 | 32 | Percentage Error | Same 110% sum issue as Row 15 (30+30+30+20) | **Flag**: Ask user to correct percentages. |
| 8 | 34 | Ambiguous Date | `04-05-2026` — could be April 5 or May 4 | **Assume**: DD-MM-YYYY → May 4th. But context (between March and April entries) suggests **April 5th** → `05-04-2026`. User must confirm. |
| 9 | 36 | Membership Violation | Meera included in April 2026 groceries split, but she left end of March | **Remove**: Remove Meera from participants, recalculate equal split among Aisha, Rohan, Priya. |
| 10 | 38 | Settlement Misclassified | "Sam deposit share" ₹15000 from Sam to Aisha | **Convert**: Create Settlement (Sam → Aisha ₹15000) or treat as deposit. |

### 🟡 Medium Anomalies (10)

| # | Row | Type | Description | Handling Policy |
|---|-----|------|-------------|----------------|
| 11 | 7 | Invalid Format | Comma in amount: `"1,200"` | **Clean**: Parse as `1200` after stripping comma. |
| 12 | 9 | Name Mismatch | `priya` (lowercase) should be `Priya` | **Normalize**: Auto-correct to `Priya`. |
| 13 | 10 | Floating Point | Amount `899.995` has sub-paisa precision | **Round**: Round to `900.00`. |
| 14 | 11 | Name Mismatch | `Priya S` is likely `Priya` | **Normalize**: Map to `Priya` (with approval). |
| 15 | 20,21,23 | Currency Issue | USD expenses ($540, $84, $150) without exchange rates | **Default**: Apply default rate ₹84.50/USD. User can override. |
| 16 | 23 | Non-Group Member | "Dev's friend Kabir" not a registered flatmate | **Create**: Add as temporary participant or ask user to absorb share into Dev. |
| 17 | 26 | Negative Amount | `-30 USD` parasailing refund | **Keep**: Valid refund. Store as negative expense (reduces balances). |
| 18 | 27 | Name Mismatch | `rohan ` (trailing space, lowercase) | **Normalize**: Trim and correct to `Rohan`. |
| 19 | 28 | Currency Missing | No currency set for "Groceries DMart" ₹2105 | **Default**: Set to INR (domestic grocery store). |
| 20 | 31 | Zero Amount | "Dinner order Swiggy" ₹0, notes: "counted twice earlier" | **Delete**: Skip this row — placeholder with no value. |

### 🟢 Low Anomalies (2)

| # | Row | Type | Description | Handling Policy |
|---|-----|------|-------------|----------------|
| 21 | 42 | Conflicting Metadata | split_type is "equal" but split_details has `1:1:1:1` ratios | **Ignore**: Equal shares = equal split. Discard redundant details. |
| 22 | 44 | Empty Row | Blank row at end of file | **Skip**: Ignore during parsing. |

---

## Membership Timeline

| Member | Join Date | Leave Date | Notes |
|--------|-----------|------------|-------|
| Aisha | 1 Jan 2026 | Active | Group admin |
| Rohan | 1 Jan 2026 | Active | |
| Priya | 1 Jan 2026 | Active | |
| Meera | 1 Jan 2026 | **31 Mar 2026** | Farewell dinner Row 33 (28 Mar) |
| Dev | 1 Jan 2026 | Active | Not a flatmate but joins trips |
| Sam | **8 Apr 2026** | Active | Deposit paid Row 38 |

### Timeline Rules Applied
- Sam is **excluded** from all expenses before 8 April 2026
- Meera is **excluded** from all expenses after 31 March 2026
- Row 36 (2 Apr groceries) incorrectly includes Meera → flagged and corrected

---

## Currency Handling

| Currency | Treatment |
|----------|-----------|
| INR | Base currency. Exchange rate = 1.0 |
| USD | Converted at rate specified during import (default: ₹92.32/USD) |

**USD Expenses in CSV**: Rows 20, 21, 23, 26 (total: $744 before refund)
