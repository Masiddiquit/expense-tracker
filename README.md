# Expense Tracker

Live app: https://pay-and-expenses.vercel.app/

A public, responsive personal expense tracker. Each signed-in user has private financial records. Built with React, Vite, and Supabase, and deployed on Vercel.

## Features

- Annual Dashboard with a year selector, monthly comparisons, and links to all 12 months.
- Monthly Insights with a month selector and January–December shortcuts, pay schedule, charts, and transaction details.
- Download annual or monthly PDF and CSV reports for the selected period, optionally including every transaction. Demo reports are labeled as sample data.

- Select weekly, every two weeks, twice monthly, monthly, or irregular pay **for each month**.
- Generate actual calendar paydays, including five-payday months and three-payday biweekly months. Choose the weekday for weekly or every-two-weeks pay. For every two weeks, select the first payday in the month to preserve the alternating cycle across months.
- Record each actual payment with its own date and amount. Expected pay never increases the actual balance.
- Add repeated expenses independently, duplicate an entry, or save and add another.
- Edit saved income directly from each payday card or the Income received list; multiple payments remain individually editable. Expense edits also recalculate balances.
- Save reusable custom income and expense categories (for example, College fees), private to your account and available across months and devices.
- Soft-delete entries with an immediate undo action.
- Delete a selected month’s transactions and pay schedule after reviewing its totals. Restore deleted month data later from Settings; balances and reports recalculate automatically.
- Update the screen immediately after server-confirmed deletion/restoration, without a full account reload. Account reads run in parallel. A 15-second deadline bounds network and session waits; uncertain operations offer a saved-data check before retrying.
- Carry forward balances automatically and recalculate subsequent months when earlier entries change.
- Filter transactions, download CSV, and view category totals and six-month comparisons.
- Responsive sidebar on desktop, bottom navigation on mobile, accessible dialogs, safe-area spacing, and home-screen installation metadata.
- Try a browser-local demo. Demo records never enter a real account automatically.

## Project status

The dedicated Supabase project is connected to the production Vercel deployment. Tables, owner-scoped policies, email/password authentication, the production Site URL, and authentication redirects are configured. API integration tests passed for password login, profile/schedule/expense storage, reload, edit, soft deletion, sign-out, and isolation between two test accounts. Temporary test accounts and records were removed. New accounts persist their starting-balance date on first load so later months retain carry-forward history.

Email confirmation remains enabled. Public signup and password-reset email delivery require a custom SMTP provider: Supabase's default email service only delivers to project-team addresses. No custom SMTP credentials have been provided, so unrestricted public signup is not yet ready. Confirmation has not been disabled.

## Local development

Requires Node.js 22.12+ or 24+.

```sh
npm ci
npm run dev
npm test
npm run build
```

## Connect a dedicated Supabase project

1. Create a dedicated Supabase project; this app already has one configured in production.
2. Run `database/setup.sql`, `database/month-data.sql`, then `database/purge-deleted-months.sql`, once in the new project's SQL editor. They create the core tables, recovery history, atomic month delete/restore functions, indexes, explicit grants, and owner-scoped row-level policies. These scripts are for initial setup; policies intentionally do not use `IF NOT EXISTS`.
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

For existing databases created before custom categories were added, apply `database/custom-categories.sql` once. Production has already been updated.

Month deletion and restoration require `database/month-data.sql` after the base schema. Production has already been updated. Operations are atomic, account-scoped, and recoverable.

Apply `database/purge-deleted-months.sql` after the month-data schema to enable confirmed permanent deletion of individual deleted month entries or the selected trash list. Active data is excluded. Production has been updated.
