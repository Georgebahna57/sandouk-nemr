import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Lock, Shield } from 'lucide-react';
import { isEditUnlocked, lockEditSession, unlockEditSession, verifyEditPin } from '../lib/editProtection';

interface PendingAction {
  run: () => void;
  label: string;
}

interface EditProtectionContextValue {
  isUnlocked: boolean;
  lockNow: () => void;
  /** يطلب الرمز 2233 للتعديل والحذف فقط */
  guard: (action: () => void, label: string) => void;
}

const EditProtectionContext = createContext<EditProtectionContextValue | null>(null);

export function useEditProtection(): EditProtectionContextValue {
  const ctx = useContext(EditProtectionContext);
  if (!ctx) throw new Error('useEditProtection outside provider');
  return ctx;
}

export function EditProtectionProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [error, setError] = useState('');
  const [unlocked, setUnlocked] = useState(() => isEditUnlocked());

  const finishUnlock = useCallback((action?: PendingAction) => {
    unlockEditSession();
    setUnlocked(true);
    setPending(null);
    setPinInput('');
    setError('');
    action?.run();
  }, []);

  const guard = useCallback(
    (action: () => void, label: string) => {
      if (unlocked || isEditUnlocked()) {
        setUnlocked(true);
        action();
        return;
      }
      setPending({ run: action, label });
      setError('');
    },
    [unlocked],
  );

  const lockNow = useCallback(() => {
    lockEditSession();
    setUnlocked(false);
  }, []);

  const submitUnlock = () => {
    if (!verifyEditPin(pinInput)) {
      setError('رمز غير صحيح');
      return;
    }
    finishUnlock(pending ?? undefined);
  };

  const value = useMemo(
    () => ({
      isUnlocked: unlocked || isEditUnlocked(),
      lockNow,
      guard,
    }),
    [unlocked, lockNow, guard],
  );

  return (
    <EditProtectionContext.Provider value={value}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm">
          <div className="card w-full max-w-sm p-4 space-y-3 border border-amber-500/30">
            <div className="flex items-center gap-2 text-amber-400">
              <Shield className="h-5 w-5" />
              <h3 className="font-bold text-sm">حماية التعديل والحذف</h3>
            </div>
            <p className="text-xs text-slate-400">{pending.label}</p>
            <p className="text-sm text-slate-300">أدخل الرمز للمتابعة (صلاحية 30 دقيقة).</p>
            <input
              type="password"
              inputMode="numeric"
              className="input-field num text-center tracking-widest"
              placeholder="••••"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              autoFocus
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => {
                  setPending(null);
                  setPinInput('');
                  setError('');
                }}
              >
                إلغاء
              </button>
              <button type="button" className="btn-primary text-sm" onClick={submitUnlock}>
                تأكيد
              </button>
            </div>
          </div>
        </div>
      )}
    </EditProtectionContext.Provider>
  );
}

export function EditLockBadge() {
  const { isUnlocked, lockNow } = useEditProtection();
  return (
    <button
      type="button"
      className={`text-xs flex items-center gap-1 px-2 py-1 rounded-lg border ${
        isUnlocked
          ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
          : 'border-slate-600 text-slate-400'
      }`}
      onClick={() => isUnlocked && lockNow()}
      title={isUnlocked ? 'قفل التعديل والحذف' : 'التعديل والحذف مقفولان — يُطلب الرمز'}
    >
      <Lock className="h-3.5 w-3.5" />
      {isUnlocked ? 'التعديل/الحذف مفتوح' : 'التعديل/الحذف مقفول'}
    </button>
  );
}
