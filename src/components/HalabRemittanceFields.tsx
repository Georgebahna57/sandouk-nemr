import { useEffect, useRef } from 'react';
import { CURRENCIES, getValueInputLabel, isWeightCurrency } from '../config';
import type { Currency, HalabRemittanceFields } from '../types';
import {
  applyHalabDeliverySource,
  deliveryDiffersFromSource,
  formatHalabDeliveryDisplay,
  HALAB_REMITTANCE_EDITOR_FIELDS,
  type HalabDeliverySource,
} from '../lib/halabRemittance';

interface Props {
  values: HalabRemittanceFields;
  onChange: (next: HalabRemittanceFields) => void;
  compact?: boolean;
  deliverySource?: HalabDeliverySource | null;
}

export function HalabRemittanceFieldsEditor({
  values,
  onChange,
  compact = false,
  deliverySource = null,
}: Props) {
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const labelClass = compact ? 'mb-1 block text-[10px] text-slate-400' : 'mb-1 block text-xs text-slate-400';
  const inputClass = compact
    ? 'w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-xs'
    : 'w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm';
  const deliveryEditedRef = useRef(deliveryDiffersFromSource(values, deliverySource));

  useEffect(() => {
    if (deliveryEditedRef.current || !deliverySource) return;
    onChange(applyHalabDeliverySource(valuesRef.current, deliverySource));
  }, [deliverySource?.amount, deliverySource?.currency, onChange]);

  function patch(key: keyof HalabRemittanceFields, value: string) {
    onChange({ ...values, [key]: value });
  }

  function patchDeliveryAmount(value: string) {
    deliveryEditedRef.current = true;
    onChange({ ...values, deliveryAmount: value });
  }

  function patchDeliveryCurrency(value: Currency) {
    deliveryEditedRef.current = true;
    onChange({ ...values, deliveryCurrency: value });
  }

  const deliveryCurrency = values.deliveryCurrency ?? deliverySource?.currency ?? 'USD';
  const deliveryStep = isWeightCurrency(deliveryCurrency) ? '0.01' : '1';

  return (
    <div className={`rounded-xl border border-rose-500/30 bg-rose-500/5 space-y-2 ${compact ? 'p-2.5' : 'p-3'}`}>
      <p className={`font-medium text-rose-300 ${compact ? 'text-[10px]' : 'text-xs'}`}>
        بيانات الحوالة (حلب - الفيلات)
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {HALAB_REMITTANCE_EDITOR_FIELDS.map(({ key, label }) => (
          <div key={key}>
            <label className={labelClass}>{label}</label>
            {key === 'transferDate' ? (
              <input
                type="date"
                value={values.transferDate ?? ''}
                onChange={e => patch('transferDate', e.target.value)}
                className={inputClass}
              />
            ) : (
              <input
                type="text"
                value={values[key] ?? ''}
                onChange={e => patch(key, e.target.value)}
                className={inputClass}
                dir={key === 'beneficiaryPhone' || key === 'publicNumber' ? 'ltr' : undefined}
              />
            )}
          </div>
        ))}

        <div className="sm:col-span-2">
          <label className={labelClass}>مبلغ التسليم</label>
          <div className="grid grid-cols-[1fr,auto] gap-2">
            <input
              type="number"
              min="0"
              step={deliveryStep}
              value={values.deliveryAmount ?? ''}
              onChange={e => patchDeliveryAmount(e.target.value)}
              placeholder={getValueInputLabel(deliveryCurrency)}
              className={inputClass}
            />
            <select
              value={deliveryCurrency}
              onChange={e => patchDeliveryCurrency(e.target.value as Currency)}
              className={`${inputClass} min-w-[9rem]`}
            >
              {CURRENCIES.map(c => (
                <option key={c.id} value={c.id}>
                  {c.label} ({c.symbol})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HalabRemittanceSummary({ fields }: { fields: HalabRemittanceFields | undefined }) {
  if (!fields) return null;

  const lines = HALAB_REMITTANCE_EDITOR_FIELDS
    .map(({ key, label }) => {
      const v = fields[key]?.trim();
      return v ? { label, value: v } : null;
    })
    .filter(Boolean) as { label: string; value: string }[];

  const delivery = formatHalabDeliveryDisplay(fields);
  if (delivery) lines.push({ label: 'مبلغ التسليم', value: delivery });

  if (!lines.length) return null;

  return (
    <div className="mt-2 rounded-xl border border-rose-500/20 bg-rose-500/5 p-2.5 space-y-1">
      <p className="text-[10px] font-medium text-rose-300/90">بيانات الحوالة</p>
      {lines.map(line => (
        <p key={line.label} className="text-[10px] text-slate-400">
          <span className="text-slate-500">{line.label}: </span>
          <span className="text-slate-200">{line.value}</span>
        </p>
      ))}
    </div>
  );
}
