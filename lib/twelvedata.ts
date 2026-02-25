// ============================================
// Twelve Data API - Stocks, Forex, Metals
// ============================================

const TWELVEDATA_BASE = 'https://api.twelvedata.com'

const INTERVAL_MAP: Record<string, string> = {
  '5m': '5min',
  '15m': '15min',
  '30m': '30min',
  '1h': '1h',
  '4h': '4h',
  '1d': '1day',
  '1w': '1week',
}

export interface TwelveDataCandle {
  datetime: string
  open: string
  high: string
  low: string
  close: string
  volume: string
}

// Fetch kline/candlestick data from Twelve Data
export async function getTwelveDataKlines(
  symbol: string,
  interval: string,
  limit: number = 200
): Promise<any[]> {
  const apiKey = process.env.TWELVEDATA_API_KEY
  if (!apiKey) {
    console.error('[TwelveData] ERROR: TWELVEDATA_API_KEY not set in environment variables!')
    return []
  }

  const tdInterval = INTERVAL_MAP[interval] || '15min'

  try {
    const url = `${TWELVEDATA_BASE}/time_series?symbol=${encodeURIComponent(symbol)}&interval=${tdInterval}&outputsize=${limit}&order=asc&apikey=${apiKey}`
    console.log(`[TwelveData] Fetching ${symbol} ${tdInterval}...`)
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      console.error(`[TwelveData] HTTP ${res.status} for ${symbol}`)
      return []
    }

    const data = await res.json()
    if (data.status !== 'ok' || !data.values) {
      console.error(`[TwelveData] Bad response for ${symbol}:`, data.status, data.message || '')
      return []
    }
    console.log(`[TwelveData] Got ${data.values.length} candles for ${symbol}`)

    // Convert Twelve Data format to Binance kline format:
    // [openTime, open, high, low, close, volume, closeTime, ...]
    return data.values.map((v: TwelveDataCandle) => {
      const ts = new Date(v.datetime).getTime()
      return [
        ts,                    // open time
        v.open,                // open
        v.high,                // high
        v.low,                 // low
        v.close,               // close
        v.volume || '0',       // volume (forex/metals may not have volume)
        ts + 60000,            // close time (approximate)
        '0',                   // quote asset volume
        0,                     // number of trades
        '0',                   // taker buy base
        '0',                   // taker buy quote
        '0',                   // ignore
      ]
    })
  } catch (e) {
    console.error(`TwelveData error for ${symbol}:`, e)
    return []
  }
}

// Format Twelve Data symbols for display
export function formatTwelveDataSymbol(symbol: string): string {
  // Already formatted like EUR/USD
  if (symbol.includes('/')) return symbol
  // Stock symbols: AAPL -> AAPL
  return symbol
}
