// ============================================
// High-Frequency Correlation Scalping — API Route
// GET: Analysis with Order Book (fast cache)
// ============================================

import { NextResponse } from 'next/server'
import { getKlines, getPrice } from '@/lib/binance'
import { parseKlines } from '@/lib/indicators'
import {
  runCorrelationAnalysis,
  CORRELATION_TARGETS,
  openTrade,
  manualCloseTrade,
  getAllTrades,
  type CorrelationSignal,
  type TargetConfig,
} from '@/lib/correlation-engine'

// ─── Binance Order Book Fetch ──────────────────────────────────────────────────

async function getOrderBook(symbol: string, limit = 10): Promise<{ bids: [string, string][], asks: [string, string][] } | null> {
  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=${limit}`,
      { signal: AbortSignal.timeout(3000) }
    )
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// ─── Rate Limiting ─────────────────────────────────────────────────────────────

const rateLimit = new Map<string, number[]>()
const RATE_LIMIT_WINDOW = 1000  // 1 second for HF
const RATE_LIMIT_MAX = 5

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const requests = rateLimit.get(ip) || []
  const recent = requests.filter(t => now - t < RATE_LIMIT_WINDOW)
  if (recent.length >= RATE_LIMIT_MAX) return false
  recent.push(now)
  rateLimit.set(ip, recent)
  return true
}

// ─── Cache (500ms for HF) ──────────────────────────────────────────────────────

interface CacheEntry {
  data: any
  timestamp: number
}

const cache = new Map<string, CacheEntry>()
const CACHE_TTL = 400 // 400ms for HF mode

function getCached(key: string): any | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key)
    return null
  }
  return entry.data
}

function setCache(key: string, data: any) {
  cache.set(key, { data, timestamp: Date.now() })
  if (cache.size > 50) {
    const now = Date.now()
    const keysToDelete: string[] = []
    cache.forEach((v, k) => {
      if (now - v.timestamp > CACHE_TTL * 5) keysToDelete.push(k)
    })
    keysToDelete.forEach(k => cache.delete(k))
  }
}

// ─── GET Handler ───────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: 'Rate limit' }, { status: 429 })
    }

    const { searchParams } = new URL(request.url)
    const interval = searchParams.get('interval') || '1m'
    const symbolsParam = searchParams.get('symbols') || ''
    const limit = 100

    let targets: TargetConfig[] = CORRELATION_TARGETS
    if (symbolsParam) {
      const allowed = symbolsParam.split(',').map(s => s.trim().toUpperCase())
      targets = targets.filter(t => allowed.includes(t.symbol))
    }

    const cacheKey = `hf_${interval}_${targets.map(t => t.symbol).join(',')}`
    const cached = getCached(cacheKey)
    if (cached) {
      return NextResponse.json({ success: true, data: cached })
    }

    // Fetch BTC data + all targets + order books in parallel
    const allPromises: Promise<any>[] = [
      getPrice('BTCUSDT'),
      getKlines('BTCUSDT', interval, limit),
    ]

    // Target prices, klines, and order books
    for (const config of targets) {
      allPromises.push(getPrice(config.symbol))
      allPromises.push(getKlines(config.symbol, interval, limit))
      allPromises.push(getOrderBook(config.symbol, 10))
    }

    const results = await Promise.all(allPromises)

    const btcPrice = results[0] as number
    const btcKlinesRaw = results[1] as any[]

    if (!btcPrice || btcKlinesRaw.length === 0) {
      return NextResponse.json({ error: 'Failed to fetch BTC data' }, { status: 502 })
    }

    const btcKlines = parseKlines(btcKlinesRaw)

    const targetData: Array<{
      config: TargetConfig
      price: number
      klines: any[]
      depth: any
    }> = []

    const currentPrices: Record<string, number> = { BTCUSDT: btcPrice }

    for (let i = 0; i < targets.length; i++) {
      const baseIdx = 2 + i * 3
      const price = results[baseIdx] as number
      const klinesRaw = results[baseIdx + 1] as any[]
      const depth = results[baseIdx + 2]

      if (price > 0 && klinesRaw.length > 0) {
        currentPrices[targets[i].symbol] = price
        targetData.push({
          config: targets[i],
          price,
          klines: parseKlines(klinesRaw),
          depth,
        })
      }
    }

    const analysis = runCorrelationAnalysis(btcPrice, btcKlines, targetData, currentPrices)

    setCache(cacheKey, analysis)

    return NextResponse.json({ success: true, data: analysis })
  } catch (error) {
    console.error('[Correlation HF API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST Handler ──────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, tradeId, signal } = body

    if (action === 'open_trade' && signal) {
      const trade = openTrade(signal as CorrelationSignal)
      if (!trade) {
        return NextResponse.json({ success: false, error: 'Cannot open trade' })
      }
      return NextResponse.json({ success: true, trade })
    }

    if (action === 'close_trade' && tradeId) {
      const trade = manualCloseTrade(tradeId)
      if (!trade) {
        return NextResponse.json({ success: false, error: 'Trade not found' })
      }
      return NextResponse.json({ success: true, trade })
    }

    if (action === 'get_trades') {
      return NextResponse.json({ success: true, trades: getAllTrades() })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
