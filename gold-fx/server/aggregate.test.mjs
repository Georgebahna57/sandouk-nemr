import assert from 'node:assert/strict'
import test from 'node:test'
import { aggregateCandles, parseNewsRss } from './market.mjs'

test('aggregates hourly candles into 4-hour buckets', () => {
  const candles = []
  for (let i = 0; i < 8; i++) {
    candles.push({
      time: i * 3600,
      open: 100 + i,
      high: 110 + i,
      low: 90 + i,
      close: 105 + i,
    })
  }
  const bars = aggregateCandles(candles, 4)
  assert.equal(bars.length, 2)
  assert.equal(bars[0].time, 0)
  assert.equal(bars[0].open, 100)
  assert.equal(bars[0].high, 113)
  assert.equal(bars[0].low, 90)
  assert.equal(bars[0].close, 108)
  assert.equal(bars[1].open, 104)
  assert.equal(bars[1].close, 112)
})

test('parses gold headlines from an RSS item', () => {
  const xml = `<?xml version="1.0"?><rss><channel><item>
    <title><![CDATA[Gold holds above $4,000 - Kitco]]></title>
    <link>https://news.google.com/rss/articles/example</link>
    <pubDate>Thu, 01 Oct 2026 10:00:00 GMT</pubDate>
    <source url="https://www.kitco.com">Kitco</source>
  </item></channel></rss>`
  const items = parseNewsRss(xml)
  assert.equal(items.length, 1)
  assert.equal(items[0].title, 'Gold holds above $4,000')
  assert.equal(items[0].source, 'Kitco')
  assert.equal(items[0].publishedAt, '2026-10-01T10:00:00.000Z')
})
