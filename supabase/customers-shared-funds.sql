-- ═══════════════════════════════════════════════════════════════
-- شغّل هالملف كامل في Supabase → SQL Editor → Run
-- ترتيب مهم: احذف السياسات أولاً ثم عمود shared
-- ═══════════════════════════════════════════════════════════════

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

create or replace function public.fund_permission(p_fund_id text)
returns text language sql stable security definer set search_path = public as $$
  select case
    when public.is_admin() then 'edit'
    else (select permission from user_fund_permissions where user_id = auth.uid() and fund_id = p_fund_id)
  end;
$$;

-- 1) احذف السياسات القديمة (تعتمد على عمود shared)
drop policy if exists "perm select customers" on customers;
drop policy if exists "perm insert customers" on customers;
drop policy if exists "perm update customers" on customers;
drop policy if exists "perm delete customers" on customers;
drop policy if exists "authenticated full access customers" on customers;

-- 2) الآن يمكن حذف العمود القديم وإضافة الجديد
alter table customers drop column if exists shared;
alter table customers add column if not exists shared_fund_ids text[] not null default '{}';
alter table customers enable row level security;

-- 3) دوال المشاركة
create or replace function public.can_read_customer(p_home_fund text, p_shared_funds text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fund_permission(p_home_fund) in ('edit', 'view')
    or exists (
      select 1
      from unnest(coalesce(p_shared_funds, '{}'::text[])) as f(fund_id)
      where public.fund_permission(f.fund_id) in ('edit', 'view')
    );
$$;

create or replace function public.can_edit_customer(p_home_fund text, p_shared_funds text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fund_permission(p_home_fund) = 'edit'
    or exists (
      select 1
      from unnest(coalesce(p_shared_funds, '{}'::text[])) as f(fund_id)
      where public.fund_permission(f.fund_id) = 'edit'
    );
$$;

-- 4) سياسات جديدة
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
