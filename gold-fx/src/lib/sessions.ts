export interface Session {
  name: string
  open: boolean
}

export function openSessions(now = new Date()): Session[] {
  const hour = now.getUTCHours() + now.getUTCMinutes() / 60
  const inRange = (start: number, end: number) => (start <= end ? hour >= start && hour < end : hour >= start || hour < end)
  return [
    { name: 'سيدني', open: inRange(22, 7) },
    { name: 'طوكيو', open: inRange(0, 9) },
    { name: 'لندن', open: inRange(7, 16) },
    { name: 'نيويورك', open: inRange(12, 21) },
  ]
}

export function sessionNote(sessions: Session[]): string {
  const london = sessions.find((session) => session.name === 'لندن')?.open
  const newYork = sessions.find((session) => session.name === 'نيويورك')?.open
  if (london && newYork) return 'تداخل لندن ونيويورك: أنشط وقت لحركة الأونصة.'
  if (london) return 'جلسة لندن مفتوحة. السيولة على الذهب عادة أفضل من جلسة آسيا.'
  if (newYork) return 'جلسة نيويورك مفتوحة. أخبار الدولار هنا تحرّك الذهب بسرعة.'
  const open = sessions.filter((session) => session.open).map((session) => session.name)
  if (open.length) return `جلسة ${open.join(' و')} مفتوحة. الحركة في آسيا غالباً أهدأ ما لم يصدر خبر.`
  return 'لا جلسة رئيسية مفتوحة الآن. السيولة أضعف والسبريد قد يتسع.'
}
