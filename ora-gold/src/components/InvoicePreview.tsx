import { formatNumber } from '../lib/format';
import type { InvoicePosting } from '../types';

interface Props {
  postings: InvoicePosting[];
  description: string;
}

export function InvoicePreview({ postings, description }: Props) {
  if (!postings.length) {
    return (
      <div className="card p-4 text-sm text-slate-500 text-center">
        أدخل البيانات لمعاينة التوزيع على الحسابات
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-700 bg-slate-800/50 px-4 py-3">
        <h3 className="font-semibold text-amber-400">معاينة التوزيع</h3>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full table-ledger text-sm">
          <thead>
            <tr>
              <th>الحساب</th>
              <th>النوع</th>
              <th>مدين / خروج</th>
              <th>دائن / دخول</th>
              <th>ملاحظة</th>
            </tr>
          </thead>
          <tbody>
            {postings.map((p, i) => (
              <tr key={`${p.accountId}-${p.side}-${i}`}>
                <td className="font-medium">{p.accountName}</td>
                <td>{p.side === 'gold' ? 'ذهب 995' : 'دولار'}</td>
                <td className="num">{p.debit ? formatNumber(p.debit, p.side === 'gold' ? 4 : 2) : '—'}</td>
                <td className="num">{p.credit ? formatNumber(p.credit, p.side === 'gold' ? 4 : 2) : '—'}</td>
                <td className="text-slate-400 text-xs">{p.note ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
