-- شغّل هالملف بعد schema.sql (أو مرة واحدة للتحديث)

-- ═══ جداول الصلاحيات ═══

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists user_fund_permissions (
  user_id uuid not null references profiles(id) on delete cascade,
  fund_id text not null,
  permission text not null check (permission in ('edit', 'view')),
  primary key (user_id, fund_id)
);

alter table profiles enable row level security;
alter table user_fund_permissions enable row level security;

-- ═══ دوال مساعدة ═══

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select is_admin from profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.fund_permission(p_fund_id text)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select case
    when public.is_admin() then 'edit'
    else (
      select permission
      from user_fund_permissions
      where user_id = auth.uid() and fund_id = p_fund_id
    )
  end;
$$;

-- ═══ سياسات profiles ═══

drop policy if exists "users read own profile" on profiles;
drop policy if exists "users insert own profile" on profiles;
drop policy if exists "users update own profile" on profiles;
drop policy if exists "admins read all profiles" on profiles;
drop policy if exists "admins update profiles" on profiles;

create policy "users read own profile"
  on profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "users insert own profile"
  on profiles for insert to authenticated
  with check (id = auth.uid());

create policy "users update own profile"
  on profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "admins update profiles"
  on profiles for update to authenticated
  using (public.is_admin());

-- ═══ سياسات user_fund_permissions ═══

drop policy if exists "users read own permissions" on user_fund_permissions;
drop policy if exists "admins manage permissions" on user_fund_permissions;

create policy "users read own permissions"
  on user_fund_permissions for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "admins manage permissions"
  on user_fund_permissions for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ═══ استبدال سياسات البيانات ═══

drop policy if exists "authenticated full access transactions" on transactions;
drop policy if exists "authenticated full access bills" on bills;
drop policy if exists "authenticated full access customers" on customers;

drop policy if exists "perm select transactions" on transactions;
drop policy if exists "perm insert transactions" on transactions;
drop policy if exists "perm update transactions" on transactions;
drop policy if exists "perm delete transactions" on transactions;

create policy "perm select transactions"
  on transactions for select to authenticated
  using (public.fund_permission(fund_id) in ('edit', 'view'));

create policy "perm insert transactions"
  on transactions for insert to authenticated
  with check (public.fund_permission(fund_id) = 'edit');

create policy "perm update transactions"
  on transactions for update to authenticated
  using (public.fund_permission(fund_id) = 'edit');

create policy "perm delete transactions"
  on transactions for delete to authenticated
  using (public.is_admin());

drop policy if exists "perm select bills" on bills;
drop policy if exists "perm insert bills" on bills;
drop policy if exists "perm delete bills" on bills;

create policy "perm select bills"
  on bills for select to authenticated
  using (public.fund_permission(fund_id) in ('edit', 'view'));

create policy "perm insert bills"
  on bills for insert to authenticated
  with check (public.fund_permission(fund_id) = 'edit');

create policy "perm delete bills"
  on bills for delete to authenticated
  using (public.fund_permission(fund_id) = 'edit');

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

-- ═══ أول مسؤول (عدّل الإيميل) ═══
-- update profiles set is_admin = true where email = 'YOUR_EMAIL@example.com';
