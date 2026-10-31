-- Recoverable, atomic deletion of one account's calendar-month data.
create table public.expense_deleted_months (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month date not null check (month between date '1900-01-01' and date '2100-12-01' and extract(day from month)=1),
  deleted_at timestamptz not null default now(),
  restored_at timestamptz,
  transaction_count integer not null check (transaction_count>=0),
  had_schedule boolean not null
);
alter table public.expense_deleted_months enable row level security;
revoke all on public.expense_deleted_months from anon, authenticated;
grant select, insert, update on public.expense_deleted_months to authenticated;
create policy "Read own deleted months" on public.expense_deleted_months for select to authenticated using ((select auth.uid())=user_id);
create policy "Create own deleted months" on public.expense_deleted_months for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Update own deleted months" on public.expense_deleted_months for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create index expense_deleted_months_owner on public.expense_deleted_months(user_id,deleted_at desc);

alter table public.expense_transactions add column month_deletion_id uuid;
alter table public.expense_months add column deleted_at timestamptz, add column month_deletion_id uuid;
create index expense_transactions_deleted_month on public.expense_transactions(user_id,month_deletion_id) where month_deletion_id is not null;

create function public.delete_expense_month(target_month date) returns uuid
language plpgsql security invoker set search_path='' as $$
declare
  owner_id uuid := auth.uid();
  deletion_id uuid := gen_random_uuid();
  deleted_time timestamptz := clock_timestamp();
  entry_count integer;
  has_schedule boolean;
begin
  if owner_id is null then raise exception 'Please sign in again.'; end if;
  if target_month is null or target_month<date '1900-01-01' or target_month>date '2100-12-01' or extract(day from target_month)<>1 then
    raise exception 'Choose a valid calendar month.';
  end if;
  -- Serialize delete/restore requests for this account without bypassing RLS.
  perform 1 from public.expense_profiles where user_id=owner_id for update;
  if not found then raise exception 'Load your account before deleting month data.'; end if;
  select count(*) into entry_count from public.expense_transactions
    where user_id=owner_id and date>=target_month and date<(target_month+interval '1 month') and deleted_at is null;
  select exists(select 1 from public.expense_months where user_id=owner_id and month=target_month and deleted_at is null) into has_schedule;
  if entry_count=0 and not has_schedule then raise exception 'There is no data to delete in this month.'; end if;
  insert into public.expense_deleted_months(id,user_id,month,deleted_at,transaction_count,had_schedule)
    values(deletion_id,owner_id,target_month,deleted_time,entry_count,has_schedule);
  update public.expense_transactions set deleted_at=deleted_time,month_deletion_id=deletion_id
    where user_id=owner_id and date>=target_month and date<(target_month+interval '1 month') and deleted_at is null;
  update public.expense_months set deleted_at=deleted_time,month_deletion_id=deletion_id
    where user_id=owner_id and month=target_month and deleted_at is null;
  return deletion_id;
end;
$$;

create function public.restore_expense_month(deletion_id uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare
  owner_id uuid := auth.uid();
  starting_date date;
  batch public.expense_deleted_months%rowtype;
begin
  if owner_id is null then raise exception 'Please sign in again.'; end if;
  select opening_date into starting_date from public.expense_profiles where user_id=owner_id for update;
  if not found then raise exception 'Load your account before restoring month data.'; end if;
  select * into batch from public.expense_deleted_months where id=deletion_id and user_id=owner_id and restored_at is null for update;
  if not found then raise exception 'This deleted month is unavailable or already restored.'; end if;
  if exists(select 1 from public.expense_transactions where user_id=owner_id and month_deletion_id=deletion_id and deleted_at is not null and date<starting_date) then
    raise exception 'These transactions are before your starting balance date. Move the starting date earlier in Settings before restoring.';
  end if;
  update public.expense_transactions set deleted_at=null,month_deletion_id=null
    where user_id=owner_id and month_deletion_id=deletion_id and deleted_at is not null;
  -- New schedules clear their deletion marker and are preserved on restoration.
  update public.expense_months set deleted_at=null,month_deletion_id=null
    where user_id=owner_id and month_deletion_id=deletion_id and deleted_at is not null;
  update public.expense_deleted_months set restored_at=clock_timestamp() where id=deletion_id and user_id=owner_id;
end;
$$;

revoke all on function public.delete_expense_month(date),public.restore_expense_month(uuid) from public,anon;
grant execute on function public.delete_expense_month(date),public.restore_expense_month(uuid) to authenticated;
