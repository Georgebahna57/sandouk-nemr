import { getSpot } from '../server/market.mjs'

export default async function handler(_req, res) {
  try {
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30')
    res.status(200).json(await getSpot())
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : 'خطأ في سعر السبوت' })
  }
}
