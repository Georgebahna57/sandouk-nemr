import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BookOpen, CalendarDays, ChartCandlestick, Coins, Newspaper, RefreshCw } from 'lucide-react'
import { CandleChart } from '@/components/CandleChart'
import { buildBriefing, readMarket } from '@/lib/briefing'
import { countryName, goldNote, impactName, isGoldRelevant, newsTopic, surpriseGuide, upcomingRisks } from '@/lib/events'
import { candleTime, eventTime, formatLead, hoursUntil, money, relativeNews, signed } from '@/lib/format'
import { ema, sma } from '@/lib/indicators'
import { averageRange, describeCandle, detectPatterns, parts } from '@/lib/patterns'
import { buildTradePlan, weeklyCandles, type TradePlan } from '@/lib/setup'
import { openSessions, sessionNote } from '@/lib/sessions'
import type { Candle, EcoEvent, Interval, MarketPack, NewsItem, SpotQuote } from '@/types'

const INTERVALS: { id: Interval; label: string }[] = [
  { id: '5m', label: '5 د' },
  { id: '15m', label: '15 د' },
  { id: '1h', label: 'ساعة' },
  { id: '4h', label: '4 س' },
  { id: '1d', label: 'يوم' },
]

const HIGHER: Record<Interval, { id: Interval | 'week'; label: string }> = {
  '5m': { id: '1h', label: 'الساعة' },
  '15m': { id: '1h', label: 'الساعة' },
  '1h': { id: '4h', label: '4 ساعات' },
  '4h': { id: '1d', label: 'اليوم' },
  '1d': { id: 'week', label: 'الأسبوع' },
}

async function loadJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  const body = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) throw new Error(body.error || 'تعذر الاتصال بالبيانات')
  return body as T
}

function biasClass(bias: string) {
  if (bias === 'bullish') return 'text-up'
  if (bias === 'bearish') return 'text-down'
  return 'text-gold'
}

function MiniCandle({ candle }: { candle: Candle }) {
  const candleParts = parts(candle)
  const range = candleParts.range || 1
  const upper = (candleParts.upper / range) * 100
  const body = (candleParts.body / range) * 100
  const lower = (candleParts.lower / range) * 100
  const rising = candle.close >= candle.open
  return (
    <div className="flex items-end gap-3" dir="ltr" aria-hidden>
      <div className="flex h-36 w-8 items-stretch justify-center">
        <div className="relative w-px bg-line">
          <div
            className={`absolute inset-x-[-7px] rounded-sm ${rising ? 'bg-up' : 'bg-down'}`}
            style={{ top: `${upper}%`, height: `${Math.max(body, 4)}%` }}
          />
        </div>
      </div>
      <div className="space-y-1 text-[11px] text-muted">
        <p>ذيل علوي {upper.toFixed(0)}%</p>
        <p>جسم {body.toFixed(0)}%</p>
        <p>ذيل سفلي {lower.toFixed(0)}%</p>
      </div>
    </div>
  )
}

function clock(ms: number) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Damascus',
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(ms))
}

export default function App() {
  const [interval, setInterval] = useState<Interval>('1h')
  const [market, setMarket] = useState<MarketPack | null>(null)
  const [higherCandles, setHigherCandles] = useState<Candle[]>([])
  const [spot, setSpot] = useState<SpotQuote | null>(null)
  const [events, setEvents] = useState<EcoEvent[]>([])
  const [news, setNews] = useState<NewsItem[]>([])
  const [chartError, setChartError] = useState<string | null>(null)
  const [auxError, setAuxError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [hovered, setHovered] = useState<Candle | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(readLayout)
  const [narrow, setNarrow] = useState(false)
  const [tab, setTab] = useState<PhoneTab>('price')

  const loadChart = useCallback(async (next: Interval, silent = false) => {
    if (!silent) {
      setChartError(null)
      setHigherCandles([])
      setHovered(null)
    }
    const higher = HIGHER[next]
    const packPromise = loadJson<MarketPack>(`/api/candles?interval=${next}`)
    const higherPromise =
      higher.id === 'week' ? null : loadJson<MarketPack>(`/api/candles?interval=${higher.id}`)
    const pack = await packPromise
    setMarket(pack)
    if (!higherPromise) {
      setHigherCandles(weeklyCandles(pack.candles))
      return
    }
    try {
      const higherPack = await higherPromise
      setHigherCandles(higherPack.candles)
    } catch {
      if (!silent) setHigherCandles([])
    }
  }, [])

  const loadAux = useCallback(async () => {
    const [spotResult, calendarResult, newsResult] = await Promise.allSettled([
      loadJson<SpotQuote>('/api/spot'),
      loadJson<EcoEvent[]>('/api/calendar'),
      loadJson<NewsItem[]>('/api/news'),
    ])
    const problems: string[] = []
    if (spotResult.status === 'fulfilled') setSpot(spotResult.value)
    else problems.push(spotResult.reason instanceof Error ? spotResult.reason.message : 'السبوت')
    if (calendarResult.status === 'fulfilled') setEvents(calendarResult.value)
    else problems.push('التقويم الاقتصادي')
    if (newsResult.status === 'fulfilled') setNews(newsResult.value)
    else problems.push('الأخبار')
    setAuxError(problems.length ? problems.join(' · ') : null)
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      await Promise.all([loadChart(interval), loadAux()])
      setNow(Date.now())
    } catch (error) {
      setChartError(error instanceof Error ? error.message : 'تعذر تحديث الشارت')
    } finally {
      setLoading(false)
    }
  }, [interval, loadAux, loadChart])

  useEffect(() => {
    localStorage.setItem('onssa-layout', layoutMode)
  }, [layoutMode])

  useEffect(() => {
    const query = window.matchMedia('(max-width: 800px)')
    const apply = () => setNarrow(query.matches)
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadChart(interval)
      .catch((error: unknown) => {
        if (!cancelled) setChartError(error instanceof Error ? error.message : 'تعذر جلب الشموع')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [interval, loadChart])

  useEffect(() => {
    void loadAux()
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void loadChart(interval, true).catch(() => {
        // نبقي آخر قراءة ناجحة إذا تعذّر تحديث صامت.
      })
      void loadAux()
      setNow(Date.now())
    }, 5_000)
    return () => window.clearInterval(timer)
  }, [interval, loadAux, loadChart])

  const candles = market?.candles ?? []
  const patterns = useMemo(() => detectPatterns(candles), [candles])
  const risks = useMemo(() => upcomingRisks(events, now), [events, now])
  const higherLabel = HIGHER[interval].label
  const higherSnapshot = useMemo(
    () => (higherCandles.length >= 55 ? readMarket(higherCandles) : null),
    [higherCandles],
  )
  const briefing = useMemo(
    () => (candles.length ? buildBriefing(candles, patterns, risks, { higher: higherSnapshot, higherLabel }) : null),
    [candles, patterns, risks, higherSnapshot, higherLabel],
  )
  const plan = useMemo(
    () => (candles.length ? buildTradePlan(candles, patterns, higherCandles, higherLabel, risks) : null),
    [candles, patterns, higherCandles, higherLabel, risks],
  )
  const closes = useMemo(() => candles.map((candle) => candle.close), [candles])
  const emaLine = useMemo(
    () => ema(closes, 21).flatMap((value, index) => (value == null ? [] : [{ time: candles[index].time, value }])),
    [candles, closes],
  )
  const smaLine = useMemo(
    () => sma(closes, 50).flatMap((value, index) => (value == null ? [] : [{ time: candles[index].time, value }])),
    [candles, closes],
  )
  const selected = hovered ?? candles.at(-1) ?? null
  const selectedPattern = selected ? patterns.find((pattern) => pattern.time === selected.time) : undefined
  const sessions = openSessions(new Date(now))
  const relevant = events
    .filter((event) => isGoldRelevant(event))
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const upcoming = relevant.filter((event) => (hoursUntil(event.date, now) ?? -1) > -0.15)
  const released = relevant.filter((event) => {
    const hours = hoursUntil(event.date, now)
    return hours != null && hours <= -0.15 && hours > -30
  })
  const changeUp = (market?.change ?? 0) >= 0
  const spread = spot && market?.price != null ? market.price - spot.price : null
  const nextEvent = upcoming.find((event) => event.impact === 'High') ?? upcoming[0]
  const biasWash =
    briefing?.bias === 'bullish'
      ? 'border-up/40 bg-up/10'
      : briefing?.bias === 'bearish'
        ? 'border-down/40 bg-down/10'
        : 'border-gold/25 bg-panel'
  const phone = layoutMode === 'phone' || (layoutMode === 'auto' && narrow)

  return (
    <div className={`app-root mx-auto max-w-7xl px-4 py-5 sm:px-6 ${phone ? 'phone' : 'desk'}`} data-tab={tab}>
      <header className="topbar flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="brand-mark" aria-hidden>
            أ
          </span>
          <div>
            <p className="text-sm font-medium tracking-wide text-gold">XAU / USD</p>
            <h1 className="text-3xl font-semibold leading-none">أونصة</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="layout-switch" role="group" aria-label="طريقة العرض">
            {(
              [
                ['auto', 'تلقائي'],
                ['desk', 'كمبيوتر'],
                ['phone', 'جوال'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={layoutMode === id ? 'active' : ''}
                onClick={() => setLayoutMode(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 px-3 py-1 text-xs text-muted">
            <span className="h-2 w-2 animate-pulse rounded-full bg-gold" />
            كل 5 ث · <bdi className="num">{clock(now)}</bdi>
          </span>
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-sm text-ink hover:border-gold"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            تحديث
          </button>
        </div>
      </header>

      {loading && !market ? (
        <div className="mt-5 space-y-4">
          <div className="h-40 animate-pulse rounded-3xl bg-line/60" />
          <div className="h-[460px] animate-pulse rounded-3xl bg-line/40" />
        </div>
      ) : (
        <section className="sheet tab-price mt-5 rounded-3xl p-5">
          <div className="hero-row flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs text-muted">سبوت الأونصة</p>
              <p className="price-hero mt-1 text-5xl font-semibold tracking-tight sm:text-6xl">
                <bdi className="num">{money(spot?.price)}</bdi>
              </p>
              <p className="mt-2 text-sm text-muted">دولار للأونصة · يتحدث تلقائياً كل 5 ثوانٍ</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted">عقد COMEX</p>
                <p className={`mt-1 text-2xl font-semibold ${changeUp ? 'text-up' : 'text-down'}`}>
                  <bdi className="num">{money(market?.price)}</bdi>
                </p>
                <p className="mt-1 text-xs text-muted">
                  <bdi className="num">{signed(market?.change)}</bdi>
                  {' ('}
                  <bdi className="num">{signed(market?.changePercent)}%</bdi>
                  {')'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">العقد ناقص السبوت</p>
                <p className="mt-1 text-2xl font-semibold">
                  <bdi className="num">{signed(spread)}</bdi>
                </p>
                <p className="mt-1 text-xs text-muted">فرق السعر بين العقد والأونصة</p>
              </div>
            </div>
          </div>
          <DayStrip low={market?.dayLow ?? null} high={market?.dayHigh ?? null} price={market?.price ?? null} />
          <SessionTrack sessions={sessions} />
          <p className="mt-2 text-xs text-muted">{sessionNote(sessions)} الجلسات بتوقيت تقريبي.</p>
        </section>
      )}

      {chartError && (
        <p className="mt-4 rounded-xl border border-down/40 bg-down/10 px-4 py-3 text-sm text-down">{chartError}</p>
      )}
      {auxError && <p className="mt-3 text-sm text-muted">بعض المصادر لم تصل: {auxError}</p>}

      <section className="chart-grid mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.9fr)]">
        <div className="sheet tab-chart rounded-2xl p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium">شموع العقد</h2>
              <p className="text-xs text-muted">مرّر على الشمعة لتقرأ جسمها وذيولها.</p>
            </div>
            <div className="intervals flex flex-wrap rounded-full border border-line p-1">
              {INTERVALS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setInterval(item.id)}
                  className={`rounded-full px-3 py-1 text-sm ${interval === item.id ? 'bg-gold text-bg' : 'text-muted'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          {candles.length > 0 && briefing ? (
            <>
              <CandleChart
                candles={candles}
                ema={emaLine}
                sma={smaLine}
                patterns={patterns}
                support={briefing.snapshot.support}
                resistance={briefing.snapshot.resistance}
                interval={interval}
                onHover={setHovered}
              />
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
                <Legend swatch="bg-gold" label="متوسط 21" />
                <Legend swatch="bg-[#8eb4ff]" label="متوسط 50" />
                <Legend swatch="bg-up" label="دعم" />
                <Legend swatch="bg-down" label="مقاومة" />
                <span>أسماء الأنماط في القائمة تحت الشارت، والأسهم على الشمعة فقط.</span>
              </div>
            </>
          ) : (
            <div className="grid h-[340px] place-items-center text-muted sm:h-[460px]">
              {loading ? 'جاري جلب شموع الذهب…' : 'لا توجد شموع للعرض'}
            </div>
          )}
        </div>

        <aside className={`sheet tab-read rounded-2xl border p-4 ${biasWash}`}>
          <p className="text-xs text-muted">القراءة على إطار {INTERVALS.find((item) => item.id === interval)?.label}</p>
          <h2 className={`mt-2 text-2xl font-semibold ${biasClass(briefing?.bias ?? 'neutral')}`}>
            {briefing?.headline ?? 'بانتظار السعر'}
          </h2>
          {briefing && (
            <p className="mt-1 text-sm text-muted">
              وضوح القراءة: {briefing.confidence}، مقارنة مع {higherLabel}. الميل ليس أمر دخول.
            </p>
          )}
          <ul className="mt-4 space-y-3 text-sm leading-6">
            {briefing?.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          {briefing && briefing.cautions.length > 0 && (
            <div className="mt-4 space-y-2">
              {briefing.cautions.map((caution) => (
                <p key={caution} className="flex gap-2 rounded-xl bg-gold/10 px-3 py-2 text-sm text-gold">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{caution}</span>
                </p>
              ))}
            </div>
          )}
          {briefing && (
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Level label="دعم" value={money(briefing.snapshot.support)} />
              <Level label="مقاومة" value={money(briefing.snapshot.resistance)} />
              <Level label="ATR 14" value={money(briefing.snapshot.atr)} />
              <Level label="RSI 14" value={briefing.snapshot.rsi == null ? '—' : briefing.snapshot.rsi.toFixed(1)} />
            </dl>
          )}
        </aside>
      </section>

      {plan && (
        <div className="tab-read">
          <PlanCard plan={plan} />
        </div>
      )}

      <section className="tab-read mt-4 grid gap-4 lg:grid-cols-2">
        <article className="sheet rounded-2xl p-4">
          <h2 className="text-lg font-medium">قراءة الشمعة</h2>
          {selected ? (
            <div className="mt-3 flex gap-4">
              <MiniCandle candle={selected} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted">{candleTime(selected.time)} — توقيت دمشق</p>
                <dl className="ohlc mt-2 grid grid-cols-4 gap-2 text-sm">
                  <Level label="فتح" value={money(selected.open)} />
                  <Level label="أعلى" value={money(selected.high)} />
                  <Level label="أدنى" value={money(selected.low)} />
                  <Level label="إغلاق" value={money(selected.close)} />
                </dl>
                <ul className="mt-3 space-y-1 text-sm leading-6">
                  {describeCandle(selected, averageRange(candles)).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                  {selectedPattern && (
                    <li>
                      النمط على هذه الشمعة: {selectedPattern.name} ({selectedPattern.english}). {selectedPattern.lesson}
                    </li>
                  )}
                </ul>
                <p className="mt-2 text-xs text-muted">
                  الجسم {((parts(selected).bodyRatio || 0) * 100).toFixed(0)}% من المدى.
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">ستظهر هنا تشريح آخر شمعة.</p>
          )}
        </article>

        <article className="sheet rounded-2xl p-4">
          <h2 className="text-lg font-medium">أنماط آخر الشموع</h2>
          {patterns.length === 0 ? (
            <p className="mt-3 text-sm text-muted">لا يوجد نمط كلاسيكي واضح في آخر 25 شمعة. هذا طبيعي في السوق العرضي.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {patterns.map((pattern) => (
                <li key={`${pattern.id}-${pattern.time}`} className="border-b border-line pb-3 last:border-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">
                      {pattern.name}{' '}
                      <span className="text-xs text-muted">{pattern.english}</span>
                    </p>
                    <span className={`text-xs ${biasClass(pattern.direction)}`}>
                      {pattern.direction === 'bullish' ? 'صاعد' : pattern.direction === 'bearish' ? 'هابط' : 'تردد'} ·{' '}
                      {'●'.repeat(pattern.strength)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">{candleTime(pattern.time)}</p>
                  <p className="mt-1 text-sm leading-6">{pattern.lesson}</p>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <details className="sheet tab-read mt-4 rounded-2xl px-4 py-3 text-sm leading-7">
        <summary className="cursor-pointer font-medium">كيف تقرأ شمعة الذهب قبل ما تعتمد نمطاً</summary>
        <div className="mt-2 grid gap-2 text-muted sm:grid-cols-3">
          <p>الجسم هو المسافة بين الافتتاح والإغلاق. جسم أخضر إغلاق أعلى، وجسم أحمر إغلاق أدنى.</p>
          <p>الذيل منطقة رُفض فيها السعر. ذيل سفلي يعني دفاعاً من المشترين، وذيل علوي رفضاً من البائعين.</p>
          <p>النمط بلا دعم أو مقاومة أو خبر مجرد شكل. قبل خبر الدولار القوي يتسع التقلب وتضعف الأشكال.</p>
        </div>
      </details>

      <section className="tab-news mt-4 grid gap-4 lg:grid-cols-2">
        <article className="sheet rounded-2xl p-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-gold" />
            <h2 className="text-lg font-medium">أخبار اقتصادية تهم الذهب</h2>
          </div>
          <p className="mt-1 text-xs text-muted">هذا الأسبوع، بتوقيت دمشق. التركيز على الدولار والأخبار القوية.</p>
          {nextEvent && <NextEvent event={nextEvent} now={now} />}
          <EventList title="القادم" events={upcoming.slice(0, 6)} now={now} />
          <EventList title="صدر خلال الساعات الماضية" events={released.slice(-4).reverse()} now={now} />
          {upcoming.length === 0 && released.length === 0 && (
            <p className="mt-3 text-sm text-muted">التقويم غير متاح أو لا توجد أحداث مطابقة هذا الأسبوع.</p>
          )}
        </article>

        <article className="sheet rounded-2xl p-4">
          <div className="flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-gold" />
            <h2 className="text-lg font-medium">عناوين الذهب</h2>
          </div>
          <p className="mt-1 text-xs text-muted">عناوين حديثة بالإنجليزية، مع تصنيف عربي لموضوعها.</p>
          <ul className="mt-3 space-y-3">
            {news.map((item) => (
              <li key={item.link} className="border-b border-line pb-3 last:border-0">
                <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs text-gold">{newsTopic(item.title)}</span>
                <a href={item.link} target="_blank" rel="noreferrer" className="mt-2 block break-words font-medium hover:text-gold">
                  {item.title}
                </a>
                <p className="mt-1 text-xs text-muted">
                  {item.source ? item.source : 'خبر'}
                  {item.publishedAt ? ` · ${relativeNews(item.publishedAt, now)}` : ''}
                </p>
              </li>
            ))}
            {news.length === 0 && <li className="text-sm text-muted">لا توجد عناوين حالياً.</li>}
          </ul>
        </article>
      </section>

      {briefing && (
        <div className="tab-chart">
          <RsiBar value={briefing.snapshot.rsi} />
        </div>
      )}

      <footer className="mt-6 border-t border-gold/20 pt-4 text-xs leading-6 text-muted">
        الشموع من عقد الذهب GC على COMEX لأنها أوضح سلسلة سعرية متاحة، وهي تتحرك مع أونصة الفوركس XAU/USD من غير أن
        تطابقها سنتاً بسنت. الأسعار للمساعدة على القراءة وقد تتأخر عن وسيطك. هذه ليست نصيحة استثمارية، والتداول بالرافعة
        يمكن أن يخسّرك رأس المال. على الجوال اختر «جوال»، أو اترك «تلقائي» وهو يبدّل وحده إذا الشاشة ضيقة.
      </footer>
      <nav className="phone-nav" aria-label="أقسام الجوال">
        {(
          [
            ['price', 'السعر', Coins],
            ['chart', 'الشارت', ChartCandlestick],
            ['read', 'القراءة', BookOpen],
            ['news', 'الأخبار', Newspaper],
          ] as const
        ).map(([id, label, Icon]) => (
          <button key={id} type="button" className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            <Icon className="h-5 w-5" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}

type LayoutMode = 'auto' | 'desk' | 'phone'
type PhoneTab = 'price' | 'chart' | 'read' | 'news'

function readLayout(): LayoutMode {
  try {
    const saved = localStorage.getItem('onssa-layout')
    if (saved === 'desk' || saved === 'phone' || saved === 'auto') return saved
  } catch {
    // التخزين المحلي قد يكون ممنوعاً.
  }
  return 'auto'
}

function PlanCard({ plan }: { plan: TradePlan }) {
  const watching = plan.status === 'watch'
  const steps = [
    {
      n: '1',
      label: 'التأكيد',
      value: money(plan.triggerPrice),
      hint: plan.side === 'short' ? 'إغلاق شمعة تحته' : 'إغلاق شمعة فوقه',
    },
    { n: '2', label: 'الإبطال', value: money(plan.invalidation), hint: 'إغلاق عكسه يلغي الفكرة' },
    { n: '3', label: 'الهدف', value: money(plan.target), hint: 'مستوى ممكن، ليس وعداً' },
  ]
  return (
    <section className="sheet mt-4 rounded-3xl p-4 sm:p-5">
      <p className="text-xs text-gold">خطة المراقبة</p>
      <h2 className={`mt-1 text-xl font-semibold ${watching ? biasClass(plan.side === 'long' ? 'bullish' : 'bearish') : ''}`}>
        {plan.headline}
      </h2>
      {watching && (
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {steps.map((step) => (
            <li key={step.n} className="rounded-2xl border border-line px-3 py-3">
              <p className="text-xs text-gold">
                {step.n} · {step.label}
              </p>
              <p className="mt-1 text-2xl font-semibold">
                <bdi className="num">{step.value}</bdi>
              </p>
              <p className="mt-1 text-xs text-muted">{step.hint}</p>
            </li>
          ))}
        </ol>
      )}
      {plan.missing.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm leading-6 text-muted">
          {plan.missing.map((item) => (
            <li key={item}>· {item}</li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-sm leading-6 text-gold">{plan.note}</p>
    </section>
  )
}

function DayStrip({ low, high, price }: { low: number | null; high: number | null; price: number | null }) {
  if (low == null || high == null || price == null || high <= low) return null
  const place = Math.min(100, Math.max(0, ((price - low) / (high - low)) * 100))
  return (
    <div className="mt-5" dir="ltr">
      <div className="relative h-1.5 rounded-full bg-line">
        <div className="absolute inset-y-0 rounded-full bg-gold/40" style={{ width: `${place}%` }} />
        <div className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-gold" style={{ left: `calc(${place}% - 7px)` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted">
        <span className="num">{money(low)}</span>
        <span>مدى اليوم</span>
        <span className="num">{money(high)}</span>
      </div>
    </div>
  )
}

function SessionTrack({ sessions }: { sessions: { name: string; open: boolean }[] }) {
  return (
    <div className="mt-4 grid grid-cols-4 gap-1" dir="ltr">
      {sessions.map((session) => (
        <div
          key={session.name}
          className={`rounded-full px-2 py-1 text-center text-xs ${session.open ? 'bg-gold/20 text-gold' : 'bg-white/5 text-muted'}`}
        >
          {session.name}
        </div>
      ))}
    </div>
  )
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${swatch}`} />
      {label}
    </span>
  )
}

function NextEvent({ event, now }: { event: EcoEvent; now: number }) {
  const hours = hoursUntil(event.date, now)
  return (
    <div className="mt-3 rounded-2xl border border-down/30 bg-down/10 px-3 py-2">
      <p className="text-xs text-down">أقرب خبر قوي</p>
      <p className="mt-1 font-medium">{event.title}</p>
      <p className="mt-1 text-xs text-muted">
        {countryName(event.country)} · {eventTime(event.date)}
        {hours != null && hours > 0 ? ` · ${formatLead(hours)}` : ''}
      </p>
    </div>
  )
}

function Level({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-medium">
      <bdi className="num">{value}</bdi>
    </dd>
    </div>
  )
}

function EventList({ title, events, now }: { title: string; events: EcoEvent[]; now: number }) {
  if (!events.length) return null
  return (
    <div className="mt-4">
      <h3 className="text-sm text-gold">{title}</h3>
      <ul className="mt-2 space-y-3">
        {events.map((event) => {
          const hours = hoursUntil(event.date, now)
          const guide = surpriseGuide(event)
          return (
            <li key={`${event.date}-${event.title}`} className="rounded-xl border border-line px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{event.title}</p>
                <span className={`shrink-0 text-xs ${event.impact === 'High' ? 'text-down' : 'text-gold'}`}>
                  {countryName(event.country)} · {impactName(event.impact)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">
                {eventTime(event.date)}
                {hours != null && hours > 0 ? ` · ${formatLead(hours)}` : ''}
              </p>
              <p className="mt-1 text-xs text-muted">
                المتوقع <bdi className="num">{event.forecast || '—'}</bdi>
                {' · السابق '}
                <bdi className="num">{event.previous || '—'}</bdi>
                {event.actual ? (
                  <>
                    {' · الفعلي '}
                    <bdi className="num">{event.actual}</bdi>
                  </>
                ) : null}
              </p>
              <p className="mt-1 text-sm leading-6">{goldNote(event)}</p>
              {guide && <p className="mt-1 text-sm leading-6 text-gold">{guide}</p>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function RsiBar({ value }: { value: number | null }) {
  if (value == null) return null
  return (
    <div className="sheet mt-4 rounded-2xl px-4 py-3">
      <div className="flex items-center justify-between text-sm">
        <span>مؤشر RSI</span>
        <span className="num">{value.toFixed(1)}</span>
      </div>
      <div className="relative mt-2 h-2 rounded-full bg-line" dir="ltr">
        <div className="absolute inset-y-0 rounded-full bg-down/70" style={{ left: '0%', width: '30%' }} />
        <div className="absolute inset-y-0 bg-gold/40" style={{ left: '30%', width: '40%' }} />
        <div className="absolute inset-y-0 rounded-full bg-up/70" style={{ left: '70%', width: '30%' }} />
        <div className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-ink" style={{ left: `calc(${value}% - 6px)` }} />
      </div>
      <p className="mt-2 text-xs text-muted">تحت 30 هبوط ممدود، فوق 70 صعود ممدود، والمنتصف حياد.</p>
    </div>
  )
}
