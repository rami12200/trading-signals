// ============================================
// استراتيجية Bollinger Bounce + RSI + EMA 50
// الشمعة عند البولنجر العلوي = بيع
// الشمعة عند البولنجر السفلي = شراء
// RSI تأكيد + EMA 50 فلتر الاتجاه
// ============================================

import { OHLCV, calcEMA, calcRSI, calcBollingerBands, calcATR } from '@/lib/indicators'

export interface BollingerSignal {
  action: 'BUY' | 'SELL' | 'WAIT'
  confidence: number
  entry: number
  stopLoss: number
  takeProfit: number
  riskReward: number
  reasons: string[]
  indicators: {
    rsi: number
    rsiStatus: string
    ema50: number
    emaTrend: 'ABOVE' | 'BELOW' | 'AT'
    bbUpper: number
    bbMiddle: number
    bbLower: number
    bbWidth: number
    pricePosition: 'UPPER' | 'MIDDLE' | 'LOWER'
  }
  signalTime: string
}

export function analyzeBollinger(candles: OHLCV[]): BollingerSignal | null {
  if (candles.length < 55) return null

  const closes = candles.map(c => c.close)
  const lastCandle = candles[candles.length - 1]
  const prevCandle = candles[candles.length - 2]
  const price = lastCandle.close

  // === المؤشرات ===
  const ema50 = calcEMA(closes, 50)
  const rsiArr = calcRSI(closes, 14)
  const bb = calcBollingerBands(closes, 20, 2)
  const currentATR = calcATR(candles, 14)

  if (ema50.length < 2 || rsiArr.length < 2 || !bb || currentATR === null) return null

  const currentEMA = ema50[ema50.length - 1]
  const currentRSI = rsiArr[rsiArr.length - 1]
  const prevRSI = rsiArr[rsiArr.length - 2]
  const bbUpper = bb.upper
  const bbMiddle = bb.middle
  const bbLower = bb.lower

  const bbWidth = ((bbUpper - bbLower) / bbMiddle) * 100

  // وضع السعر بالنسبة للبولنجر
  let pricePosition: 'UPPER' | 'MIDDLE' | 'LOWER' = 'MIDDLE'
  if (price >= bbUpper || lastCandle.high >= bbUpper) pricePosition = 'UPPER'
  else if (price <= bbLower || lastCandle.low <= bbLower) pricePosition = 'LOWER'

  // وضع السعر بالنسبة لـ EMA 50
  let emaTrend: 'ABOVE' | 'BELOW' | 'AT' = 'AT'
  const emaDistance = ((price - currentEMA) / currentEMA) * 100
  if (emaDistance > 0.1) emaTrend = 'ABOVE'
  else if (emaDistance < -0.1) emaTrend = 'BELOW'

  // RSI status
  let rsiStatus = 'عادي'
  if (currentRSI >= 70) rsiStatus = 'تشبع شراء'
  else if (currentRSI >= 60) rsiStatus = 'مرتفع'
  else if (currentRSI <= 30) rsiStatus = 'تشبع بيع'
  else if (currentRSI <= 40) rsiStatus = 'منخفض'

  let action: 'BUY' | 'SELL' | 'WAIT' = 'WAIT'
  let confidence = 0
  const reasons: string[] = []

  // ===== إشارة بيع: الشمعة عند البولنجر العلوي =====
  let sellScore = 0

  // الشمعة لمست أو تجاوزت البولنجر العلوي
  if (lastCandle.high >= bbUpper) {
    sellScore += 30
    reasons.push('📊 الشمعة وصلت البولنجر العلوي')
  }
  if (lastCandle.close > bbUpper) {
    sellScore += 10
    reasons.push('⚠️ إغلاق فوق البولنجر — ارتداد قريب')
  }

  // RSI تشبع شراء
  if (currentRSI >= 70) {
    sellScore += 25
    reasons.push(`📈 RSI تشبع شراء (${currentRSI.toFixed(1)})`)
  } else if (currentRSI >= 60) {
    sellScore += 10
    reasons.push(`📈 RSI مرتفع (${currentRSI.toFixed(1)})`)
  }

  // RSI بدأ ينزل من القمة (divergence)
  if (prevRSI > currentRSI && currentRSI >= 60) {
    sellScore += 10
    reasons.push('📉 RSI بدأ ينعكس من الأعلى')
  }

  // شمعة انعكاسية (هبوطية) — إغلاق أقل من الافتتاح عند القمة
  if (lastCandle.close < lastCandle.open && pricePosition === 'UPPER') {
    sellScore += 10
    reasons.push('🕯️ شمعة انعكاسية هبوطية')
  }

  // البولنجر ضيق (سكويز) — الانفجار قادم
  if (bbWidth < 2) {
    sellScore -= 15 // نتجنب الدخول في السكويز
  }

  // ===== إشارة شراء: الشمعة عند البولنجر السفلي =====
  let buyScore = 0
  const buyReasons: string[] = []

  // الشمعة لمست أو نزلت تحت البولنجر السفلي
  if (lastCandle.low <= bbLower) {
    buyScore += 30
    buyReasons.push('📊 الشمعة وصلت البولنجر السفلي')
  }
  if (lastCandle.close < bbLower) {
    buyScore += 10
    buyReasons.push('⚠️ إغلاق تحت البولنجر — ارتداد قريب')
  }

  // RSI تشبع بيع
  if (currentRSI <= 30) {
    buyScore += 25
    buyReasons.push(`📉 RSI تشبع بيع (${currentRSI.toFixed(1)})`)
  } else if (currentRSI <= 40) {
    buyScore += 10
    buyReasons.push(`📉 RSI منخفض (${currentRSI.toFixed(1)})`)
  }

  // RSI بدأ يطلع من القاع
  if (prevRSI < currentRSI && currentRSI <= 40) {
    buyScore += 10
    buyReasons.push('📈 RSI بدأ ينعكس من الأسفل')
  }

  // شمعة انعكاسية (صعودية)
  if (lastCandle.close > lastCandle.open && pricePosition === 'LOWER') {
    buyScore += 10
    buyReasons.push('🕯️ شمعة انعكاسية صعودية')
  }

  if (bbWidth < 2) {
    buyScore -= 15
  }

  // ===== تحديد الإشارة النهائية =====
  let stopLoss = 0
  let takeProfit = 0

  if (sellScore > buyScore && sellScore >= 35) {
    action = 'SELL'
    confidence = Math.min(95, sellScore)

    // وقف الخسارة فوق البولنجر العلوي
    stopLoss = bbUpper + currentATR * 0.5
    // الهدف عند المنتصف أو البولنجر السفلي
    takeProfit = bbMiddle

  } else if (buyScore > sellScore && buyScore >= 35) {
    action = 'BUY'
    confidence = Math.min(95, buyScore)
    reasons.length = 0
    reasons.push(...buyReasons)

    // وقف الخسارة تحت البولنجر السفلي
    stopLoss = bbLower - currentATR * 0.5
    // الهدف عند المنتصف أو البولنجر العلوي
    takeProfit = bbMiddle

  } else {
    confidence = Math.max(sellScore, buyScore)
    if (reasons.length === 0 && buyReasons.length === 0) {
      reasons.push('⏸️ السعر في المنتصف — انتظر وصوله للحدود')
    }
    if (buyReasons.length > 0 && reasons.length === 0) {
      reasons.push(...buyReasons)
    }
  }

  const riskReward = stopLoss !== 0 && action !== 'WAIT'
    ? Math.abs((takeProfit - price) / (price - stopLoss))
    : 0

  return {
    action,
    confidence,
    entry: price,
    stopLoss,
    takeProfit,
    riskReward: Math.round(riskReward * 10) / 10,
    reasons,
    indicators: {
      rsi: Math.round(currentRSI * 10) / 10,
      rsiStatus,
      ema50: currentEMA,
      emaTrend,
      bbUpper,
      bbMiddle,
      bbLower,
      bbWidth: Math.round(bbWidth * 100) / 100,
      pricePosition,
    },
    signalTime: new Date().toISOString(),
  }
}
