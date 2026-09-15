-- حذف دفتر يومية صندوق نمر لليوم فقط — بدون مس حركات الحساب (ledger = account)
-- شغّل من Supabase → SQL Editor كمسؤول
-- غيّر التاريخ إذا لزم

-- معاينة قبل الحذف:
select id, date, kind, currency, amount, counterparty, link_id
from transactions
where fund_id = 'nemr'
  and date = current_date
  and ledger = 'fund'
  and party = 'صندوق نمر'
  and status = 'posted'
  and fee_source_id is null;

-- الحذف:
delete from transactions
where fund_id = 'nemr'
  and date = current_date
  and ledger = 'fund'
  and party = 'صندوق نمر'
  and status = 'posted'
  and fee_source_id is null;
