-- Run in a dedicated Supabase project. No spreadsheet data or sample users are included.
begin;

create table if not exists public.expense_profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  currency text not null default 'USD' check (currency = 'USD'),
  opening_balance_cents bigint not null default 0 check (abs(opening_balance_cents) <= 99999999999),
  opening_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.expense_months (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  frequency text not null check (frequency in ('weekly','biweekly','semimonthly','monthly','irregular')),
  anchor_date date not null,
  monthly_day smallint not null default 1 check (monthly_day between 1 and 31),
  second_day smallint not null default 15 check (second_day between 1 and 31),
  expected_amount_cents bigint not null default 0 check (expected_amount_cents between 0 and 99999999999),
  budget_cents bigint not null default 0 check (budget_cents between 0 and 99999999999),
  created_at timestamptz not null default now(),
  primary key (user_id, month),
  constraint distinct_semimonthly_days check (frequency <> 'semimonthly' or monthly_day < second_day)
);

create table if not exists public.expense_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null check (date between date '1900-01-01' and date '2100-12-31'),
  type text not null check (type in ('income','expense')),
  amount_cents bigint not null check (amount_cents between 1 and 99999999999),
  description text not null check (char_length(description) between 1 and 200),
  category text not null check (char_length(category) between 1 and 64),
  payment_method text not null check (payment_method in ('Debit card','Cash','Credit card','Bank transfer','Other')),
  scheduled_for date,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint scheduled_income_only check (scheduled_for is null or type = 'income')
);

create index if not exists expense_transactions_owner_date on public.expense_transactions (user_id, date desc, id);
create index if not exists expense_transactions_payday on public.expense_transactions (user_id, scheduled_for) where scheduled_for is not null and deleted_at is null;

alter table public.expense_profiles enable row level security;
alter table public.expense_months enable row level security;
alter table public.expense_transactions enable row level security;

revoke all on public.expense_profiles, public.expense_months, public.expense_transactions from anon;
revoke all on public.expense_profiles, public.expense_months, public.expense_transactions from authenticated;
grant select, insert, update on public.expense_profiles, public.expense_months, public.expense_transactions to authenticated;

create policy "Read own expense profile" on public.expense_profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own expense profile" on public.expense_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own expense profile" on public.expense_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Read own pay schedules" on public.expense_months for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own pay schedules" on public.expense_months for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own pay schedules" on public.expense_months for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Read own transactions" on public.expense_transactions for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own transactions" on public.expense_transactions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own transactions" on public.expense_transactions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

commit;
