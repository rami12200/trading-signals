// ============================================
// Technical Indicators - Correct Implementations
// ============================================

export interface OHLCV {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// Parse Binance kline data into OHLCV
export function parseKlines(data: any[]): OHLCV[] {
  return data.map((d) => ({
    time: d[0],
    open: parseFloat(d[1]),
    high: parseFloat(d[2]),
    low: parseFloat(d[3]),
    close: parseFloat(d[4]),
    volume: parseFloat(d[5]),
  }))
}

// ============================================
// EMA - Exponential Moving Average
// ============================================
export function calcEMA(values: number[], period: number): number[] {
  if (values.length < period) return []

  const multiplier = 2 / (period + 1)
  const ema: number[] = []

  // Seed with SMA
  let sum = 0
  for (let i = 0; i < period; i++) sum += values[i]
  ema.push(sum / period)

  // Calculate EMA
  for (let i = period; i < values.length; i++) {
    ema.push(values[i] * multiplier + ema[ema.length - 1] * (1 - multiplier))
  }

  return ema
}

// Get latest EMA value
export function latestEMA(values: number[], period: number): number | null {
  const ema = calcEMA(values, period)
  return ema.length > 0 ? ema[ema.length - 1] : null
}

// ============================================
// RSI - Relative Strength Index (Wilder's Smoothing)
// ============================================
export function calcRSI(closes: number[], period: number = 14): number[] {
  if (closes.length < period + 1) return []

  const rsiValues: number[] = []
  const deltas: number[] = []

  for (let i = 1; i < closes.length; i++) {
    deltas.push(closes[i] - closes[i - 1])
  }

  // First average gain/loss using SMA
  let avgGain = 0
  let avgLoss = 0
  for (let i = 0; i < period; i++) {
    if (deltas[i] > 0) avgGain += deltas[i]
    else avgLoss += Math.abs(deltas[i])
  }
  avgGain /= period
  avgLoss /= period

  // First RSI
  if (avgLoss === 0) {
    rsiValues.push(100)
  } else {
    const rs = avgGain / avgLoss
    rsiValues.push(100 - 100 / (1 + rs))
  }

  // Subsequent RSI using Wilder's smoothing
  for (let i = period; i < deltas.length; i++) {
    const gain = deltas[i] > 0 ? deltas[i] : 0
    const loss = deltas[i] < 0 ? Math.abs(deltas[i]) : 0

    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period

    if (avgLoss === 0) {
      rsiValues.push(100)
    } else {
      const rs = avgGain / avgLoss
      rsiValues.push(100 - 100 / (1 + rs))
    }
  }

  return rsiValues
}

// Get latest RSI
export function latestRSI(closes: number[], period: number = 14): number | null {
  const rsi = calcRSI(closes, period)
  return rsi.length > 0 ? rsi[rsi.length - 1] : null
}

// ============================================
// MACD - Moving Average Convergence Divergence
// ============================================
export interface MACDResult {
  line: number
  signal: number
  histogram: number
}

export function calcMACD(
  closes: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult[] {
  const fastEMA = calcEMA(closes, fastPeriod)
  const slowEMA = calcEMA(closes, slowPeriod)

  if (fastEMA.length === 0 || slowEMA.length === 0) return []

  // Align arrays: slow EMA starts later
  const offset = slowPeriod - fastPeriod
  const macdLine: number[] = []

  for (let i = 0; i < slowEMA.length; i++) {
    macdLine.push(fastEMA[i + offset] - slowEMA[i])
  }

  // Signal line = EMA of MACD line
  const signalLine = calcEMA(macdLine, signalPeriod)

  if (signalLine.length === 0) return []

  // Align and build results
  const signalOffset = signalPeriod - 1
  const results: MACDResult[] = []

  for (let i = 0; i < signalLine.length; i++) {
    const line = macdLine[i + signalOffset]
    const signal = signalLine[i]
    results.push({
      line,
      signal,
      histogram: line - signal,
    })
  }

  return results
}

// Get latest MACD
export function latestMACD(closes: number[]): MACDResult | null {
  const macd = calcMACD(closes)
  return macd.length > 0 ? macd[macd.length - 1] : null
}

// ============================================
// ATR - Average True Range
// ============================================
export function calcATR(candles: OHLCV[], period: number = 14): number | null {
  if (candles.length < period + 1) return null

  const trueRanges: number[] = []

  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high
    const low = candles[i].low
    const prevClose = candles[i - 1].close

    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose))
    trueRanges.push(tr)
  }

  // First ATR = SMA of first `period` TRs
  let atr = 0
  for (let i = 0; i < period; i++) atr += trueRanges[i]
  atr /= period

  // Wilder's smoothing for subsequent ATRs
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period
  }

  return atr
}

// ============================================
// Bollinger Bands
// ============================================
export interface BollingerBands {
  upper: number
  middle: number
  lower: number
  position: number // 0-100, where price sits within bands
}

export function calcBollingerBands(
  closes: number[],
  period: number = 20,
  stdDev: number = 2
): BollingerBands | null {
  if (closes.length < period) return null

  const slice = closes.slice(-period)
  const sma = slice.reduce((a, b) => a + b, 0) / period

  const variance = slice.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period
  const sd = Math.sqrt(variance)

  const upper = sma + stdDev * sd
  const lower = sma - stdDev * sd
  const currentPrice = closes[closes.length - 1]

  const position = upper !== lower ? ((currentPrice - lower) / (upper - lower)) * 100 : 50

  return { upper, middle: sma, lower, position: Math.max(0, Math.min(100, position)) }
}

// ============================================
// Support & Resistance Detection
// ============================================
export function findSupportResistance(
  candles: OHLCV[],
  lookback: number = 5,
  clusterThreshold: number = 0.3
): { support: number[]; resistance: number[] } {
  const highs = candles.map((c) => c.high)
  const lows = candles.map((c) => c.low)
  const volumes = candles.map((c) => c.volume)

  const resistanceLevels: { price: number; strength: number }[] = []
  const supportLevels: { price: number; strength: number }[] = []

  for (let i = lookback; i < candles.length - lookback; i++) {
    // Check for resistance (local high)
    let isResistance = true
    for (let j = 1; j <= lookback; j++) {
      if (highs[i] <= highs[i - j] || highs[i] <= highs[i + j]) {
        isResistance = false
        break
      }
    }
    if (isResistance) {
      resistanceLevels.push({ price: highs[i], strength: volumes[i] })
    }

    // Check for support (local low)
    let isSupport = true
    for (let j = 1; j <= lookback; j++) {
      if (lows[i] >= lows[i - j] || lows[i] >= lows[i + j]) {
        isSupport = false
        break
      }
    }
    if (isSupport) {
      supportLevels.push({ price: lows[i], strength: volumes[i] })
    }
  }

  // Cluster nearby levels
  const clusterLevels = (levels: { price: number; strength: number }[]): number[] => {
    if (levels.length === 0) return []

    levels.sort((a, b) => a.price - b.price)
    const clusters: { prices: number[]; totalStrength: number }[] = [
      { prices: [levels[0].price], totalStrength: levels[0].strength },
    ]

    for (let i = 1; i < levels.length; i++) {
      const lastCluster = clusters[clusters.length - 1]
      const avgPrice = lastCluster.prices.reduce((a, b) => a + b, 0) / lastCluster.prices.length

      if (Math.abs(levels[i].price - avgPrice) / avgPrice < clusterThreshold / 100) {
        lastCluster.prices.push(levels[i].price)
        lastCluster.totalStrength += levels[i].strength
      } else {
        clusters.push({ prices: [levels[i].price], totalStrength: levels[i].strength })
      }
    }

    // Sort by strength (more touches + volume = stronger)
    return clusters
      .sort((a, b) => b.prices.length * b.totalStrength - a.prices.length * a.totalStrength)
      .slice(0, 5)
      .map((c) => c.prices.reduce((a, b) => a + b, 0) / c.prices.length)
      .sort((a, b) => a - b)
  }

  return {
    support: clusterLevels(supportLevels),
    resistance: clusterLevels(resistanceLevels),
  }
}

// ============================================
// Break of Structure (Smart Money)
// ============================================
export function detectBOS(candles: OHLCV[]): string {
  if (candles.length < 20) return 'NONE'

  const recent = candles.slice(-20)
  const highs = recent.map((c) => c.high)
  const lows = recent.map((c) => c.low)
  const lastClose = recent[recent.length - 1].close

  // Find swing high and swing low in last 20 candles
  let swingHigh = -Infinity
  let swingLow = Infinity

  for (let i = 5; i < 15; i++) {
    if (highs[i] > highs[i - 1] && highs[i] > highs[i + 1]) {
      swingHigh = Math.max(swingHigh, highs[i])
    }
    if (lows[i] < lows[i - 1] && lows[i] < lows[i + 1]) {
      swingLow = Math.min(swingLow, lows[i])
    }
  }

  // Bullish BoS: price breaks above recent swing high
  if (swingHigh !== -Infinity && lastClose > swingHigh) return 'BULLISH'

  // Bearish BoS: price breaks below recent swing low
  if (swingLow !== Infinity && lastClose < swingLow) return 'BEARISH'

  return 'NONE'
}

// ============================================
// Volume Analysis
// ============================================
export function analyzeVolume(
  volumes: number[],
  period: number = 20
): { current: number; average: number; spike: boolean; ratio: number } {
  if (volumes.length < period) {
    return { current: volumes[volumes.length - 1] || 0, average: 0, spike: false, ratio: 1 }
  }

  const current = volumes[volumes.length - 1]
  const avg = volumes.slice(-period - 1, -1).reduce((a, b) => a + b, 0) / period
  const ratio = avg > 0 ? current / avg : 1

  return {
    current,
    average: avg,
    spike: ratio > 1.5,
    ratio,
  }
}

// ============================================
// Signal Generation Engine
// ============================================
export interface SignalScore {
  signal: 'BUY' | 'SELL' | 'NEUTRAL'
  buyScore: number
  sellScore: number
  confidence: number
  reasons: string[]
}

export function generateSignalScore(
  candles: OHLCV[],
  closes: number[]
): SignalScore {
  const reasons: string[] = []
  let buyScore = 0
  let sellScore = 0

  const currentPrice = closes[closes.length - 1]

  // 1. EMA Analysis
  const ema20 = latestEMA(closes, 20)
  const ema50 = latestEMA(closes, 50)
  const ema200 = latestEMA(closes, 200)

  if (ema20 !== null && ema50 !== null) {
    if (ema20 > ema50) {
      buyScore += 3
      reasons.push('EMA 20 > 50 (تقاطع صاعد)')
    } else {
      sellScore += 3
      reasons.push('EMA 20 < 50 (تقاطع هابط)')
    }

    if (currentPrice > ema20) buyScore += 2
    else sellScore += 2
  }

  if (ema200 !== null) {
    if (currentPrice > ema200) {
      buyScore += 2
      reasons.push('فوق EMA 200')
    } else {
      sellScore += 2
      reasons.push('تحت EMA 200')
    }
  }

  // 2. RSI Analysis (Wilder's)
  const rsi = latestRSI(closes)
  if (rsi !== null) {
    if (rsi < 25) {
      buyScore += 4
      reasons.push(`RSI ${rsi.toFixed(0)} — ذروة بيع قوية`)
    } else if (rsi < 35) {
      buyScore += 2
      reasons.push(`RSI ${rsi.toFixed(0)} — منطقة بيع`)
    } else if (rsi > 75) {
      sellScore += 4
      reasons.push(`RSI ${rsi.toFixed(0)} — ذروة شراء قوية`)
    } else if (rsi > 65) {
      sellScore += 2
      reasons.push(`RSI ${rsi.toFixed(0)} — منطقة شراء`)
    }
  }

  // 3. MACD Analysis (with Signal Line)
  const macd = latestMACD(closes)
  if (macd !== null) {
    if (macd.histogram > 0 && macd.line > 0) {
      buyScore += 3
      reasons.push('MACD صاعد + Histogram موجب')
    } else if (macd.histogram < 0 && macd.line < 0) {
      sellScore += 3
      reasons.push('MACD هابط + Histogram سالب')
    } else if (macd.histogram > 0) {
      buyScore += 1
      reasons.push('MACD Histogram موجب')
    } else {
      sellScore += 1
      reasons.push('MACD Histogram سالب')
    }
  }

  // 4. Volume Analysis
  const volumes = candles.map((c) => c.volume)
  const vol = analyzeVolume(volumes)
  if (vol.spike) {
    if (buyScore > sellScore) {
      buyScore += 2
      reasons.push('ارتفاع حجم مع اتجاه صاعد')
    } else {
      sellScore += 2
      reasons.push('ارتفاع حجم مع اتجاه هابط')
    }
  }

  // 5. Break of Structure
  const bos = detectBOS(candles)
  if (bos === 'BULLISH') {
    buyScore += 3
    reasons.push('كسر هيكلي صاعد (BoS)')
  } else if (bos === 'BEARISH') {
    sellScore += 3
    reasons.push('كسر هيكلي هابط (BoS)')
  }

  // 6. Support/Resistance proximity
  const sr = findSupportResistance(candles)
  const nearSupport = sr.support.find(
    (s) => Math.abs(s - currentPrice) / currentPrice < 0.008
  )
  const nearResistance = sr.resistance.find(
    (r) => Math.abs(r - currentPrice) / currentPrice < 0.008
  )
  if (nearSupport) {
    buyScore += 2
    reasons.push('قرب مستوى دعم')
  }
  if (nearResistance) {
    sellScore += 2
    reasons.push('قرب مستوى مقاومة')
  }

  // Determine signal
  const totalScore = buyScore + sellScore
  let signal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL'
  let confidence = 50

  if (buyScore > sellScore + 3) {
    signal = 'BUY'
    confidence = Math.min(85, 50 + ((buyScore - sellScore) / totalScore) * 50)
  } else if (sellScore > buyScore + 3) {
    signal = 'SELL'
    confidence = Math.min(85, 50 + ((sellScore - buyScore) / totalScore) * 50)
  } else if (buyScore > sellScore + 1) {
    signal = 'BUY'
    confidence = Math.min(65, 45 + ((buyScore - sellScore) / totalScore) * 30)
  } else if (sellScore > buyScore + 1) {
    signal = 'SELL'
    confidence = Math.min(65, 45 + ((sellScore - buyScore) / totalScore) * 30)
  }

  return {
    signal,
    buyScore,
    sellScore,
    confidence: Math.round(confidence),
    reasons: reasons.slice(0, 5),
  }
}

// ============================================
// Calculate Stop Loss & Targets using ATR
// ============================================
export function calcTradeSetup(
  signal: 'BUY' | 'SELL' | 'NEUTRAL',
  currentPrice: number,
  atr: number | null,
  support: number[],
  resistance: number[]
): { entry: number; sl: number; tp1: number; tp2: number; tp3: number; riskReward: number } {
  const fallbackATR = currentPrice * 0.01
  const effectiveATR = atr ?? fallbackATR

  let sl: number
  let tp1: number
  let tp2: number
  let tp3: number

  if (signal === 'BUY') {
    // SL below nearest support or 1.5x ATR
    const nearestSupport = support.filter((s) => s < currentPrice).pop()
    sl = nearestSupport
      ? Math.min(nearestSupport - effectiveATR * 0.2, currentPrice - effectiveATR * 1.5)
      : currentPrice - effectiveATR * 1.5

    tp1 = currentPrice + effectiveATR * 1.5
    tp2 = currentPrice + effectiveATR * 2.5
    const nearestResistance = resistance.find((r) => r > currentPrice)
    tp3 = nearestResistance ?? currentPrice + effectiveATR * 3.5
  } else {
    // SL above nearest resistance or 1.5x ATR
    const nearestResistance = resistance.find((r) => r > currentPrice)
    sl = nearestResistance
      ? Math.max(nearestResistance + effectiveATR * 0.2, currentPrice + effectiveATR * 1.5)
      : currentPrice + effectiveATR * 1.5

    tp1 = currentPrice - effectiveATR * 1.5
    tp2 = currentPrice - effectiveATR * 2.5
    const nearestSupport = support.filter((s) => s < currentPrice).pop()
    tp3 = nearestSupport ?? currentPrice - effectiveATR * 3.5
  }

  const risk = Math.abs(currentPrice - sl)
  const reward = Math.abs(tp1 - currentPrice)
  const riskReward = risk > 0 ? reward / risk : 0

  return { entry: currentPrice, sl, tp1, tp2, tp3, riskReward: Math.round(riskReward * 10) / 10 }
}
