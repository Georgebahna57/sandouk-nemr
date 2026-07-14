-- شغّل هالملف في Supabase → SQL Editor إذا ظهر خطأ أعمدة ناقصة

alter table transactions add column if not exists ledger text not null default 'fund';
alter table transactions add column if not exists counterparty text;
alter table transactions add column if not exists batch_id uuid;
alter table transactions add column if not exists link_id uuid;
alter table transactions add column if not exists fee text;
alter table transactions add column if not exists created_by_id uuid;
alter table transactions add column if not exists created_by_email text;
alter table transactions add column if not exists created_by_name text;
alter table transactions add column if not exists last_edited_at timestamptz;
alter table transactions add column if not exists last_edited_by_name text;
alter table transactions add column if not exists last_edited_by_email text;
alter table transactions add column if not exists edit_history jsonb;
alter table transactions add column if not exists pending_whatsapp_message text;
alter table transactions add column if not exists approval_details text;
alter table transactions add column if not exists approved_by_name text;
alter table transactions add column if not exists approved_by_email text;
alter table transactions add column if not exists approved_at timestamptz;
alter table transactions add column if not exists claimed_by_id uuid;
alter table transactions add column if not exists claimed_by_name text;
alter table transactions add column if not exists claimed_at timestamptz;
alter table transactions add column if not exists comments jsonb;
alter table transactions add column if not exists ordered_date text;

-- أصلح الطلبات المعتمدة سابقاً: تاريخ التنفيذ = يوم الاعتماد
update transactions
set
  ordered_date = date::text,
  date = approved_at::date
where status = 'posted'
  and approved_at is not null
  and ordered_date is null
  and date < approved_at::date;
