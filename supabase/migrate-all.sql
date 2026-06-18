-- ═══ شغّل هالملف مرة وحدة في Supabase → SQL Editor ═══
-- يحل مشكلة "فشل الحفظ" ويفعّل العمليات متعددة البنود

-- 1) أعمدة الحركات الجديدة
alter table transactions add column if not exists ledger text not null default 'fund';
alter table transactions add column if not exists counterparty text;
alter table transactions add column if not exists batch_id uuid;
alter table transactions add column if not exists created_by_id uuid;
alter table transactions add column if not exists created_by_email text;
alter table transactions add column if not exists created_by_name text;

alter table transactions add column if not exists link_id uuid;
alter table transactions add column if not exists last_edited_at timestamptz;
alter table transactions add column if not exists last_edited_by_name text;
alter table transactions add column if not exists last_edited_by_email text;
alter table transactions add column if not exists edit_history jsonb;

-- 2) حوّل الحركات القديمة لحساب الصندوق
update transactions t
set
  counterparty = t.party,
  party = case t.fund_id
    when 'nemr' then 'صندوق نمر'
    when 'tiger' then 'صندوق تايغر'
    when 'aura' then 'صندوق اورا'
    when 'zalqa' then 'صندوق زلقا'
    when 'george' then 'صندوق جورج'
    else t.party
  end,
  ledger = 'fund'
where t.counterparty is null
  and t.party not in ('صندوق نمر', 'صندوق تايغر', 'صندوق اورا', 'صندوق زلقا', 'صندوق جورج');

-- 3) الحسابات مربوطة بكل صندوق
-- إذا عندك حسابات قديمة بدون صندوق، عيّنهم أولاً:
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

-- 4) حذف العمليات — مسؤول فقط
drop policy if exists "perm delete transactions" on transactions;
create policy "perm delete transactions"
  on transactions for delete to authenticated
  using (public.is_admin());

-- 5) أرقام واتساب لكل صندوق
create table if not exists fund_settings (
  fund_id text primary key,
  whatsapp_phone text,
  updated_at timestamptz not null default now()
);

alter table fund_settings enable row level security;

drop policy if exists "read fund_settings" on fund_settings;
drop policy if exists "admin write fund_settings" on fund_settings;

create policy "read fund_settings"
  on fund_settings for select to authenticated
  using (true);

create policy "admin write fund_settings"
  on fund_settings for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
