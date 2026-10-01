import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, Newspaper, RefreshCw } from 'lucide-react'
import { CandleChart } from '@/components/CandleChart'
import { buildBriefing } from '@/lib/briefing'
import { countryName, goldNote, impactName, isGoldRelevant, newsTopic, surpriseGuide, upcomingRisks } from '@/lib/events'
import { candleTime, eventTime, formatLead, hoursUntil, money, relativeNews, signed } from '@/lib/format'
import { ema, sma } from '@/lib/indicators'
import { averageRange, describeCandle, detectPatterns, parts } from '@/lib/patterns'
import { openSessions, sessionNote } from '@/lib/sessions'
import type { Candle, EcoEvent, Interval, MarketPack, NewsItem, SpotQuote } from '@/types'

const INTERVALS: { id: Interval; label: string }[] = [
  { id: '5m', label: '5 د' },
  { id: '15m', label: '15 د' },
  { id: '1h', label: 'ساعة' },
  { id: '4h', label: '4 س' },
  { id: '1d', label: 'يوم' },
]

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
  const range = candle.high - candle.low || 1
  const upper = ((candle.high - Math.max(candle.open, candle.close)) / range) * 100
  const body = (Math.abs(candle.close - candle.open) / range) * 100
  const rising = candle.close >= candle.open
  return (
    <div className="flex h-28 w-10 items-stretch justify-center" dir="ltr" aria-hidden>
      <div className="relative w-px bg-line">
        <div
          className={`absolute inset-x-[-6px] rounded-sm ${rising ? 'bg-up' : 'bg-down'}`}
          style={{ top: `${upper}%`, height: `${Math.max(body, 4)}%` }}
        />
      </div>
    </div>
  )
}

export default function App() {
  const [interval, setInterval] = useState<Interval>('1h')
  const [market, setMarket] = useState<MarketPack | null>(null)
  const [spot, setSpot] = useState<SpotQuote | null>(null)
  const [events, setEvents] = useState<EcoEvent[]>([])
  const [news, setNews] = useState<NewsItem[]>([])
  const [chartError, setChartError] = useState<string | null>(null)
  const [auxError, setAuxError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [hovered, setHovered] = useState<Candle | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const loadChart = useCallback(async (next: Interval) => {
    setChartError(null)
    const pack = await loadJson<MarketPack>(`/api/candles?interval=${next}`)
    setMarket(pack)
    setHovered(null)
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
      void loadChart(interval).catch((error: unknown) => {
        setChartError(error instanceof Error ? error.message : 'تعذر تحديث الشموع')
      })
      void loadAux()
      setNow(Date.now())
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [interval, loadAux, loadChart])

  const candles = market?.candles ?? []
  const patterns = useMemo(() => detectPatterns(candles), [candles])
  const risks = useMemo(() => upcomingRisks(events, now), [events, now])
  const briefing = useMemo(() => (candles.length ? buildBriefing(candles, patterns, risks) : null), [candles, patterns, risks])
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
      <header className="flex flex-col gap-4 border-b border-line pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-gold">XAU / USD</p>
          <h1 className="text-3xl font-semibold">أونصة</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            قراءة شموع الذهب والأخبار التي تحرّكه. الأداة تعلّمك السياق، ولا تنفّذ صفقة ولا تعطي أمر شراء أو بيع.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sessions.map((session) => (
            <span
              key={session.name}
              className={`rounded-full border px-3 py-1 text-xs ${session.open ? 'border-gold/50 text-gold' : 'border-line text-muted'}`}
            >
              {session.name}
              {session.open ? ' مفتوحة' : ''}
            </span>
          ))}
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

      <p className="mt-4 text-sm text-muted">{sessionNote(sessions)} الجلسات بتوقيت تقريبي.</p>

      <section className="mt-4 grid gap-3 sm:grid-cols-3">
        <Quote
          label="سبوت الأونصة"
          value={money(spot?.price)}
          hint="XAU بالدولار، من سعر السبوت"
        />
        <Quote
          label="عقد COMEX"
          value={money(market?.price)}
          hint={
            market ? (
              <>
                <bdi className="num">{signed(market.change)}</bdi>
                {' ('}
                <bdi className="num">{signed(market.changePercent)}%</bdi>
                {') عن إغلاق الأمس'}
              </>
            ) : (
              'GC — شارت الشموع'
            )
          }
          tone={market ? (changeUp ? 'up' : 'down') : undefined}
        />
        <Quote
          label="العقد ناقص السبوت"
          value={signed(spread)}
          hint={
            <>
              أدنى اليوم <bdi className="num">{money(market?.dayLow)}</bdi>
              {' · أعلى '}
              <bdi className="num">{money(market?.dayHigh)}</bdi>
            </>
          }
        />
      </section>

      {chartError && (
        <p className="mt-4 rounded-xl border border-down/40 bg-down/10 px-4 py-3 text-sm text-down">{chartError}</p>
      )}
      {auxError && <p className="mt-3 text-sm text-muted">بعض المصادر لم تصل: {auxError}</p>}

      <section className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.9fr)]">
        <div className="rounded-2xl border border-line bg-panel p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium">شموع العقد</h2>
              <p className="text-xs text-muted">الخط الذهبي متوسط 21 الأسي، والأزرق متوسط 50. مرّر على الشمعة لتقرأها.</p>
            </div>
            <div className="flex rounded-full border border-line p-1">
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
          ) : (
            <div className="grid h-[340px] place-items-center text-muted sm:h-[460px]">
              {loading ? 'جاري جلب شموع الذهب…' : 'لا توجد شموع للعرض'}
            </div>
          )}
        </div>

        <aside className="rounded-2xl border border-line bg-panel p-4">
          <p className="text-xs text-muted">القراءة على إطار {INTERVALS.find((item) => item.id === interval)?.label}</p>
          <h2 className={`mt-2 text-2xl font-semibold ${biasClass(briefing?.bias ?? 'neutral')}`}>
            {briefing?.headline ?? 'بانتظار السعر'}
          </h2>
          {briefing && (
            <p className="mt-1 text-sm text-muted">
              ثقة القراءة: {briefing.confidence}
              {briefing.confidence === 'منخفضة' ? ' لأن خبراً قريباً قد يلغي الشكل الفني' : ''}
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

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-line bg-panel p-4">
          <h2 className="text-lg font-medium">قراءة الشمعة</h2>
          {selected ? (
            <div className="mt-3 flex gap-4">
              <MiniCandle candle={selected} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted">{candleTime(selected.time)} — توقيت دمشق</p>
                <dl className="mt-2 grid grid-cols-4 gap-2 text-sm">
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

        <article className="rounded-2xl border border-line bg-panel p-4">
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

      <details className="mt-4 rounded-2xl border border-line bg-panel px-4 py-3 text-sm leading-7">
        <summary className="cursor-pointer font-medium">كيف تقرأ شمعة الذهب قبل ما تعتمد نمطاً</summary>
        <div className="mt-2 grid gap-2 text-muted sm:grid-cols-3">
          <p>الجسم هو المسافة بين الافتتاح والإغلاق. جسم أخضر إغلاق أعلى، وجسم أحمر إغلاق أدنى.</p>
          <p>الذيل منطقة رُفض فيها السعر. ذيل سفلي يعني دفاعاً من المشترين، وذيل علوي رفضاً من البائعين.</p>
          <p>النمط بلا دعم أو مقاومة أو خبر مجرد شكل. قبل خبر الدولار القوي يتسع التقلب وتضعف الأشكال.</p>
        </div>
      </details>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-line bg-panel p-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-gold" />
            <h2 className="text-lg font-medium">أخبار اقتصادية تهم الذهب</h2>
          </div>
          <p className="mt-1 text-xs text-muted">هذا الأسبوع، بتوقيت دمشق. التركيز على الدولار والأخبار القوية.</p>
          <EventList title="القادم" events={upcoming.slice(0, 6)} now={now} />
          <EventList title="صدر خلال الساعات الماضية" events={released.slice(-4).reverse()} now={now} />
          {upcoming.length === 0 && released.length === 0 && (
            <p className="mt-3 text-sm text-muted">التقويم غير متاح أو لا توجد أحداث مطابقة هذا الأسبوع.</p>
          )}
        </article>

        <article className="rounded-2xl border border-line bg-panel p-4">
          <div className="flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-gold" />
            <h2 className="text-lg font-medium">عناوين الذهب</h2>
          </div>
          <p className="mt-1 text-xs text-muted">عناوين حديثة بالإنجليزية، مع تصنيف عربي لموضوعها.</p>
          <ul className="mt-3 space-y-3">
            {news.map((item) => (
              <li key={item.link} className="border-b border-line pb-3 last:border-0">
                <a href={item.link} target="_blank" rel="noreferrer" className="block break-words font-medium hover:text-gold">
                  {item.title}
                </a>
                <p className="mt-1 text-xs text-muted">
                  {newsTopic(item.title)}
                  {item.source ? ` · ${item.source}` : ''}
                  {item.publishedAt ? ` · ${relativeNews(item.publishedAt, now)}` : ''}
                </p>
              </li>
            ))}
            {news.length === 0 && <li className="text-sm text-muted">لا توجد عناوين حالياً.</li>}
          </ul>
        </article>
      </section>

      {briefing && <RsiBar value={briefing.snapshot.rsi} />}

      <footer className="mt-6 border-t border-line pt-4 text-xs leading-6 text-muted">
        الشموع من عقد الذهب GC على COMEX لأنها أوضح سلسلة سعرية متاحة، وهي تتحرك مع أونصة الفوركس XAU/USD من غير أن
        تطابقها سنتاً بسنت. الأسعار للمساعدة على القراءة وقد تتأخر عن وسيطك. هذه ليست نصيحة استثمارية، والتداول بالرافعة
        يمكن أن يخسّرك رأس المال.
      </footer>
    </div>
  )
}

function Quote({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint: React.ReactNode
  tone?: 'up' | 'down'
}) {
  return (
    <div className="rounded-2xl border border-line bg-panel px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : ''}`}>
        <bdi className="num">{value}</bdi>
      </p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
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
    <div className="mt-4 rounded-2xl border border-line bg-panel px-4 py-3">
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
