import { useEffect, useRef } from 'react'
import {
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type SeriesMarker,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { Candle, PatternHit } from '@/types'

interface Point {
  time: number
  value: number
}

interface Props {
  candles: Candle[]
  ema: Point[]
  sma: Point[]
  patterns: PatternHit[]
  support: number | null
  resistance: number | null
  interval: string
  onHover: (candle: Candle | null) => void
}

export function CandleChart({ candles, ema, sma, patterns, support, resistance, interval, onHover }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const emaRef = useRef<ISeriesApi<'Line'> | null>(null)
  const smaRef = useRef<ISeriesApi<'Line'> | null>(null)
  const supportRef = useRef<IPriceLine | null>(null)
  const resistanceRef = useRef<IPriceLine | null>(null)
  const hoverRef = useRef(onHover)
  const fitted = useRef('')
  hoverRef.current = onHover

  useEffect(() => {
    const element = wrapRef.current
    if (!element) return
    const chart = createChart(element, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#10151f' },
        textColor: '#d9d0c2',
        fontFamily: 'IBM Plex Sans Arabic, sans-serif',
      },
      grid: {
        vertLines: { color: '#243049' },
        horzLines: { color: '#243049' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#33415f' },
      timeScale: { borderColor: '#33415f', timeVisible: true, secondsVisible: false },
      localization: { locale: 'en-US' },
    })
    const series = chart.addCandlestickSeries({
      upColor: '#3dbe86',
      downColor: '#f07167',
      borderVisible: false,
      wickUpColor: '#3dbe86',
      wickDownColor: '#f07167',
    })
    const emaSeries = chart.addLineSeries({
      color: '#f0c36a',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })
    const smaSeries = chart.addLineSeries({
      color: '#8eb4ff',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })
    chartRef.current = chart
    seriesRef.current = series
    emaRef.current = emaSeries
    smaRef.current = smaSeries
    chart.subscribeCrosshairMove((param) => {
      const time = param.time as number | undefined
      if (!time) {
        hoverRef.current(null)
        return
      }
      const match = (param.seriesData.get(series) as { open?: number } | undefined)
      if (!match || match.open == null) {
        hoverRef.current(null)
        return
      }
      const bar = match as { open: number; high: number; low: number; close: number }
      hoverRef.current({ time, open: bar.open, high: bar.high, low: bar.low, close: bar.close })
    })
    return () => {
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  useEffect(() => {
    const series = seriesRef.current
    const chart = chartRef.current
    if (!series || !chart || !candles.length) return
    series.setData(
      candles.map((item) => ({
        time: item.time as UTCTimestamp,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
      })),
    )
    emaRef.current?.setData(ema.map((point) => ({ time: point.time as UTCTimestamp, value: point.value })))
    smaRef.current?.setData(sma.map((point) => ({ time: point.time as UTCTimestamp, value: point.value })))
    const markers: SeriesMarker<UTCTimestamp>[] = patterns.slice(0, 3).map((pattern) => ({
      time: pattern.time as UTCTimestamp,
      position: pattern.direction === 'bullish' ? 'belowBar' : 'aboveBar',
      color: pattern.direction === 'bullish' ? '#3dbe86' : pattern.direction === 'bearish' ? '#ff7b72' : '#f0c36a',
      shape: pattern.direction === 'bullish' ? 'arrowUp' : pattern.direction === 'bearish' ? 'arrowDown' : 'circle',
      text: '',
    }))
    series.setMarkers(markers.reverse())
    if (supportRef.current) series.removePriceLine(supportRef.current)
    if (resistanceRef.current) series.removePriceLine(resistanceRef.current)
    supportRef.current = support
      ? series.createPriceLine({
          price: support,
          color: '#3dbe86',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          title: 'دعم',
          axisLabelVisible: true,
        })
      : null
    resistanceRef.current = resistance
      ? series.createPriceLine({
          price: resistance,
          color: '#f07167',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          title: 'مقاومة',
          axisLabelVisible: true,
        })
      : null
    if (fitted.current !== interval) {
      chart.timeScale().fitContent()
      fitted.current = interval
    }
  }, [candles, ema, sma, patterns, support, resistance, interval])

  return <div ref={wrapRef} className="chart-canvas h-[340px] w-full sm:h-[460px]" dir="ltr" />
}
