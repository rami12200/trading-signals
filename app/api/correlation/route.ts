// ============================================
// Smart Correlation Scalping — API Route
// GET: Fetch analysis (BTC state + lag detection + signals)
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

// ─── Rate Limiting ─────────────────────────────────────────────────────────────

const rateLimit = new Map<string, number[]>()
const RATE_LIMIT_WINDOW = 3000
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

// ─── Cache ─────────────────────────────────────────────────────────────────────

interface CacheEntry {
  data: any
  timestamp: number
}

const cache = new Map<string, CacheEntry>()
const CACHE_TTL = 2000 // 2 seconds for fast polling

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
  // Cleanup old entries
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
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      )
    }

    const { searchParams } = new URL(request.url)
    const interval = searchParams.get('interval') || '1m'
    const targetsParam = searchParams.get('targets') // optional: comma-separated symbols
    const limit = 100

    // Determine which targets to analyze
    let targets: TargetConfig[] = CORRELATION_TARGETS
    if (targetsParam) {
      const requestedSymbols = targetsParam.split(',').map(s => s.trim().toUpperCase())
      targets = CORRELATION_TARGETS.filter(t => requestedSymbols.includes(t.symbol))
      if (targets.length === 0) targets = CORRELATION_TARGETS
    }

    // Check cache
    const cacheKey = `corr_${interval}_${targets.map(t => t.symbol).join(',')}`
    const cached = getCached(cacheKey)
    if (cached) {
      return NextResponse.json({ success: true, data: cached })
    }

    // Fetch BTC price and klines
    const [btcPrice, btcKlinesRaw] = await Promise.all([
      getPrice('BTCUSDT'),
      getKlines('BTCUSDT', interval, limit),
    ])

    if (!btcPrice || btcKlinesRaw.length === 0) {
      return NextResponse.json(
        { error: 'Failed to fetch BTC data' },
        { status: 502 }
      )
    }

    const btcKlines = parseKlines(btcKlinesRaw)

    // Fetch all target data in parallel
    const targetDataPromises = targets.map(async (config) => {
      if (config.source === 'binance') {
        const [price, klinesRaw] = await Promise.all([
          getPrice(config.symbol),
          getKlines(config.symbol, interval, limit),
        ])
        return {
          config,
          price,
          klines: parseKlines(klinesRaw),
        }
      }
      // FastForex/TwelveData targets will be added later
      return null
    })

    const targetResults = await Promise.all(targetDataPromises)
    const validTargets = targetResults.filter(
      (t): t is NonNullable<typeof t> => t !== null && t.price > 0 && t.klines.length > 0
    )

    // Build current prices map
    const currentPrices: Record<string, number> = { BTCUSDT: btcPrice }
    for (const t of validTargets) {
      currentPrices[t.config.symbol] = t.price
    }

    // Run analysis
    const analysis = runCorrelationAnalysis(btcPrice, btcKlines, validTargets, currentPrices)

    setCache(cacheKey, analysis)

    return NextResponse.json({ success: true, data: analysis })
  } catch (error) {
    console.error('[Correlation API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ─── POST Handler — Trade Actions ──────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, signalId, tradeId, signal } = body

    if (action === 'open_trade' && signal) {
      const trade = openTrade(signal as CorrelationSignal)
      if (!trade) {
        return NextResponse.json({
          success: false,
          error: 'Cannot open trade (max trades reached or duplicate)',
        })
      }
      return NextResponse.json({ success: true, trade })
    }

    if (action === 'close_trade' && tradeId) {
      const trade = manualCloseTrade(tradeId)
      if (!trade) {
        return NextResponse.json({
          success: false,
          error: 'Trade not found or already closed',
        })
      }
      return NextResponse.json({ success: true, trade })
    }

    if (action === 'get_trades') {
      return NextResponse.json({
        success: true,
        trades: getAllTrades(),
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }
}
