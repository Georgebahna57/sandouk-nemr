-- أرقام واتساب لكل صندوق (تنبيه قيد الانتظار)
-- شغّله من Supabase → SQL Editor

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
