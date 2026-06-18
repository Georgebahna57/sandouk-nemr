-- ربط الحسابات بكل صندوق على حدة

-- إذا fund_id فاضي على حسابات قديمة، عيّنهم يدوياً قبل تشغيل هالسطر:
-- update customers set fund_id = 'nemr' where fund_id is null;

alter table customers alter column fund_id set not null;

drop policy if exists "perm select customers" on customers;
drop policy if exists "perm insert customers" on customers;
drop policy if exists "perm delete customers" on customers;

create policy "perm select customers"
  on customers for select to authenticated
  using (public.fund_permission(fund_id) in ('edit', 'view'));

create policy "perm insert customers"
  on customers for insert to authenticated
  with check (public.fund_permission(fund_id) = 'edit');

create policy "perm delete customers"
  on customers for delete to authenticated
  using (public.fund_permission(fund_id) = 'edit');
