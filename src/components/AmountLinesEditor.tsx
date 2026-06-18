import { Plus, Trash2 } from 'lucide-react';
import { CURRENCIES, getValueInputLabel, isWeightCurrency } from '../config';
import type { Currency } from '../types';

export interface AmountLine {
  id: string;
  currency: Currency;
  amount: string;
}

interface Props {
  lines: AmountLine[];
  onChange: (lines: AmountLine[]) => void;
}

function assetOptionLabel(c: (typeof CURRENCIES)[number]) {
  return c.kind === 'weight' ? `${c.label} (غرام)` : `${c.label} (${c.symbol})`;
}

function newLine(currency: Currency = 'USD'): AmountLine {
  return { id: crypto.randomUUID(), currency, amount: '' };
}

export function createDefaultLines(): AmountLine[] {
  return [newLine()];
}

export function parseAmountLines(lines: AmountLine[]): { currency: Currency; amount: number }[] {
  return lines
    .map(line => ({
      currency: line.currency,
      amount: Number(line.amount.replace(/,/g, '')) || 0,
    }))
    .filter(line => line.amount > 0);
}

export function AmountLinesEditor({ lines, onChange }: Props) {
  function updateLine(id: string, patch: Partial<AmountLine>) {
    onChange(lines.map(line => (line.id === id ? { ...line, ...patch } : line)));
  }

  function addLine() {
    const used = new Set(lines.map(l => l.currency));
    const next = CURRENCIES.find(c => !used.has(c.id))?.id ?? 'USD';
    onChange([...lines, newLine(next)]);
  }

  function removeLine(id: string) {
    if (lines.length <= 1) {
      onChange([newLine()]);
      return;
    }
    onChange(lines.filter(line => line.id !== id));
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400">البنود — فيك تضيف أكثر من عملة / ذهب / فضة</p>
      {lines.map((line, index) => {
        const step = isWeightCurrency(line.currency) ? '0.01' : '1';
        const valueLabel = getValueInputLabel(line.currency);
        return (
          <div key={line.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
            <select
              value={line.currency}
              onChange={e => updateLine(line.id, { currency: e.target.value as Currency })}
              className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm"
            >
              {CURRENCIES.map(c => (
                <option key={c.id} value={c.id}>{assetOptionLabel(c)}</option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              step={step}
              placeholder={valueLabel}
              value={line.amount}
              onChange={e => updateLine(line.id, { amount: e.target.value })}
              className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm"
              required={index === 0}
            />
            <button
              type="button"
              onClick={() => removeLine(line.id)}
              className="rounded-lg p-2 text-slate-500 hover:bg-rose-600/20 hover:text-rose-400"
              aria-label="حذف البند"
            >
              <Trash2 size={14} />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={addLine}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-600 py-2 text-xs text-slate-400 hover:border-amber-500/50 hover:text-amber-400"
      >
        <Plus size={14} />
        إضافة بند
      </button>
    </div>
  );
}
