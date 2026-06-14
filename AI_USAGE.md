# AI_USAGE.md — AI Tools & Transparency Report

## AI Tools Used

| Tool | Purpose |
|------|---------|
| **Claude (Anthropic)** | Primary AI assistant for architecture design, code generation, CSV anomaly analysis, documentation |
| **Gemini Code Assist** | IDE integration for code suggestions and debugging |

---

## Key Prompts Used

### 1. CSV Analysis
> "Analyze the uploaded CSV file, identify all columns, data types, split types, currencies, duplicates, invalid records, missing values, and generate an anomaly table."

### 2. Architecture Design
> "Design a production-ready expense sharing application with PostgreSQL schema supporting membership timelines, multi-currency, settlements separate from expenses, and a CSV import wizard with anomaly detection."

### 3. Balance Algorithm
> "Implement a simplified debt settlement algorithm using greedy graph minimization that produces minimum transactions."

---

## 3 Examples Where AI Was Wrong

### Error 1: Express 5 Syntax
**What happened**: AI initially generated code using Express 5 beta (`express@5.1.0`) with `express.Router()` patterns that broke with certain middleware.

**How corrected**: Downgraded to Express 4.21 (`express@^4.21.0`) and verified all route patterns work correctly with Express 4 API.

### Error 2: Percentage Validation Logic
**What happened**: AI's initial split calculator accepted percentages summing to 110% without error — the exact bug present in the CSV (Rows 15, 32).

**How corrected**: Added explicit validation: `if (Math.abs(totalPercentage - 100) > 0.01) throw Error`. The 0.01 tolerance handles floating-point rounding.

### Error 3: TypeScript Assumption
**What happened**: AI defaulted to TypeScript despite the user wanting plain JavaScript. Generated `tsconfig.json`, `.ts` file extensions, and type annotations.

**How corrected**: User explicitly requested JavaScript. All files regenerated as `.js`/`.jsx`. Removed TypeScript dependencies. Added JSDoc comments for critical functions.

---

## Verification of AI Output

All AI-generated code was reviewed for:
- ✅ Correct Prisma schema relationships and constraints
- ✅ Proper JWT authentication flow
- ✅ Balance calculation accuracy (verified with sample data)
- ✅ All 22 CSV anomalies detected by the anomaly pipeline
- ✅ Membership timeline logic correctly excludes Sam/Meera
- ✅ Settlement vs expense separation in data model
