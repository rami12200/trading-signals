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

// === Asset categories — Binance (crypto) + Twelve Data (stocks, forex, metals) ===
export type DataSource = 'binance' | 'finnhub'
export type AssetCategory = 'major' | 'defi' | 'layer1' | 'layer2' | 'meme' | 'gaming' | 'stocks' | 'forex' | 'metals'

export interface CategoryConfig {
  label: string
  source: DataSource
  pairs: string[]
}

export const ASSET_CATEGORIES: Record<AssetCategory, CategoryConfig> = {
  // ---- Crypto (Binance) ----
  major: {
    label: 'كربتو رئيسية',
    source: 'binance',
    pairs: [
      'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT',
      'DOTUSDT', 'AVAXUSDT', 'LINKUSDT', 'LTCUSDT',
    ],
  },
  defi: {
    label: 'DeFi',
    source: 'binance',
    pairs: [
      'UNIUSDT', 'AAVEUSDT', 'MKRUSDT', 'COMPUSDT', 'SNXUSDT',
      'CRVUSDT', 'SUSHIUSDT', 'DYDXUSDT', '1INCHUSDT', 'LDOUSDT',
    ],
  },
  layer1: {
    label: 'Layer 1',
    source: 'binance',
    pairs: [
      'APTUSDT', 'SUIUSDT', 'NEARUSDT', 'ATOMUSDT', 'ALGOUSDT',
      'FTMUSDT', 'ICPUSDT', 'TONUSDT', 'SEIUSDT', 'INJUSDT',
    ],
  },
  layer2: {
    label: 'Layer 2',
    source: 'binance',
    pairs: [
      'MATICUSDT', 'ARBUSDT', 'OPUSDT', 'STXUSDT', 'IMXUSDT',
    ],
  },
  meme: {
    label: 'Meme',
    source: 'binance',
    pairs: [
      'DOGEUSDT', 'SHIBUSDT', 'PEPEUSDT', 'FLOKIUSDT', 'WIFUSDT',
    ],
  },
  gaming: {
    label: 'Gaming',
    source: 'binance',
    pairs: [
      'AXSUSDT', 'SANDUSDT', 'MANAUSDT', 'GALAUSDT', 'ENJUSDT',
    ],
  },
  // ---- Stocks (Finnhub) ----
  stocks: {
    label: 'أسهم أمريكية',
    source: 'finnhub',
    pairs: [
      'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA',
      'JPM', 'V', 'JNJ', 'WMT', 'HD', 'INTC', 'IBM', 'COST',
    ],
  },
  // ---- Forex (Finnhub) ----
  forex: {
    label: 'فوركس',
    source: 'finnhub',
    pairs: [
      'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF',
      'AUD/USD', 'USD/CAD', 'NZD/USD', 'EUR/GBP',
    ],
  },
  // ---- Metals (Finnhub) ----
  metals: {
    label: 'معادن',
    source: 'finnhub',
    pairs: [
      'XAU/USD', 'XAG/USD',
    ],
  },
}

// Legacy type alias for backward compatibility
export type CryptoCategory = AssetCategory
export const CRYPTO_CATEGORIES = ASSET_CATEGORIES

// All crypto pairs (Binance only) — deduplicated
const cryptoCats: AssetCategory[] = ['major', 'defi', 'layer1', 'layer2', 'meme', 'gaming']
export const CRYPTO_PAIRS = Array.from(
  new Set(cryptoCats.flatMap(k => ASSET_CATEGORIES[k].pairs))
)
export const SIGNAL_PAIRS = ASSET_CATEGORIES.major.pairs.slice(0, 6)

export function getCategoryPairs(category: AssetCategory): string[] {
  return ASSET_CATEGORIES[category]?.pairs || ASSET_CATEGORIES.major.pairs
}

export function getCategorySource(category: AssetCategory): DataSource {
  return ASSET_CATEGORIES[category]?.source || 'binance'
}

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
