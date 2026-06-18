-- أرقام واتساب لكل صندوق (تنبيه قيد الانتظار)
-- شغّله من Supabase → SQL Editor

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
