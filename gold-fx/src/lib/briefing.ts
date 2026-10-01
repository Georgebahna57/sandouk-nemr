import type { Candle, Direction, PatternHit } from '@/types'
import type { UpcomingRisk } from '@/lib/events'
import { countryName, goldNote } from '@/lib/events'
import { formatLead, isolate } from '@/lib/format'
import { atr, ema, lastNumber, nearestLevels, rsi, sma } from '@/lib/indicators'

export interface Snapshot {
  price: number | null
  rsi: number | null
  atr: number | null
  ema21: number | null
  sma20: number | null
  sma50: number | null
  support: number | null
  resistance: number | null
  trend: Direction
}

export interface Briefing {
  bias: Direction
  headline: string
  confidence: 'منخفضة' | 'متوسطة' | 'أوضح'
  points: string[]
  cautions: string[]
  snapshot: Snapshot
}

function trendOf(price: number | null, ema21: number | null, sma50: number | null): Direction {
  if (price == null || ema21 == null || sma50 == null) return 'neutral'
  if (price > ema21 && ema21 > sma50) return 'bullish'
  if (price < ema21 && ema21 < sma50) return 'bearish'
  return 'neutral'
}

function trendText(trend: Direction): string {
  if (trend === 'bullish') return 'السعر فوق متوسط 21 الأسي، وهذا المتوسط فوق متوسط 50. الهيكل صاعد على هذا الإطار.'
  if (trend === 'bearish') return 'السعر تحت متوسط 21 الأسي، وهذا المتوسط تحت متوسط 50. الهيكل هابط على هذا الإطار.'
  return 'السعر والمتوسطات متداخلان. لا اتجاه نظيف على هذا الإطار.'
}

export function readMarket(candles: Candle[]): Snapshot {
  const closes = candles.map((candle) => candle.close)
  const price = closes.at(-1) ?? null
  const ema21 = lastNumber(ema(closes, 21))
  const sma20 = lastNumber(sma(closes, 20))
  const sma50 = lastNumber(sma(closes, 50))
  const atrValue = lastNumber(atr(candles, 14))
  const minDistance = price != null && atrValue != null ? Math.max(atrValue * 0.6, price * 0.001) : 0
  const levels = price == null ? { support: null, resistance: null } : nearestLevels(candles, price, minDistance)
  return {
    price,
    rsi: lastNumber(rsi(closes, 14)),
    atr: atrValue,
    ema21,
    sma20,
    sma50,
    support: levels.support,
    resistance: levels.resistance,
    trend: trendOf(price, ema21, sma50),
  }
}

export function buildBriefing(
  candles: Candle[],
  patterns: PatternHit[],
  risks: UpcomingRisk[],
  context?: { higher: Snapshot | null; higherLabel: string },
): Briefing {
  const snapshot = readMarket(candles)
  const points = [trendText(snapshot.trend)]
  const cautions: string[] = []
  let score = snapshot.trend === 'bullish' ? 1 : snapshot.trend === 'bearish' ? -1 : 0

  if (snapshot.rsi != null) {
    if (snapshot.rsi >= 70) {
      points.push(`RSI عند ${snapshot.rsi.toFixed(0)}: الصعود ممدود. حتى الميل الصاعد قد يرتاح.`)
      score -= 0.35
    } else if (snapshot.rsi <= 30) {
      points.push(`RSI عند ${snapshot.rsi.toFixed(0)}: الهبوط ممدود. الارتداد محتمل لكن الاتجاه لا ينقلب وحده.`)
      score += 0.35
    } else if (snapshot.rsi >= 55) {
      points.push(`RSI عند ${snapshot.rsi.toFixed(0)}: الزخم يميل للصعود دون مبالغة.`)
      score += 0.4
    } else if (snapshot.rsi <= 45) {
      points.push(`RSI عند ${snapshot.rsi.toFixed(0)}: الزخم يميل للهبوط دون مبالغة.`)
      score -= 0.4
    } else {
      points.push(`RSI عند ${snapshot.rsi.toFixed(0)}: زخم محايد.`)
    }
  }

  const latest = patterns.find((pattern) => pattern.direction !== 'neutral') ?? patterns[0]
  if (latest) {
    points.push(`آخر نمط واضح: ${latest.name}. ${latest.summary}`)
    if (latest.direction === 'bullish') score += latest.strength / 3
    if (latest.direction === 'bearish') score -= latest.strength / 3
  } else {
    points.push('لا نمط شمعة بارز في آخر الشموع. اعتمد على الاتجاه والمستويات.')
  }

  if (snapshot.price != null && snapshot.resistance != null && snapshot.atr) {
    const distance = (snapshot.resistance - snapshot.price) / snapshot.atr
    if (distance < 0.8) cautions.push('المقاومة قريبة نسبة إلى متوسط الحركة. الصعود قد يتباطأ عندها.')
  }
  if (snapshot.price != null && snapshot.support != null && snapshot.atr) {
    const distance = (snapshot.price - snapshot.support) / snapshot.atr
    if (distance < 0.8) cautions.push('الدعم قريب نسبة إلى متوسط الحركة. الهبوط قد يتباطأ عنده.')
  }

  const soon = risks.find((risk) => risk.hours <= 8 && risk.country === 'USD')
  if (soon) {
    cautions.unshift(
      `خلال ${soon.hours < 1 ? 'أقل من ساعة' : formatLead(soon.hours).replace('بعد ', '')}: ${isolate(soon.title)}. ${goldNote({
        title: soon.title,
        country: soon.country,
        date: '',
        impact: soon.impact,
        forecast: '',
        previous: '',
        actual: '',
      })}`,
    )
  } else if (risks[0]) {
    cautions.push(
      `أقرب خبر قوي: ${isolate(risks[0].title)} (${countryName(risks[0].country)}) ${formatLead(risks[0].hours)}.`,
    )
  }

  const bias: Direction = score >= 0.85 ? 'bullish' : score <= -0.85 ? 'bearish' : 'neutral'
  const higher = context?.higher
  const higherAgrees = !higher || higher.trend === 'neutral' || bias === 'neutral' || higher.trend === bias
  if (higher && higher.trend !== 'neutral' && bias !== 'neutral' && higher.trend !== bias) {
    cautions.unshift(
      `الإطار الأعلى (${context?.higherLabel ?? 'الأكبر'}) عكس هذا الميل. قراءة الإطار الصغير وحدها لا تكفي.`,
    )
  }
  const confidence = soon || !higherAgrees ? 'منخفضة' : Math.abs(score) >= 1.5 ? 'أوضح' : 'متوسطة'
  const biasText = bias === 'bullish' ? 'ميل صاعد' : bias === 'bearish' ? 'ميل هابط' : 'ميل متردد'
  const headline = soon
    ? `${biasText}، لكن خبر الدولار قريب والقراءة الفنية أضعف`
    : !higherAgrees
      ? `${biasText} على هذا الإطار، والإطار الأعلى مخالف`
      : biasText

  return { bias, headline, confidence, points, cautions, snapshot }
}
