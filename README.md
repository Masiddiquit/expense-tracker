# Expense Tracker

A public, responsive personal expense tracker. Each signed-in user has private financial records. Built with React, Vite, and Supabase, and deployed on Vercel.

## Features

- Select weekly, every two weeks, twice monthly, monthly, or irregular pay **for each month**.
- Generate actual calendar paydays, including five-payday weeks and three-payday biweekly months. A reference payday preserves the 14-day cycle across months.
- Record each actual payment with its own date and amount. Expected pay never increases the actual balance.
- Add repeated expenses independently, duplicate an entry, or save and add another.
- Edit and soft-delete entries with an immediate undo action.
- Carry forward balances automatically and recalculate subsequent months when earlier entries change.
- Filter transactions, download CSV, and view category totals and six-month comparisons.
- Responsive sidebar on desktop, bottom navigation on mobile, accessible dialogs, safe-area spacing, and home-screen installation metadata.
- Try a browser-local demo. Demo records never enter a real account automatically.

## Project status

The interface, demo, finance calculations, Supabase client integration, and database setup script are implemented. Creating the dedicated Supabase project was blocked by the account's two-active-free-project limit. Until a project is connected, the public app clearly labels sample data and disables account submission. No real signup, database persistence, password recovery, or user-isolation checks have been verified against a live project yet.

## Local development

Requires Node.js 22.12+ or 24+.

```sh
npm ci
npm run dev
npm test
npm run build
```

## Connect a dedicated Supabase project

1. Create a dedicated project after resolving the active-project limit. Do not change existing Payroll or warehouse projects.
2. Run `database/setup.sql` once in the new project's SQL editor. It creates three tables, indexes, explicit grants, and owner-scoped row-level policies. The SQL is for initial setup; policies intentionally do not use `IF NOT EXISTS`.
3. Enable email/password signup in Authentication. Configure the Site URL to the production Vercel URL and add the same origin to allowed redirect URLs. Retain email confirmation for real users. Configure a production email provider for unrestricted public signup and password recovery; the default mail service may restrict recipients and rate limits.
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` on Vercel, then redeploy. Use only the publishable key in the browser. Never publish a secret/service-role key.
5. Verify signup, confirmation, login, recovery, persistence after reload, and access isolation with two separate test accounts. Run Supabase security advisors before enabling real users.

Environment variable names are listed in `.env.example`. Financial records, emails, passwords, spreadsheet attachments, and private API keys must never be committed to this public repository.

## Calculations

Amounts are validated and stored as integer USD cents. Dates use calendar dates rather than local timestamp conversions.

```
Opening balance = initial balance + earlier income - earlier expenses
Monthly net = income received this month - expenses this month
Closing balance = opening balance + monthly net
```

Only non-deleted transactions on or after the starting balance date count. The starting balance date cannot be moved past existing transactions in the UI. Scheduled pay is shown independently and counted only when an actual income transaction is saved. A late payment can link to an earlier scheduled payday while its receipt date controls cash-flow reporting.

This release tracks simple income and expenses in USD. Credit-card purchases should be recorded once; entering the later card repayment as another expense would count the same spending twice. Account transfers, borrowing balances, bank feeds, offline sync, and receipt uploads are outside this release.

## Deployment

Vercel uses `npm run build` and publishes `dist`. `vercel.json` includes SPA routing and security headers. Source is public, while authenticated data is protected in Supabase. Supabase's dashboard itself is a project administration surface, not a public user interface.

Tests cover exact cents, invalid dates, calendar paydays, 14-day continuity, leap years, monthly boundaries, carry-forward corrections, repeated purchases, deleted entries, category aggregation, and CSV formula injection.
