import assert from 'node:assert/strict'
import test from 'node:test'
import { buildBriefing } from './briefing.ts'
import { goldNote, isGoldRelevant, newsTopic, surpriseGuide } from './events.ts'
import { nearestLevels, rsi, sma } from './indicators.ts'
import { describeCandle, detectPatterns } from './patterns.ts'
import type { Candle, EcoEvent } from '../types.ts'

function candle(time: number, open: number, high: number, low: number, close: number): Candle {
  return { time, open, high, low, close }
}

test('simple moving average uses the latest window', () => {
  assert.deepEqual(sma([1, 2, 3, 4], 2), [null, 1.5, 2.5, 3.5])
})

test('rsi rises toward 100 in a steady uptrend', () => {
  const closes = Array.from({ length: 30 }, (_, index) => 100 + index)
  const value = rsi(closes, 14).at(-1)
  assert.ok(value != null && value > 90)
})

test('detects a hammer after a decline', () => {
  const candles: Candle[] = []
  let price = 120
  for (let i = 0; i < 8; i++) {
    const open = price
    const close = price - 1.2
    candles.push(candle(i, open, open + 0.15, close - 0.15, close))
    price = close
  }
  candles.push(candle(8, price, price + 0.35, price - 3.2, price + 0.25))
  const names = detectPatterns(candles).map((pattern) => pattern.name)
  assert.ok(names.includes('مطرقة'))
})

test('detects a shooting star after a rally', () => {
  const candles: Candle[] = []
  let price = 80
  for (let i = 0; i < 8; i++) {
    const open = price
    const close = price + 1.2
    candles.push(candle(i, open, close + 0.15, open - 0.15, close))
    price = close
  }
  candles.push(candle(8, price, price + 3.2, price - 0.1, price - 0.2))
  const names = detectPatterns(candles).map((pattern) => pattern.name)
  assert.ok(names.includes('نجمة ساقطة'))
})

test('detects a bullish engulfing candle', () => {
  const candles: Candle[] = []
  let price = 100
  for (let i = 0; i < 6; i++) {
    candles.push(candle(i, price, price + 1, price - 1, price + 0.2))
    price += 0.2
  }
  const bearOpen = price + 1
  const bearClose = price - 1
  candles.push(candle(6, bearOpen, bearOpen + 0.2, bearClose - 0.2, bearClose))
  candles.push(candle(7, bearClose - 0.3, bearOpen + 0.8, bearClose - 0.4, bearOpen + 0.6))
  const hit = detectPatterns(candles).find((pattern) => pattern.id === 'bull-engulf')
  assert.ok(hit)
  assert.equal(hit?.direction, 'bullish')
})

test('detects a morning star', () => {
  const candles = [
    candle(0, 100, 101, 99, 100),
    candle(1, 110, 110.4, 99.6, 100),
    candle(2, 100, 101, 99.2, 100.3),
    candle(3, 100.4, 107, 100.2, 106.2),
  ]
  const hit = detectPatterns(candles).find((pattern) => pattern.id === 'morning-star')
  assert.ok(hit)
})

test('ignores a dust doji inside a quiet range', () => {
  const candles: Candle[] = []
  for (let i = 0; i < 10; i++) candles.push(candle(i, 100, 101, 99, 100.4))
  candles.push(candle(10, 100, 100.02, 99.99, 100.01))
  assert.equal(
    detectPatterns(candles).some((pattern) => pattern.id === 'doji'),
    false,
  )
})

test('skips nearby noise when choosing support and resistance', () => {
  const candles: Candle[] = []
  for (let i = 0; i < 30; i++) candles.push(candle(i, 100, 101, 99, 100))
  candles[8] = candle(8, 100, 130, 99, 101)
  candles[18] = candle(18, 100, 101, 70, 99)
  for (let i = 30; i < 40; i++) candles.push(candle(i, 100, 102, 98, 100.4))
  const levels = nearestLevels(candles, 100.4, 5)
  assert.ok(levels.resistance != null && levels.resistance > 120)
  assert.ok(levels.support != null && levels.support < 80)
})

test('describes a long lower wick', () => {
  const text = describeCandle(candle(1, 100, 101, 94, 100.5), 1).join(' ')
  assert.match(text, /ذيل سفلي/)
})

test('explains non-farm payrolls for gold', () => {
  const event: EcoEvent = {
    title: 'Non-Farm Employment Change',
    country: 'USD',
    date: '2026-10-02T08:30:00-04:00',
    impact: 'High',
    forecast: '89K',
    previous: '162K',
    actual: '',
  }
  assert.match(goldNote(event), /وظائف/)
  assert.match(surpriseGuide(event) ?? '', /89K/)
  assert.equal(isGoldRelevant(event), true)
  assert.equal(newsTopic('Gold slips as Treasury yields climb'), 'الدولار والعوائد')
})

test('lowers confidence when a high-impact US release is soon', () => {
  const candles: Candle[] = []
  let price = 100
  for (let i = 0; i < 60; i++) {
    const open = price
    const close = price + 0.4
    candles.push(candle(i, open, close + 0.1, open - 0.1, close))
    price = close
  }
  const briefing = buildBriefing(
    candles,
    [],
    [{ title: 'Non-Farm Employment Change', country: 'USD', impact: 'High', hours: 2 }],
  )
  assert.equal(briefing.confidence, 'منخفضة')
  assert.match(briefing.cautions.join(' '), /وظائف/)
})
