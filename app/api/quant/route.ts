import { NextResponse } from 'next/server'
import { runQuantAnalysis, Candle, OrderBook } from '@/lib/quant-engine'

// ============================================
// Institutional Quant AI Engine API
// ============================================

const cache: Record<string, { data: any; timestamp: number }> = {}
const CACHE_TTL = 8_000 // 8 seconds

const VALID_PAIRS = ['BTCUSDT', 'ETHUSDT']
const VALID_INTERVALS = ['1m', '5m', '15m']
const BINANCE_BASE = 'https://api.binance.com'
const BINANCE_FAPI = 'https://fapi.binance.com'

async function fetchJSON(url: string) {
  const res = await fetch(url, { next: { revalidate: 0 } })
  if (!res.ok) throw new Error(`Binance API error: ${res.status} ${res.statusText}`)
  return res.json()
}

async function getCached<T>(key: string, fetcher: () => Promise<T>, ttl = CACHE_TTL): Promise<T> {
  const now = Date.now()
  if (cache[key] && now - cache[key].timestamp < ttl) return cache[key].data as T
  const data = await fetcher()
  cache[key] = { data, timestamp: now }
  return data
}

// Fetch klines from Binance
async function getKlines(symbol: string, interval: string, limit: number = 200): Promise<Candle[]> {
  const key = `klines-${symbol}-${interval}-${limit}`
  return getCached(key, async () => {
    const raw = await fetchJSON(`${BINANCE_BASE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`)
    return raw.map((k: any) => ({
      time: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }))
  })
}

// Fetch order book depth
async function getOrderBook(symbol: string, limit: number = 20): Promise<OrderBook> {
  const key = `ob-${symbol}-${limit}`
  return getCached(key, async () => {
    const raw = await fetchJSON(`${BINANCE_BASE}/api/v3/depth?symbol=${symbol}&limit=${limit}`)
    return {
      bids: raw.bids.map((b: string[]) => ({ price: parseFloat(b[0]), qty: parseFloat(b[1]) })),
      asks: raw.asks.map((a: string[]) => ({ price: parseFloat(a[0]), qty: parseFloat(a[1]) })),
    }
  })
}

// Fetch funding rate from Binance Futures
async function getFundingRate(symbol: string): Promise<number> {
  const key = `fr-${symbol}`
  return getCached(key, async () => {
    try {
      const raw = await fetchJSON(`${BINANCE_FAPI}/fapi/v1/fundingRate?symbol=${symbol}&limit=1`)
      return raw.length > 0 ? parseFloat(raw[0].fundingRate) : 0
    } catch {
      return 0
    }
  }, 30_000) // cache for 30s
}

// Fetch open interest from Binance Futures
async function getOpenInterest(symbol: string): Promise<{ current: number; previous: number }> {
  const key = `oi-${symbol}`
  return getCached(key, async () => {
    try {
      const raw = await fetchJSON(`${BINANCE_FAPI}/fapi/v1/openInterest?symbol=${symbol}`)
      const current = parseFloat(raw.openInterest)
      // Fetch OI history for comparison
      const hist = await fetchJSON(`${BINANCE_FAPI}/futures/data/openInterestHist?symbol=${symbol}&period=5m&limit=2`)
      const previous = hist.length >= 2 ? parseFloat(hist[hist.length - 2].sumOpenInterest) : current
      return { current, previous }
    } catch {
      return { current: 0, previous: 0 }
    }
  }, 30_000) // cache for 30s
}

// Fetch current price
async function getPrice(symbol: string): Promise<number> {
  const key = `price-${symbol}`
  return getCached(key, async () => {
    const raw = await fetchJSON(`${BINANCE_BASE}/api/v3/ticker/price?symbol=${symbol}`)
    return parseFloat(raw.price)
  }, 3_000)
}

// Rate limiter
const rateLimiter: Record<string, number[]> = {}
function isRateLimited(ip: string): boolean {
  const now = Date.now()
  if (!rateLimiter[ip]) rateLimiter[ip] = []
  rateLimiter[ip] = rateLimiter[ip].filter((t) => now - t < 10_000)
  if (rateLimiter[ip].length >= 15) return true
  rateLimiter[ip].push(now)
  return false
}

export async function GET(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
    }

    const { searchParams } = new URL(req.url)
    const pair = (searchParams.get('pair') || 'BTCUSDT').toUpperCase()
    const interval = searchParams.get('interval') || '15m'

    if (!VALID_PAIRS.includes(pair)) {
      return NextResponse.json({ error: `Invalid pair. Supported: ${VALID_PAIRS.join(', ')}` }, { status: 400 })
    }
    if (!VALID_INTERVALS.includes(interval)) {
      return NextResponse.json({ error: `Invalid interval. Supported: ${VALID_INTERVALS.join(', ')}` }, { status: 400 })
    }

    // Fetch all data in parallel
    const [candles, orderBook, fundingRate, oi, price] = await Promise.all([
      getKlines(pair, interval, 200),
      getOrderBook(pair, 20),
      getFundingRate(pair),
      getOpenInterest(pair),
      getPrice(pair),
    ])

    // Run quant analysis
    const analysis = runQuantAnalysis(pair, candles, orderBook, fundingRate, oi.current, oi.previous)

    return NextResponse.json({
      success: true,
      data: {
        ...analysis,
        price,
        interval,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error: any) {
    console.error('Quant API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
