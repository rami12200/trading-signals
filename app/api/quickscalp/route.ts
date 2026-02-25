import { NextResponse } from 'next/server'
import { getKlines, formatSymbol, getCategoryPairs, getCategorySource, CryptoCategory } from '@/lib/binance'
import { getFinnhubKlines } from '@/lib/finnhub'
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

// ============================================
// Quick Scalp Strategy API
// EMA 9/21 crossover + RSI + MACD momentum
// Designed for small, frequent profits
// ============================================

type ScalpAction = 'BUY' | 'SELL' | 'EXIT_BUY' | 'EXIT_SELL' | 'WAIT'

// === In-memory cache to reduce Binance API pressure ===
const cache: Record<string, { data: any; timestamp: number }> = {}
const CACHE_TTL = 10_000 // 10 seconds

// === Signal age tracking: when each signal action first appeared ===
const signalTracker: Record<string, { action: string; since: string }> = {}

// === Simple rate limiting ===
const rateLimiter: Record<string, number[]> = {}
const RATE_LIMIT_WINDOW = 10_000 // 10 seconds
const RATE_LIMIT_MAX = 10 // max requests per window

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  if (!rateLimiter[ip]) rateLimiter[ip] = []
  rateLimiter[ip] = rateLimiter[ip].filter((t) => now - t < RATE_LIMIT_WINDOW)
  if (rateLimiter[ip].length >= RATE_LIMIT_MAX) return true
  rateLimiter[ip].push(now)
  return false
}

const FINNHUB_CACHE_TTL = 30_000 // 30 seconds for Finnhub (60 req/min is generous)

async function getCachedKlines(symbol: string, interval: string, limit: number, source: 'binance' | 'finnhub' = 'binance') {
  const key = `${source}-${symbol}-${interval}-${limit}`
  const now = Date.now()
  const ttl = source === 'finnhub' ? FINNHUB_CACHE_TTL : CACHE_TTL
  if (cache[key] && now - cache[key].timestamp < ttl) {
    return cache[key].data
  }
  const data = source === 'finnhub'
    ? await getFinnhubKlines(symbol, interval, limit)
    : await getKlines(symbol, interval, limit)
  cache[key] = { data, timestamp: now }
  return data
}

interface QuickScalpSignal {
  id: string
  symbol: string
  displaySymbol: string
  price: number
  action: ScalpAction
  actionText: string
  reason: string
  reasons: string[]
  entry: number
  stopLoss: number
  target: number
  profitPct: string
  riskPct: string
  riskReward: string
  indicators: {
    rsi: number
    rsiStatus: string
    ema9: number
    ema21: number
    emaTrend: 'UP' | 'DOWN' | 'CROSS_UP' | 'CROSS_DOWN'
    macdHistogram: number
    macdTrend: string
    bbPosition: number
    atr: number
    volumeSpike: boolean
  }
  momentum: 'STRONG_UP' | 'UP' | 'WEAK' | 'DOWN' | 'STRONG_DOWN'
  signalQuality: 'STRONG' | 'NORMAL' | 'WEAK'
  confidence: number
  confidenceLabel: string
  signalSince: string
  signalAgeSeconds: number
  reversalWarning: boolean
  reversalReason: string
  timestamp: string
}

// === Confidence Score Calculator ===
function calcConfidence(
  action: ScalpAction,
  momentumScore: number,
  vol: { spike: boolean; ratio: number },
  emaTrend: string,
  rsi: number,
  htfTrend: string,
  mtfTrend: string,
  reversalWarning: boolean,
  strongCandle: boolean
): number {
  if (action === 'WAIT') return 0

  let score = 50 // base

  // Momentum strength (+/- 15)
  const absMomentum = Math.abs(momentumScore)
  if (absMomentum >= 6) score += 15
  else if (absMomentum >= 4) score += 10
  else if (absMomentum >= 2) score += 5
  else score -= 5

  // Volume confirmation (+/- 10)
  if (vol.spike) score += 10
  else if (vol.ratio < 0.7) score -= 10

  // Higher timeframe alignment (+/- 15)
  const isBuy = action === 'BUY' || action === 'EXIT_SELL'
  if (isBuy && htfTrend === 'UP') score += 8
  if (isBuy && mtfTrend === 'UP') score += 7
  if (!isBuy && htfTrend === 'DOWN') score += 8
  if (!isBuy && mtfTrend === 'DOWN') score += 7

  // EMA cross is strongest signal (+10)
  if (emaTrend === 'CROSS_UP' && isBuy) score += 10
  else if (emaTrend === 'CROSS_DOWN' && !isBuy) score += 10

  // RSI in good zone (+5)
  if (isBuy && rsi < 45) score += 5
  else if (!isBuy && rsi > 55) score += 5
  // RSI extreme against us (-10)
  if (isBuy && rsi > 70) score -= 10
  else if (!isBuy && rsi < 30) score -= 10

  // Strong candle (+5)
  if (strongCandle) score += 5

  // Reversal warning (-15)
  if (reversalWarning) score -= 15

  return Math.max(10, Math.min(95, score))
}

// === Asset-specific trading hours check ===
type AssetType = 'crypto' | 'stocks' | 'forex' | 'metals'

function getAssetType(category: string): AssetType {
  if (category === 'stocks') return 'stocks'
  if (category === 'forex') return 'forex'
  if (category === 'metals') return 'metals'
  return 'crypto'
}

function isTradingHoursOpen(assetType: AssetType): { open: boolean; reason: string } {
  const now = new Date()
  const utcH = now.getUTCHours()
  const utcM = now.getUTCMinutes()
  const totalMin = utcH * 60 + utcM
  const day = now.getUTCDay() // 0=Sun, 6=Sat

  if (assetType === 'crypto') return { open: true, reason: '' }

  if (assetType === 'stocks') {
    // US market: 9:30 AM - 3:30 PM ET = 14:30 - 20:30 UTC (skip last 30 min)
    // Closed on weekends
    if (day === 0 || day === 6) return { open: false, reason: 'السوق الأمريكي مغلق (عطلة نهاية الأسبوع)' }
    if (totalMin < 870 || totalMin > 1230) return { open: false, reason: 'السوق الأمريكي مغلق — يفتح 9:30 AM ET' }
    // First 15 min too volatile
    if (totalMin < 885) return { open: false, reason: 'انتظر 15 دقيقة بعد الافتتاح (تقلبات عالية)' }
    return { open: true, reason: '' }
  }

  if (assetType === 'forex') {
    // Best hours: London+NY overlap 13:00-17:00 UTC
    if (day === 0 || day === 6) return { open: false, reason: 'سوق الفوركس مغلق (عطلة نهاية الأسبوع)' }
    // Forex trades 24h on weekdays, but we prefer high liquidity
    const highLiquidity = (totalMin >= 780 && totalMin <= 1020) // 13:00-17:00 UTC
    if (!highLiquidity) return { open: true, reason: '⚠️ سيولة منخفضة — أفضل وقت 13:00-17:00 UTC' }
    return { open: true, reason: '' }
  }

  if (assetType === 'metals') {
    if (day === 0 || day === 6) return { open: false, reason: 'سوق المعادن مغلق (عطلة نهاية الأسبوع)' }
    return { open: true, reason: '' }
  }

  return { open: true, reason: '' }
}

// === Asset-specific config ===
interface AssetConfig {
  emaFast: number
  emaSlow: number
  minConfidence: number
  slATRMultiplier: number
  tpATRMultiplier: number
  requireVolume: boolean
  minVolumeRatio: number
  requireBothTF: boolean // require both MTF and HTF alignment
}

function getAssetConfig(assetType: AssetType): AssetConfig {
  switch (assetType) {
    case 'stocks':
      return { emaFast: 9, emaSlow: 21, minConfidence: 65, slATRMultiplier: 1.5, tpATRMultiplier: 2.5, requireVolume: true, minVolumeRatio: 1.3, requireBothTF: true }
    case 'forex':
      return { emaFast: 9, emaSlow: 21, minConfidence: 60, slATRMultiplier: 1.0, tpATRMultiplier: 2.0, requireVolume: false, minVolumeRatio: 0, requireBothTF: false }
    case 'metals':
      return { emaFast: 9, emaSlow: 21, minConfidence: 60, slATRMultiplier: 1.5, tpATRMultiplier: 2.0, requireVolume: false, minVolumeRatio: 0, requireBothTF: false }
    default: // crypto
      return { emaFast: 9, emaSlow: 21, minConfidence: 50, slATRMultiplier: 1.5, tpATRMultiplier: 2.5, requireVolume: false, minVolumeRatio: 0, requireBothTF: false }
  }
}

function analyzeQuickScalp(candles: OHLCV[], symbol: string, htfTrend: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL', mtfTrend: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL', assetType: AssetType = 'crypto'): QuickScalpSignal | null {
  if (candles.length < 50) return null

  const config = getAssetConfig(assetType)

  const closes = candles.map((c) => c.close)
  const currentPrice = closes[closes.length - 1]
  const prevPrice = closes[closes.length - 2]

  // === Price Action: Real direction of last 3 candles ===
  const last3 = candles.slice(-3)
  const priceRising = last3[2].close > last3[1].close && last3[1].close > last3[0].close
  const priceFalling = last3[2].close < last3[1].close && last3[1].close < last3[0].close
  const lastCandleBullish = last3[2].close > last3[2].open
  const lastCandleBearish = last3[2].close < last3[2].open
  // At least 2 of last 3 candles going same direction
  const bullishCandles = last3.filter((c) => c.close > c.open).length
  const bearishCandles = last3.filter((c) => c.close < c.open).length
  const priceGoingUp = bullishCandles >= 2
  const priceGoingDown = bearishCandles >= 2
  // Strong candle detection (body > 60% of candle range)
  const lastCandle = last3[2]
  const lastCandleBody = Math.abs(lastCandle.close - lastCandle.open)
  const lastCandleRange = lastCandle.high - lastCandle.low
  const strongCandle = lastCandleRange > 0 && (lastCandleBody / lastCandleRange) > 0.5
  // Did price just break EMA9? (previous close was on other side)
  const prevClose = last3[1].close

  // === Core Indicators ===

  // EMA 9 & 21 — the main trend engine
  const ema9All = calcEMA(closes, 9)
  const ema21All = calcEMA(closes, 21)
  if (ema9All.length < 3 || ema21All.length < 3) return null

  const ema9 = ema9All[ema9All.length - 1]
  const ema9Prev = ema9All[ema9All.length - 2]
  const ema21 = ema21All[ema21All.length - 1]
  const ema21Prev = ema21All[ema21All.length - 2]

  // RSI
  const rsiAll = calcRSI(closes, 14)
  if (rsiAll.length < 3) return null
  const rsi = rsiAll[rsiAll.length - 1]
  const rsiPrev = rsiAll[rsiAll.length - 2]
  const rsiPrev2 = rsiAll[rsiAll.length - 3]

  // MACD
  const macdAll = calcMACD(closes, 12, 26, 9)
  const macd = macdAll.length > 1 ? macdAll[macdAll.length - 1] : null
  const macdPrev = macdAll.length > 2 ? macdAll[macdAll.length - 2] : null

  // ATR for SL/TP
  const atr = calcATR(candles, 14)
  const effectiveATR = atr ?? currentPrice * 0.005

  // Bollinger Bands
  const bb = calcBollingerBands(closes, 20, 2)

  // Volume
  const volumes = candles.map((c) => c.volume)
  const vol = analyzeVolume(volumes, 20)

  // === Determine EMA Trend ===
  let emaTrend: 'UP' | 'DOWN' | 'CROSS_UP' | 'CROSS_DOWN' = 'UP'
  const justCrossedUp = ema9Prev <= ema21Prev && ema9 > ema21
  const justCrossedDown = ema9Prev >= ema21Prev && ema9 < ema21

  if (justCrossedUp) emaTrend = 'CROSS_UP'
  else if (justCrossedDown) emaTrend = 'CROSS_DOWN'
  else if (ema9 > ema21) emaTrend = 'UP'
  else emaTrend = 'DOWN'

  // === RSI Status ===
  let rsiStatus = 'عادي'
  if (rsi > 75) rsiStatus = 'ذروة شراء قوية'
  else if (rsi > 65) rsiStatus = 'ذروة شراء'
  else if (rsi < 25) rsiStatus = 'ذروة بيع قوية'
  else if (rsi < 35) rsiStatus = 'ذروة بيع'

  // === MACD Trend ===
  let macdTrend = 'محايد'
  if (macd) {
    if (macd.histogram > 0 && macdPrev && macd.histogram > macdPrev.histogram) macdTrend = 'صاعد متسارع'
    else if (macd.histogram > 0) macdTrend = 'صاعد'
    else if (macd.histogram < 0 && macdPrev && macd.histogram < macdPrev.histogram) macdTrend = 'هابط متسارع'
    else if (macd.histogram < 0) macdTrend = 'هابط'
  }

  // === Momentum Score (now includes Price Action) ===
  let momentumScore = 0
  if (ema9 > ema21) momentumScore += 2
  else momentumScore -= 2
  if (rsi > 55) momentumScore += 1
  else if (rsi < 45) momentumScore -= 1
  if (macd && macd.histogram > 0) momentumScore += 1
  else if (macd && macd.histogram < 0) momentumScore -= 1
  if (currentPrice > ema9) momentumScore += 1
  else momentumScore -= 1
  // Price Action bonus
  if (priceGoingUp) momentumScore += 2
  else if (priceGoingDown) momentumScore -= 2
  // MACD accelerating?
  const macdAccelUp = macd && macdPrev && macd.histogram > macdPrev.histogram
  const macdAccelDown = macd && macdPrev && macd.histogram < macdPrev.histogram
  if (macdAccelUp) momentumScore += 1
  if (macdAccelDown) momentumScore -= 1

  let momentum: 'STRONG_UP' | 'UP' | 'WEAK' | 'DOWN' | 'STRONG_DOWN' = 'WEAK'
  if (momentumScore >= 4) momentum = 'STRONG_UP'
  else if (momentumScore >= 2) momentum = 'UP'
  else if (momentumScore <= -4) momentum = 'STRONG_DOWN'
  else if (momentumScore <= -2) momentum = 'DOWN'

  // === Reversal Detection ===
  let reversalWarning = false
  let reversalReason = ''

  // RSI divergence from extreme
  if (rsi > 70 && rsiPrev > rsi) {
    reversalWarning = true
    reversalReason = 'RSI يتراجع من ذروة الشراء — احتمال انعكاس هابط'
  } else if (rsi < 30 && rsiPrev < rsi) {
    reversalWarning = true
    reversalReason = 'RSI يرتد من ذروة البيع — احتمال انعكاس صاعد'
  }

  // MACD histogram weakening
  if (macd && macdPrev) {
    if (macd.histogram > 0 && macd.histogram < macdPrev.histogram && macdPrev.histogram > 0) {
      if (!reversalWarning) {
        reversalWarning = true
        reversalReason = 'زخم MACD يضعف — الصعود يفقد قوته'
      }
    } else if (macd.histogram < 0 && macd.histogram > macdPrev.histogram && macdPrev.histogram < 0) {
      if (!reversalWarning) {
        reversalWarning = true
        reversalReason = 'زخم MACD يضعف — الهبوط يفقد قوته'
      }
    }
  }

  // Bollinger Band extreme
  if (bb) {
    if (bb.position > 95) {
      reversalWarning = true
      reversalReason = 'السعر عند الحد العلوي لبولنجر — احتمال ارتداد'
    } else if (bb.position < 5) {
      reversalWarning = true
      reversalReason = 'السعر عند الحد السفلي لبولنجر — احتمال ارتداد'
    }
  }

  // === Support/Resistance for bounce detection ===
  const sr = findSupportResistance(candles)
  const nearSupport = sr.support.filter((s) => s < currentPrice).pop()
  const nearResistance = sr.resistance.find((r) => r > currentPrice)
  const atSupport = nearSupport && Math.abs(currentPrice - nearSupport) / currentPrice < 0.003
  const atResistance = nearResistance && Math.abs(nearResistance - currentPrice) / currentPrice < 0.003

  // === Determine Action ===
  let action: ScalpAction = 'WAIT'
  let reason = ''
  const reasons: string[] = []

  // BUY conditions — confirm price direction is not against us
  if (emaTrend === 'CROSS_UP' && rsi < 70 && !lastCandleBearish) {
    action = 'BUY'
    reason = 'تقاطع EMA 9/21 صاعد — ادخل شراء'
    reasons.push('EMA 9 عبرت فوق EMA 21')
    if (lastCandleBullish) reasons.push('الشمعة الأخيرة صاعدة')
    if (rsi < 45) reasons.push('RSI في منطقة مناسبة للشراء')
    if (vol.spike) reasons.push('حجم تداول مرتفع يدعم الحركة')
  } else if (emaTrend === 'UP' && rsi < 40 && lastCandleBullish) {
    action = 'BUY'
    reason = 'RSI منخفض + الاتجاه صاعد + الشمعة الأخيرة صاعدة'
    reasons.push('الاتجاه العام صاعد (EMA 9 > 21)')
    reasons.push(`RSI ${rsi.toFixed(0)} — منخفض`)
    reasons.push('الشمعة الأخيرة صاعدة (ارتداد)')
  } else if (emaTrend === 'UP' && currentPrice > ema9 && lastCandleBullish && rsi < 65 && (!macd || macd.histogram > 0)) {
    action = 'BUY'
    reason = 'السعر فوق EMA 9 ويطلع + MACD موجب'
    reasons.push('السعر فوق EMA 9 (دعم ديناميكي)')
    reasons.push('الشمعة الأخيرة صاعدة')
    if (macdAccelUp) reasons.push('MACD يتسارع للأعلى')
  } else if (emaTrend === 'UP' && momentum === 'STRONG_UP' && !priceFalling) {
    action = 'BUY'
    reason = 'زخم صعود قوي — فرصة شراء'
    reasons.push('الزخم قوي جداً (EMA + RSI + MACD + السعر)')
    if (lastCandleBullish) reasons.push('الشمعة الأخيرة صاعدة')
  }

  // BOUNCE from support — BUY signal
  if (action === 'WAIT' && atSupport && lastCandleBullish && strongCandle && rsi < 45) {
    action = 'BUY'
    reason = 'ارتداد من مستوى دعم قوي — فرصة شراء'
    reasons.push(`السعر عند دعم ${nearSupport!.toFixed(2)}`)
    reasons.push('شمعة صاعدة قوية (ارتداد)')
    if (rsi < 35) reasons.push('RSI في ذروة بيع — فرصة ارتداد')
  }

  // BOUNCE from resistance — SELL signal
  if (action === 'WAIT' && atResistance && lastCandleBearish && strongCandle && rsi > 55) {
    action = 'SELL'
    reason = 'ارتداد من مستوى مقاومة قوي — فرصة بيع'
    reasons.push(`السعر عند مقاومة ${nearResistance!.toFixed(2)}`)
    reasons.push('شمعة هابطة قوية (ارتداد)')
    if (rsi > 65) reasons.push('RSI في ذروة شراء — فرصة ارتداد')
  }

  // SELL conditions — confirm price direction is not against us
  if (emaTrend === 'CROSS_DOWN' && rsi > 30 && !lastCandleBullish) {
    action = 'SELL'
    reason = 'تقاطع EMA 9/21 هابط — ادخل بيع'
    reasons.push('EMA 9 عبرت تحت EMA 21')
    if (lastCandleBearish) reasons.push('الشمعة الأخيرة هابطة')
    if (rsi > 55) reasons.push('RSI في منطقة مناسبة للبيع')
    if (vol.spike) reasons.push('حجم تداول مرتفع يدعم الحركة')
  } else if (action === 'WAIT' && emaTrend === 'DOWN' && rsi > 60 && lastCandleBearish) {
    action = 'SELL'
    reason = 'RSI مرتفع + الاتجاه هابط + الشمعة الأخيرة هابطة'
    reasons.push('الاتجاه العام هابط (EMA 9 < 21)')
    reasons.push(`RSI ${rsi.toFixed(0)} — مرتفع`)
    reasons.push('الشمعة الأخيرة هابطة (ارتداد)')
  } else if (action === 'WAIT' && emaTrend === 'DOWN' && currentPrice < ema9 && lastCandleBearish && rsi > 35 && (!macd || macd.histogram < 0)) {
    action = 'SELL'
    reason = 'السعر تحت EMA 9 وينزل + MACD سالب'
    reasons.push('السعر تحت EMA 9 (مقاومة ديناميكية)')
    reasons.push('الشمعة الأخيرة هابطة')
    if (macdAccelDown) reasons.push('MACD يتسارع للأسفل')
  } else if (action === 'WAIT' && emaTrend === 'DOWN' && momentum === 'STRONG_DOWN' && !priceRising) {
    action = 'SELL'
    reason = 'زخم هبوط قوي — فرصة بيع'
    reasons.push('الزخم قوي جداً (EMA + RSI + MACD + السعر)')
    if (lastCandleBearish) reasons.push('الشمعة الأخيرة هابطة')
  }

  // ============================================
  // 🔴 DUAL TREND FILTER (15m + 1h)
  // Stocks: require BOTH timeframes aligned (stricter)
  // Others: block if EITHER is against us
  // ============================================
  if (config.requireBothTF) {
    // Stocks: both MTF and HTF must agree with the trade direction
    const isBuyAction = action === 'BUY'
    const isSellAction = action === 'SELL'
    if (isBuyAction && (htfTrend !== 'UP' || mtfTrend !== 'UP')) {
      action = 'WAIT'
      reason = 'الأسهم تحتاج تأكيد ترند — كلا الفريمين لازم صاعد'
      reasons.length = 0
      reasons.push(`فريم 15 دقيقة: ${mtfTrend === 'UP' ? '✅ صاعد' : '❌ ' + mtfTrend}`)
      reasons.push(`فريم الساعة: ${htfTrend === 'UP' ? '✅ صاعد' : '❌ ' + htfTrend}`)
      reasons.push('انتظر حتى يتوافق الترندان')
    } else if (isSellAction && (htfTrend !== 'DOWN' || mtfTrend !== 'DOWN')) {
      action = 'WAIT'
      reason = 'الأسهم تحتاج تأكيد ترند — كلا الفريمين لازم هابط'
      reasons.length = 0
      reasons.push(`فريم 15 دقيقة: ${mtfTrend === 'DOWN' ? '✅ هابط' : '❌ ' + mtfTrend}`)
      reasons.push(`فريم الساعة: ${htfTrend === 'DOWN' ? '✅ هابط' : '❌ ' + htfTrend}`)
      reasons.push('انتظر حتى يتوافق الترندان')
    }
  } else {
    if ((htfTrend === 'UP' || mtfTrend === 'UP') && (action === 'SELL')) {
      action = 'WAIT'
      reason = 'الترند صاعد — ممنوع البيع'
      reasons.length = 0
      if (mtfTrend === 'UP') reasons.push('📈 الترند على فريم 15 دقيقة صاعد')
      if (htfTrend === 'UP') reasons.push('📈 الترند على فريم الساعة صاعد')
      reasons.push('البيع ضد الترند = خطر عالي')
      reasons.push('انتظر إشارة شراء مع الترند')
    } else if ((htfTrend === 'DOWN' || mtfTrend === 'DOWN') && (action === 'BUY')) {
      action = 'WAIT'
      reason = 'الترند هابط — ممنوع الشراء'
      reasons.length = 0
      if (mtfTrend === 'DOWN') reasons.push('📉 الترند على فريم 15 دقيقة هابط')
      if (htfTrend === 'DOWN') reasons.push('📉 الترند على فريم الساعة هابط')
      reasons.push('الشراء ضد الترند = خطر عالي')
      reasons.push('انتظر إشارة بيع مع الترند')
    }
  }

  // ============================================
  // 📊 VOLUME FILTER (stocks require high volume)
  // ============================================
  if (config.requireVolume && action !== 'WAIT' && vol.ratio < config.minVolumeRatio) {
    action = 'WAIT'
    reason = 'حجم التداول ضعيف — انتظر سيولة أعلى'
    reasons.length = 0
    reasons.push(`الفوليوم ${(vol.ratio * 100).toFixed(0)}% من المتوسط`)
    reasons.push(`المطلوب: ${(config.minVolumeRatio * 100).toFixed(0)}% على الأقل`)
    reasons.push('الأسهم تحتاج فوليوم عالي لتأكيد الحركة')
  }

  // EXIT conditions — detect actual reversal happening
  if (emaTrend === 'UP' && reversalWarning && (rsi > 68 || (rsi > 60 && priceFalling))) {
    action = 'EXIT_BUY'
    reason = priceFalling
      ? 'أغلق الشراء — السعر بدأ ينزل فعلاً!'
      : 'أغلق صفقة الشراء — إشارات انعكاس!'
    reasons.length = 0
    reasons.push(reversalReason)
    if (priceFalling) reasons.push('آخر شمعتين هابطة')
    if (rsi > 70) reasons.push('RSI فوق 70 — ذروة شراء')
    if (macdAccelDown) reasons.push('زخم MACD يتراجع')
  } else if (emaTrend === 'DOWN' && reversalWarning && (rsi < 32 || (rsi < 40 && priceRising))) {
    action = 'EXIT_SELL'
    reason = priceRising
      ? 'أغلق البيع — السعر بدأ يطلع فعلاً!'
      : 'أغلق صفقة البيع — إشارات انعكاس!'
    reasons.length = 0
    reasons.push(reversalReason)
    if (priceRising) reasons.push('آخر شمعتين صاعدة')
    if (rsi < 30) reasons.push('RSI تحت 30 — ذروة بيع')
    if (macdAccelUp) reasons.push('زخم MACD يتعافى')
  }

  // Safety: cancel BUY only if last 3 candles ALL falling (strong contradiction)
  if (action === 'BUY' && priceFalling && lastCandleBearish) {
    action = 'WAIT'
    reason = 'الاتجاه صاعد لكن السعر ينزل بقوة — انتظر'
    reasons.length = 0
    reasons.push('آخر 3 شموع كلها هابطة')
    reasons.push('انتظر حتى يتوقف النزول')
  } else if (action === 'SELL' && priceRising && lastCandleBullish) {
    action = 'WAIT'
    reason = 'الاتجاه هابط لكن السعر يطلع بقوة — انتظر'
    reasons.length = 0
    reasons.push('آخر 3 شموع كلها صاعدة')
    reasons.push('انتظر حتى يتوقف الصعود')
  }

  // Add HTF trend info to reasons
  if (action !== 'WAIT' && htfTrend !== 'NEUTRAL') {
    reasons.push(htfTrend === 'UP' ? '📈 الترند العام صاعد (1 ساعة)' : '📉 الترند العام هابط (1 ساعة)')
  }

  // WAIT with context
  if (action === 'WAIT') {
    if (emaTrend === 'UP') {
      reason = 'الاتجاه صاعد — انتظر نقطة دخول أفضل'
      reasons.push('EMA 9 فوق EMA 21')
      reasons.push(`RSI: ${rsi.toFixed(0)}`)
    } else {
      reason = 'الاتجاه هابط — انتظر نقطة دخول أفضل'
      reasons.push('EMA 9 تحت EMA 21')
      reasons.push(`RSI: ${rsi.toFixed(0)}`)
    }
    if (reversalWarning) reasons.push(reversalReason)
  }

  // === Calculate SL/TP using Support/Resistance + ATR ===
  let entry = currentPrice
  let stopLoss: number
  let target: number

  if (action === 'BUY' || action === 'EXIT_SELL') {
    // SL: nearest support below price, or ATR-based
    const nearSup = sr.support.filter((s) => s < currentPrice).pop()
    const atrSL = currentPrice - effectiveATR * config.slATRMultiplier
    stopLoss = nearSup && nearSup > atrSL
      ? nearSup - effectiveATR * 0.15 // slightly below support
      : atrSL
    // TP: nearest resistance above price, or ATR-based
    const nearRes = sr.resistance.find((r) => r > currentPrice)
    const atrTP = currentPrice + effectiveATR * config.tpATRMultiplier
    target = nearRes && nearRes < atrTP * 1.5
      ? nearRes - effectiveATR * 0.05 // slightly before resistance
      : atrTP
  } else if (action === 'SELL' || action === 'EXIT_BUY') {
    // SL: nearest resistance above price, or ATR-based
    const nearRes = sr.resistance.find((r) => r > currentPrice)
    const atrSL = currentPrice + effectiveATR * config.slATRMultiplier
    stopLoss = nearRes && nearRes < atrSL
      ? nearRes + effectiveATR * 0.15 // slightly above resistance
      : atrSL
    // TP: nearest support below price, or ATR-based
    const nearSup = sr.support.filter((s) => s < currentPrice).pop()
    const atrTP = currentPrice - effectiveATR * config.tpATRMultiplier
    target = nearSup && nearSup > atrTP * 0.5
      ? nearSup + effectiveATR * 0.05 // slightly before support
      : atrTP
  } else {
    // WAIT — show hypothetical levels
    if (emaTrend === 'UP') {
      stopLoss = currentPrice - effectiveATR * config.slATRMultiplier
      target = currentPrice + effectiveATR * config.tpATRMultiplier
    } else {
      stopLoss = currentPrice + effectiveATR * config.slATRMultiplier
      target = currentPrice - effectiveATR * config.tpATRMultiplier
    }
  }

  // === Ensure TP always exists with minimum 1:1.5 R:R ===
  const slDist = Math.abs(currentPrice - stopLoss)
  const tpDist = Math.abs(target - currentPrice)
  const minTPDist = slDist * 1.5

  if (action === 'BUY' || action === 'EXIT_SELL') {
    if (target <= currentPrice || tpDist < minTPDist) {
      target = currentPrice + minTPDist
    }
  } else if (action === 'SELL' || action === 'EXIT_BUY') {
    if (target >= currentPrice || tpDist < minTPDist) {
      target = currentPrice - minTPDist
    }
  }

  const risk = Math.abs(currentPrice - stopLoss)
  const profit = Math.abs(target - currentPrice)
  const rr = risk > 0 ? (profit / risk).toFixed(1) : '0'

  // Action text in Arabic
  const actionTextMap: Record<ScalpAction, string> = {
    BUY: '🟢 اشترِ الآن',
    SELL: '🔴 بِع الآن',
    EXIT_BUY: '⚠️ أغلق الشراء',
    EXIT_SELL: '⚠️ أغلق البيع',
    WAIT: '⏳ انتظر',
  }

  const result: QuickScalpSignal = {
    id: `qs-${symbol}-${Date.now()}`,
    symbol,
    displaySymbol: formatSymbol(symbol),
    price: currentPrice,
    action,
    actionText: actionTextMap[action],
    reason,
    reasons: reasons.slice(0, 4),
    entry,
    stopLoss,
    target,
    profitPct: ((profit / currentPrice) * 100).toFixed(3),
    riskPct: ((risk / currentPrice) * 100).toFixed(3),
    riskReward: rr,
    indicators: {
      rsi,
      rsiStatus,
      ema9,
      ema21,
      emaTrend,
      macdHistogram: macd?.histogram ?? 0,
      macdTrend,
      bbPosition: bb?.position ?? 50,
      atr: effectiveATR,
      volumeSpike: vol.spike,
    },
    momentum,
    signalQuality: (action !== 'WAIT' && vol.spike && (momentum === 'STRONG_UP' || momentum === 'STRONG_DOWN'))
      ? 'STRONG'
      : (action !== 'WAIT' && !vol.spike && vol.ratio < 0.8)
        ? 'WEAK'
        : 'NORMAL',
    confidence: calcConfidence(action, momentumScore, vol, emaTrend, rsi, htfTrend, mtfTrend, reversalWarning, strongCandle),
    confidenceLabel: '',
    signalSince: '',
    signalAgeSeconds: 0,
    reversalWarning,
    reversalReason,
    timestamp: new Date().toISOString(),
  }

  // Set confidence label
  if (result.confidence >= 80) result.confidenceLabel = 'ثقة عالية جداً'
  else if (result.confidence >= 65) result.confidenceLabel = 'ثقة عالية'
  else if (result.confidence >= 50) result.confidenceLabel = 'ثقة متوسطة'
  else if (result.confidence >= 35) result.confidenceLabel = 'ثقة منخفضة'
  else result.confidenceLabel = 'ثقة ضعيفة'

  // === MINIMUM CONFIDENCE FILTER (asset-specific) ===
  if (result.action !== 'WAIT' && result.action !== 'EXIT_BUY' && result.action !== 'EXIT_SELL') {
    if (result.confidence < config.minConfidence) {
      result.action = 'WAIT'
      result.actionText = '⏳ انتظر'
      result.reason = `الثقة ${result.confidence}% أقل من الحد المطلوب (${config.minConfidence}%)`
      result.reasons = [
        `الحد الأدنى للثقة: ${config.minConfidence}%`,
        `الثقة الحالية: ${result.confidence}%`,
        'انتظر إشارة أقوى',
      ]
    }
  }

  return result
}

export async function GET(request: Request) {
  // Rate limiting
  const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
  if (isRateLimited(clientIP)) {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Please wait.' },
      { status: 429 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const interval = searchParams.get('interval') || '15m'
    const symbolParam = searchParams.get('symbol')
    const category = (searchParams.get('category') || 'major') as CryptoCategory

    // Use specific symbol, category pairs, or default major pairs
    const symbols = symbolParam ? [symbolParam] : getCategoryPairs(category)
    const source = getCategorySource(category)
    const assetType = getAssetType(category)

    // === Trading hours check ===
    const tradingHours = isTradingHoursOpen(assetType)
    if (!tradingHours.open) {
      return NextResponse.json({
        success: true,
        data: {
          signals: symbols.map(s => ({
            id: `qs-${s}-closed`,
            symbol: s,
            displaySymbol: formatSymbol(s),
            price: 0,
            action: 'WAIT' as ScalpAction,
            actionText: '⏳ السوق مغلق',
            reason: tradingHours.reason,
            reasons: [tradingHours.reason],
            entry: 0, stopLoss: 0, target: 0,
            profitPct: '0', riskPct: '0', riskReward: '0',
            indicators: { rsi: 50, rsiStatus: 'مغلق', ema9: 0, ema21: 0, emaTrend: 'UP' as const, macdHistogram: 0, macdTrend: 'محايد', bbPosition: 50, atr: 0, volumeSpike: false },
            momentum: 'WEAK' as const,
            signalQuality: 'NORMAL' as const,
            confidence: 0, confidenceLabel: 'السوق مغلق',
            signalSince: '', signalAgeSeconds: 0,
            reversalWarning: false, reversalReason: '',
            timestamp: new Date().toISOString(),
          })),
          interval,
          count: symbols.length,
          actionable: 0,
          marketClosed: true,
          marketClosedReason: tradingHours.reason,
          timestamp: new Date().toISOString(),
        },
      })
    }

    const signals: QuickScalpSignal[] = []

    // Fetch and analyze each symbol with dual trend filter (15m + 1h)
    const promises = symbols.map(async (symbol) => {
      try {
        // Get main timeframe candles
        const rawKlines = await getCachedKlines(symbol, interval, 200, source)
        if (rawKlines.length < 50) return null
        const candles = parseKlines(rawKlines)

        // Get mid timeframe (15m) for fast trend detection
        let mtfTrend: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL'
        try {
          const mtfKlines = await getCachedKlines(symbol, '15m', 50, source)
          if (mtfKlines.length >= 30) {
            const mtfCandles = parseKlines(mtfKlines)
            const mtfCloses = mtfCandles.map((c: OHLCV) => c.close)
            const mtfEma9 = calcEMA(mtfCloses, 9)
            const mtfEma21 = calcEMA(mtfCloses, 21)
            if (mtfEma9.length > 0 && mtfEma21.length > 0) {
              const e9 = mtfEma9[mtfEma9.length - 1]
              const e21 = mtfEma21[mtfEma21.length - 1]
              const mtfPrice = mtfCloses[mtfCloses.length - 1]
              if (e9 > e21 && mtfPrice > e9) mtfTrend = 'UP'
              else if (e9 < e21 && mtfPrice < e9) mtfTrend = 'DOWN'
            }
          }
        } catch {}

        // Get higher timeframe (1h) for trend filter
        let htfTrend: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL'
        try {
          const htfKlines = await getCachedKlines(symbol, '1h', 50, source)
          if (htfKlines.length >= 30) {
            const htfCandles = parseKlines(htfKlines)
            const htfCloses = htfCandles.map((c: OHLCV) => c.close)
            const htfEma9 = calcEMA(htfCloses, 9)
            const htfEma21 = calcEMA(htfCloses, 21)
            if (htfEma9.length > 0 && htfEma21.length > 0) {
              const e9 = htfEma9[htfEma9.length - 1]
              const e21 = htfEma21[htfEma21.length - 1]
              const htfPrice = htfCloses[htfCloses.length - 1]
              if (e9 > e21 && htfPrice > e9) htfTrend = 'UP'
              else if (e9 < e21 && htfPrice < e9) htfTrend = 'DOWN'
            }
          }
        } catch {}

        return analyzeQuickScalp(candles, symbol, htfTrend, mtfTrend, assetType)
      } catch {
        return null
      }
    })

    const results = await Promise.all(promises)
    const now = new Date()
    for (const r of results) {
      if (r) {
        // Track signal age: when did this action first appear for this symbol?
        const key = r.symbol
        const tracked = signalTracker[key]
        if (!tracked || tracked.action !== r.action) {
          // New signal or action changed
          signalTracker[key] = { action: r.action, since: now.toISOString() }
          r.signalSince = now.toISOString()
          r.signalAgeSeconds = 0
        } else {
          // Same signal still active
          r.signalSince = tracked.since
          r.signalAgeSeconds = Math.floor((now.getTime() - new Date(tracked.since).getTime()) / 1000)
        }

        // Reduce confidence based on signal age (older = less reliable)
        if (r.action !== 'WAIT' && r.signalAgeSeconds > 0) {
          const ageMinutes = r.signalAgeSeconds / 60
          if (ageMinutes > 10) r.confidence = Math.max(10, r.confidence - 20)
          else if (ageMinutes > 5) r.confidence = Math.max(10, r.confidence - 10)
          else if (ageMinutes > 2) r.confidence = Math.max(10, r.confidence - 5)

          // Update label after age adjustment
          if (r.confidence >= 80) r.confidenceLabel = '\u062b\u0642\u0629 \u0639\u0627\u0644\u064a\u0629 \u062c\u062f\u0627\u064b'
          else if (r.confidence >= 65) r.confidenceLabel = '\u062b\u0642\u0629 \u0639\u0627\u0644\u064a\u0629'
          else if (r.confidence >= 50) r.confidenceLabel = '\u062b\u0642\u0629 \u0645\u062a\u0648\u0633\u0637\u0629'
          else if (r.confidence >= 35) r.confidenceLabel = '\u062b\u0642\u0629 \u0645\u0646\u062e\u0641\u0636\u0629'
          else r.confidenceLabel = '\u062b\u0642\u0629 \u0636\u0639\u064a\u0641\u0629'
        }

        signals.push(r)
      }
    }

    // Sort: actionable signals first (BUY/SELL/EXIT), then WAIT
    signals.sort((a, b) => {
      const priority: Record<ScalpAction, number> = {
        EXIT_BUY: 0,
        EXIT_SELL: 0,
        BUY: 1,
        SELL: 1,
        WAIT: 2,
      }
      return priority[a.action] - priority[b.action]
    })

    return NextResponse.json({
      success: true,
      data: {
        signals,
        interval,
        count: signals.length,
        actionable: signals.filter((s) => s.action !== 'WAIT').length,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to generate quick scalp signals' },
      { status: 500 }
    )
  }
}
