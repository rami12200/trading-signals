import { NextResponse } from 'next/server'
import { getKlines, getCategoryPairs, getCategorySource, CryptoCategory } from '@/lib/binance'
import { getDatabentoKlines } from '@/lib/databento'
import { parseKlines, OHLCV } from '@/lib/indicators'
import { analyzeICT, ICTSignal, OHLCV as ICTOHLCV } from '@/lib/ict'

// ============================================
// مؤشر أبو خالد 👑 — ICT Hybrid API
// Order Blocks + FVG + Liquidity + BOS/CHoCH
// وضعين: سريع (15m) + عادي (1h)
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

async function getCachedKlines(symbol: string, interval: string, limit: number, source: 'binance' | 'databento' = 'binance') {
  const key = `ict-${source}-${symbol}-${interval}-${limit}`
  const now = Date.now()
  const ttl = source === 'databento' ? DATABENTO_CACHE_TTL : CACHE_TTL
  if (cache[key] && now - cache[key].timestamp < ttl) {
    return cache[key].data
  }
  const data = source === 'databento'
    ? await getDatabentoKlines(symbol, interval, limit)
    : await getKlines(symbol, interval, limit)
  cache[key] = { data, timestamp: now }
  return data
}

// تحويل parseKlines لصيغة ICT OHLCV
function toICTCandles(klines: OHLCV[]): ICTOHLCV[] {
  return klines.map(k => ({
    time: k.time,
    open: k.open,
    high: k.high,
    low: k.low,
    close: k.close,
    volume: k.volume,
  }))
}

export async function GET(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: 'طلبات كثيرة — انتظر شوي' }, { status: 429 })
    }

    const { searchParams } = new URL(req.url)
    const category = (searchParams.get('category') || 'major') as CryptoCategory
    const mode = searchParams.get('mode') || 'fast' // fast = 15m, normal = 1h

    const pairs = getCategoryPairs(category)
    const source = getCategorySource(category) as 'binance' | 'databento'

    if (!pairs || pairs.length === 0) {
      return NextResponse.json({ signals: [], category })
    }

    // الفريمات حسب الوضع
    const mainInterval = mode === 'fast' ? '15m' : '1h'
    const htfInterval = mode === 'fast' ? '1h' : '4h'
    const mainLimit = 200
    const htfLimit = 100

    // جلب البيانات لكل زوج
    const signals: any[] = []
    const batchSize = source === 'databento' ? 3 : 10
    const allPairs = [...pairs]

    for (let i = 0; i < allPairs.length; i += batchSize) {
      const batch = allPairs.slice(i, i + batchSize)
      const results = await Promise.allSettled(
        batch.map(async (pair) => {
          const symbol = source === 'binance' ? pair : pair

          // جلب الفريم الرئيسي والأعلى
          const [mainRaw, htfRaw] = await Promise.all([
            getCachedKlines(symbol, mainInterval, mainLimit, source),
            getCachedKlines(symbol, htfInterval, htfLimit, source),
          ])

          const mainKlines = parseKlines(mainRaw)
          const htfKlines = parseKlines(htfRaw)

          if (mainKlines.length < 30) return null

          const mainCandles = toICTCandles(mainKlines)
          const htfCandles = htfKlines.length >= 30 ? toICTCandles(htfKlines) : null

          const analysis = analyzeICT(mainCandles, htfCandles)

          // نظهر كل العملات حتى اللي حالتها انتظر

          const lastPrice = mainKlines[mainKlines.length - 1].close
          const displaySymbol = source === 'databento'
            ? pair
            : pair.replace('USDT', '/USDT')

          return {
            symbol: pair,
            displaySymbol,
            price: lastPrice,
            action: analysis.action,
            confidence: analysis.confidence,
            entry: analysis.entry,
            stopLoss: analysis.stopLoss,
            takeProfit1: analysis.takeProfit1,
            takeProfit2: analysis.takeProfit2,
            riskReward: analysis.riskReward,
            reasons: analysis.reasons,
            marketStructure: analysis.marketStructure,
            killZone: analysis.killZone,
            orderBlocks: analysis.orderBlocks.length,
            fvgs: analysis.fvgs.length,
            liquidityZones: analysis.liquidityZones.length,
            structureBreaks: analysis.structureBreaks.length,
            mode,
            source,
          }
        })
      )

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          signals.push(r.value)
        }
      }

      // تأخير بين الدفعات لـ Databento
      if (source === 'databento' && i + batchSize < allPairs.length) {
        await new Promise(r => setTimeout(r, 500))
      }
    }

    // ترتيب حسب الثقة
    signals.sort((a, b) => b.confidence - a.confidence)

    return NextResponse.json({
      signals,
      category,
      mode,
      count: signals.length,
      timestamp: new Date().toISOString(),
    })

  } catch (error: any) {
    console.error('[ICT API] خطأ:', error)
    return NextResponse.json({ error: 'خطأ في السيرفر', signals: [] }, { status: 500 })
  }
}
