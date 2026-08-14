import { useEffect, useState } from 'react';

/** يؤخّر تحديث القيمة — مفيد لحقول البحث بدون إعادة رسم كامل الصفحة */
export function useDebouncedValue<T>(value: T, delayMs = 200): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
