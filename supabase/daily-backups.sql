-- نسخة احتياطية يومية على السحابة — شغّل بعد permissions.sql

create table if not exists daily_backups (
  backup_date date primary key,
  payload jsonb not null,
  summary text,
  created_by_name text,
  created_at timestamptz not null default now()
);

alter table daily_backups enable row level security;

drop policy if exists "admins read daily backups" on daily_backups;
drop policy if exists "authenticated insert daily backup" on daily_backups;
drop policy if exists "admins delete old daily backups" on daily_backups;

create policy "admins read daily backups"
  on daily_backups for select to authenticated
  using (public.is_admin());

create policy "authenticated insert daily backup"
  on daily_backups for insert to authenticated
  with check (backup_date = current_date);

create policy "admins delete old daily backups"
  on daily_backups for delete to authenticated
  using (public.is_admin());
