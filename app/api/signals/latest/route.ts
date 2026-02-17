// ============================================
// EA Signal API - Returns latest trading signals for MT5 EA
// ============================================

import { NextResponse } from 'next/server'
import { getKlines, CRYPTO_PAIRS, formatSymbol } from '@/lib/binance'
import {
  parseKlines,
  calcEMA,
  calcRSI,
  calcMACD,
  calcATR,
  calcBollingerBands,
  analyzeVolume,
  findSupportResistance,
  OHLCV,
} from '@/lib/indicators'

// === API Key validation (temporary - will use Supabase later) ===
const EA_API_KEY = process.env.EA_API_KEY || 'ts_ea_test_key_2026_rami12200'

function validateApiKey(request: Request): boolean {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7) === EA_API_KEY
  }
  const url = new URL(request.url)
  const keyParam = url.searchParams.get('key')
  return keyParam === EA_API_KEY
}

// === Cache ===
const cache: Record<string, { data: any; timestamp: number }> = {}
const CACHE_TTL = 10_000

async function getCachedKlines(symbol: string, interval: string, limit: number) {
  const key = `ea-${symbol}-${interval}-${limit}`
  const now = Date.now()
  if (cache[key] && now - cache[key].timestamp < CACHE_TTL) {
    return cache[key].data
  }
  const data = await getKlines(symbol, interval, limit)
  cache[key] = { data, timestamp: now }
  return data
}

// === Signal type for EA (simplified, MT5-friendly) ===
interface EASignal {
  symbol: string           // BTCUSDT (Binance format)
  mt5Symbol: string        // BTCUSD (MT5 format without T)
  action: 'BUY' | 'SELL' | 'NONE'
  price: number
  stopLoss: number
  takeProfit: number
  volume: number           // suggested lot size
  signalQuality: 'STRONG' | 'NORMAL' | 'WEAK'
  reason: string
  timestamp: string
}

// === Symbol mapping: Binance -> MT5 base ===
function toMT5Symbol(binanceSymbol: string): string {
  // BTCUSDT -> BTCUSD, ETHUSDT -> ETHUSD, etc.
  return binanceSymbol.replace('USDT', 'USD')
}

// === Analyze signal for EA ===
function analyzeForEA(candles: OHLCV[], symbol: string): EASignal | null {
  if (candles.length < 50) return null

  const closes = candles.map((c) => c.close)
  const highs = candles.map((c) => c.high)
  const lows = candles.map((c) => c.low)
  const volumes = candles.map((c) => c.volume)
  const currentPrice = closes[closes.length - 1]

  // === Indicators ===
  const ema9 = calcEMA(closes, 9)
  const ema21 = calcEMA(closes, 21)
  const rsi = calcRSI(closes, 14)
  const macdArr = calcMACD(closes)
  const atr = calcATR(candles, 14)
  const bb = calcBollingerBands(closes, 20, 2)
  const vol = analyzeVolume(volumes)
  const sr = findSupportResistance(candles)

  if (!ema9.length || !ema21.length || !rsi.length || !macdArr.length || atr === null || !bb) return null

  const currentEMA9 = ema9[ema9.length - 1]
  const currentEMA21 = ema21[ema21.length - 1]
  const prevEMA9 = ema9[ema9.length - 2]
  const prevEMA21 = ema21[ema21.length - 2]
  const currentRSI = rsi[rsi.length - 1]
  const currentATR = atr
  const macdHist = macdArr[macdArr.length - 1].histogram
  const prevMacdHist = macdArr[macdArr.length - 2].histogram

  // === Price Action ===
  const last3 = candles.slice(-3)
  const lastCandleBullish = last3[2].close > last3[2].open
  const lastCandleBearish = last3[2].close < last3[2].open
  const bullishCandles = last3.filter((c) => c.close > c.open).length
  const bearishCandles = last3.filter((c) => c.close < c.open).length
  const priceGoingUp = bullishCandles >= 2
  const priceGoingDown = bearishCandles >= 2
  const candleBody = Math.abs(last3[2].close - last3[2].open)
  const candleRange = last3[2].high - last3[2].low
  const strongCandle = candleRange > 0 ? candleBody / candleRange > 0.6 : false

  // === EMA Trend ===
  const emaTrend = currentEMA9 > currentEMA21 ? 'UP' : 'DOWN'
  const emaCrossUp = prevEMA9 <= prevEMA21 && currentEMA9 > currentEMA21
  const emaCrossDown = prevEMA9 >= prevEMA21 && currentEMA9 < currentEMA21

  // === MACD ===
  const macdAccelUp = macdHist > prevMacdHist && macdHist > 0
  const macdAccelDown = macdHist < prevMacdHist && macdHist < 0

  // === Determine Action ===
  let action: 'BUY' | 'SELL' | 'NONE' = 'NONE'
  let reason = ''

  // BUY conditions
  if (emaCrossUp && currentRSI < 70 && lastCandleBullish && priceGoingUp) {
    action = 'BUY'
    reason = 'EMA 9/21 cross up + RSI ok + bullish candles'
  } else if (emaTrend === 'UP' && currentPrice > currentEMA9 && currentRSI < 65 && macdAccelUp && priceGoingUp && strongCandle) {
    action = 'BUY'
    reason = 'Uptrend + price above EMA9 + MACD accelerating'
  } else if (emaTrend === 'DOWN' && currentPrice > currentEMA9 && prevEMA9 > closes[closes.length - 2] && lastCandleBullish && strongCandle && priceGoingUp) {
    action = 'BUY'
    reason = 'Fast reversal: price broke above EMA9'
  }

  // SELL conditions
  if (action === 'NONE') {
    if (emaCrossDown && currentRSI > 30 && lastCandleBearish && priceGoingDown) {
      action = 'SELL'
      reason = 'EMA 9/21 cross down + RSI ok + bearish candles'
    } else if (emaTrend === 'DOWN' && currentPrice < currentEMA9 && currentRSI > 35 && macdAccelDown && priceGoingDown && strongCandle) {
      action = 'SELL'
      reason = 'Downtrend + price below EMA9 + MACD declining'
    } else if (emaTrend === 'UP' && currentPrice < currentEMA9 && prevEMA9 < closes[closes.length - 2] && lastCandleBearish && strongCandle && priceGoingDown) {
      action = 'SELL'
      reason = 'Fast reversal: price broke below EMA9'
    }
  }

  if (action === 'NONE') return null

  // === Signal Quality ===
  let signalQuality: 'STRONG' | 'NORMAL' | 'WEAK' = 'NORMAL'
  const momentum = Math.abs(macdHist)
  if (vol.spike && momentum > Math.abs(prevMacdHist) * 1.2) {
    signalQuality = 'STRONG'
  } else if (!vol.spike && momentum < Math.abs(prevMacdHist) * 0.8) {
    signalQuality = 'WEAK'
  }

  // === Calculate SL/TP using S/R + ATR ===
  const effectiveATR = currentATR > 0 ? currentATR : currentPrice * 0.005
  let stopLoss: number
  let takeProfit: number

  if (action === 'BUY') {
    const nearSupport = sr.support.filter((s) => s < currentPrice).pop()
    const atrSL = currentPrice - effectiveATR * 1.0
    stopLoss = nearSupport && nearSupport > atrSL
      ? nearSupport - effectiveATR * 0.1
      : atrSL

    const nearResistance = sr.resistance.find((r) => r > currentPrice)
    const atrTP = currentPrice + effectiveATR * 1.2
    takeProfit = nearResistance && nearResistance < atrTP * 1.5
      ? nearResistance - effectiveATR * 0.05
      : atrTP
  } else {
    const nearResistance = sr.resistance.find((r) => r > currentPrice)
    const atrSL = currentPrice + effectiveATR * 1.0
    stopLoss = nearResistance && nearResistance < atrSL
      ? nearResistance + effectiveATR * 0.1
      : atrSL

    const nearSupport = sr.support.filter((s) => s < currentPrice).pop()
    const atrTP = currentPrice - effectiveATR * 1.2
    takeProfit = nearSupport && nearSupport > atrTP * 0.5
      ? nearSupport + effectiveATR * 0.05
      : atrTP
  }

  return {
    symbol,
    mt5Symbol: toMT5Symbol(symbol),
    action,
    price: currentPrice,
    stopLoss: parseFloat(stopLoss.toFixed(currentPrice >= 1000 ? 2 : currentPrice >= 1 ? 4 : 6)),
    takeProfit: parseFloat(takeProfit.toFixed(currentPrice >= 1000 ? 2 : currentPrice >= 1 ? 4 : 6)),
    volume: 0.1,
    signalQuality,
    reason,
    timestamp: new Date().toISOString(),
  }
}

// === Rate limiting ===
const rateLimiter: Record<string, number[]> = {}
const RATE_LIMIT_WINDOW = 10_000
const RATE_LIMIT_MAX = 20 // EA polls frequently

function isRateLimited(key: string): boolean {
  const now = Date.now()
  if (!rateLimiter[key]) rateLimiter[key] = []
  rateLimiter[key] = rateLimiter[key].filter((t) => now - t < RATE_LIMIT_WINDOW)
  if (rateLimiter[key].length >= RATE_LIMIT_MAX) return true
  rateLimiter[key].push(now)
  return false
}

// === GET /api/signals/latest ===
export async function GET(request: Request) {
  // Validate API Key
  if (!validateApiKey(request)) {
    return NextResponse.json(
      { success: false, error: 'Invalid API key' },
      { status: 401 }
    )
  }

  // Rate limiting by API key
  if (isRateLimited(EA_API_KEY)) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded. Max 20 requests per 10 seconds.' },
      { status: 429 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const interval = searchParams.get('interval') || '5m'
    const symbolParam = searchParams.get('symbol')
    const qualityFilter = searchParams.get('quality') // STRONG, NORMAL, or empty for all

    const symbols = symbolParam ? [symbolParam] : CRYPTO_PAIRS

    const promises = symbols.map(async (symbol) => {
      try {
        const rawKlines = await getCachedKlines(symbol, interval, 200)
        if (rawKlines.length < 50) return null
        const candles = parseKlines(rawKlines)
        return analyzeForEA(candles, symbol)
      } catch {
        return null
      }
    })

    const results = await Promise.all(promises)
    let signals: EASignal[] = results.filter((r): r is EASignal => r !== null)

    // Filter by quality if specified
    if (qualityFilter) {
      signals = signals.filter((s) => s.signalQuality === qualityFilter.toUpperCase())
    }

    // Sort: STRONG first, then NORMAL, then WEAK
    const qualityOrder = { STRONG: 0, NORMAL: 1, WEAK: 2 }
    signals.sort((a, b) => qualityOrder[a.signalQuality] - qualityOrder[b.signalQuality])

    return NextResponse.json({
      success: true,
      count: signals.length,
      interval,
      signals,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to generate signals' },
      { status: 500 }
    )
  }
}
