import { BOX_FUNDS } from '../config';
import type { FundId } from '../types';

interface Props {
  homeFundId: FundId;
  value: FundId[];
  onChange: (ids: FundId[]) => void;
  fundOptions?: typeof BOX_FUNDS;
}

export function SharedFundIdsField({
  homeFundId,
  value,
  onChange,
  fundOptions = BOX_FUNDS,
}: Props) {
  const options = fundOptions.filter(f => f.id !== homeFundId);

  function toggle(fundId: FundId) {
    onChange(
      value.includes(fundId)
        ? value.filter(id => id !== fundId)
        : [...value, fundId],
    );
  }

  if (!options.length) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400">مشترك مع صناديق (اختياري):</p>
      <div className="flex flex-wrap gap-2">
        {options.map(f => {
          const checked = value.includes(f.id);
          return (
            <label
              key={f.id}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${
                checked
                  ? 'border-sky-500/50 bg-sky-500/15 text-sky-300'
                  : 'border-slate-600 bg-slate-900/60 text-slate-400'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(f.id)}
                className="rounded"
              />
              {f.shortName}
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function formatSharedFundLabels(ids: FundId[] | undefined, fundOptions = BOX_FUNDS): string {
  if (!ids?.length) return '';
  return ids
    .map(id => fundOptions.find(f => f.id === id)?.shortName ?? id)
    .join('، ');
}
