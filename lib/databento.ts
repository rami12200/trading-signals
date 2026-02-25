// ============================================
// Databento API - أسهم أمريكية، فوركس، معادن
// $125 رصيد مجاني — بيانات OHLCV دقيقة
// ============================================

const DATABENTO_BASE = 'https://hist.databento.com/v0'

// تحويل الفترات الزمنية لصيغة Databento
// ohlcv-1m, ohlcv-1h, ohlcv-1d
const SCHEMA_MAP: Record<string, string> = {
  '1m': 'ohlcv-1m',
  '5m': 'ohlcv-1m',   // Databento ما عنده 5m، نجلب 1m ونجمّع
  '15m': 'ohlcv-1m',  // نجلب 1m ونجمّع
  '30m': 'ohlcv-1m',
  '1h': 'ohlcv-1h',
  '4h': 'ohlcv-1h',
  '1d': 'ohlcv-1d',
  '1w': 'ohlcv-1d',
}

// عدد الشموع الخام المطلوبة حسب الفريم
function getRawLimit(interval: string, limit: number): number {
  switch (interval) {
    case '5m': return limit * 5
    case '15m': return limit * 15
    case '30m': return limit * 30
    case '4h': return limit * 4
    case '1w': return limit * 7
    default: return limit
  }
}

// عدد الدقائق/الساعات لكل شمعة مجمّعة
function getAggFactor(interval: string): number {
  switch (interval) {
    case '5m': return 5
    case '15m': return 15
    case '30m': return 30
    case '4h': return 4
    case '1w': return 7
    default: return 1
  }
}

// تحديد الـ dataset حسب نوع الأصل
// XNAS.ITCH = أسهم ناسداك (AAPL, MSFT, etc.)
// GLBX.MDP3 = CME فوركس ومعادن (GC, SI, 6E, 6B)
function getDataset(symbol: string): string {
  // فوركس ومعادن تروح CME
  if (symbol.includes('/')) return 'GLBX.MDP3'
  // أسهم أمريكية
  return 'XNAS.ITCH'
}

// تحويل رموز الفوركس والمعادن لصيغة Databento/CME
// EUR/USD -> 6E.c.0 (العقد المستمر)
// GBP/USD -> 6B.c.0
// XAU/USD -> GC.c.0
// XAG/USD -> SI.c.0
function toDabentoSymbol(symbol: string): string {
  const map: Record<string, string> = {
    'EUR/USD': '6E.c.0',
    'GBP/USD': '6B.c.0',
    'USD/JPY': '6J.c.0',
    'USD/CHF': '6S.c.0',
    'AUD/USD': '6A.c.0',
    'USD/CAD': '6C.c.0',
    'NZD/USD': '6N.c.0',
    'EUR/GBP': '6E.c.0', // سنستخدم EUR كبديل
    'XAU/USD': 'GC.c.0',
    'XAG/USD': 'SI.c.0',
  }
  return map[symbol] || symbol
}

// تحويل سعر Databento من fixed-point
// الأسهم: القيمة / 1,000,000,000 (9 أصفار)
// الفوركس/المعادن (CME): نفس المنطق
function parsePrice(raw: string | number): number {
  const val = typeof raw === 'string' ? parseInt(raw) : raw
  return val / 1_000_000_000
}

// تجميع شموع 1 دقيقة إلى فترات أكبر (5m, 15m, 30m)
function aggregateCandles(candles: any[][], factor: number): any[][] {
  if (factor <= 1) return candles
  const result: any[][] = []
  for (let i = 0; i < candles.length; i += factor) {
    const chunk = candles.slice(i, i + factor)
    if (chunk.length === 0) continue
    const open = chunk[0][1]
    const high = Math.max(...chunk.map(c => parseFloat(c[2]))).toString()
    const low = Math.min(...chunk.map(c => parseFloat(c[3]))).toString()
    const close = chunk[chunk.length - 1][4]
    const volume = chunk.reduce((sum, c) => sum + parseFloat(c[5]), 0).toString()
    result.push([
      chunk[0][0],  // open time
      open, high, low, close, volume,
      chunk[chunk.length - 1][6], // close time
      '0', 0, '0', '0', '0',
    ])
  }
  return result
}

// جلب شموع OHLCV من Databento
export async function getDatabentoKlines(
  symbol: string,
  interval: string,
  limit: number = 200
): Promise<any[]> {
  const apiKey = process.env.DATABENTO_API_KEY
  if (!apiKey) {
    console.error('[Databento] خطأ: DATABENTO_API_KEY مو موجود!')
    return []
  }

  const schema = SCHEMA_MAP[interval] || 'ohlcv-1m'
  const dataset = getDataset(symbol)
  const dbSymbol = symbol.includes('/') ? toDabentoSymbol(symbol) : symbol
  const rawLimit = getRawLimit(interval, limit)
  const aggFactor = getAggFactor(interval)

  // حساب التاريخ — end = بداية اليوم UTC عشان ما نتجاوز آخر بيانات متاحة
  // Databento بيانات تاريخية — آخر بيانات متاحة تكون نهاية آخر يوم تداول مكتمل
  const now = new Date()
  const daysBack = interval === '1d' || interval === '1w' ? 365 : 10
  const start = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)
  const startStr = start.toISOString().split('T')[0]
  const endStr = now.toISOString().split('T')[0] // بداية اليوم فقط (بدون وقت)

  try {
    const params = new URLSearchParams({
      dataset,
      schema,
      symbols: dbSymbol,
      start: startStr,
      end: endStr,
      encoding: 'json',
      limit: String(rawLimit),
    })

    const url = `${DATABENTO_BASE}/timeseries.get_range`
    console.log(`[Databento] جلب ${symbol} (${dbSymbol}) ${schema}...`)

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(apiKey + ':').toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params.toString(),
      signal: AbortSignal.timeout(20000),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error(`[Databento] خطأ HTTP ${res.status} لـ ${symbol}:`, errText.substring(0, 200))
      return []
    }

    // Databento يرجع NDJSON (سطر لكل شمعة)
    const text = await res.text()
    const lines = text.trim().split('\n').filter(l => l.length > 0)

    if (lines.length === 0) {
      console.error(`[Databento] لا توجد بيانات لـ ${symbol}`)
      return []
    }

    console.log(`[Databento] تم جلب ${lines.length} شمعة لـ ${symbol}`)

    // تحويل لصيغة Binance kline
    const candles: any[][] = lines.map(line => {
      const d = JSON.parse(line)
      const tsNano = parseInt(d.hd.ts_event)
      const tsMs = Math.floor(tsNano / 1_000_000)
      const open = parsePrice(d.open)
      const high = parsePrice(d.high)
      const low = parsePrice(d.low)
      const close = parsePrice(d.close)
      const volume = d.volume || 0

      return [
        tsMs,                    // وقت الفتح
        String(open),            // سعر الفتح
        String(high),            // أعلى سعر
        String(low),             // أدنى سعر
        String(close),           // سعر الإغلاق
        String(volume),          // حجم التداول
        tsMs + 60000,            // وقت الإغلاق (تقريبي)
        '0', 0, '0', '0', '0',
      ]
    })

    // تجميع لو الفريم أكبر من 1 دقيقة
    const aggregated = aggregateCandles(candles, aggFactor)

    // نرجع آخر `limit` شمعة
    return aggregated.slice(-limit)
  } catch (e) {
    console.error(`[Databento] خطأ لـ ${symbol}:`, e)
    return []
  }
}
