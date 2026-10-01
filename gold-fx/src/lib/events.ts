import type { EcoEvent } from '@/types'
import { hoursUntil } from '@/lib/format'

const COUNTRIES: Record<string, string> = {
  USD: 'الدولار',
  EUR: 'اليورو',
  GBP: 'الإسترليني',
  JPY: 'الين',
  CNY: 'اليوان',
  CHF: 'الفرنك',
  AUD: 'أستراليا',
  CAD: 'كندا',
  NZD: 'نيوزيلندا',
}

const MAJOR = new Set(['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'CHF'])

export function countryName(code: string): string {
  return COUNTRIES[code] ?? code
}

export function impactName(impact: string): string {
  if (impact === 'High') return 'قوي'
  if (impact === 'Medium') return 'متوسط'
  return 'ضعيف'
}

type Surprise = 'usd-up' | 'usd-down' | 'rate'

export function surpriseKind(title: string): Surprise | null {
  const text = title.toLowerCase()
  if (/fed funds|interest rate|cash rate|official bank rate|rate decision|fomc statement|ecb interest|boe interest/.test(text)) {
    return 'rate'
  }
  if (/unemployment rate|jobless claims|continuing claims|claimant count/.test(text)) return 'usd-down'
  if (
    /non-farm|nonfarm|employment change|adp|average hourly|cpi|ppi|pce|retail sales|gdp|ism|pmi|durable goods|consumer confidence|jolts|building permits|housing starts|philly|empire state/.test(
      text,
    )
  ) {
    return 'usd-up'
  }
  return null
}

export function goldNote(event: EcoEvent): string {
  const text = event.title.toLowerCase()
  if (/non-farm|nonfarm/.test(text)) {
    return 'وظائف أمريكا خارج الزراعة. رقم أقوى من المتوقع غالباً يقوّي الدولار ويضغط على الذهب، والرقم الأضعف يدعمه. التقلب يقفز لحظة الصدور.'
  }
  if (/unemployment rate/.test(text)) {
    return 'بطالة أعلى من المتوقع تُضعف الدولار عادة وتريح الذهب. بطالة أدنى تفعل العكس.'
  }
  if (/average hourly/.test(text)) {
    return 'أجر الساعة يقيس ضغط الأجور. تسارع الأجور يرفع قلق التضخم وقد يضغط على الذهب عبر توقعات الفائدة.'
  }
  if (/cpi|ppi|pce|inflation/.test(text)) {
    return 'تضخم أعلى من المتوقع يرفع احتمال فائدة مرتفعة، وهذا غالباً يضغط على الذهب. مفاجأة أضعف تدعمه.'
  }
  if (/fed funds|fomc|interest rate|powell/.test(text)) {
    return 'الفائدة وتلميحات الفيدرالي من أقوى محركات الأونصة. فائدة أعلى أو لهجة متشددة تضغط على الذهب، والتيسير أو التلميح للخفض يدعمانه.'
  }
  if (/gdp/.test(text)) {
    return 'نمو أقوى يدعم الدولار عادة ويحدّ من الذهب. نمو أضعف يفتح باب التيسير وقد يدعم الأونصة.'
  }
  if (/retail sales|consumer confidence|ism|pmi/.test(text)) {
    return 'نشاط أقوى من المتوقع يدعم الدولار غالباً. الذهب يتفاعل أكثر إذا غيّرت النتيجة توقعات الفائدة.'
  }
  if (/jobless claims/.test(text)) {
    return 'طلبات إعانة أعلى تعني سوق عمل أضعف، وهذا غالباً يريح الذهب. الطلبات الأقل تدعم الدولار.'
  }
  if (event.country === 'USD' && event.impact === 'High') {
    return 'خبر أمريكي عالي التأثير. الذهب يتحرك مع الدولار وعوائد السندات وقت الصدور، والقراءة الفنية قبله تكون أضعف.'
  }
  if (event.impact === 'High') {
    return 'خبر عالي التأثير من اقتصاد كبير. قد يحرّك الدولار وبالتالي الذهب حتى لو لم يكن الخبر أمريكياً.'
  }
  return 'أثره المباشر على الذهب أضعف من الفائدة والتضخم ووظائف أمريكا، لكنه يفيد كسياق للدولار.'
}

export function surpriseGuide(event: EcoEvent): string | null {
  const kind = surpriseKind(event.title)
  if (!kind || !event.forecast) return null
  if (kind === 'usd-up') {
    return `إذا جاءت النتيجة أعلى من المتوقع (${event.forecast}) فالدولار غالباً يقوى والذهب يتعرض لضغط. إذا جاءت أضعف من ${event.forecast}، الذهب يجد دعماً.`
  }
  if (kind === 'usd-down') {
    return `إذا جاءت النتيجة أعلى من المتوقع (${event.forecast}) فالدولار غالباً يضعف والذهب يجد دعماً. نتيجة أضعف من ${event.forecast} تضغط على الذهب.`
  }
  return `إذا ثبتت الفائدة أعلى من المتوقع (${event.forecast}) فالضغط يزيد على الذهب. تثبيت أدنى أو تلميح للتيسير يدعمانه.`
}

export function isGoldRelevant(event: EcoEvent, includeUsdMedium = true): boolean {
  if (event.country === 'USD' && event.impact === 'High') return true
  if (includeUsdMedium && event.country === 'USD' && event.impact === 'Medium') return true
  return MAJOR.has(event.country) && event.impact === 'High'
}

export interface UpcomingRisk {
  title: string
  country: string
  impact: string
  hours: number
}

export function upcomingRisks(events: EcoEvent[], now = Date.now()): UpcomingRisk[] {
  return events
    .filter((event) => event.impact === 'High' && (event.country === 'USD' || MAJOR.has(event.country)))
    .map((event) => ({ event, hours: hoursUntil(event.date, now) }))
    .filter((item): item is { event: EcoEvent; hours: number } => item.hours != null && item.hours > 0 && item.hours <= 36)
    .sort((a, b) => a.hours - b.hours)
    .slice(0, 3)
    .map(({ event, hours }) => ({
      title: event.title,
      country: event.country,
      impact: event.impact,
      hours,
    }))
}

export function newsTopic(title: string): string {
  const text = title.toLowerCase()
  if (/fed|fomc|powell|interest rate|rate cut|rate hike/.test(text)) return 'الفائدة والفيدرالي'
  if (/inflation|cpi|ppi|pce/.test(text)) return 'التضخم'
  if (/nfp|payroll|jobs|unemployment|labor/.test(text)) return 'وظائف أمريكا'
  if (/dollar|dxy|treasury|yield/.test(text)) return 'الدولار والعوائد'
  if (/war|geopolit|safe[- ]haven|sanction|conflict/.test(text)) return 'الملاذ الآمن'
  if (/silver|platinum|copper|commodit/.test(text)) return 'المعادن'
  if (/gold|xau|bullion|ounce/.test(text)) return 'سعر الذهب'
  return 'أسواق'
}
