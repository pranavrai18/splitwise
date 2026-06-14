# SplitWise — Expense Tracker

A production-ready expense sharing application for flatmates, built with React + Node.js + PostgreSQL.

## 🏗️ Architecture

```
expensetracker/
├── client/          # React + Vite + Material UI frontend
│   └── src/
│       ├── pages/           # 8 page components
│       ├── components/      # Reusable UI components
│       ├── services/        # API service layer (Axios)
│       ├── hooks/           # React Query hooks
│       └── utils/           # Formatting, helpers
├── server/          # Node.js + Express backend
│   ├── src/
│   │   ├── routes/          # REST API routes
│   │   ├── services/        # Business logic engines
│   │   ├── middleware/      # JWT auth, audit logging
│   │   └── utils/           # CSV parser, anomaly detection
│   └── prisma/
│       ├── schema.prisma    # Database schema (10 tables)
│       └── seed.js          # Seed data for 6 flatmates
├── README.md
├── SCOPE.md
├── DECISIONS.md
└── AI_USAGE.md
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+ (or Supabase)
- npm

### Backend Setup

```bash
cd server
npm install
```

Configure `.env`:
```
DATABASE_URL="postgresql://postgres:password@localhost:5432/expense_tracker"
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"
PORT=3001
DEFAULT_USD_TO_INR_RATE=92.32
```

Run migrations and seed:
```bash
npx prisma migrate dev --name init
npm run prisma:seed
```

Start server:
```bash
npm run dev
```

### Frontend Setup

```bash
cd client
npm install
npm run dev
```

Open http://localhost:5173

### Demo Login
- **Email**: `aisha@example.com` (or rohan, priya, meera, dev, sam)
- **Password**: `password123`

## 👥 Flatmates

| Name | Role | Timeline |
|------|------|----------|
| Aisha | Admin | Jan 2026 → Present |
| Rohan | Member | Jan 2026 → Present |
| Priya | Member | Jan 2026 → Present |
| Meera | Member | Jan 2026 → **Left 31 Mar** |
| Dev | Member | Jan 2026 → Present |
| Sam | Member | **Joined 8 Apr** → Present |

## 📊 Key Features

### For Aisha — "One number per person"
- **Settlement Summary**: Simplified debt view with minimum transactions
- Uses greedy graph minimization algorithm

### For Rohan — "Show the calculations"
- **Expandable Ledger**: Click any balance to see every expense that contributes to it
- Detailed breakdown with date, description, your share, net effect

### For Priya — "Currency handling"
- Supports INR and USD expenses
- Stores original currency + exchange rate + base amount (INR)
- All balance calculations in base currency

### For Sam — "Membership timeline"
- Members have `join_date` and `leave_date`
- Expenses validate participants against active memberships on expense date

### For Meera — "Approve changes"
- CSV Import Wizard with anomaly detection
- Every anomaly requires explicit user approval (Accept/Reject/Ignore/Convert)
- 22 anomalies detected in sample CSV

## 🔌 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/login` | Login |
| GET | `/api/groups` | List groups |
| POST | `/api/groups` | Create group |
| GET | `/api/groups/:id/members` | List members |
| GET | `/api/groups/:id/expenses` | List expenses |
| POST | `/api/groups/:id/expenses` | Add expense |
| GET | `/api/groups/:id/balances` | Get balances |
| GET | `/api/groups/:id/balances/simplified` | Simplified debts |
| GET | `/api/groups/:id/balances/:userId/ledger` | User ledger |
| POST | `/api/groups/:id/settlements` | Record settlement |
| POST | `/api/groups/:id/imports` | Upload CSV |
| POST | `/api/groups/:gid/imports/:id/approve` | Commit import |
| GET | `/api/audit-logs` | Audit trail |

## 🧪 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Material UI 5 |
| State | React Query (TanStack) |
| Charts | Recharts |
| Routing | React Router v6 |
| Backend | Node.js, Express 4 |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| File Upload | Multer |
| CSV Parsing | csv-parse |

## 📦 Deployment

| Component | Platform |
|-----------|----------|
| Frontend | Vercel |
| Backend | Render |
| Database | Supabase (PostgreSQL) |
