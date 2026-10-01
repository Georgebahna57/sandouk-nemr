import { getCalendar } from '../server/market.mjs'

export default async function handler(_req, res) {
  try {
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300')
    res.status(200).json(await getCalendar())
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : 'خطأ في التقويم' })
  }
}
