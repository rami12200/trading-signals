// ============================================
// Finnhub API - Stocks, Forex, Metals
// 60 requests/minute (free plan) — much better than Twelve Data's 8/min
// ============================================

const FINNHUB_BASE = 'https://api.finnhub.io/api/v1'

// Map our intervals to Finnhub resolutions
const RESOLUTION_MAP: Record<string, string> = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '30m': '30',
  '1h': '60',
  '4h': '60',   // Finnhub free doesn't have 4h, we'll use 60m
  '1d': 'D',
  '1w': 'W',
}

// Convert forex/metals symbols to Finnhub OANDA format
// EUR/USD -> OANDA:EUR_USD, XAU/USD -> OANDA:XAU_USD
function toFinnhubForexSymbol(symbol: string): string {
  if (symbol.includes('/')) {
    return `OANDA:${symbol.replace('/', '_')}`
  }
  return symbol
}

// Determine if symbol is forex/metals (contains /)
function isForexOrMetal(symbol: string): boolean {
  return symbol.includes('/')
}

// Fetch stock candles from Finnhub
export async function getFinnhubKlines(
  symbol: string,
  interval: string,
  limit: number = 200
): Promise<any[]> {
  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) {
    console.error('[Finnhub] ERROR: FINNHUB_API_KEY not set in environment variables!')
    return []
  }

  const resolution = RESOLUTION_MAP[interval] || '15'

  // Calculate time range based on resolution and limit
  const now = Math.floor(Date.now() / 1000)
  let secondsPerCandle = 900 // 15m default
  switch (resolution) {
    case '1': secondsPerCandle = 60; break
    case '5': secondsPerCandle = 300; break
    case '15': secondsPerCandle = 900; break
    case '30': secondsPerCandle = 1800; break
    case '60': secondsPerCandle = 3600; break
    case 'D': secondsPerCandle = 86400; break
    case 'W': secondsPerCandle = 604800; break
  }
  // Add extra buffer (1.5x) to account for weekends/holidays
  const from = now - Math.floor(limit * secondsPerCandle * 1.5)

  try {
    let url: string
    const forex = isForexOrMetal(symbol)

    if (forex) {
      const finnSymbol = toFinnhubForexSymbol(symbol)
      url = `${FINNHUB_BASE}/forex/candles?symbol=${encodeURIComponent(finnSymbol)}&resolution=${resolution}&from=${from}&to=${now}&token=${apiKey}`
    } else {
      url = `${FINNHUB_BASE}/stock/candles?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&from=${from}&to=${now}&token=${apiKey}`
    }

    console.log(`[Finnhub] Fetching ${symbol} res=${resolution} limit=${limit}...`)
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      console.error(`[Finnhub] HTTP ${res.status} for ${symbol}`)
      return []
    }

    const data = await res.json()
    if (data.s !== 'ok' || !data.c || !data.t) {
      console.error(`[Finnhub] No data for ${symbol}:`, data.s || 'no status')
      return []
    }

    const candles = data.t.length
    console.log(`[Finnhub] Got ${candles} candles for ${symbol}`)

    // Convert Finnhub format to Binance kline format:
    // Finnhub: { c: [], h: [], l: [], o: [], t: [], v: [] }
    // Binance: [openTime, open, high, low, close, volume, closeTime, ...]
    const result: any[] = []
    const count = Math.min(data.t.length, limit)
    // Take the last `limit` candles if we got more
    const startIdx = Math.max(0, data.t.length - count)

    for (let i = startIdx; i < data.t.length; i++) {
      result.push([
        data.t[i] * 1000,                        // open time (ms)
        String(data.o[i]),                        // open
        String(data.h[i]),                        // high
        String(data.l[i]),                        // low
        String(data.c[i]),                        // close
        String(data.v?.[i] || 0),                 // volume (forex may not have)
        (data.t[i] + secondsPerCandle) * 1000,    // close time (ms)
        '0',                                      // quote asset volume
        0,                                        // number of trades
        '0',                                      // taker buy base
        '0',                                      // taker buy quote
        '0',                                      // ignore
      ])
    }

    return result
  } catch (e) {
    console.error(`[Finnhub] Error for ${symbol}:`, e)
    return []
  }
}
