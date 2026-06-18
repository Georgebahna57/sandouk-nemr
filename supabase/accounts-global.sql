-- شغّل هالملف لجعل الحسابات عامة (غير مربوطة بصندوق)

alter table customers alter column fund_id drop not null;

drop policy if exists "perm select customers" on customers;
drop policy if exists "perm insert customers" on customers;
drop policy if exists "perm delete customers" on customers;

create policy "perm select customers"
  on customers for select to authenticated
  using (true);

create policy "perm insert customers"
  on customers for insert to authenticated
  with check (public.is_admin() or exists (
    select 1 from user_fund_permissions
    where user_id = auth.uid() and permission = 'edit'
  ));

create policy "perm delete customers"
  on customers for delete to authenticated
  using (public.is_admin() or exists (
    select 1 from user_fund_permissions
    where user_id = auth.uid() and permission = 'edit'
  ));
