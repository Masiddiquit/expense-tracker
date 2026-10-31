-- Add reusable categories to each private account profile. Existing RLS applies.
alter table public.expense_profiles
  add column if not exists expense_categories text[] not null default '{}'::text[]
    check (cardinality(expense_categories) <= 200),
  add column if not exists income_categories text[] not null default '{}'::text[]
    check (cardinality(income_categories) <= 200);
