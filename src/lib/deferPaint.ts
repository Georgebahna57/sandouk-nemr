/** يؤجّل العمل الثقيل حتى بعد إطار الرسم التالي — يحسّن INP */
export function deferToNextPaint(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}
