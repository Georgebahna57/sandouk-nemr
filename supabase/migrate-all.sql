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
    when 'marakiz' then 'صندوق مراكز'
    else t.party
  end,
  ledger = 'fund'
where t.counterparty is null
  and t.party not in ('صندوق نمر', 'صندوق تايغر', 'صندوق اورا', 'صندوق زلقا', 'صندوق جورج', 'صندوق مراكز');

-- 3) الحسابات مربوطة بكل صندوق
-- إذا عندك حسابات قديمة بدون صندوق، عيّنهم أولاً:
-- update customers set fund_id = 'nemr' where fund_id is null;

alter table customers alter column fund_id set not null;

-- (سياسات customers الكاملة في القسم 8 بعد عمود shared)

-- 4) حذف العمليات — مسؤول فقط
drop policy if exists "perm delete transactions" on transactions;
create policy "perm delete transactions"
  on transactions for delete to authenticated
  using (public.is_admin());

-- 5) أرقام واتساب لكل صندوق
create table if not exists fund_settings (
  fund_id text primary key,
  whatsapp_phone text,
  whatsapp_destinations jsonb,
  updated_at timestamptz not null default now()
);

alter table fund_settings add column if not exists whatsapp_destinations jsonb;

update fund_settings
set whatsapp_destinations = jsonb_build_array(whatsapp_phone)
where whatsapp_phone is not null
  and (whatsapp_destinations is null or whatsapp_destinations = '[]'::jsonb);

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

-- 6) اعتماد قيد الانتظار + رسالة واتساب
alter table transactions add column if not exists pending_whatsapp_message text;
alter table transactions add column if not exists approval_details text;
alter table transactions add column if not exists approved_by_name text;
alter table transactions add column if not exists approved_by_email text;
alter table transactions add column if not exists approved_at timestamptz;

-- 7) تنسيق الفريق: أجور، متابعة، تعليقات
alter table transactions add column if not exists fee text;
alter table transactions add column if not exists claimed_by_id uuid;
alter table transactions add column if not exists claimed_by_name text;
alter table transactions add column if not exists claimed_at timestamptz;
alter table transactions add column if not exists comments jsonb;

-- 8) حسابات مشتركة — صناديق محددة (نفس customers-shared-funds.sql)
drop policy if exists "perm select customers" on customers;
drop policy if exists "perm insert customers" on customers;
drop policy if exists "perm update customers" on customers;
drop policy if exists "perm delete customers" on customers;
drop policy if exists "authenticated full access customers" on customers;

alter table customers drop column if exists shared;
alter table customers add column if not exists shared_fund_ids text[] not null default '{}';
alter table customers enable row level security;

create or replace function public.can_read_customer(p_home_fund text, p_shared_funds text[])
returns boolean language sql stable security definer set search_path = public as $$
  select public.fund_permission(p_home_fund) in ('edit', 'view')
    or exists (
      select 1 from unnest(coalesce(p_shared_funds, '{}'::text[])) as f(fund_id)
      where public.fund_permission(f.fund_id) in ('edit', 'view')
    );
$$;

create or replace function public.can_edit_customer(p_home_fund text, p_shared_funds text[])
returns boolean language sql stable security definer set search_path = public as $$
  select public.fund_permission(p_home_fund) = 'edit'
    or exists (
      select 1 from unnest(coalesce(p_shared_funds, '{}'::text[])) as f(fund_id)
      where public.fund_permission(f.fund_id) = 'edit'
    );
$$;

create policy "perm select customers"
  on customers for select to authenticated
  using (public.can_read_customer(fund_id, shared_fund_ids));

create policy "perm insert customers"
  on customers for insert to authenticated
  with check (public.fund_permission(fund_id) = 'edit');

create policy "perm update customers"
  on customers for update to authenticated
  using (public.can_edit_customer(fund_id, shared_fund_ids))
  with check (public.can_edit_customer(fund_id, shared_fund_ids));

create policy "perm delete customers"
  on customers for delete to authenticated
  using (public.fund_permission(fund_id) = 'edit');

-- 9) أسعار التقييم — مشتركة لكل المشروع
create table if not exists app_settings (
  key text primary key,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;

drop policy if exists "read app_settings" on app_settings;
drop policy if exists "admin write app_settings" on app_settings;

create policy "read app_settings"
  on app_settings for select to authenticated
  using (true);

create policy "admin write app_settings"
  on app_settings for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 10) تاريخ إنشاء الطلب (قيد الانتظار) منفصل عن تاريخ التنفيذ
alter table transactions add column if not exists ordered_date text;

update transactions
set
  ordered_date = date::text,
  date = approved_at::date
where status = 'posted'
  and approved_at is not null
  and ordered_date is null
  and date < approved_at::date;
