import { NextResponse } from 'next/server'
import { getTwelveDataKlines } from '@/lib/twelvedata'
import { parseKlines } from '@/lib/indicators'
import { analyzeSPX } from '@/lib/spx-strategy'

// ============================================
// SPX Bollinger Bounce API — S&P 500 فقط
// ============================================

const cache: Record<string, { data: any; timestamp: number }> = {}
const CACHE_TTL = 300_000 // 5 دقائق — حد 800 طلب/يوم

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

async function getCachedKlines(symbol: string, interval: string, limit: number) {
  const key = `spx-${symbol}-${interval}-${limit}`
  const now = Date.now()
  if (cache[key] && now - cache[key].timestamp < CACHE_TTL) {
    return cache[key].data
  }
  const data = await getTwelveDataKlines(symbol, interval, limit)
  cache[key] = { data, timestamp: now }
  return data
}

// الفريمات المتاحة لـ SPX
const VALID_INTERVALS = ['5m', '15m', '30m', '1h', '4h', '1d']

export async function GET(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: 'طلبات كثيرة — انتظر شوي' }, { status: 429 })
    }

    const { searchParams } = new URL(req.url)
    const interval = searchParams.get('interval') || '15m'

    if (!VALID_INTERVALS.includes(interval)) {
      return NextResponse.json({ error: 'فريم غير صالح', signals: [] }, { status: 400 })
    }

    const symbol = 'SPY'
    const raw = await getCachedKlines(symbol, interval, 200)
    const klines = parseKlines(raw)

    if (klines.length < 55) {
      return NextResponse.json({
        signal: null,
        symbol,
        interval,
        error: 'بيانات غير كافية — السوق مغلق؟',
        timestamp: new Date().toISOString(),
      })
    }

    const analysis = analyzeSPX(klines)

    return NextResponse.json({
      signal: analysis ? {
        symbol,
        displaySymbol: 'S&P 500 (SPY)',
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
        source: 'twelvedata',
      } : null,
      symbol,
      interval,
      candleCount: klines.length,
      timestamp: new Date().toISOString(),
    })

  } catch (error: any) {
    console.error('[SPX API] خطأ:', error)
    return NextResponse.json({ error: 'خطأ في السيرفر', signal: null }, { status: 500 })
  }
}
