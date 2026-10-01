export type Interval = '5m' | '15m' | '1h' | '4h' | '1d'

export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
}

export interface MarketPack {
  symbol: string
  name: string
  exchange: string
  currency: string
  interval: Interval
  price: number | null
  change: number | null
  changePercent: number | null
  dayHigh: number | null
  dayLow: number | null
  previousClose: number | null
  updatedAt: string | null
  candles: Candle[]
}

export interface SpotQuote {
  symbol: string
  currency: string
  price: number
  updatedAt: string | null
}

export interface EcoEvent {
  title: string
  country: string
  date: string
  impact: string
  forecast: string
  previous: string
  actual: string
}

export interface NewsItem {
  title: string
  link: string
  source: string | null
  publishedAt: string | null
}

export type Direction = 'bullish' | 'bearish' | 'neutral'

export interface PatternHit {
  id: string
  name: string
  english: string
  direction: Direction
  time: number
  index: number
  strength: 1 | 2 | 3
  summary: string
  lesson: string
}
