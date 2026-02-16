// ============================================
// Binance API - Real-time Market Data
// ============================================

const BINANCE_APIS = [
  'https://data-api.binance.vision/api/v3',
  'https://api.binance.com/api/v3',
  'https://api1.binance.com/api/v3',
  'https://api2.binance.com/api/v3',
  'https://api3.binance.com/api/v3',
  'https://api4.binance.com/api/v3',
]

const FETCH_HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
}

async function fetchWithFallback(path: string, options?: RequestInit): Promise<Response> {
  let lastError: Error | null = null
  for (const base of BINANCE_APIS) {
    try {
      const res = await fetch(`${base}${path}`, {
        ...options,
        headers: { ...FETCH_HEADERS, ...(options?.headers || {}) },
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) return res
    } catch (e) {
      lastError = e as Error
      continue
    }
  }
  throw lastError || new Error('All Binance API endpoints failed')
}

export interface BinanceTicker {
  symbol: string
  lastPrice: string
  priceChangePercent: string
  highPrice: string
  lowPrice: string
  volume: string
}

// Fetch single ticker price
export async function getPrice(symbol: string): Promise<number> {
  try {
    const response = await fetchWithFallback(`/ticker/price?symbol=${symbol}`)
    const data = await response.json()
    return parseFloat(data.price)
  } catch {
    return 0
  }
}

// Fetch 24h ticker for a symbol
export async function get24hTicker(symbol: string): Promise<BinanceTicker | null> {
  try {
    const response = await fetchWithFallback(`/ticker/24hr?symbol=${symbol}`)
    return await response.json()
  } catch {
    return null
  }
}

// Fetch multiple 24h tickers
export async function getMultipleTickers(symbols: string[]): Promise<BinanceTicker[]> {
  try {
    const symbolsParam = JSON.stringify(symbols)
    const response = await fetchWithFallback(
      `/ticker/24hr?symbols=${encodeURIComponent(symbolsParam)}`
    )
    return await response.json()
  } catch {
    return []
  }
}

// Fetch kline/candlestick data
export async function getKlines(
  symbol: string,
  interval: string,
  limit: number = 200
): Promise<any[]> {
  try {
    const response = await fetchWithFallback(
      `/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
    )
    return await response.json()
  } catch {
    return []
  }
}

// Crypto pairs available on Binance
export const CRYPTO_PAIRS = [
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'SOLUSDT',
  'XRPUSDT',
  'ADAUSDT',
  'DOGEUSDT',
  'AVAXUSDT',
  'DOTUSDT',
  'LINKUSDT',
]

// Top pairs for signal generation
export const SIGNAL_PAIRS = [
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'BNBUSDT',
  'XRPUSDT',
  'ADAUSDT',
]

// Format symbol for display: BTCUSDT -> BTC/USDT
export function formatSymbol(symbol: string): string {
  if (symbol.endsWith('USDT')) {
    return symbol.replace('USDT', '/USDT')
  }
  return symbol
}

// Format price based on magnitude
export function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (price >= 1) return price.toFixed(4)
  return price.toFixed(6)
}
