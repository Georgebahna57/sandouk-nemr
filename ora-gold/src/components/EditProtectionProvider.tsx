import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Lock, Shield } from 'lucide-react';
import { isEditUnlocked, lockEditSession, unlockEditSession, verifyEditPin } from '../lib/editProtection';

interface PendingAction {
  run: () => void;
  label: string;
}

interface EditProtectionContextValue {
  hasPin: boolean;
  isUnlocked: boolean;
  setEditPin: (pin: string) => void;
  clearEditPin: () => void;
  lockNow: () => void;
  guard: (action: () => void, label: string) => void;
}

const EditProtectionContext = createContext<EditProtectionContextValue | null>(null);

export function useEditProtection(): EditProtectionContextValue {
  const ctx = useContext(EditProtectionContext);
  if (!ctx) throw new Error('useEditProtection outside provider');
  return ctx;
}

interface Props {
  editPin?: string;
  onEditPinChange: (pin: string | undefined) => void;
  children: React.ReactNode;
}

export function EditProtectionProvider({ editPin, onEditPinChange, children }: Props) {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState('');
  const [unlocked, setUnlocked] = useState(() => isEditUnlocked());

  const hasPin = Boolean(editPin?.length);

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
      if (!hasPin) {
        setPending({ run: action, label });
        setError('');
        return;
      }
      if (unlocked || isEditUnlocked()) {
        setUnlocked(true);
        action();
        return;
      }
      setPending({ run: action, label });
      setError('');
    },
    [hasPin, unlocked],
  );

  const lockNow = useCallback(() => {
    lockEditSession();
    setUnlocked(false);
  }, []);

  const setEditPin = useCallback(
    (pin: string) => {
      const trimmed = pin.trim();
      if (trimmed.length < 4) return;
      onEditPinChange(trimmed);
      finishUnlock();
    },
    [onEditPinChange, finishUnlock],
  );

  const clearEditPin = useCallback(() => {
    onEditPinChange(undefined);
    lockNow();
  }, [onEditPinChange, lockNow]);

  const submitUnlock = () => {
    if (!hasPin) {
      if (newPin.trim().length < 4) {
        setError('الرمز 4 أرقام على الأقل');
        return;
      }
      onEditPinChange(newPin.trim());
      finishUnlock(pending ?? undefined);
      setNewPin('');
      return;
    }
    if (!verifyEditPin(pinInput, editPin)) {
      setError('رمز غير صحيح');
      return;
    }
    finishUnlock(pending ?? undefined);
  };

  const value = useMemo(
    () => ({
      hasPin,
      isUnlocked: unlocked || isEditUnlocked(),
      setEditPin,
      clearEditPin,
      lockNow,
      guard,
    }),
    [hasPin, unlocked, setEditPin, clearEditPin, lockNow, guard],
  );

  return (
    <EditProtectionContext.Provider value={value}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm">
          <div className="card w-full max-w-sm p-4 space-y-3 border border-amber-500/30">
            <div className="flex items-center gap-2 text-amber-400">
              <Shield className="h-5 w-5" />
              <h3 className="font-bold text-sm">حماية التعديل</h3>
            </div>
            <p className="text-xs text-slate-400">{pending.label}</p>
            {!hasPin ? (
              <>
                <p className="text-sm text-slate-300">أنشئ رمزًا سريًا (4 أرقام أو أكثر) لحماية التعديل والحذف.</p>
                <input
                  type="password"
                  className="input-field num text-center tracking-widest"
                  placeholder="رمز جديد"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  autoFocus
                />
              </>
            ) : (
              <>
                <p className="text-sm text-slate-300">أدخل الرمز للمتابعة (صلاحية 30 دقيقة).</p>
                <input
                  type="password"
                  className="input-field num text-center tracking-widest"
                  placeholder="••••"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  autoFocus
                />
              </>
            )}
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => {
                  setPending(null);
                  setPinInput('');
                  setNewPin('');
                  setError('');
                }}
              >
                إلغاء
              </button>
              <button type="button" className="btn-primary text-sm" onClick={submitUnlock}>
                {hasPin ? 'تأكيد' : 'إنشاء الرمز'}
              </button>
            </div>
          </div>
        </div>
      )}
    </EditProtectionContext.Provider>
  );
}

export function EditLockBadge() {
  const { isUnlocked, hasPin, lockNow } = useEditProtection();
  if (!hasPin) return null;
  return (
    <button
      type="button"
      className={`text-xs flex items-center gap-1 px-2 py-1 rounded-lg border ${
        isUnlocked
          ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
          : 'border-slate-600 text-slate-400'
      }`}
      onClick={() => isUnlocked && lockNow()}
      title={isUnlocked ? 'قفل التعديل' : 'التعديل مقفول'}
    >
      <Lock className="h-3.5 w-3.5" />
      {isUnlocked ? 'التعديل مفتوح' : 'التعديل مقفول'}
    </button>
  );
}
