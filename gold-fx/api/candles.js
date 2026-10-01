import { getCandles } from '../server/market.mjs'

export default async function handler(req, res) {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const interval = req.query?.interval || url.searchParams.get('interval') || '1h'
    res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=40')
    res.status(200).json(await getCandles(String(interval)))
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : 'خطأ في جلب الشموع' })
  }
}
