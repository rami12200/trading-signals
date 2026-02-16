// ============================================
// Binance API - Real-time Market Data
// ============================================

const BINANCE_API = 'https://api.binance.com/api/v3'

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
    const response = await fetch(`${BINANCE_API}/ticker/price?symbol=${symbol}`, {
      next: { revalidate: 10 },
    })
    if (!response.ok) return 0
    const data = await response.json()
    return parseFloat(data.price)
  } catch {
    return 0
  }
}

// Fetch 24h ticker for a symbol
export async function get24hTicker(symbol: string): Promise<BinanceTicker | null> {
  try {
    const response = await fetch(`${BINANCE_API}/ticker/24hr?symbol=${symbol}`, {
      next: { revalidate: 15 },
    })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

// Fetch multiple 24h tickers
export async function getMultipleTickers(symbols: string[]): Promise<BinanceTicker[]> {
  try {
    const symbolsParam = JSON.stringify(symbols)
    const response = await fetch(
      `${BINANCE_API}/ticker/24hr?symbols=${encodeURIComponent(symbolsParam)}`,
      { next: { revalidate: 15 } }
    )
    if (!response.ok) return []
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
    const response = await fetch(
      `${BINANCE_API}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
      { next: { revalidate: 30 } }
    )
    if (!response.ok) return []
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
