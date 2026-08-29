import { useEffect, useState } from 'react';
import { Loader2, ScrollText } from 'lucide-react';
import {
  AUDIT_ACTION_LABELS,
  fetchAuditLog,
  type AuditEntry,
} from '../lib/auditLog';

export function AuditLogSection() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuditLog(80)
      .then(setEntries)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mb-4 rounded-2xl border border-slate-600/80 bg-slate-800/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <ScrollText size={18} className="text-sky-400" />
        <div>
          <p className="font-medium text-slate-200">سجل التغييرات</p>
          <p className="text-xs text-slate-500">تعديل حسابات، مطابقات، وحذف</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-slate-500" size={24} />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-center text-sm text-slate-500">لا يوجد سجل بعد</p>
      ) : (
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {entries.map(entry => (
            <div
              key={entry.id}
              className="rounded-xl border border-slate-700/80 bg-slate-900/50 px-3 py-2 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-amber-300">
                  {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                </span>
                <span className="text-slate-500">
                  {new Date(entry.at).toLocaleString('ar-SY', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <p className="mt-1 text-slate-300">
                {entry.userName}
                {entry.fundId && <span className="text-slate-500"> · {entry.fundId}</span>}
              </p>
              {entry.details && (
                <p className="mt-0.5 text-slate-500">{entry.details}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
