-- أسعار التقييم — مشتركة لكل المشروع (تحويل رصيد الحساب إلى دولار/ذهب)

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
