import type { HalabRemittanceFields } from '../types';
import { HALAB_REMITTANCE_LABELS } from '../lib/halabRemittance';

interface Props {
  values: HalabRemittanceFields;
  onChange: (next: HalabRemittanceFields) => void;
  compact?: boolean;
}

export function HalabRemittanceFieldsEditor({ values, onChange, compact = false }: Props) {
  const labelClass = compact ? 'mb-1 block text-[10px] text-slate-400' : 'mb-1 block text-xs text-slate-400';
  const inputClass = compact
    ? 'w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-xs'
    : 'w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm';

  function patch(key: keyof HalabRemittanceFields, value: string) {
    onChange({ ...values, [key]: value });
  }

  return (
    <div className={`rounded-xl border border-rose-500/30 bg-rose-500/5 space-y-2 ${compact ? 'p-2.5' : 'p-3'}`}>
      <p className={`font-medium text-rose-300 ${compact ? 'text-[10px]' : 'text-xs'}`}>
        بيانات الحوالة (حلب - الفيلات)
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {HALAB_REMITTANCE_LABELS.map(({ key, label }) => (
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
      </div>
    </div>
  );
}

export function HalabRemittanceSummary({ fields }: { fields: HalabRemittanceFields | undefined }) {
  if (!fields) return null;
  const lines = HALAB_REMITTANCE_LABELS
    .map(({ key, label }) => {
      const v = fields[key]?.trim();
      return v ? { label, value: v } : null;
    })
    .filter(Boolean) as { label: string; value: string }[];

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
