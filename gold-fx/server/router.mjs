import { getCalendar, getCandles, getNews, getSpot } from './market.mjs'

export async function handleApi(pathname, searchParams) {
  try {
    if (pathname === '/api/candles') {
      return { status: 200, body: await getCandles(searchParams.get('interval') || '1h') }
    }
    if (pathname === '/api/spot') {
      return { status: 200, body: await getSpot() }
    }
    if (pathname === '/api/calendar') {
      return { status: 200, body: await getCalendar() }
    }
    if (pathname === '/api/news') {
      return { status: 200, body: await getNews() }
    }
    return null
  } catch (error) {
    return {
      status: 502,
      body: { error: error instanceof Error ? error.message : 'خطأ في جلب البيانات' },
    }
  }
}
