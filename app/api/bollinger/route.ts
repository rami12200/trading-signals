import { NextResponse } from 'next/server'
import { getKlines, getCategoryPairs, getCategorySource, CryptoCategory } from '@/lib/binance'
import { getDatabentoKlines } from '@/lib/databento'
import { getTwelveDataKlines } from '@/lib/twelvedata'
import { parseKlines } from '@/lib/indicators'
import { analyzeBollinger } from '@/lib/bollinger-strategy'

// ============================================
// Bollinger Bounce + RSI + EMA50 API
// ============================================

const cache: Record<string, { data: any; timestamp: number }> = {}
const CACHE_TTL = 15_000
const DATABENTO_CACHE_TTL = 120_000

const rateLimiter: Record<string, number[]> = {}
const RATE_LIMIT_WINDOW = 10_000
const RATE_LIMIT_MAX = 10

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  if (!rateLimiter[ip]) rateLimiter[ip] = []
  rateLimiter[ip] = rateLimiter[ip].filter((t) => now - t < RATE_LIMIT_WINDOW)
  if (rateLimiter[ip].length >= RATE_LIMIT_MAX) return true
  rateLimiter[ip].push(now)
  return false
}

async function getCachedKlines(symbol: string, interval: string, limit: number, source: 'binance' | 'databento' | 'twelvedata' = 'binance') {
  const key = `bb-${source}-${symbol}-${interval}-${limit}`
  const now = Date.now()
  const ttl = source === 'databento' || source === 'twelvedata' ? DATABENTO_CACHE_TTL : CACHE_TTL
  if (cache[key] && now - cache[key].timestamp < ttl) {
    return cache[key].data
  }
  let data: any[]
  if (source === 'twelvedata') {
    data = await getTwelveDataKlines(symbol, interval, limit)
  } else if (source === 'databento') {
    data = await getDatabentoKlines(symbol, interval, limit)
  } else {
    data = await getKlines(symbol, interval, limit)
  }
  cache[key] = { data, timestamp: now }
  return data
}

export async function GET(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: 'طلبات كثيرة — انتظر شوي' }, { status: 429 })
    }

    const { searchParams } = new URL(req.url)
    const category = (searchParams.get('category') || 'major') as CryptoCategory
    const interval = searchParams.get('interval') || '15m'

    const pairs = getCategoryPairs(category)
    const source = getCategorySource(category) as 'binance' | 'databento'

    if (!pairs || pairs.length === 0) {
      return NextResponse.json({ signals: [], category })
    }

    const signals: any[] = []
    const batchSize = source === 'databento' ? 3 : 10

    for (let i = 0; i < pairs.length; i += batchSize) {
      const batch = pairs.slice(i, i + batchSize)
      const results = await Promise.allSettled(
        batch.map(async (pair) => {
          const raw = await getCachedKlines(pair, interval, 200, source)
          const klines = parseKlines(raw)

          if (klines.length < 55) return null

          const analysis = analyzeBollinger(klines)
          if (!analysis) return null

          const displaySymbol = source === 'databento'
            ? pair
            : pair.replace('USDT', '/USDT')

          return {
            symbol: pair,
            displaySymbol,
            price: analysis.entry,
            action: analysis.action,
            confidence: analysis.confidence,
            entry: analysis.entry,
            stopLoss: analysis.stopLoss,
            takeProfit: analysis.takeProfit,
            riskReward: analysis.riskReward,
            reasons: analysis.reasons,
            indicators: analysis.indicators,
            signalTime: analysis.signalTime,
            source,
          }
        })
      )

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          signals.push(r.value)
        }
      }

      if (source === 'databento' && i + batchSize < pairs.length) {
        await new Promise(r => setTimeout(r, 500))
      }
    }

    // ترتيب: الإشارات الفعلية أولاً ثم حسب الثقة
    signals.sort((a, b) => {
      if (a.action !== 'WAIT' && b.action === 'WAIT') return -1
      if (a.action === 'WAIT' && b.action !== 'WAIT') return 1
      return b.confidence - a.confidence
    })

    return NextResponse.json({
      signals,
      category,
      interval,
      count: signals.length,
      timestamp: new Date().toISOString(),
    })

  } catch (error: any) {
    console.error('[Bollinger API] خطأ:', error)
    return NextResponse.json({ error: 'خطأ في السيرفر', signals: [] }, { status: 500 })
  }
}
