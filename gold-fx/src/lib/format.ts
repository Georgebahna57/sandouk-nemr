export function money(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function signed(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return '—'
  const text = money(Math.abs(value), digits)
  if (value > 0) return `+${text}`
  if (value < 0) return `-${text}`
  return text
}

const dateTime = new Intl.DateTimeFormat('ar', {
  timeZone: 'Asia/Damascus',
  numberingSystem: 'latn',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const dateWeekTime = new Intl.DateTimeFormat('ar', {
  timeZone: 'Asia/Damascus',
  numberingSystem: 'latn',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function candleTime(unixSeconds: number): string {
  return dateTime.format(new Date(unixSeconds * 1000))
}

export function eventTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return dateWeekTime.format(date)
}

export function hoursUntil(iso: string, now = Date.now()): number | null {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return (date.getTime() - now) / 3_600_000
}

export function formatLead(hours: number): string {
  if (hours < 1) return 'بعد أقل من ساعة'
  const total = Math.round(hours * 60)
  const wholeHours = Math.floor(total / 60)
  const minutes = total % 60
  if (wholeHours === 0) return `بعد ${minutes} د`
  if (minutes < 5) return `بعد ${wholeHours} س`
  return `بعد ${wholeHours} س و ${minutes} د`
}

export function isolate(text: string): string {
  return `\u2068${text}\u2069`
}

export function relativeNews(iso: string | null, now = Date.now()): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const minutes = Math.round((now - date.getTime()) / 60_000)
  if (minutes < 1) return 'الآن'
  if (minutes < 60) return `قبل ${minutes} د`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `قبل ${hours} س`
  const days = Math.round(hours / 24)
  return `قبل ${days} ي`
}
