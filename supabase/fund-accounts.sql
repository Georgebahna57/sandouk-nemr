-- فصل حساب الصندوق عن حسابات الزبائن

alter table transactions add column if not exists ledger text not null default 'fund';
alter table transactions add column if not exists counterparty text;

-- حوّل الحركات القديمة: party كان الطرف → صار counterparty، وparty صار حساب الصندوق
update transactions t
set
  counterparty = t.party,
  party = case t.fund_id
    when 'nemr' then 'صندوق نمر'
    when 'tiger' then 'صندوق تايغر'
    when 'aura' then 'صندوق اورا'
    when 'zalqa' then 'صندوق زلقا'
    when 'george' then 'صندوق جورج'
    else t.party
  end,
  ledger = 'fund'
where t.ledger = 'fund'
  and t.counterparty is null
  and t.party not in ('صندوق نمر', 'صندوق تايغر', 'صندوق اورا', 'صندوق زلقا', 'صندوق جورج');
