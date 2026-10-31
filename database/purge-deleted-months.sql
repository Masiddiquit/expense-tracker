-- Permanently remove only explicitly selected, already-deleted month batches.
grant delete on public.expense_transactions,public.expense_months,public.expense_deleted_months to authenticated;
create policy "Purge own deleted month transactions" on public.expense_transactions for delete to authenticated
using ((select auth.uid())=user_id and deleted_at is not null and exists(
  select 1 from public.expense_deleted_months b where b.id=expense_transactions.month_deletion_id and b.user_id=(select auth.uid()) and b.restored_at is null
));
create policy "Purge own deleted month schedules" on public.expense_months for delete to authenticated
using ((select auth.uid())=user_id and deleted_at is not null and exists(
  select 1 from public.expense_deleted_months b where b.id=expense_months.month_deletion_id and b.user_id=(select auth.uid()) and b.restored_at is null
));
create policy "Purge own deleted months" on public.expense_deleted_months for delete to authenticated
using ((select auth.uid())=user_id and restored_at is null);

create function public.purge_deleted_expense_months(deletion_ids uuid[]) returns uuid[]
language plpgsql security invoker set search_path='' as $$
declare
  owner_id uuid:=auth.uid();
  requested uuid[];
  matched uuid[];
begin
  if owner_id is null then raise exception 'Please sign in again.'; end if;
  select array_agg(distinct id) into requested from unnest(deletion_ids) id where id is not null;
  if coalesce(cardinality(requested),0)=0 then raise exception 'Choose deleted month data to remove.'; end if;
  perform 1 from public.expense_profiles where user_id=owner_id for update;
  if not found then raise exception 'Load your account before deleting data.'; end if;
  select array_agg(id) into matched from public.expense_deleted_months
    where user_id=owner_id and restored_at is null and id=any(requested);
  if coalesce(cardinality(matched),0)<>cardinality(requested) then
    raise exception 'Some selected data is already removed or restored. Check saved data before trying again.';
  end if;
  delete from public.expense_transactions where user_id=owner_id and deleted_at is not null and month_deletion_id=any(matched);
  delete from public.expense_months where user_id=owner_id and deleted_at is not null and month_deletion_id=any(matched);
  delete from public.expense_deleted_months where user_id=owner_id and restored_at is null and id=any(matched);
  return matched;
end;
$$;
revoke all on function public.purge_deleted_expense_months(uuid[]) from public,anon;
grant execute on function public.purge_deleted_expense_months(uuid[]) to authenticated;
