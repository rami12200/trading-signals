import { NextResponse } from 'next/server'
import { getKlines, SIGNAL_PAIRS, formatSymbol } from '@/lib/binance'
import { parseKlines, calcEMA, analyzeVolume, OHLCV } from '@/lib/indicators'

// ============================================
// SMC / Liquidity Sweep Strategy API
// Smart Money Concepts — Sweep → Displacement → Exhaustion → Entry
// ============================================

type SMCAction = 'BUY' | 'SELL' | 'WAIT'

// === Cache ===
const cache: Record<string, { data: any; timestamp: number }> = {}
const CACHE_TTL = 10_000

// === Signal age tracking ===
const signalTracker: Record<string, { action: string; since: string }> = {}

// === Rate limiting ===
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
  const key = `smc-${symbol}-${interval}-${limit}`
  const now = Date.now()
  if (cache[key] && now - cache[key].timestamp < CACHE_TTL) {
    return cache[key].data
  }
  const data = await getKlines(symbol, interval, limit)
  cache[key] = { data, timestamp: now }
  return data
}

// ============================================
// Interfaces
// ============================================

interface LiquidityLevel {
  price: number
  type: 'PDH' | 'PDL' | 'ASIAN_HIGH' | 'ASIAN_LOW' | 'EQUAL_HIGH' | 'EQUAL_LOW' | 'WEEKLY_HIGH' | 'WEEKLY_LOW'
  label: string
  swept: boolean
}

interface SMCSignal {
  id: string
  symbol: string
  displaySymbol: string
  price: number
  action: SMCAction
  actionText: string
  reason: string
  reasons: string[]
  entry: number
  stopLoss: number
  target1: number
  target2: number
  profitPct: string
  riskPct: string
  riskReward: string
  // Pre-trade filters
  filters: {
    volumeSpike: boolean
    volumeRatio: number
    pdhBreak: boolean
    pdlBreak: boolean
    nySession: boolean
    hasTrigger: boolean
  }
  // Liquidity
  liquidity: {
    levels: LiquidityLevel[]
    sweptLevel: LiquidityLevel | null
    atLiquidity: boolean
  }
  // Displacement
  displacement: {
    detected: boolean
    direction: 'UP' | 'DOWN' | 'NONE'
    strength: number // number of strong candles
    avgBodyRatio: number
  }
  // Exhaustion
  exhaustion: {
    detected: boolean
    wickRatio: number
    followThrough: boolean
    volumeSlowdown: boolean
  }
  // Structure
  structure: {
    dailyRange: number
    dailyRangePct: number
    vwap: number
    pdh: number
    pdl: number
    asianHigh: number
    asianLow: number
  }
  confidence: number
  confidenceLabel: string
  signalSince: string
  signalAgeSeconds: number
  cancelReasons: string[]
  timestamp: string
}

// ============================================
// Helper: Calculate VWAP from candles
// ============================================
function calcVWAP(candles: OHLCV[]): number {
  let cumulativeTPV = 0
  let cumulativeVol = 0
  for (const c of candles) {
    const tp = (c.high + c.low + c.close) / 3
    cumulativeTPV += tp * c.volume
    cumulativeVol += c.volume
  }
  return cumulativeVol > 0 ? cumulativeTPV / cumulativeVol : 0
}

// ============================================
// Helper: Get Previous Day High/Low from daily candles
// ============================================
function getPDHL(dailyCandles: OHLCV[]): { pdh: number; pdl: number } {
  if (dailyCandles.length < 2) return { pdh: 0, pdl: 0 }
  const prev = dailyCandles[dailyCandles.length - 2]
  return { pdh: prev.high, pdl: prev.low }
}

// ============================================
// Helper: Get Asian Session High/Low (00:00-08:00 UTC)
// ============================================
function getAsianHL(candles: OHLCV[]): { asianHigh: number; asianLow: number } {
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setUTCHours(0, 0, 0, 0)
  const asianEnd = new Date(todayStart)
  asianEnd.setUTCHours(8, 0, 0, 0)

  const asianCandles = candles.filter(c => {
    const t = c.time
    return t >= todayStart.getTime() && t < asianEnd.getTime()
  })

  if (asianCandles.length === 0) {
    // Fallback: use yesterday's asian session
    const yesterdayStart = new Date(todayStart)
    yesterdayStart.setDate(yesterdayStart.getDate() - 1)
    const yesterdayAsianEnd = new Date(yesterdayStart)
    yesterdayAsianEnd.setUTCHours(8, 0, 0, 0)
    const yAsian = candles.filter(c => c.time >= yesterdayStart.getTime() && c.time < yesterdayAsianEnd.getTime())
    if (yAsian.length === 0) return { asianHigh: 0, asianLow: 0 }
    return {
      asianHigh: Math.max(...yAsian.map(c => c.high)),
      asianLow: Math.min(...yAsian.map(c => c.low)),
    }
  }

  return {
    asianHigh: Math.max(...asianCandles.map(c => c.high)),
    asianLow: Math.min(...asianCandles.map(c => c.low)),
  }
}

// ============================================
// Helper: Detect Equal Highs / Equal Lows
// ============================================
function findEqualLevels(candles: OHLCV[], tolerance: number = 0.001): { equalHighs: number[]; equalLows: number[] } {
  const highs = candles.slice(-50).map(c => c.high)
  const lows = candles.slice(-50).map(c => c.low)
  const equalHighs: number[] = []
  const equalLows: number[] = []

  for (let i = 0; i < highs.length; i++) {
    for (let j = i + 3; j < highs.length; j++) {
      if (Math.abs(highs[i] - highs[j]) / highs[i] < tolerance) {
        const avg = (highs[i] + highs[j]) / 2
        if (!equalHighs.some(h => Math.abs(h - avg) / avg < tolerance)) {
          equalHighs.push(avg)
        }
      }
    }
  }

  for (let i = 0; i < lows.length; i++) {
    for (let j = i + 3; j < lows.length; j++) {
      if (Math.abs(lows[i] - lows[j]) / lows[i] < tolerance) {
        const avg = (lows[i] + lows[j]) / 2
        if (!equalLows.some(l => Math.abs(l - avg) / avg < tolerance)) {
          equalLows.push(avg)
        }
      }
    }
  }

  return { equalHighs, equalLows }
}

// ============================================
// Helper: Is NY session open (first 45 min)
// NY open = 14:30 UTC (9:30 AM ET)
// For crypto we use 13:30-14:15 UTC as high-vol window
// ============================================
function isNYSessionOpen(): boolean {
  const now = new Date()
  const h = now.getUTCHours()
  const m = now.getUTCMinutes()
  const totalMin = h * 60 + m
  // NY open ~13:30 UTC, first 45 min = 13:30-14:15
  return totalMin >= 810 && totalMin <= 855
}

// ============================================
// Helper: Detect Displacement (3 strong candles)
// ============================================
function detectDisplacement(candles: OHLCV[]): { detected: boolean; direction: 'UP' | 'DOWN' | 'NONE'; strength: number; avgBodyRatio: number } {
  if (candles.length < 25) return { detected: false, direction: 'NONE', strength: 0, avgBodyRatio: 0 }

  // Calculate average body size of last 20 candles
  const last20 = candles.slice(-20)
  const avgBody = last20.reduce((s, c) => s + Math.abs(c.close - c.open), 0) / 20

  // Check last 3-5 candles for displacement
  const recent = candles.slice(-5)
  let bullCount = 0
  let bearCount = 0
  let totalBodyRatio = 0

  for (const c of recent) {
    const body = Math.abs(c.close - c.open)
    const range = c.high - c.low
    const bodyRatio = range > 0 ? body / range : 0
    totalBodyRatio += bodyRatio

    if (c.close > c.open && body > avgBody) bullCount++
    else if (c.close < c.open && body > avgBody) bearCount++
  }

  const avgBodyRatio = totalBodyRatio / recent.length

  if (bullCount >= 3) return { detected: true, direction: 'UP', strength: bullCount, avgBodyRatio }
  if (bearCount >= 3) return { detected: true, direction: 'DOWN', strength: bearCount, avgBodyRatio }
  return { detected: false, direction: 'NONE', strength: 0, avgBodyRatio }
}

// ============================================
// Helper: Detect Exhaustion
// ============================================
function detectExhaustion(candles: OHLCV[], direction: 'UP' | 'DOWN'): { detected: boolean; wickRatio: number; followThrough: boolean; volumeSlowdown: boolean } {
  if (candles.length < 5) return { detected: false, wickRatio: 0, followThrough: false, volumeSlowdown: false }

  const last = candles[candles.length - 1]
  const prev = candles[candles.length - 2]
  const body = Math.abs(last.close - last.open)
  const range = last.high - last.low

  // Wick ratio: opposite wick compared to body
  let wickRatio = 0
  if (direction === 'UP') {
    // After upward displacement, look for long upper wick
    const upperWick = last.high - Math.max(last.close, last.open)
    wickRatio = body > 0 ? upperWick / body : 0
  } else {
    // After downward displacement, look for long lower wick
    const lowerWick = Math.min(last.close, last.open) - last.low
    wickRatio = body > 0 ? lowerWick / body : 0
  }

  // Follow-through weakness: current candle body much smaller than prev
  const prevBody = Math.abs(prev.close - prev.open)
  const followThrough = body < prevBody * 0.5

  // Volume slowdown
  const volumes = candles.slice(-5).map(c => c.volume)
  const recentAvgVol = (volumes[0] + volumes[1] + volumes[2]) / 3
  const lastVol = volumes[volumes.length - 1]
  const volumeSlowdown = lastVol < recentAvgVol * 0.7

  const detected = wickRatio >= 0.5 || (followThrough && volumeSlowdown)

  return { detected, wickRatio, followThrough, volumeSlowdown }
}

// ============================================
// Main SMC Analysis Function
// ============================================
async function analyzeSMC(
  candles: OHLCV[],
  symbol: string,
  dailyCandles: OHLCV[],
  weeklyCandles: OHLCV[]
): Promise<SMCSignal | null> {
  if (candles.length < 50) return null

  const currentPrice = candles[candles.length - 1].close
  const closes = candles.map(c => c.close)
  const volumes = candles.map(c => c.volume)

  // ============================================
  // 1. STRUCTURE: PDH/PDL, Asian H/L, Weekly H/L, VWAP
  // ============================================
  const { pdh, pdl } = getPDHL(dailyCandles)
  const { asianHigh, asianLow } = getAsianHL(candles)
  const weeklyHigh = weeklyCandles.length >= 2 ? weeklyCandles[weeklyCandles.length - 2].high : 0
  const weeklyLow = weeklyCandles.length >= 2 ? weeklyCandles[weeklyCandles.length - 2].low : 0
  const todayCandles = candles.slice(-96) // ~last 24h for 15m candles
  const vwap = calcVWAP(todayCandles)
  const dailyRange = pdh > 0 ? pdh - pdl : 0
  const dailyRangePct = pdh > 0 ? (dailyRange / pdh) * 100 : 0

  // ============================================
  // 2. BUILD LIQUIDITY LEVELS
  // ============================================
  const levels: LiquidityLevel[] = []
  const proximityPct = 0.3

  if (pdh > 0) levels.push({ price: pdh, type: 'PDH', label: 'أعلى اليوم السابق', swept: false })
  if (pdl > 0) levels.push({ price: pdl, type: 'PDL', label: 'أدنى اليوم السابق', swept: false })
  if (asianHigh > 0) levels.push({ price: asianHigh, type: 'ASIAN_HIGH', label: 'أعلى الجلسة الآسيوية', swept: false })
  if (asianLow > 0) levels.push({ price: asianLow, type: 'ASIAN_LOW', label: 'أدنى الجلسة الآسيوية', swept: false })
  if (weeklyHigh > 0) levels.push({ price: weeklyHigh, type: 'WEEKLY_HIGH', label: 'أعلى الأسبوع السابق', swept: false })
  if (weeklyLow > 0) levels.push({ price: weeklyLow, type: 'WEEKLY_LOW', label: 'أدنى الأسبوع السابق', swept: false })

  // Equal Highs/Lows
  const eqLevels = findEqualLevels(candles)
  for (const eh of eqLevels.equalHighs) {
    levels.push({ price: eh, type: 'EQUAL_HIGH', label: 'قمم متساوية', swept: false })
  }
  for (const el of eqLevels.equalLows) {
    levels.push({ price: el, type: 'EQUAL_LOW', label: 'قيعان متساوية', swept: false })
  }

  // Check which levels have been swept (price went beyond then came back)
  const last10 = candles.slice(-10)
  for (const level of levels) {
    const isHigh = level.type.includes('HIGH')
    for (const c of last10) {
      if (isHigh && c.high > level.price && c.close < level.price) {
        level.swept = true
        break
      }
      if (!isHigh && c.low < level.price && c.close > level.price) {
        level.swept = true
        break
      }
    }
  }

  // Is price near any liquidity level?
  const nearLevel = levels.find(l => Math.abs(currentPrice - l.price) / currentPrice * 100 < proximityPct)
  const sweptLevel = levels.find(l => l.swept)

  // ============================================
  // 3. PRE-TRADE FILTERS
  // ============================================
  const vol = analyzeVolume(volumes, 20)
  const volumeSpike = vol.ratio >= 1.5

  // PDH/PDL break check
  const last5 = candles.slice(-5)
  const pdhBreak = pdh > 0 && last5.some(c => c.high > pdh)
  const pdlBreak = pdl > 0 && last5.some(c => c.low < pdl)
  const nySession = isNYSessionOpen()

  const hasTrigger = volumeSpike || pdhBreak || pdlBreak || nySession

  // ============================================
  // 4. DISPLACEMENT
  // ============================================
  const disp = detectDisplacement(candles)

  // ============================================
  // 5. EXHAUSTION
  // ============================================
  const exhaust = disp.detected && disp.direction !== 'NONE'
    ? detectExhaustion(candles, disp.direction)
    : { detected: false, wickRatio: 0, followThrough: false, volumeSlowdown: false }

  // ============================================
  // 6. DETERMINE ACTION
  // ============================================
  let action: SMCAction = 'WAIT'
  let reason = ''
  const reasons: string[] = []
  const cancelReasons: string[] = []

  // --- BUY: Sweep of low + displacement down + exhaustion ---
  const sweptLow = levels.find(l => l.swept && !l.type.includes('HIGH'))
  const sweptHigh = levels.find(l => l.swept && l.type.includes('HIGH'))

  // Last candle analysis
  const lastCandle = candles[candles.length - 1]
  const prevCandle = candles[candles.length - 2]
  const lastBody = Math.abs(lastCandle.close - lastCandle.open)
  const lastRange = lastCandle.high - lastCandle.low
  const lastBullish = lastCandle.close > lastCandle.open
  const lastBearish = lastCandle.close < lastCandle.open

  // Wick rejection analysis
  const lowerWick = Math.min(lastCandle.close, lastCandle.open) - lastCandle.low
  const upperWick = lastCandle.high - Math.max(lastCandle.close, lastCandle.open)
  const hasLongLowerWick = lastRange > 0 && (lowerWick / lastRange) > 0.4
  const hasLongUpperWick = lastRange > 0 && (upperWick / lastRange) > 0.4

  // Displacement candle reference
  const dispCandle = candles[candles.length - 3] // the displacement push candle
  const dispMid = (dispCandle.high + dispCandle.low) / 2

  // === BUY SIGNAL ===
  if (
    hasTrigger &&
    sweptLow &&
    hasLongLowerWick &&
    lastBullish &&
    lastCandle.close > dispMid
  ) {
    action = 'BUY'
    reason = `سحب سيولة ${sweptLow.label} ← ارتداد صاعد`
    reasons.push(`✅ كسر ${sweptLow.label} ($${sweptLow.price.toFixed(2)})`)
    reasons.push('✅ Wick رفض قوي من الأسفل')
    reasons.push('✅ إغلاق صاعد فوق 50% من شمعة الاندفاع')
    if (volumeSpike) reasons.push('📊 فوليوم مرتفع 150%+')
    if (nySession) reasons.push('🏦 جلسة نيويورك مفتوحة')
    if (exhaust.detected) reasons.push('💫 علامات استنزاف البائعين')
  }
  // === BUY — Alternative: displacement down + exhaustion at support ===
  else if (
    hasTrigger &&
    (nearLevel && !nearLevel.type.includes('HIGH')) &&
    disp.detected && disp.direction === 'DOWN' &&
    exhaust.detected &&
    lastBullish
  ) {
    action = 'BUY'
    reason = `اندفاع هابط + استنزاف عند ${nearLevel.label}`
    reasons.push(`📍 السعر عند ${nearLevel.label} ($${nearLevel.price.toFixed(2)})`)
    reasons.push('📉 اندفاع هابط قوي (3+ شموع)')
    reasons.push('💫 استنزاف: Wick رفض + ضعف متابعة')
    if (lastBullish) reasons.push('✅ شمعة إغلاق صاعدة')
  }

  // === SELL SIGNAL ===
  if (
    action === 'WAIT' &&
    hasTrigger &&
    sweptHigh &&
    hasLongUpperWick &&
    lastBearish &&
    lastCandle.close < dispMid
  ) {
    action = 'SELL'
    reason = `سحب سيولة ${sweptHigh.label} ← ارتداد هابط`
    reasons.push(`✅ كسر ${sweptHigh.label} ($${sweptHigh.price.toFixed(2)})`)
    reasons.push('✅ Wick رفض قوي من الأعلى')
    reasons.push('✅ إغلاق هابط تحت 50% من شمعة الاندفاع')
    if (volumeSpike) reasons.push('📊 فوليوم مرتفع 150%+')
    if (nySession) reasons.push('🏦 جلسة نيويورك مفتوحة')
    if (exhaust.detected) reasons.push('💫 علامات استنزاف المشترين')
  }
  // === SELL — Alternative: displacement up + exhaustion at resistance ===
  else if (
    action === 'WAIT' &&
    hasTrigger &&
    (nearLevel && nearLevel.type.includes('HIGH')) &&
    disp.detected && disp.direction === 'UP' &&
    exhaust.detected &&
    lastBearish
  ) {
    action = 'SELL'
    reason = `اندفاع صاعد + استنزاف عند ${nearLevel.label}`
    reasons.push(`📍 السعر عند ${nearLevel.label} ($${nearLevel.price.toFixed(2)})`)
    reasons.push('📈 اندفاع صاعد قوي (3+ شموع)')
    reasons.push('💫 استنزاف: Wick رفض + ضعف متابعة')
    if (lastBearish) reasons.push('✅ شمعة إغلاق هابطة')
  }

  // ============================================
  // WAIT context
  // ============================================
  if (action === 'WAIT') {
    if (!hasTrigger) {
      reason = 'لا يوجد محفّز — انتظر فوليوم أو كسر مستوى'
      reasons.push('❌ لا فوليوم مرتفع')
      if (!pdhBreak && !pdlBreak) reasons.push('❌ لا كسر PDH/PDL')
      if (!nySession) reasons.push('❌ خارج جلسة نيويورك')
    } else if (!sweptLow && !sweptHigh && !nearLevel) {
      reason = 'المحفّز موجود لكن السعر بعيد عن مناطق السيولة'
      reasons.push('⏳ انتظر وصول السعر لمنطقة سيولة')
      if (pdh > 0) reasons.push(`📍 PDH: $${pdh.toFixed(2)}`)
      if (pdl > 0) reasons.push(`📍 PDL: $${pdl.toFixed(2)}`)
    } else if (!disp.detected && !sweptLow && !sweptHigh) {
      reason = 'السعر عند سيولة لكن لا يوجد اندفاع واضح'
      reasons.push('⏳ انتظر 3 شموع قوية متتالية')
    } else {
      reason = 'انتظر تأكيد — لم تكتمل شروط الدخول'
      if (nearLevel) reasons.push(`📍 قريب من ${nearLevel.label}`)
      if (disp.detected) reasons.push(`📊 اندفاع ${disp.direction === 'UP' ? 'صاعد' : 'هابط'} مكتشف`)
      if (!exhaust.detected) reasons.push('⏳ انتظر علامات استنزاف')
    }
  }

  // ============================================
  // 7. CANCELLATION CHECKS
  // ============================================
  if (action !== 'WAIT') {
    // Check for engulfing candle against us
    const prevBody2 = Math.abs(prevCandle.close - prevCandle.open)
    if (action === 'BUY' && lastBearish && lastBody > prevBody2 * 1.5) {
      cancelReasons.push('⚠️ شمعة ابتلاع هابطة قوية')
    }
    if (action === 'SELL' && lastBullish && lastBody > prevBody2 * 1.5) {
      cancelReasons.push('⚠️ شمعة ابتلاع صاعدة قوية')
    }

    // Volume increasing against position
    const last3Vols = candles.slice(-3).map(c => c.volume)
    const volIncreasing = last3Vols[2] > last3Vols[1] && last3Vols[1] > last3Vols[0]
    if (action === 'BUY' && volIncreasing && lastBearish) {
      cancelReasons.push('⚠️ فوليوم يزداد ضد الشراء')
    }
    if (action === 'SELL' && volIncreasing && lastBullish) {
      cancelReasons.push('⚠️ فوليوم يزداد ضد البيع')
    }
  }

  // ============================================
  // 8. SL / TP
  // ============================================
  let entry = currentPrice
  let stopLoss: number
  let target1: number
  let target2: number

  const slPct = currentPrice > 10000 ? 0.002 : 0.003 // 0.2% BTC, 0.3% others

  if (action === 'BUY') {
    const sweepPrice = sweptLow?.price ?? (nearLevel?.price ?? currentPrice)
    stopLoss = sweepPrice * (1 - slPct)
    // Target 1: 50% of daily range or VWAP
    const halfRange = dailyRange * 0.5
    target1 = vwap > currentPrice ? vwap : currentPrice + halfRange
    // Target 2: opposite side of range (PDH)
    target2 = pdh > currentPrice ? pdh : currentPrice + dailyRange
  } else if (action === 'SELL') {
    const sweepPrice = sweptHigh?.price ?? (nearLevel?.price ?? currentPrice)
    stopLoss = sweepPrice * (1 + slPct)
    const halfRange = dailyRange * 0.5
    target1 = vwap < currentPrice ? vwap : currentPrice - halfRange
    target2 = pdl < currentPrice ? pdl : currentPrice - dailyRange
  } else {
    // WAIT — show hypothetical
    stopLoss = currentPrice * (1 - slPct)
    target1 = vwap || currentPrice * 1.005
    target2 = pdh > currentPrice ? pdh : currentPrice * 1.01
  }

  // Ensure sensible SL/TP
  if (action === 'BUY') {
    if (target1 <= currentPrice) target1 = currentPrice + Math.abs(currentPrice - stopLoss) * 1.5
    if (target2 <= target1) target2 = target1 + Math.abs(currentPrice - stopLoss)
  } else if (action === 'SELL') {
    if (target1 >= currentPrice) target1 = currentPrice - Math.abs(stopLoss - currentPrice) * 1.5
    if (target2 >= target1) target2 = target1 - Math.abs(stopLoss - currentPrice)
  }

  const risk = Math.abs(currentPrice - stopLoss)
  const profit = Math.abs(target1 - currentPrice)
  const rr = risk > 0 ? (profit / risk).toFixed(1) : '0'

  // ============================================
  // 9. CONFIDENCE
  // ============================================
  let confidence = 0
  if (action !== 'WAIT') {
    confidence = 45 // base

    // Sweep confirmed: +15
    if (sweptLow || sweptHigh) confidence += 15

    // Displacement: +10
    if (disp.detected) confidence += 10

    // Exhaustion: +10
    if (exhaust.detected) confidence += 10
    if (exhaust.wickRatio >= 0.7) confidence += 5

    // Volume spike trigger: +8
    if (volumeSpike) confidence += 8

    // NY session: +5
    if (nySession) confidence += 5

    // Multiple triggers: +5
    const triggerCount = [volumeSpike, pdhBreak || pdlBreak, nySession].filter(Boolean).length
    if (triggerCount >= 2) confidence += 5

    // Cancel penalties
    confidence -= cancelReasons.length * 10

    confidence = Math.max(10, Math.min(95, confidence))
  }

  let confidenceLabel = ''
  if (confidence >= 80) confidenceLabel = 'ثقة عالية جداً'
  else if (confidence >= 65) confidenceLabel = 'ثقة عالية'
  else if (confidence >= 50) confidenceLabel = 'ثقة متوسطة'
  else if (confidence >= 35) confidenceLabel = 'ثقة منخفضة'
  else confidenceLabel = action === 'WAIT' ? '' : 'ثقة ضعيفة'

  // ============================================
  // 10. BUILD RESULT
  // ============================================
  const actionTextMap: Record<SMCAction, string> = {
    BUY: '🟢 شراء — Sweep سفلي',
    SELL: '🔴 بيع — Sweep علوي',
    WAIT: '⏳ لا يوجد فرصة الآن',
  }

  return {
    id: `smc-${symbol}-${Date.now()}`,
    symbol,
    displaySymbol: formatSymbol(symbol),
    price: currentPrice,
    action,
    actionText: actionTextMap[action],
    reason,
    reasons: reasons.slice(0, 6),
    entry,
    stopLoss,
    target1,
    target2,
    profitPct: ((profit / currentPrice) * 100).toFixed(3),
    riskPct: ((risk / currentPrice) * 100).toFixed(3),
    riskReward: rr,
    filters: {
      volumeSpike,
      volumeRatio: vol.ratio,
      pdhBreak,
      pdlBreak,
      nySession,
      hasTrigger,
    },
    liquidity: {
      levels: levels.slice(0, 8),
      sweptLevel: sweptLevel || null,
      atLiquidity: !!nearLevel,
    },
    displacement: {
      detected: disp.detected,
      direction: disp.direction,
      strength: disp.strength,
      avgBodyRatio: disp.avgBodyRatio,
    },
    exhaustion: {
      detected: exhaust.detected,
      wickRatio: exhaust.wickRatio,
      followThrough: exhaust.followThrough,
      volumeSlowdown: exhaust.volumeSlowdown,
    },
    structure: {
      dailyRange,
      dailyRangePct,
      vwap,
      pdh,
      pdl,
      asianHigh,
      asianLow,
    },
    confidence,
    confidenceLabel,
    signalSince: '',
    signalAgeSeconds: 0,
    cancelReasons,
    timestamp: new Date().toISOString(),
  }
}

// ============================================
// GET Handler
// ============================================
export async function GET(request: Request) {
  const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
  if (isRateLimited(clientIP)) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const interval = searchParams.get('interval') || '15m'
    const symbolParam = searchParams.get('symbol')
    const symbols = symbolParam ? [symbolParam] : SIGNAL_PAIRS

    const signals: SMCSignal[] = []

    const promises = symbols.map(async (symbol) => {
      try {
        // Main timeframe candles (more history for structure)
        const rawKlines = await getCachedKlines(symbol, interval, 200)
        if (rawKlines.length < 50) return null
        const candles = parseKlines(rawKlines)

        // Daily candles for PDH/PDL
        const rawDaily = await getCachedKlines(symbol, '1d', 7)
        const dailyCandles = parseKlines(rawDaily)

        // Weekly candles for weekly H/L
        const rawWeekly = await getCachedKlines(symbol, '1w', 4)
        const weeklyCandles = parseKlines(rawWeekly)

        return analyzeSMC(candles, symbol, dailyCandles, weeklyCandles)
      } catch {
        return null
      }
    })

    const results = await Promise.all(promises)
    const now = new Date()

    for (const r of results) {
      if (r) {
        // Signal age tracking
        const key = r.symbol
        const tracked = signalTracker[key]
        if (!tracked || tracked.action !== r.action) {
          signalTracker[key] = { action: r.action, since: now.toISOString() }
          r.signalSince = now.toISOString()
          r.signalAgeSeconds = 0
        } else {
          r.signalSince = tracked.since
          r.signalAgeSeconds = Math.floor((now.getTime() - new Date(tracked.since).getTime()) / 1000)
        }

        // Age-based confidence reduction
        if (r.action !== 'WAIT' && r.signalAgeSeconds > 0) {
          const ageMin = r.signalAgeSeconds / 60
          if (ageMin > 10) r.confidence = Math.max(10, r.confidence - 20)
          else if (ageMin > 5) r.confidence = Math.max(10, r.confidence - 10)
          else if (ageMin > 2) r.confidence = Math.max(10, r.confidence - 5)

          if (r.confidence >= 80) r.confidenceLabel = 'ثقة عالية جداً'
          else if (r.confidence >= 65) r.confidenceLabel = 'ثقة عالية'
          else if (r.confidence >= 50) r.confidenceLabel = 'ثقة متوسطة'
          else if (r.confidence >= 35) r.confidenceLabel = 'ثقة منخفضة'
          else r.confidenceLabel = 'ثقة ضعيفة'
        }

        signals.push(r)
      }
    }

    // Sort: actionable first
    signals.sort((a, b) => {
      const priority: Record<SMCAction, number> = { BUY: 0, SELL: 0, WAIT: 1 }
      return priority[a.action] - priority[b.action]
    })

    return NextResponse.json({
      success: true,
      data: {
        signals,
        interval,
        count: signals.length,
        actionable: signals.filter(s => s.action !== 'WAIT').length,
        timestamp: new Date().toISOString(),
      },
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to generate SMC signals' }, { status: 500 })
  }
}
