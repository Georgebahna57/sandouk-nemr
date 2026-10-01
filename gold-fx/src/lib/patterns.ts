import type { Candle, Direction, PatternHit } from '@/types'

interface Parts {
  body: number
  range: number
  upper: number
  lower: number
  bull: boolean
  bear: boolean
  bodyRatio: number
}

export function parts(candle: Candle): Parts {
  const body = Math.abs(candle.close - candle.open)
  const range = Math.max(candle.high - candle.low, 0)
  const upper = candle.high - Math.max(candle.open, candle.close)
  const lower = Math.min(candle.open, candle.close) - candle.low
  return {
    body,
    range,
    upper,
    lower,
    bull: candle.close > candle.open,
    bear: candle.close < candle.open,
    bodyRatio: range === 0 ? 0 : body / range,
  }
}

function average(candles: Candle[], index: number) {
  const slice = candles.slice(Math.max(0, index - 20), index)
  const ranges = slice.map((candle) => parts(candle).range)
  const bodies = slice.map((candle) => parts(candle).body)
  const mean = (values: number[]) =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
  const avgRange = Math.max(mean(ranges), 1e-9)
  const avgBody = Math.max(mean(bodies), 1e-9)
  const look = Math.min(4, index)
  const prior = look > 0 ? candles[index - 1].close - candles[index - look].close : 0
  const trend: Direction = prior <= -0.8 * avgRange ? 'bearish' : prior >= 0.8 * avgRange ? 'bullish' : 'neutral'
  return { avgRange, avgBody, trend }
}

function hit(
  candle: Candle,
  index: number,
  fields: Omit<PatternHit, 'time' | 'index'>,
): PatternHit {
  return { ...fields, time: candle.time, index }
}

function wickShape(candle: Candle): 'hammer' | 'star' | null {
  const candleParts = parts(candle)
  if (candleParts.range <= 0) return null
  const lowerShare = candleParts.lower / candleParts.range
  const upperShare = candleParts.upper / candleParts.range
  if (lowerShare >= 0.55 && candleParts.lower >= candleParts.body * 2 && upperShare <= 0.18 && candleParts.bodyRatio <= 0.4) {
    return 'hammer'
  }
  if (upperShare >= 0.55 && candleParts.upper >= candleParts.body * 2 && lowerShare <= 0.18 && candleParts.bodyRatio <= 0.4) {
    return 'star'
  }
  return null
}

function bullishEngulfing(previous: Candle, current: Candle, avgBody: number): boolean {
  const prev = parts(previous)
  const curr = parts(current)
  return (
    prev.bear &&
    curr.bull &&
    curr.body >= prev.body &&
    curr.body >= avgBody * 0.6 &&
    current.open <= previous.close &&
    current.close >= previous.open
  )
}

function bearishEngulfing(previous: Candle, current: Candle, avgBody: number): boolean {
  const prev = parts(previous)
  const curr = parts(current)
  return (
    prev.bull &&
    curr.bear &&
    curr.body >= prev.body &&
    curr.body >= avgBody * 0.6 &&
    current.open >= previous.close &&
    current.close <= previous.open
  )
}

function harami(previous: Candle, current: Candle, avgBody: number): Direction | null {
  const prev = parts(previous)
  const curr = parts(current)
  if (prev.body < avgBody * 0.7 || curr.body >= prev.body) return null
  const inside =
    Math.max(current.open, current.close) <= Math.max(previous.open, previous.close) &&
    Math.min(current.open, current.close) >= Math.min(previous.open, previous.close)
  if (!inside) return null
  if (prev.bear && curr.bull) return 'bullish'
  if (prev.bull && curr.bear) return 'bearish'
  return null
}

function morningStar(candles: Candle[], index: number, avgBody: number): boolean {
  if (index < 2) return false
  const first = candles[index - 2]
  const middle = candles[index - 1]
  const third = candles[index]
  const a = parts(first)
  const b = parts(middle)
  const c = parts(third)
  return (
    a.bear &&
    a.body >= avgBody * 0.8 &&
    b.body <= a.body * 0.6 &&
    c.bull &&
    c.body >= avgBody * 0.5 &&
    third.close > (first.open + first.close) / 2
  )
}

function eveningStar(candles: Candle[], index: number, avgBody: number): boolean {
  if (index < 2) return false
  const first = candles[index - 2]
  const middle = candles[index - 1]
  const third = candles[index]
  const a = parts(first)
  const b = parts(middle)
  const c = parts(third)
  return (
    a.bull &&
    a.body >= avgBody * 0.8 &&
    b.body <= a.body * 0.6 &&
    c.bear &&
    c.body >= avgBody * 0.5 &&
    third.close < (first.open + first.close) / 2
  )
}

function threeSoldiers(candles: Candle[], index: number, avgBody: number, bullish: boolean): boolean {
  if (index < 2) return false
  const group = [candles[index - 2], candles[index - 1], candles[index]]
  if (!group.every((candle) => (bullish ? parts(candle).bull : parts(candle).bear))) return false
  for (const candle of group) {
    const candleParts = parts(candle)
    if (candleParts.body < avgBody * 0.5) return false
    const rejection = bullish ? candleParts.upper : candleParts.lower
    if (rejection > candleParts.body) return false
  }
  if (bullish) {
    if (!(group[1].close > group[0].close && group[2].close > group[1].close)) return false
    if (group[1].open < group[0].open || group[1].open > group[0].close) return false
    if (group[2].open < group[1].open || group[2].open > group[1].close) return false
    return true
  }
  if (!(group[1].close < group[0].close && group[2].close < group[1].close)) return false
  if (group[1].open > group[0].open || group[1].open < group[0].close) return false
  if (group[2].open > group[1].open || group[2].open < group[1].close) return false
  return true
}

function classify(candles: Candle[], index: number): PatternHit | null {
  const candle = candles[index]
  const candleParts = parts(candle)
  if (candleParts.range <= 0) return null
  const { avgRange, avgBody, trend } = average(candles, index)
  const previous = index > 0 ? candles[index - 1] : null

  if (morningStar(candles, index, avgBody)) {
    return hit(candle, index, {
      id: 'morning-star',
      name: 'نجمة الصباح',
      english: 'Morning Star',
      direction: 'bullish',
      strength: 3,
      summary: 'هبوط ثم تردد ثم صعود أغلق فوق منتصف الشمعة الأولى.',
      lesson: 'نمط انعكاس صاعد من ثلاث شموع. يُقرأ أقوى إذا جاء عند دعم، وبعده ثبات فوق قمة الشمعة الأخيرة.',
    })
  }
  if (eveningStar(candles, index, avgBody)) {
    return hit(candle, index, {
      id: 'evening-star',
      name: 'نجمة المساء',
      english: 'Evening Star',
      direction: 'bearish',
      strength: 3,
      summary: 'صعود ثم تردد ثم هبوط أغلق تحت منتصف الشمعة الأولى.',
      lesson: 'نمط انعكاس هابط. قرب مقاومة يكون أوضح، والتأكيد كسر قاع الشمعة الأخيرة.',
    })
  }
  if (threeSoldiers(candles, index, avgBody, true)) {
    return hit(candle, index, {
      id: 'three-soldiers',
      name: 'ثلاثة جنود',
      english: 'Three White Soldiers',
      direction: 'bullish',
      strength: 3,
      summary: 'ثلاث شموع صاعدة متتالية بإغلاق أعلى كل مرة.',
      lesson: 'زخم شراء مستمر. على الذهب راقب إن كان السعر ممدوداً عن المتوسط، لأن الامتداد قد يتراجع.',
    })
  }
  if (threeSoldiers(candles, index, avgBody, false)) {
    return hit(candle, index, {
      id: 'three-crows',
      name: 'ثلاثة غربان',
      english: 'Three Black Crows',
      direction: 'bearish',
      strength: 3,
      summary: 'ثلاث شموع هابطة متتالية بإغلاق أدنى كل مرة.',
      lesson: 'زخم بيع مستمر. الأقوى حين يكسر دعماً، والأضعف إذا ظهر بعد هبوط طويل بلا ارتداد.',
    })
  }
  if (previous && bullishEngulfing(previous, candle, avgBody)) {
    return hit(candle, index, {
      id: 'bull-engulf',
      name: 'ابتلاع صاعد',
      english: 'Bullish Engulfing',
      direction: 'bullish',
      strength: trend === 'bearish' ? 3 : 2,
      summary: 'جسم صاعد ابتلع جسم الشمعة الهابطة السابقة.',
      lesson: 'المشترون سيطروا على مدى الشمعة السابقة. النمط أوضح بعد نزول، ويحتاج ألا يكسر الإغلاق مباشرة.',
    })
  }
  if (previous && bearishEngulfing(previous, candle, avgBody)) {
    return hit(candle, index, {
      id: 'bear-engulf',
      name: 'ابتلاع هابط',
      english: 'Bearish Engulfing',
      direction: 'bearish',
      strength: trend === 'bullish' ? 3 : 2,
      summary: 'جسم هابط ابتلع جسم الشمعة الصاعدة السابقة.',
      lesson: 'البائعون محوا صعود الشمعة السابقة. قرب مقاومة يكون أهم من ظهوره وسط نطاق عرضي.',
    })
  }

  const shape = wickShape(candle)
  if (shape === 'hammer') {
    if (trend === 'bearish') {
      return hit(candle, index, {
        id: 'hammer',
        name: 'مطرقة',
        english: 'Hammer',
        direction: 'bullish',
        strength: 3,
        summary: 'ذيل سفلي طويل بعد نزول، والجسم صغير في أعلى الشمعة.',
        lesson: 'السعر نزل ثم عاد. المشترون دافعوا. على الذهب تُقرأ غالباً قرب دعم، والتأكيد شمعة لاحقة تغلق فوقها.',
      })
    }
    if (trend === 'bullish') {
      return hit(candle, index, {
        id: 'hanging-man',
        name: 'رجل مشنوق',
        english: 'Hanging Man',
        direction: 'bearish',
        strength: 2,
        summary: 'نفس شكل المطرقة لكنه جاء بعد صعود.',
        lesson: 'الذيل السفلي بعد ارتفاع يعني تقلباً تحت السعر. وحده أضعف من المطرقة، ويهتم به المتداول إذا أغلق ما بعده تحت الجسم.',
      })
    }
    return hit(candle, index, {
      id: 'lower-pin',
      name: 'دبوس سفلي',
      english: 'Lower pin',
      direction: 'bullish',
      strength: 1,
      summary: 'ذيل سفلي طويل بلا اتجاه واضح قبله.',
      lesson: 'في رفض للأسعار الدنيا داخل الشمعة. بدون دعم أو اتجاه سابق تبقى الإشارة ضعيفة.',
    })
  }
  if (shape === 'star') {
    if (trend === 'bullish') {
      return hit(candle, index, {
        id: 'shooting-star',
        name: 'نجمة ساقطة',
        english: 'Shooting Star',
        direction: 'bearish',
        strength: 3,
        summary: 'ذيل علوي طويل بعد صعود، والجسم صغير في أسفل الشمعة.',
        lesson: 'السعر جُرّب للأعلى ثم رُفض. غالباً تُقرأ عند مقاومة. التأكيد إغلاق لاحق تحت الجسم.',
      })
    }
    if (trend === 'bearish') {
      return hit(candle, index, {
        id: 'inverted-hammer',
        name: 'مطرقة مقلوبة',
        english: 'Inverted Hammer',
        direction: 'bullish',
        strength: 2,
        summary: 'ذيل علوي طويل بعد نزول.',
        lesson: 'المشترون حاولوا رفع السعر قبل أن يعود للإغلاق. أضعف من نجمة الصباح، ويحتاج تأكيداً من الشمعة التالية.',
      })
    }
    return hit(candle, index, {
      id: 'upper-pin',
      name: 'دبوس علوي',
      english: 'Upper pin',
      direction: 'bearish',
      strength: 1,
      summary: 'ذيل علوي طويل بلا اتجاه واضح قبله.',
      lesson: 'رفض للأسعار العليا داخل الشمعة. أهميته تكبر إذا لامست مقاومة معروفة.',
    })
  }

  if (previous) {
    const haramiDirection = harami(previous, candle, avgBody)
    if (haramiDirection) {
      return hit(candle, index, {
        id: haramiDirection === 'bullish' ? 'bull-harami' : 'bear-harami',
        name: haramiDirection === 'bullish' ? 'هارامي صاعد' : 'هارامي هابط',
        english: haramiDirection === 'bullish' ? 'Bullish Harami' : 'Bearish Harami',
        direction: haramiDirection,
        strength: 1,
        summary: 'جسم صغير محبوس داخل جسم الشمعة السابقة.',
        lesson: 'الاندفاع السابق فقد سرعته. هذا تردد أكثر مما هو انعكاس جاهز، فانتظر الشمعة التي تكسر أحد الطرفين.',
      })
    }
  }

  if (candleParts.bodyRatio >= 0.88 && candleParts.body >= avgBody * 0.8 && (candleParts.bull || candleParts.bear)) {
    const direction: Direction = candleParts.bull ? 'bullish' : 'bearish'
    return hit(candle, index, {
      id: direction === 'bullish' ? 'bull-marubozu' : 'bear-marubozu',
      name: direction === 'bullish' ? 'ماروبوزو صاعد' : 'ماروبوزو هابط',
      english: 'Marubozu',
      direction,
      strength: 2,
      summary: 'جسم عريض وذيول شبه غائبة.',
      lesson: 'جهة واحدة سيطرت من الافتتاح حتى الإغلاق. إذا ظهرت مع اختراق مستوى، الحركة أقوى من ظهورها وسط النطاق.',
    })
  }

  if (candleParts.bodyRatio <= 0.1 && candleParts.range >= avgRange * 0.7) {
    return hit(candle, index, {
      id: 'doji',
      name: 'دوجي',
      english: 'Doji',
      direction: 'neutral',
      strength: 1,
      summary: 'الافتتاح والإغلاق متقاربان مقارنة بمدى الشمعة.',
      lesson: 'توازن بين المشترين والبائعين. بعد حركة قوية أو عند دعم ومقاومة يعني تردداً، ووحده لا يحدد الاتجاه.',
    })
  }

  return null
}

export function detectPatterns(candles: Candle[]): PatternHit[] {
  const hits: PatternHit[] = []
  for (let index = 0; index < candles.length; index++) {
    const pattern = classify(candles, index)
    if (pattern) hits.push(pattern)
  }
  const recent = hits.filter((pattern) => pattern.index >= candles.length - 25)
  const picked: PatternHit[] = []
  for (const pattern of [...recent].reverse()) {
    if (picked.length >= 6) break
    if (pattern.direction === 'neutral' && picked.some((item) => Math.abs(item.index - pattern.index) <= 2)) continue
    picked.push(pattern)
  }
  return picked
}

export function describeCandle(candle: Candle, averageRange: number): string[] {
  const candleParts = parts(candle)
  const lines: string[] = []
  if (candleParts.bull) lines.push('شمعة صاعدة: الإغلاق أعلى من الافتتاح.')
  else if (candleParts.bear) lines.push('شمعة هابطة: الإغلاق أدنى من الافتتاح.')
  else lines.push('الافتتاح والإغلاق على السعر نفسه تقريباً.')

  if (candleParts.range === 0) {
    lines.push('لا مدى للحركة داخل هذه الشمعة.')
    return lines
  }
  if (candleParts.bodyRatio < 0.15) lines.push('الجسم صغير: تردد بين الطرفين داخل المدى.')
  else if (candleParts.bodyRatio > 0.75) lines.push('الجسم كبير: الجهة الرابحة سيطرت على معظم المدى.')

  if (candleParts.lower > candleParts.body * 2 && candleParts.lower > candleParts.upper) {
    lines.push('ذيل سفلي طويل: السعر نزل ثم رُفع. المشترون دافعوا عن القاع.')
  }
  if (candleParts.upper > candleParts.body * 2 && candleParts.upper > candleParts.lower) {
    lines.push('ذيل علوي طويل: السعر صعد ثم أُعيد. البائعون رفضوا القمة.')
  }
  if (averageRange > 0 && candleParts.range > averageRange * 1.6) {
    lines.push('مدى الشمعة أوسع من المعتاد: حركة قوية، غالباً مع خبر أو كسر مستوى.')
  }
  return lines
}

export function averageRange(candles: Candle[], count = 14): number {
  const slice = candles.slice(-count)
  if (!slice.length) return 0
  return slice.reduce((sum, candle) => sum + parts(candle).range, 0) / slice.length
}
