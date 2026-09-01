-- شغّل بعد accounts-only-audit.sql
-- صلاحية تعديل الحركات السابقة (أقدم من اليوم الحالي)

alter table profiles
  add column if not exists can_edit_past boolean not null default false;
