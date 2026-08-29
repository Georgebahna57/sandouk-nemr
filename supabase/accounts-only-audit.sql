-- شغّل بعد permissions.sql

alter table profiles
  add column if not exists accounts_only boolean not null default false;

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  user_id uuid references profiles(id) on delete set null,
  user_name text not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  fund_id text,
  details text
);

alter table audit_log enable row level security;

drop policy if exists "authenticated insert audit" on audit_log;
drop policy if exists "admins read audit" on audit_log;

create policy "authenticated insert audit"
  on audit_log for insert to authenticated
  with check (true);

create policy "admins read audit"
  on audit_log for select to authenticated
  using (public.is_admin());
