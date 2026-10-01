const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

const SPECS = {
  '5m': { interval: '5m', range: '5d' },
  '15m': { interval: '15m', range: '5d' },
  '1h': { interval: '1h', range: '1mo' },
  '4h': { interval: '1h', range: '3mo', aggregateHours: 4 },
  '1d': { interval: '1d', range: '2y' },
}

const cache = new Map()

async function cached(key, ttlMs, fn) {
  const hit = cache.get(key)
  if (hit && hit.exp > Date.now()) return hit.value
  const value = await fn()
  cache.set(key, { exp: Date.now() + ttlMs, value })
  return value
}

async function fetchJson(url) {
  let lastStatus = 0
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    })
    lastStatus = res.status
    if (res.status === 429 && attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 900))
      continue
    }
    if (!res.ok) {
      const err = new Error(
        res.status === 429
          ? 'مزود الأسعار طلب الانتظار قليلاً. أعد المحاولة بعد ثوانٍ.'
          : `تعذر جلب البيانات (${res.status})`,
      )
      err.status = res.status
      throw err
    }
    return res.json()
  }
  throw new Error(`تعذر جلب البيانات (${lastStatus})`)
}

export function aggregateCandles(candles, hours) {
  const size = hours * 3600
  const buckets = new Map()
  for (const candle of candles) {
    const key = Math.floor(candle.time / size) * size
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

function toCandles(result) {
  const times = result.timestamp ?? []
  const quote = result.indicators?.quote?.[0] ?? {}
  const candles = []
  for (let i = 0; i < times.length; i++) {
    const open = quote.open?.[i]
    const high = quote.high?.[i]
    const low = quote.low?.[i]
    const close = quote.close?.[i]
    if ([open, high, low, close].some((value) => value == null || Number.isNaN(value))) continue
    candles.push({
      time: times[i],
      open,
      high,
      low,
      close,
    })
  }
  candles.sort((a, b) => a.time - b.time)
  const last = candles.at(-1)
  if (last && candles.length > 2 && last.high === last.low && last.open === last.close) candles.pop()
  return candles
}

export async function getCandles(interval) {
  const spec = SPECS[interval]
  if (!spec) throw new Error('إطار زمني غير مدعوم')
  return cached(`candles:${interval}`, 20_000, async () => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?interval=${spec.interval}&range=${spec.range}&includePrePost=false`
    const data = await fetchJson(url)
    const result = data?.chart?.result?.[0]
    if (!result) throw new Error('لا توجد بيانات للذهب حالياً')
    const meta = result.meta ?? {}
    let candles = toCandles(result)
    if (spec.aggregateHours) candles = aggregateCandles(candles, spec.aggregateHours)
    const price = Number(meta.regularMarketPrice)
    const metaPrevious = Number(meta.previousClose)
    const previousClose = Number.isFinite(metaPrevious)
      ? metaPrevious
      : candles.length >= 2
        ? candles[candles.length - 2].close
        : NaN
    const change = Number.isFinite(price) && Number.isFinite(previousClose) ? price - previousClose : null
    const changePercent =
      change != null && previousClose ? (change / previousClose) * 100 : null
    return {
      symbol: 'GC=F',
      name: meta.shortName || 'Gold Futures',
      exchange: meta.fullExchangeName || 'COMEX',
      currency: meta.currency || 'USD',
      interval,
      price: Number.isFinite(price) ? price : null,
      change,
      changePercent,
      dayHigh: meta.regularMarketDayHigh ?? null,
      dayLow: meta.regularMarketDayLow ?? null,
      previousClose: Number.isFinite(previousClose) ? previousClose : null,
      updatedAt: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
      candles,
    }
  })
}

export async function getSpot() {
  return cached('spot', 15_000, async () => {
    const data = await fetchJson('https://api.gold-api.com/price/XAU')
    const price = Number(data?.price)
    if (!Number.isFinite(price)) throw new Error('سعر السبوت غير متاح')
    return {
      symbol: 'XAU',
      currency: 'USD',
      price,
      updatedAt: data.updatedAt ?? null,
    }
  })
}

export async function getCalendar() {
  return cached('calendar', 120_000, async () => {
    const events = await fetchJson('https://nfs.faireconomy.media/ff_calendar_thisweek.json')
    if (!Array.isArray(events)) throw new Error('التقويم الاقتصادي غير متاح')
    return events.map((event) => ({
      title: String(event.title ?? ''),
      country: String(event.country ?? ''),
      date: String(event.date ?? ''),
      impact: String(event.impact ?? ''),
      forecast: String(event.forecast ?? ''),
      previous: String(event.previous ?? ''),
      actual: event.actual != null ? String(event.actual) : '',
    }))
  })
}

function decodeXml(value) {
  return value
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .trim()
}

function tag(block, name) {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))
  return match ? decodeXml(match[1]) : ''
}

export function parseNewsRss(xml) {
  const items = []
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const block = match[1]
    let title = tag(block, 'title')
    const source = tag(block, 'source')
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3))
    const link = tag(block, 'link')
    const pubDate = tag(block, 'pubDate')
    const published = new Date(pubDate)
    if (!title || !/^https?:\/\//i.test(link)) continue
    items.push({
      title,
      link,
      source: source || null,
      publishedAt: Number.isNaN(published.getTime()) ? null : published.toISOString(),
    })
  }
  return items
}

export async function getNews() {
  return cached('news', 120_000, async () => {
    const url =
      'https://news.google.com/rss/search?q=gold+price+OR+XAUUSD+OR+%22gold+futures%22+when%3A3d&hl=en-US&gl=US&ceid=US:en'
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error('تعذر جلب الأخبار')
    const xml = await res.text()
    const items = parseNewsRss(xml)
    const relevant = items.filter((item) =>
      /gold|xau|bullion|ounce|fed|fomc|powell|dollar|inflation|cpi|treasury|yield|nfp|payroll|safe[- ]haven/i.test(
        item.title,
      ),
    )
    const picked = (relevant.length >= 4 ? relevant : items).slice(0, 12)
    if (!picked.length) throw new Error('لا توجد أخبار حالياً')
    return picked
  })
}
