import type { Candle, Direction, PatternHit } from '@/types'
import type { Snapshot } from '@/lib/briefing'
import { readMarket } from '@/lib/briefing'
import type { UpcomingRisk } from '@/lib/events'
import { formatLead, isolate } from '@/lib/format'

const RECENT_BARS = 6
const MIN_REWARD_RISK = 1.5
const NEWS_BLOCK_HOURS = 6

export interface TradePlan {
  status: 'watch' | 'wait'
  side: 'long' | 'short' | null
  headline: string
  checks: string[]
  missing: string[]
  triggerPrice: number | null
  invalidation: number | null
  target: number | null
  note: string
}

const NOTE =
  'لا توجد صفقة شبه مضمونة على الذهب. الفكرة تنتهي إذا أُغلق السعر وراء الإبطال، والخبر القوي يلغيها. المخاطرة على المحاولة الواحدة تبقى صغيرة.'

export function weeklyCandles(daily: Candle[]): Candle[] {
  const week = 7 * 24 * 3600
  const buckets = new Map<number, Candle>()
  for (const candle of daily) {
    const key = Math.floor(candle.time / week) * week
    const bucket = buckets.get(key)
    if (!bucket) {
      buckets.set(key, { ...candle, time: key })
      continue
    }
    bucket.high = Math.max(bucket.high, candle.high)
    bucket.low = Math.min(bucket.low, candle.low)
    bucket.close = candle.close
  }
  return [...buckets.values()]
}

export function judgeSetup(input: {
  local: Snapshot
  higher: Snapshot | null
  higherLabel: string
  pattern: PatternHit | null
  patternCandle: Candle | null
  candleCount: number
  risks: UpcomingRisk[]
}): TradePlan {
  const { local, higher, higherLabel, pattern, patternCandle, candleCount, risks } = input
  const missing: string[] = []
  const checks: string[] = []
  const news = risks.find((risk) => risk.country === 'USD' && risk.impact === 'High' && risk.hours > 0 && risk.hours <= NEWS_BLOCK_HOURS)

  if (news) {
    missing.push(`خبر أمريكي قوي ${formatLead(news.hours)}: ${isolate(news.title)}. قبل الخبر الفكرة الفنية تُلغى.`)
  }

  if (!higher) missing.push('بانتظار اتجاه الإطار الأعلى.')
  else if (higher.trend === 'neutral') missing.push(`اتجاه ${higherLabel} غير واضح، فلا اتجاه أعلى نبني عليه.`)

  const recent =
    pattern &&
    pattern.direction !== 'neutral' &&
    pattern.strength >= 2 &&
    pattern.index >= candleCount - RECENT_BARS
      ? pattern
      : null
  if (!recent || !patternCandle) missing.push('لا نمط قوي في آخر ست شموع. الشكل الضعيف لا يكفي للدخول.')

  const side = recent?.direction === 'bullish' ? 'long' : recent?.direction === 'bearish' ? 'short' : null
  const withTrend: Direction = side === 'long' ? 'bullish' : 'bearish'

  if (side && higher && higher.trend !== 'neutral') {
    if (higher.trend !== withTrend) missing.push(`الإطار الأعلى (${higherLabel}) عكس النمط. لا دخول عكس الاتجاه الأكبر.`)
    else checks.push(`الاتجاه على ${higherLabel} موافق للنمط.`)
  }

  if (side === 'long' && local.trend === 'bearish') missing.push('هيكل هذا الإطار ما زال هابطاً.')
  if (side === 'short' && local.trend === 'bullish') missing.push('هيكل هذا الإطار ما زال صاعداً.')
  if (side && local.trend === withTrend) checks.push('هيكل الإطار الحالي في نفس الاتجاه.')

  if (local.rsi == null) missing.push('مؤشر الزخم غير جاهز.')
  else if (side === 'long' && (local.rsi < 42 || local.rsi > 65)) {
    missing.push(`RSI عند ${local.rsi.toFixed(0)} خارج منطقة الشراء الهادئة بين 42 و 65.`)
  } else if (side === 'short' && (local.rsi > 58 || local.rsi < 35)) {
    missing.push(`RSI عند ${local.rsi.toFixed(0)} خارج منطقة البيع الهادئة بين 35 و 58.`)
  } else if (side) checks.push(`الزخم ليس مبالغاً، RSI عند ${local.rsi.toFixed(0)}.`)

  let triggerPrice: number | null = null
  let invalidation: number | null = null
  let target: number | null = null

  if (side && patternCandle && local.price != null && local.atr != null && local.atr > 0) {
    const candleRange = patternCandle.high - patternCandle.low
    if (candleRange < local.atr * 0.35) missing.push('شمعة الإشارة ضيقة، والإبطال قريب فيُكسر بسهولة.')

    if (side === 'long') {
      triggerPrice = patternCandle.high
      invalidation = patternCandle.low
      target = local.resistance
      if (local.support == null || local.price - local.support > local.atr * 1.8) {
        missing.push('السعر بعيد عن الدعم. النمط في الفراغ أضعف.')
      } else checks.push('السعر قريب من دعم.')
      if (local.price > triggerPrice + local.atr * 0.5) missing.push('السعر ابتعد فوق شمعة الإشارة. الدخول هنا مطاردة.')
    } else {
      triggerPrice = patternCandle.low
      invalidation = patternCandle.high
      target = local.support
      if (local.resistance == null || local.resistance - local.price > local.atr * 1.8) {
        missing.push('السعر بعيد عن المقاومة. النمط في الفراغ أضعف.')
      } else checks.push('السعر قريب من مقاومة.')
      if (local.price < triggerPrice - local.atr * 0.5) missing.push('السعر ابتعد تحت شمعة الإشارة. الدخول هنا مطاردة.')
    }

    const risk = side === 'long' ? triggerPrice - invalidation : invalidation - triggerPrice
    const reward = target == null ? 0 : side === 'long' ? target - triggerPrice : triggerPrice - target
    if (target == null) missing.push('لا مستوى أبعد يصلح كهدف، فالفكرة بلا مساحة.')
    else if (risk <= 0 || reward / risk < MIN_REWARD_RISK) {
      missing.push('المسافة حتى الهدف أصغر من مرة ونصف المسافة حتى الإبطال.')
    } else checks.push('المسافة حتى الهدف تغطي المخاطرة حتى الإبطال.')
  } else if (side) missing.push('المستويات أو متوسط الحركة غير جاهزة.')

  const ready = missing.length === 0 && side != null
  return {
    status: ready ? 'watch' : 'wait',
    side: ready ? side : null,
    headline: ready
      ? side === 'long'
        ? 'شروط مراقبة شراء اجتمعت. هذا ليس دخولاً مضموناً.'
        : 'شروط مراقبة بيع اجتمعت. هذا ليس دخولاً مضموناً.'
      : 'لا توجد فكرة دخول. النواقص أهم من أي شكل جميل.',
    checks,
    missing,
    triggerPrice: ready ? triggerPrice : null,
    invalidation: ready ? invalidation : null,
    target: ready ? target : null,
    note: NOTE,
  }
}

export function buildTradePlan(
  candles: Candle[],
  patterns: PatternHit[],
  higherCandles: Candle[],
  higherLabel: string,
  risks: UpcomingRisk[],
): TradePlan | null {
  if (candles.length < 55) return null
  const local = readMarket(candles)
  const higher = higherCandles.length >= 55 ? readMarket(higherCandles) : null
  const pattern = patterns.find((item) => item.direction !== 'neutral' && item.strength >= 2) ?? null
  const patternCandle = pattern ? (candles[pattern.index] ?? null) : null
  return judgeSetup({
    local,
    higher,
    higherLabel,
    pattern,
    patternCandle,
    candleCount: candles.length,
    risks,
  })
}
