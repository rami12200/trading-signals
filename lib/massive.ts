// ============================================
// Massive API — فوركس ومعادن (XAU/USD, XAG/USD, EUR/USD)
// https://massive.com/docs/rest/currencies/aggregates
// الخطة المجانية: 5 طلبات/دقيقة
// ============================================

const MASSIVE_BASE = 'https://api.massive.com/v2'

// تحويل الفترات الزمنية لصيغة Massive
// resolution: minute, hour, day, week
function getResolution(interval: string): { multiplier: number; timespan: string } {
  switch (interval) {
    case '1m': return { multiplier: 1, timespan: 'minute' }
    case '5m': return { multiplier: 5, timespan: 'minute' }
    case '15m': return { multiplier: 15, timespan: 'minute' }
    case '30m': return { multiplier: 30, timespan: 'minute' }
    case '1h': return { multiplier: 1, timespan: 'hour' }
    case '4h': return { multiplier: 4, timespan: 'hour' }
    case '1d': return { multiplier: 1, timespan: 'day' }
    case '1w': return { multiplier: 1, timespan: 'week' }
    default: return { multiplier: 15, timespan: 'minute' }
  }
}

// تحويل الرمز لصيغة Massive
// XAU/USD -> C:XAUUSD
// EUR/USD -> C:EURUSD
function toMassiveTicker(symbol: string): string {
  if (symbol.startsWith('C:')) return symbol
  return 'C:' + symbol.replace('/', '')
}

// جلب شموع OHLCV من Massive — يرجع بصيغة Binance kline
export async function getMassiveKlines(
  symbol: string,
  interval: string,
  limit: number = 200
): Promise<any[]> {
  const apiKey = process.env.MASSIVE_API_KEY
  if (!apiKey) {
    console.error('[Massive] خطأ: MASSIVE_API_KEY مو موجود!')
    return []
  }

  const ticker = toMassiveTicker(symbol)
  const { multiplier, timespan } = getResolution(interval)

  // حساب التاريخ
  const now = new Date()
  const end = now.toISOString().split('T')[0]

  // نحسب كم يوم نحتاج بناءً على الفريم والـ limit
  let daysBack = 10
  if (timespan === 'minute') {
    daysBack = Math.ceil((limit * multiplier) / (60 * 24)) + 2
  } else if (timespan === 'hour') {
    daysBack = Math.ceil((limit * multiplier) / 24) + 2
  } else if (timespan === 'day') {
    daysBack = limit + 10
  } else if (timespan === 'week') {
    daysBack = limit * 7 + 10
  }

  const start = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)
  const startStr = start.toISOString().split('T')[0]

  try {
    const url = `${MASSIVE_BASE}/aggs/ticker/${ticker}/range/${multiplier}/${timespan}/${startStr}/${end}?apiKey=${apiKey}&limit=${limit}&sort=asc`

    console.log(`[Massive] جلب ${symbol} (${ticker}) ${multiplier}${timespan}...`)

    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error(`[Massive] خطأ HTTP ${res.status} لـ ${symbol}:`, errText.substring(0, 200))
      return []
    }

    const data = await res.json()

    if (!data.results || data.results.length === 0) {
      console.error(`[Massive] لا توجد بيانات لـ ${symbol}`)
      return []
    }

    console.log(`[Massive] تم جلب ${data.results.length} شمعة لـ ${symbol}`)

    // تحويل لصيغة Binance kline
    const candles: any[][] = data.results.map((bar: any) => {
      return [
        bar.t,                    // وقت الفتح (ms)
        String(bar.o),            // سعر الفتح
        String(bar.h),            // أعلى سعر
        String(bar.l),            // أدنى سعر
        String(bar.c),            // سعر الإغلاق
        String(bar.v || 0),       // حجم التداول
        bar.t + (multiplier * (timespan === 'minute' ? 60000 : timespan === 'hour' ? 3600000 : 86400000)),
        '0', 0, '0', '0', '0',
      ]
    })

    // نرجع آخر `limit` شمعة
    return candles.slice(-limit)
  } catch (e) {
    console.error(`[Massive] خطأ لـ ${symbol}:`, e)
    return []
  }
}
