# DECISIONS.md — Architectural Decisions Record

## Decision 1: Settlements as Separate Entity

| Aspect | Detail |
|--------|--------|
| **Decision** | Store settlements in a dedicated `settlements` table, separate from expenses |
| **Alternatives** | (A) Store as expense with `type: settlement` flag, (B) Separate table |
| **Pros** | Clean data model, no confusion during balance calculation, clear audit trail, prevents "settlement logged as expense" bug (Row 14, 38 in CSV) |
| **Cons** | Two tables to query for balance computation, slightly more complex queries |
| **Final Choice** | **Option B** — Separate `settlements` table. The CSV data proves this is necessary (Rows 14 and 38 were settlements misclassified as expenses) |

---

## Decision 2: Membership Timeline (join_date / leave_date)

| Aspect | Detail |
|--------|--------|
| **Decision** | Store membership history with `join_date` and `leave_date` fields |
| **Alternatives** | (A) Boolean `is_active` flag, (B) Date-range tracking |
| **Pros** | Solves Sam's and Meera's requirements directly. Enables precise validation of who should be in each expense. Handles re-joining scenarios |
| **Cons** | More complex membership queries (must check date ranges) |
| **Final Choice** | **Option B** — Date ranges. Sam joins 8 April and shouldn't see March electricity. Meera leaves 31 March and shouldn't be in April splits. A boolean flag can't express this. |

---

## Decision 3: Balance Engine — Greedy Algorithm for Simplified Debts

| Aspect | Detail |
|--------|--------|
| **Decision** | Use greedy creditor-debtor matching for minimum transactions |
| **Alternatives** | (A) Pairwise netting, (B) Greedy approach, (C) Min-cost flow |
| **Pros** | O(n log n), simple to implement, produces near-optimal results for small groups (6 people), easy to explain |
| **Cons** | Not guaranteed minimum for all cases (though optimal for ≤6 people in practice) |
| **Final Choice** | **Option B** — Greedy. For 6 flatmates, it produces optimal results. Min-cost flow is overkill for this group size. |

---

## Decision 4: CSV Import — 9-Stage Anomaly Pipeline

| Aspect | Detail |
|--------|--------|
| **Decision** | Run 9 sequential detectors, store anomalies in DB, require user approval before commit |
| **Alternatives** | (A) Auto-fix everything, (B) Detect-and-review pipeline |
| **Pros** | Meera's requirement satisfied (she wants to approve changes). Full transparency. Audit trail for every decision |
| **Cons** | More steps for user, requires UI for anomaly review |
| **Final Choice** | **Option B** — Detect-and-review. The CSV has 22 anomalies; auto-fixing would be dangerous (e.g., wrong payer, wrong date). Human review is essential. |

---

## Decision 5: Currency Storage — Triple Fields

| Aspect | Detail |
|--------|--------|
| **Decision** | Store `amount` (original), `currency`, `exchange_rate`, and `base_amount` (converted to INR) per expense |
| **Alternatives** | (A) Store only INR equivalent, (B) Store original + rate + base |
| **Pros** | Full audit trail, can reconstruct original amounts, base_amount simplifies balance queries |
| **Cons** | More fields per expense |
| **Final Choice** | **Option B** — Triple fields. Priya's concern about "pretending a dollar is a rupee" is directly addressed. Original $540 is preserved alongside ₹45,630 converted amount. |

---

## Decision 6: Express 4 over Express 5

| Aspect | Detail |
|--------|--------|
| **Decision** | Use Express 4.x (stable) instead of Express 5 (beta) |
| **Alternatives** | (A) Express 5 beta, (B) Express 4 stable, (C) Fastify |
| **Pros** | Battle-tested, all middleware compatible, better for interviews/portfolios |
| **Cons** | Older API patterns, no native promise support in error handling |
| **Final Choice** | **Option B** — Express 4. Stability over cutting-edge for a portfolio/assignment project. |

---

## Decision 7: Soft Deletes for Expenses

| Aspect | Detail |
|--------|--------|
| **Decision** | Use `is_deleted` boolean flag instead of hard deletes |
| **Alternatives** | (A) Hard delete, (B) Soft delete with flag |
| **Pros** | Audit trail preserved, can undo deletions, referential integrity maintained |
| **Cons** | Must add `isDeleted: false` filter to all queries |
| **Final Choice** | **Option B** — Soft delete. Auditability requirement demands it. |

---

## Decision 8: Plain JavaScript over TypeScript

| Aspect | Detail |
|--------|--------|
| **Decision** | Use plain JavaScript (ES6+) for both frontend and backend |
| **Alternatives** | (A) TypeScript everywhere, (B) JavaScript |
| **Pros** | Faster development, no build step for backend (node directly), simpler debugging, lower barrier for code review |
| **Cons** | No compile-time type safety, IDE support slightly weaker |
| **Final Choice** | **Option B** — JavaScript. Per user preference. JSDoc comments provide some type hints where needed. |
