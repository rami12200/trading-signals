// ============================================
// استراتيجية SPX — Bollinger Bounce محسّنة للمؤشرات
// الشمعة عند البولنجر العلوي + RSI تشبع = بيع
// الشمعة عند البولنجر السفلي + RSI تشبع = شراء
// فلتر: BB Width (تجنب الترند القوي) + EMA 50
// ============================================

import { OHLCV, calcEMA, calcRSI, calcBollingerBands, calcATR } from '@/lib/indicators'

export interface SPXSignal {
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
    bbSqueeze: boolean
    pricePosition: 'UPPER' | 'MIDDLE' | 'LOWER'
    atr: number
  }
  signalTime: string
}

export function analyzeSPX(candles: OHLCV[]): SPXSignal | null {
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

  // === SPX خاص: BB Squeeze Detection ===
  // لو البولنجر ضيق جداً = السوق هادي = الارتداد أقوى
  // لو البولنجر واسع جداً = ترند قوي = خطر
  const bbSqueeze = bbWidth < 1.5

  // وضع السعر بالنسبة للبولنجر
  let pricePosition: 'UPPER' | 'MIDDLE' | 'LOWER' = 'MIDDLE'
  if (price >= bbUpper || lastCandle.high >= bbUpper) pricePosition = 'UPPER'
  else if (price <= bbLower || lastCandle.low <= bbLower) pricePosition = 'LOWER'

  // وضع السعر بالنسبة لـ EMA 50
  let emaTrend: 'ABOVE' | 'BELOW' | 'AT' = 'AT'
  const emaDistance = ((price - currentEMA) / currentEMA) * 100
  if (emaDistance > 0.05) emaTrend = 'ABOVE'
  else if (emaDistance < -0.05) emaTrend = 'BELOW'

  // RSI status
  let rsiStatus = 'عادي'
  if (currentRSI >= 70) rsiStatus = 'تشبع شراء'
  else if (currentRSI >= 60) rsiStatus = 'مرتفع'
  else if (currentRSI <= 30) rsiStatus = 'تشبع بيع'
  else if (currentRSI <= 40) rsiStatus = 'منخفض'

  let action: 'BUY' | 'SELL' | 'WAIT' = 'WAIT'
  let confidence = 0
  const reasons: string[] = []

  // ===== إشارة بيع: السعر عند البولنجر العلوي =====
  let sellScore = 0
  const sellReasons: string[] = []

  // الشمعة لمست أو تجاوزت البولنجر العلوي
  if (lastCandle.high >= bbUpper) {
    sellScore += 25
    sellReasons.push('📊 السعر وصل البولنجر العلوي')
  }
  if (lastCandle.close > bbUpper) {
    sellScore += 10
    sellReasons.push('⚠️ إغلاق فوق البولنجر — ارتداد قريب')
  }

  // RSI تشبع شراء
  if (currentRSI >= 70) {
    sellScore += 25
    sellReasons.push(`📈 RSI تشبع شراء (${currentRSI.toFixed(1)})`)
  } else if (currentRSI >= 60) {
    sellScore += 12
    sellReasons.push(`📈 RSI مرتفع (${currentRSI.toFixed(1)})`)
  }

  // RSI بدأ ينزل من القمة (divergence)
  if (prevRSI > currentRSI && currentRSI >= 55) {
    sellScore += 10
    sellReasons.push('📉 RSI بدأ ينعكس من الأعلى')
  }

  // شمعة انعكاسية هبوطية عند القمة
  if (lastCandle.close < lastCandle.open && pricePosition === 'UPPER') {
    sellScore += 12
    sellReasons.push('🕯️ شمعة انعكاسية هبوطية عند القمة')
  }

  // === فلتر SPX ===
  // BB Width واسع جداً = ترند قوي، خطر الدخول عكسه
  if (bbWidth > 3) {
    sellScore -= 20
    if (sellScore > 0) sellReasons.push('⚠️ البولنجر واسع — ترند قوي (حذر)')
  }

  // السعر تحت EMA 50 = الاتجاه نازل = بيع أقوى
  if (emaTrend === 'BELOW') {
    sellScore += 8
    sellReasons.push('📉 السعر تحت EMA 50 — اتجاه هابط')
  }

  // ===== إشارة شراء: السعر عند البولنجر السفلي =====
  let buyScore = 0
  const buyReasons: string[] = []

  // الشمعة لمست أو نزلت تحت البولنجر السفلي
  if (lastCandle.low <= bbLower) {
    buyScore += 25
    buyReasons.push('📊 السعر وصل البولنجر السفلي')
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
    buyScore += 12
    buyReasons.push(`📉 RSI منخفض (${currentRSI.toFixed(1)})`)
  }

  // RSI بدأ يطلع من القاع
  if (prevRSI < currentRSI && currentRSI <= 45) {
    buyScore += 10
    buyReasons.push('📈 RSI بدأ ينعكس من الأسفل')
  }

  // شمعة انعكاسية صعودية عند القاع
  if (lastCandle.close > lastCandle.open && pricePosition === 'LOWER') {
    buyScore += 12
    buyReasons.push('🕯️ شمعة انعكاسية صعودية عند القاع')
  }

  // === فلتر SPX ===
  if (bbWidth > 3) {
    buyScore -= 20
    if (buyScore > 0) buyReasons.push('⚠️ البولنجر واسع — ترند قوي (حذر)')
  }

  // السعر فوق EMA 50 = الاتجاه صاعد = شراء أقوى
  if (emaTrend === 'ABOVE') {
    buyScore += 8
    buyReasons.push('📈 السعر فوق EMA 50 — اتجاه صاعد')
  }

  // === BB Squeeze bonus: لو ضيق والسعر عند الحد = إشارة أقوى ===
  if (bbSqueeze) {
    if (pricePosition === 'LOWER') {
      buyScore += 10
      buyReasons.push('🔒 BB Squeeze — ارتداد محتمل قوي')
    }
    if (pricePosition === 'UPPER') {
      sellScore += 10
      sellReasons.push('🔒 BB Squeeze — ارتداد محتمل قوي')
    }
  }

  // ===== تحديد الإشارة النهائية =====
  let stopLoss = 0
  let takeProfit = 0

  if (sellScore > buyScore && sellScore >= 35) {
    action = 'SELL'
    confidence = Math.min(95, sellScore)
    reasons.push(...sellReasons)

    // وقف الخسارة فوق البولنجر العلوي + ATR buffer
    stopLoss = bbUpper + currentATR * 0.5
    // الهدف: المنتصف (أول هدف)
    takeProfit = bbMiddle

  } else if (buyScore > sellScore && buyScore >= 35) {
    action = 'BUY'
    confidence = Math.min(95, buyScore)
    reasons.push(...buyReasons)

    // وقف الخسارة تحت البولنجر السفلي - ATR buffer
    stopLoss = bbLower - currentATR * 0.5
    // الهدف: المنتصف
    takeProfit = bbMiddle

  } else {
    confidence = Math.max(sellScore, buyScore)
    if (sellReasons.length > buyReasons.length) reasons.push(...sellReasons)
    else if (buyReasons.length > 0) reasons.push(...buyReasons)
    if (reasons.length === 0) {
      reasons.push('⏸️ السعر في المنتصف — انتظر وصوله للحدود')
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
      bbSqueeze,
      pricePosition,
      atr: Math.round(currentATR * 100) / 100,
    },
    signalTime: new Date().toISOString(),
  }
}
