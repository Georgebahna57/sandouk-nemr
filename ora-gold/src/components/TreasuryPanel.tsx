import { formatNumber } from '../lib/format';
import type { TreasuryItem } from '../types';

interface Props {
  items: TreasuryItem[];
  onChange: (items: TreasuryItem[]) => void;
}

export function TreasuryPanel({ items, onChange }: Props) {
  const update = (id: string, field: keyof TreasuryItem, value: string) => {
    const num = value === '' ? undefined : parseFloat(value);
    onChange(items.map((t) => (t.id === id ? { ...t, [field]: num } : t)));
  };

  const totalWeight = items.reduce((s, t) => s + (t.weight ?? 0), 0);
  const totalGold995 = items.reduce((s, t) => s + (t.gold995 ?? 0), 0);
  const totalUsd = items.reduce((s, t) => s + (t.usd ?? 0), 0);

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-700 bg-slate-800/50 px-4 py-3">
        <h2 className="text-lg font-bold text-amber-400">خزنة رئيسية — جرد المخزون</h2>
        <p className="text-xs text-slate-400">أوزان الذهب والفضة والدولار في الصندوق</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full table-ledger">
          <thead>
            <tr>
              <th>النوع</th>
              <th>دولار</th>
              <th>وزن</th>
              <th>ذهب 995</th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id}>
                <td className="font-medium">{t.label}</td>
                <td>
                  <input type="number" step="any" className="input-field num w-28" value={t.usd ?? ''} onChange={(e) => update(t.id, 'usd', e.target.value)} />
                </td>
                <td>
                  <input type="number" step="any" className="input-field num w-28" value={t.weight ?? ''} onChange={(e) => update(t.id, 'weight', e.target.value)} />
                </td>
                <td>
                  <input type="number" step="any" className="input-field num w-28" value={t.gold995 ?? ''} onChange={(e) => update(t.id, 'gold995', e.target.value)} />
                </td>
              </tr>
            ))}
            <tr className="ledger-total-row font-bold">
              <td className="text-amber-400">المجموع</td>
              <td className="num">{formatNumber(totalUsd)}</td>
              <td className="num">{formatNumber(totalWeight, 4)}</td>
              <td className="num">{formatNumber(totalGold995, 4)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
