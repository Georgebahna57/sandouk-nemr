import type { Candle } from '@/types'

export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = Array(values.length).fill(null)
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= period) sum -= values[i - period]
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = Array(values.length).fill(null)
  if (values.length < period) return out
  let seed = 0
  for (let i = 0; i < period; i++) seed += values[i]
  let previous = seed / period
  out[period - 1] = previous
  const k = 2 / (period + 1)
  for (let i = period; i < values.length; i++) {
    previous = values[i] * k + previous * (1 - k)
    out[i] = previous
  }
  return out
}

export function rsi(closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = Array(closes.length).fill(null)
  if (closes.length <= period) return out
  let gain = 0
  let loss = 0
  for (let i = 1; i <= period; i++) {
    const delta = closes[i] - closes[i - 1]
    if (delta >= 0) gain += delta
    else loss -= delta
  }
  let avgGain = gain / period
  let avgLoss = loss / period
  const value = (ag: number, al: number) => (al === 0 ? 100 : 100 - 100 / (1 + ag / al))
  out[period] = value(avgGain, avgLoss)
  for (let i = period + 1; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1]
    avgGain = (avgGain * (period - 1) + (delta > 0 ? delta : 0)) / period
    avgLoss = (avgLoss * (period - 1) + (delta < 0 ? -delta : 0)) / period
    out[i] = value(avgGain, avgLoss)
  }
  return out
}

export function atr(candles: Candle[], period = 14): (number | null)[] {
  const out: (number | null)[] = Array(candles.length).fill(null)
  if (candles.length <= period) return out
  const trueRanges: number[] = []
  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i]
    if (i === 0) {
      trueRanges.push(candle.high - candle.low)
      continue
    }
    const previousClose = candles[i - 1].close
    trueRanges.push(
      Math.max(
        candle.high - candle.low,
        Math.abs(candle.high - previousClose),
        Math.abs(candle.low - previousClose),
      ),
    )
  }
  let sum = 0
  for (let i = 1; i <= period; i++) sum += trueRanges[i]
  let previous = sum / period
  out[period] = previous
  for (let i = period + 1; i < candles.length; i++) {
    previous = (previous * (period - 1) + trueRanges[i]) / period
    out[i] = previous
  }
  return out
}

export function lastNumber(values: (number | null)[]): number | null {
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] != null) return values[i]
  }
  return null
}

export function swingLevels(candles: Candle[], wing = 2): { highs: number[]; lows: number[] } {
  const highs: number[] = []
  const lows: number[] = []
  for (let i = wing; i < candles.length - wing; i++) {
    let isHigh = true
    let isLow = true
    for (let j = i - wing; j <= i + wing; j++) {
      if (j === i) continue
      if (candles[j].high >= candles[i].high) isHigh = false
      if (candles[j].low <= candles[i].low) isLow = false
    }
    if (isHigh) highs.push(candles[i].high)
    if (isLow) lows.push(candles[i].low)
  }
  return { highs, lows }
}

export function nearestLevels(
  candles: Candle[],
  price: number,
  minDistance = 0,
): { support: number | null; resistance: number | null } {
  const { highs, lows } = swingLevels(candles, 3)
  const window = candles.slice(-80, -1)
  const candidatesHigh = window.length ? [...highs, Math.max(...window.map((candle) => candle.high))] : highs
  const candidatesLow = window.length ? [...lows, Math.min(...window.map((candle) => candle.low))] : lows
  const resistance = candidatesHigh.filter((level) => level >= price + minDistance).sort((a, b) => a - b)[0] ?? null
  const support = candidatesLow.filter((level) => level <= price - minDistance).sort((a, b) => b - a)[0] ?? null
  return { support, resistance }
}
