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

// ============================================
// Quick Scalp Strategy API
// EMA 9/21 crossover + RSI + MACD momentum
// Designed for small, frequent profits
// ============================================

type ScalpAction = 'BUY' | 'SELL' | 'EXIT_BUY' | 'EXIT_SELL' | 'WAIT'

// === In-memory cache to reduce Binance API pressure ===
const cache: Record<string, { data: any; timestamp: number }> = {}
const CACHE_TTL = 10_000 // 10 seconds

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

async function getCachedKlines(symbol: string, interval: string, limit: number) {
  const key = `${symbol}-${interval}-${limit}`
  const now = Date.now()
  if (cache[key] && now - cache[key].timestamp < CACHE_TTL) {
    return cache[key].data
  }
  const data = await getKlines(symbol, interval, limit)
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
  reversalWarning: boolean
  reversalReason: string
  timestamp: string
}

function analyzeQuickScalp(candles: OHLCV[], symbol: string, htfTrend: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL'): QuickScalpSignal | null {
  if (candles.length < 50) return null

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
  // 🔴 HIGHER TIMEFRAME TREND FILTER (CRITICAL)
  // Block trades that go against the bigger trend
  // ============================================
  if (htfTrend === 'UP' && (action === 'SELL')) {
    action = 'WAIT'
    reason = 'الترند العام صاعد (1 ساعة) — ممنوع البيع'
    reasons.length = 0
    reasons.push('الترند على فريم الساعة صاعد')
    reasons.push('البيع ضد الترند = خطر عالي')
    reasons.push('انتظر إشارة شراء مع الترند')
  } else if (htfTrend === 'DOWN' && (action === 'BUY')) {
    action = 'WAIT'
    reason = 'الترند العام هابط (1 ساعة) — ممنوع الشراء'
    reasons.length = 0
    reasons.push('الترند على فريم الساعة هابط')
    reasons.push('الشراء ضد الترند = خطر عالي')
    reasons.push('انتظر إشارة بيع مع الترند')
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
    const nearSupport = sr.support.filter((s) => s < currentPrice).pop()
    const atrSL = currentPrice - effectiveATR * 1.0
    stopLoss = nearSupport && nearSupport > atrSL
      ? nearSupport - effectiveATR * 0.1 // slightly below support
      : atrSL
    // TP: nearest resistance above price, or ATR-based
    const nearResistance = sr.resistance.find((r) => r > currentPrice)
    const atrTP = currentPrice + effectiveATR * 1.2
    target = nearResistance && nearResistance < atrTP * 1.5
      ? nearResistance - effectiveATR * 0.05 // slightly before resistance
      : atrTP
  } else if (action === 'SELL' || action === 'EXIT_BUY') {
    // SL: nearest resistance above price, or ATR-based
    const nearResistance = sr.resistance.find((r) => r > currentPrice)
    const atrSL = currentPrice + effectiveATR * 1.0
    stopLoss = nearResistance && nearResistance < atrSL
      ? nearResistance + effectiveATR * 0.1 // slightly above resistance
      : atrSL
    // TP: nearest support below price, or ATR-based
    const nearSupport = sr.support.filter((s) => s < currentPrice).pop()
    const atrTP = currentPrice - effectiveATR * 1.2
    target = nearSupport && nearSupport > atrTP * 0.5
      ? nearSupport + effectiveATR * 0.05 // slightly before support
      : atrTP
  } else {
    // WAIT — show hypothetical levels
    if (emaTrend === 'UP') {
      stopLoss = currentPrice - effectiveATR * 1.0
      target = currentPrice + effectiveATR * 1.2
    } else {
      stopLoss = currentPrice + effectiveATR * 1.0
      target = currentPrice - effectiveATR * 1.2
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

  return {
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
    reversalWarning,
    reversalReason,
    timestamp: new Date().toISOString(),
  }
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

    // Use specific symbol or all crypto pairs
    const symbols = symbolParam ? [symbolParam] : CRYPTO_PAIRS

    const signals: QuickScalpSignal[] = []

    // Fetch and analyze each symbol with HTF trend filter
    const promises = symbols.map(async (symbol) => {
      try {
        // Get main timeframe candles
        const rawKlines = await getCachedKlines(symbol, interval, 200)
        if (rawKlines.length < 50) return null
        const candles = parseKlines(rawKlines)

        // Get higher timeframe (1h) for trend filter
        let htfTrend: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL'
        try {
          const htfKlines = await getCachedKlines(symbol, '1h', 50)
          if (htfKlines.length >= 30) {
            const htfCandles = parseKlines(htfKlines)
            const htfCloses = htfCandles.map((c: OHLCV) => c.close)
            const htfEma9 = calcEMA(htfCloses, 9)
            const htfEma21 = calcEMA(htfCloses, 21)
            if (htfEma9.length > 0 && htfEma21.length > 0) {
              const e9 = htfEma9[htfEma9.length - 1]
              const e21 = htfEma21[htfEma21.length - 1]
              const htfPrice = htfCloses[htfCloses.length - 1]
              // Strong trend: EMA9 > EMA21 AND price above both
              if (e9 > e21 && htfPrice > e9) htfTrend = 'UP'
              else if (e9 < e21 && htfPrice < e9) htfTrend = 'DOWN'
            }
          }
        } catch {}

        return analyzeQuickScalp(candles, symbol, htfTrend)
      } catch {
        return null
      }
    })

    const results = await Promise.all(promises)
    for (const r of results) {
      if (r) signals.push(r)
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
