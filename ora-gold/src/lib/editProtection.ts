const SESSION_KEY = 'workshop-edit-unlock-until';
const UNLOCK_MS = 30 * 60 * 1000;

export function isEditUnlocked(): boolean {
  try {
    const until = parseInt(sessionStorage.getItem(SESSION_KEY) ?? '0', 10);
    return until > Date.now();
  } catch {
    return false;
  }
}

export function unlockEditSession(): void {
  sessionStorage.setItem(SESSION_KEY, String(Date.now() + UNLOCK_MS));
}

export function lockEditSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

export function verifyEditPin(input: string, storedPin?: string): boolean {
  if (!storedPin) return false;
  return input.trim() === storedPin;
}
