// =============================================================================
// Institutional Quant AI Crypto Trading Engine
// Multi-layer quantitative market intelligence engine
// =============================================================================

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface OrderBookLevel {
  price: number
  qty: number
}

export interface OrderBook {
  bids: OrderBookLevel[]
  asks: OrderBookLevel[]
}

export type MarketRegime = 'TRENDING_UP' | 'TRENDING_DOWN' | 'RANGE_BOUND' | 'HIGH_VOLATILITY' | 'LOW_VOLATILITY'
export type SwingType = 'HH' | 'HL' | 'LH' | 'LL'
export type SignalDirection = 'BUY' | 'SELL'

export interface SwingPoint {
  index: number
  price: number
  type: SwingType
}

export interface LiquidityCluster {
  price: number
  type: 'EQUAL_HIGHS' | 'EQUAL_LOWS' | 'PREV_DAILY_HIGH' | 'PREV_DAILY_LOW' | 'RANGE_HIGH' | 'RANGE_LOW'
  swept: boolean
  sweepDirection?: 'UP' | 'DOWN'
}

export interface LayerResult {
  name: string
  score: number       // 0..100
  weight: number      // fraction summing to 1
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  detail: string
}

export interface QuantSignal {
  id: string
  pair: string
  direction: SignalDirection
  entry: number
  stopLoss: number
  takeProfit: number
  probability: number
  strengthLabel: string
  regime: MarketRegime
  layers: LayerResult[]
  timestamp: string
  atr: number
  riskReward: string
}

export interface QuantAnalysis {
  pair: string
  price: number
  regime: MarketRegime
  regimeDetail: string
  layers: LayerResult[]
  probability: number
  strengthLabel: string
  signal: QuantSignal | null
  swingPoints: SwingPoint[]
  liquidityClusters: LiquidityCluster[]
  momentum: {
    ema9: number
    ema21: number
    rsi: number
    macdLine: number
    macdSignal: number
    macdHist: number
  }
  volatility: {
    atr: number
    bbUpper: number
    bbLower: number
    bbWidth: number
    squeeze: boolean
  }
  orderFlow: {
    buyVolume: number
    sellVolume: number
    delta: number
    dominance: 'BUY' | 'SELL' | 'NEUTRAL'
    volumeSpike: boolean
  }
  orderBook: {
    bidWall: number
    askWall: number
    imbalance: number
    imbalanceDirection: 'BUY' | 'SELL' | 'NEUTRAL'
  }
  openInterest: {
    current: number
    change: number
    changePct: number
    priceCorrelation: 'STRONG_TREND' | 'WEAK_MOVE' | 'NEUTRAL'
  }
  fundingRate: {
    rate: number
    sentiment: 'EXTREME_LONG' | 'EXTREME_SHORT' | 'NEUTRAL'
  }
  liquidations: {
    shortLiquidations: number
    longLiquidations: number
    netDirection: 'BULLISH_SQUEEZE' | 'BEARISH_CASCADE' | 'NEUTRAL'
  }
}

export interface RealOrderFlow {
  buyVolume: number
  sellVolume: number
}

export interface BacktestResult {
  totalSignals: number
  wins: number
  losses: number
  winRate: number
  avgWinPct: number
  avgLossPct: number
  profitFactor: number
  expectancy: number
  maxConsecutiveLosses: number
  signals: BacktestSignalResult[]
}

export interface BacktestSignalResult {
  index: number
  direction: SignalDirection
  entry: number
  stopLoss: number
  takeProfit: number
  probability: number
  regime: MarketRegime
  exitPrice: number
  result: 'WIN' | 'LOSS'
  pnlPct: number
  barsToExit: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ema(data: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const result: number[] = [data[0]]
  for (let i = 1; i < data.length; i++) {
    result.push(data[i] * k + result[i - 1] * (1 - k))
  }
  return result
}

function sma(data: number[], period: number): number[] {
  const result: number[] = []
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { result.push(NaN); continue }
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += data[j]
    result.push(sum / period)
  }
  return result
}

function rsi(closes: number[], period: number = 14): number[] {
  const result: number[] = [50]
  let avgGain = 0, avgLoss = 0
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1]
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? -change : 0
    if (i <= period) {
      avgGain += gain / period
      avgLoss += loss / period
      if (i === period) {
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
        result.push(100 - 100 / (1 + rs))
      } else {
        result.push(50)
      }
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period
      avgLoss = (avgLoss * (period - 1) + loss) / period
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
      result.push(100 - 100 / (1 + rs))
    }
  }
  return result
}

function macd(closes: number[]): { line: number[]; signal: number[]; hist: number[] } {
  const ema12 = ema(closes, 12)
  const ema26 = ema(closes, 26)
  const line = ema12.map((v, i) => v - ema26[i])
  const signal = ema(line, 9)
  const hist = line.map((v, i) => v - signal[i])
  return { line, signal, hist }
}

function atr(candles: Candle[], period: number = 14): number[] {
  const tr: number[] = [candles[0].high - candles[0].low]
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i], p = candles[i - 1]
    tr.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)))
  }
  return ema(tr, period)
}

function bollingerBands(closes: number[], period: number = 20, mult: number = 2) {
  const middle = sma(closes, period)
  const upper: number[] = []
  const lower: number[] = []
  const width: number[] = []
  for (let i = 0; i < closes.length; i++) {
    if (isNaN(middle[i])) { upper.push(NaN); lower.push(NaN); width.push(NaN); continue }
    let sumSq = 0
    for (let j = i - period + 1; j <= i; j++) sumSq += (closes[j] - middle[i]) ** 2
    const std = Math.sqrt(sumSq / period)
    upper.push(middle[i] + mult * std)
    lower.push(middle[i] - mult * std)
    width.push(middle[i] > 0 ? (mult * 2 * std) / middle[i] * 100 : 0)
  }
  return { middle, upper, lower, width }
}

function last<T>(arr: T[]): T { return arr[arr.length - 1] }
function prev<T>(arr: T[], n = 1): T { return arr[arr.length - 1 - n] }

// ─── Layer 1: Market Regime Detection ────────────────────────────────────────

function detectRegime(candles: Candle[], atrValues: number[]): { regime: MarketRegime; detail: string } {
  const closes = candles.map(c => c.close)
  const ema50 = ema(closes, Math.min(50, closes.length))
  const currentATR = last(atrValues)
  const avgATR = atrValues.slice(-20).reduce((a, b) => a + b, 0) / 20
  const atrRatio = currentATR / avgATR

  const price = last(closes)
  const emaVal = last(ema50)
  const slope = (ema50[ema50.length - 1] - ema50[Math.max(0, ema50.length - 10)]) / ema50[Math.max(0, ema50.length - 10)] * 100

  if (atrRatio > 1.5) return { regime: 'HIGH_VOLATILITY', detail: `ATR ratio ${atrRatio.toFixed(2)}x — High volatility environment` }
  if (atrRatio < 0.6) return { regime: 'LOW_VOLATILITY', detail: `ATR ratio ${atrRatio.toFixed(2)}x — Low volatility compression` }
  if (Math.abs(slope) > 0.15 && price > emaVal) return { regime: 'TRENDING_UP', detail: `Price above EMA50, slope +${slope.toFixed(2)}%` }
  if (Math.abs(slope) > 0.15 && price < emaVal) return { regime: 'TRENDING_DOWN', detail: `Price below EMA50, slope ${slope.toFixed(2)}%` }
  return { regime: 'RANGE_BOUND', detail: `Flat EMA50 slope ${slope.toFixed(2)}% — Range-bound market` }
}

// ─── Layer 2: Market Structure ───────────────────────────────────────────────

function detectSwingPoints(candles: Candle[], lookback: number = 5): SwingPoint[] {
  const points: SwingPoint[] = []
  const highs = candles.map(c => c.high)
  const lows = candles.map(c => c.low)

  for (let i = lookback; i < candles.length - lookback; i++) {
    let isSwingHigh = true, isSwingLow = true
    for (let j = 1; j <= lookback; j++) {
      if (highs[i] <= highs[i - j] || highs[i] <= highs[i + j]) isSwingHigh = false
      if (lows[i] >= lows[i - j] || lows[i] >= lows[i + j]) isSwingLow = false
    }
    if (isSwingHigh) points.push({ index: i, price: highs[i], type: 'HH' })
    if (isSwingLow) points.push({ index: i, price: lows[i], type: 'LL' })
  }

  // Classify HH/HL/LH/LL
  const swingHighs = points.filter(p => p.type === 'HH')
  const swingLows = points.filter(p => p.type === 'LL')
  for (let i = 1; i < swingHighs.length; i++) {
    swingHighs[i].type = swingHighs[i].price > swingHighs[i - 1].price ? 'HH' : 'LH'
  }
  for (let i = 1; i < swingLows.length; i++) {
    swingLows[i].type = swingLows[i].price > swingLows[i - 1].price ? 'HL' : 'LL'
  }
  return [...swingHighs, ...swingLows].sort((a, b) => a.index - b.index)
}

function analyzeStructure(swings: SwingPoint[]): LayerResult {
  if (swings.length < 4) return { name: 'Market Structure', score: 50, weight: 0.10, direction: 'NEUTRAL', detail: 'Insufficient swing data' }
  const recent = swings.slice(-6)
  const lastHighs = recent.filter(s => s.type === 'HH' || s.type === 'LH')
  const lastLows = recent.filter(s => s.type === 'HL' || s.type === 'LL')

  const bullishHighs = lastHighs.filter(s => s.type === 'HH').length
  const bearishHighs = lastHighs.filter(s => s.type === 'LH').length
  const bullishLows = lastLows.filter(s => s.type === 'HL').length
  const bearishLows = lastLows.filter(s => s.type === 'LL').length

  const bullScore = bullishHighs + bullishLows
  const bearScore = bearishHighs + bearishLows

  if (bullScore > bearScore) {
    const score = Math.min(95, 60 + bullScore * 10)
    return { name: 'Market Structure', score, weight: 0.10, direction: 'BULLISH', detail: `HH+HL pattern (${bullScore}/${bullScore + bearScore})` }
  }
  if (bearScore > bullScore) {
    const score = Math.min(95, 60 + bearScore * 10)
    return { name: 'Market Structure', score, weight: 0.10, direction: 'BEARISH', detail: `LH+LL pattern (${bearScore}/${bullScore + bearScore})` }
  }
  return { name: 'Market Structure', score: 50, weight: 0.10, direction: 'NEUTRAL', detail: 'Mixed structure' }
}

// ─── Layer 3: Liquidity Cluster Detection ────────────────────────────────────

function detectLiquidityClusters(candles: Candle[]): LiquidityCluster[] {
  const clusters: LiquidityCluster[] = []
  const tolerance = 0.001 // 0.1%
  const highs = candles.map(c => c.high)
  const lows = candles.map(c => c.low)
  const currentPrice = last(candles).close

  // Equal highs
  for (let i = candles.length - 20; i < candles.length - 2; i++) {
    if (i < 0) continue
    for (let j = i + 2; j < candles.length - 1; j++) {
      if (Math.abs(highs[i] - highs[j]) / highs[i] < tolerance) {
        const swept = currentPrice > highs[i] * (1 + tolerance)
        clusters.push({ price: highs[i], type: 'EQUAL_HIGHS', swept, sweepDirection: swept ? 'UP' : undefined })
        break
      }
    }
  }

  // Equal lows
  for (let i = candles.length - 20; i < candles.length - 2; i++) {
    if (i < 0) continue
    for (let j = i + 2; j < candles.length - 1; j++) {
      if (Math.abs(lows[i] - lows[j]) / lows[i] < tolerance) {
        const swept = currentPrice < lows[i] * (1 - tolerance)
        clusters.push({ price: lows[i], type: 'EQUAL_LOWS', swept, sweepDirection: swept ? 'DOWN' : undefined })
        break
      }
    }
  }

  // Previous daily high/low (approx from last 96 candles for 15m or 288 for 5m)
  const dailySlice = candles.slice(-96)
  if (dailySlice.length > 10) {
    const pdh = Math.max(...dailySlice.slice(0, -16).map(c => c.high))
    const pdl = Math.min(...dailySlice.slice(0, -16).map(c => c.low))
    clusters.push({ price: pdh, type: 'PREV_DAILY_HIGH', swept: currentPrice > pdh, sweepDirection: currentPrice > pdh ? 'UP' : undefined })
    clusters.push({ price: pdl, type: 'PREV_DAILY_LOW', swept: currentPrice < pdl, sweepDirection: currentPrice < pdl ? 'DOWN' : undefined })
  }

  // Range high / low from recent consolidation
  const rangeSlice = candles.slice(-30)
  const rangeHigh = Math.max(...rangeSlice.map(c => c.high))
  const rangeLow = Math.min(...rangeSlice.map(c => c.low))
  clusters.push({ price: rangeHigh, type: 'RANGE_HIGH', swept: currentPrice > rangeHigh, sweepDirection: currentPrice > rangeHigh ? 'UP' : undefined })
  clusters.push({ price: rangeLow, type: 'RANGE_LOW', swept: currentPrice < rangeLow, sweepDirection: currentPrice < rangeLow ? 'DOWN' : undefined })

  return clusters
}

function analyzeLiquidity(clusters: LiquidityCluster[], candles: Candle[]): LayerResult {
  const currentPrice = last(candles).close
  const prevPrice = prev(candles, 2).close
  const sweptClusters = clusters.filter(c => c.swept)

  // Check for recent sweep + reversal
  const recentSweepUp = sweptClusters.some(c => c.sweepDirection === 'UP') && currentPrice < prevPrice
  const recentSweepDown = sweptClusters.some(c => c.sweepDirection === 'DOWN') && currentPrice > prevPrice

  if (recentSweepUp) {
    return { name: 'Liquidity Sweep', score: 80, weight: 0.15, direction: 'BEARISH', detail: `Upside liquidity swept — reversal potential` }
  }
  if (recentSweepDown) {
    return { name: 'Liquidity Sweep', score: 80, weight: 0.15, direction: 'BULLISH', detail: `Downside liquidity swept — reversal potential` }
  }

  // Near liquidity zone
  const nearCluster = clusters.find(c => Math.abs(c.price - currentPrice) / currentPrice < 0.002)
  if (nearCluster) {
    return { name: 'Liquidity Sweep', score: 60, weight: 0.15, direction: 'NEUTRAL', detail: `Price near ${nearCluster.type} @ ${nearCluster.price.toFixed(2)}` }
  }

  return { name: 'Liquidity Sweep', score: 40, weight: 0.15, direction: 'NEUTRAL', detail: 'No active liquidity sweep' }
}

// ─── Layer 4: Order Flow Analysis ────────────────────────────────────────────

function analyzeOrderFlow(candles: Candle[], realFlow?: RealOrderFlow): LayerResult & { buyVol: number; sellVol: number; delta: number; dominance: 'BUY' | 'SELL' | 'NEUTRAL'; spike: boolean } {
  let buyVol: number, sellVol: number

  if (realFlow && realFlow.buyVolume > 0) {
    buyVol = realFlow.buyVolume
    sellVol = realFlow.sellVolume
  } else {
    const recent = candles.slice(-10)
    buyVol = 0; sellVol = 0
    for (const c of recent) {
      if (c.close >= c.open) {
        buyVol += c.volume * 0.65
        sellVol += c.volume * 0.35
      } else {
        sellVol += c.volume * 0.65
        buyVol += c.volume * 0.35
      }
    }
  }

  const delta = buyVol - sellVol
  const totalVol = buyVol + sellVol
  const ratio = totalVol > 0 ? buyVol / totalVol : 0.5

  const buyDominance = ratio > 0.55
  const sellDominance = ratio < 0.45
  const strongBuy = ratio > 0.62
  const strongSell = ratio < 0.38
  const dominance: 'BUY' | 'SELL' | 'NEUTRAL' = buyDominance ? 'BUY' : sellDominance ? 'SELL' : 'NEUTRAL'

  const recent = candles.slice(-10)
  const avgVol = candles.slice(-50, -10).reduce((s, c) => s + c.volume, 0) / Math.max(1, candles.slice(-50, -10).length)
  const recentAvgVol = recent.reduce((s, c) => s + c.volume, 0) / recent.length
  const spike = recentAvgVol > avgVol * 1.5

  let score = 50
  let direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL'

  if (strongBuy) { score = 78 + (spike ? 15 : 0); direction = 'BULLISH' }
  else if (strongSell) { score = 78 + (spike ? 15 : 0); direction = 'BEARISH' }
  else if (buyDominance) { score = 62 + (spike ? 15 : 0); direction = 'BULLISH' }
  else if (sellDominance) { score = 62 + (spike ? 15 : 0); direction = 'BEARISH' }

  const isReal = realFlow && realFlow.buyVolume > 0

  return {
    name: 'Order Flow',
    score: Math.min(95, score),
    weight: isReal ? 0.18 : 0.12,
    direction,
    detail: `Delta: ${delta > 0 ? '+' : ''}${(delta / 1e6).toFixed(2)}M | ${dominance}${spike ? ' + SPIKE' : ''}${isReal ? ' [REAL]' : ' [EST]'}`,
    buyVol, sellVol, delta, dominance, spike
  }
}

// ─── Layer 5: Order Book Microstructure ──────────────────────────────────────

function analyzeOrderBook(orderBook: OrderBook): LayerResult & { bidWall: number; askWall: number; imbalance: number; imbalanceDir: 'BUY' | 'SELL' | 'NEUTRAL' } {
  const bidTotal = orderBook.bids.reduce((s, b) => s + b.qty * b.price, 0)
  const askTotal = orderBook.asks.reduce((s, a) => s + a.qty * a.price, 0)
  const total = bidTotal + askTotal
  const imbalance = total > 0 ? (bidTotal - askTotal) / total : 0

  const bidWall = Math.max(...orderBook.bids.map(b => b.qty * b.price))
  const askWall = Math.max(...orderBook.asks.map(a => a.qty * a.price))

  let direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL'
  let score = 50
  const imbalanceDir: 'BUY' | 'SELL' | 'NEUTRAL' = imbalance > 0.15 ? 'BUY' : imbalance < -0.15 ? 'SELL' : 'NEUTRAL'

  if (imbalance > 0.15) { direction = 'BULLISH'; score = 60 + Math.min(30, imbalance * 100) }
  else if (imbalance < -0.15) { direction = 'BEARISH'; score = 60 + Math.min(30, Math.abs(imbalance) * 100) }

  return {
    name: 'Order Book',
    score: Math.min(95, score),
    weight: 0.10,
    direction,
    detail: `Imbalance: ${(imbalance * 100).toFixed(1)}% | Bid wall: $${(bidWall / 1e6).toFixed(2)}M | Ask wall: $${(askWall / 1e6).toFixed(2)}M`,
    bidWall, askWall, imbalance, imbalanceDir
  }
}

// ─── Layer 6: Liquidation Detection ──────────────────────────────────────────

function analyzeLiquidations(candles: Candle[], oiChange: number): LayerResult & { shortLiq: number; longLiq: number; net: 'BULLISH_SQUEEZE' | 'BEARISH_CASCADE' | 'NEUTRAL' } {
  // Estimate liquidations from sudden price moves + OI drops
  const recent = candles.slice(-5)
  const priceChange = (last(recent).close - recent[0].open) / recent[0].open * 100
  const avgVolume = candles.slice(-30).reduce((s, c) => s + c.volume, 0) / 30
  const recentVol = recent.reduce((s, c) => s + c.volume, 0) / recent.length
  const volSpike = recentVol / avgVolume

  let shortLiq = 0, longLiq = 0
  if (priceChange > 1 && volSpike > 1.5 && oiChange < -2) {
    shortLiq = Math.abs(oiChange) * volSpike * 10
  }
  if (priceChange < -1 && volSpike > 1.5 && oiChange < -2) {
    longLiq = Math.abs(oiChange) * volSpike * 10
  }

  let net: 'BULLISH_SQUEEZE' | 'BEARISH_CASCADE' | 'NEUTRAL' = 'NEUTRAL'
  let score = 50
  let direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL'

  if (shortLiq > longLiq && shortLiq > 5) {
    net = 'BULLISH_SQUEEZE'; score = 70 + Math.min(25, shortLiq); direction = 'BULLISH'
  } else if (longLiq > shortLiq && longLiq > 5) {
    net = 'BEARISH_CASCADE'; score = 70 + Math.min(25, longLiq); direction = 'BEARISH'
  }

  return {
    name: 'Liquidations',
    score: Math.min(95, score),
    weight: 0.10,
    direction,
    detail: `Short liq: ${shortLiq.toFixed(0)} | Long liq: ${longLiq.toFixed(0)} | ${net}`,
    shortLiq, longLiq, net
  }
}

// ─── Layer 7: Open Interest Analysis ─────────────────────────────────────────

function analyzeOpenInterest(oiCurrent: number, oiPrevious: number, priceChange: number): LayerResult & { current: number; change: number; changePct: number; correlation: 'STRONG_TREND' | 'WEAK_MOVE' | 'NEUTRAL' } {
  const change = oiCurrent - oiPrevious
  const changePct = oiPrevious > 0 ? (change / oiPrevious) * 100 : 0

  let correlation: 'STRONG_TREND' | 'WEAK_MOVE' | 'NEUTRAL' = 'NEUTRAL'
  let score = 50
  let direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL'

  if (priceChange > 0.3 && changePct > 1) {
    correlation = 'STRONG_TREND'; score = 75; direction = 'BULLISH'
  } else if (priceChange < -0.3 && changePct > 1) {
    correlation = 'STRONG_TREND'; score = 75; direction = 'BEARISH'
  } else if (priceChange > 0.3 && changePct < -1) {
    correlation = 'WEAK_MOVE'; score = 35; direction = 'NEUTRAL'
  } else if (priceChange < -0.3 && changePct < -1) {
    correlation = 'WEAK_MOVE'; score = 35; direction = 'NEUTRAL'
  } else if (Math.abs(changePct) > 3) {
    score = 65; direction = priceChange > 0 ? 'BULLISH' : 'BEARISH'
  }

  return {
    name: 'Open Interest',
    score: Math.min(95, score),
    weight: 0.10,
    direction,
    detail: `OI Δ: ${changePct > 0 ? '+' : ''}${changePct.toFixed(2)}% | Price Δ: ${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)}% | ${correlation}`,
    current: oiCurrent, change, changePct, correlation
  }
}

// ─── Layer 8: Funding Rate Sentiment ─────────────────────────────────────────

function analyzeFundingRate(rate: number): LayerResult & { rate: number; sentiment: 'EXTREME_LONG' | 'EXTREME_SHORT' | 'NEUTRAL' } {
  let sentiment: 'EXTREME_LONG' | 'EXTREME_SHORT' | 'NEUTRAL' = 'NEUTRAL'
  let score = 50
  let direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL'

  if (rate > 0.05) {
    sentiment = 'EXTREME_LONG'; score = 70; direction = 'BEARISH' // contrarian
  } else if (rate < -0.05) {
    sentiment = 'EXTREME_SHORT'; score = 70; direction = 'BULLISH' // contrarian
  } else if (rate > 0.02) {
    score = 55; direction = 'BEARISH'
  } else if (rate < -0.02) {
    score = 55; direction = 'BULLISH'
  }

  return {
    name: 'Funding Rate',
    score: Math.min(95, score),
    weight: 0.10,
    direction,
    detail: `Rate: ${(rate * 100).toFixed(4)}% | ${sentiment}`,
    rate, sentiment
  }
}

// ─── Layer 9: Momentum Confirmation ──────────────────────────────────────────

function analyzeMomentum(candles: Candle[]): LayerResult & { ema9: number; ema21: number; rsiVal: number; macdLine: number; macdSignal: number; macdHist: number } {
  const closes = candles.map(c => c.close)
  const ema9 = ema(closes, 9)
  const ema21 = ema(closes, 21)
  const rsiVals = rsi(closes, 14)
  const macdData = macd(closes)

  const e9 = last(ema9)
  const e21 = last(ema21)
  const rsiVal = last(rsiVals)
  const macdH = last(macdData.hist)
  const prevMacdH = prev(macdData.hist, 1)

  let bullPoints = 0, bearPoints = 0

  // EMA crossover
  if (e9 > e21) bullPoints += 2; else bearPoints += 2
  // EMA cross event
  if (prev(ema9, 1) < prev(ema21, 1) && e9 > e21) bullPoints += 2
  if (prev(ema9, 1) > prev(ema21, 1) && e9 < e21) bearPoints += 2
  // RSI
  if (rsiVal > 55) bullPoints += 1
  if (rsiVal < 45) bearPoints += 1
  if (rsiVal > 65) bullPoints += 1
  if (rsiVal < 35) bearPoints += 1
  // MACD
  if (macdH > 0 && macdH > prevMacdH) bullPoints += 2
  if (macdH < 0 && macdH < prevMacdH) bearPoints += 2

  const total = bullPoints + bearPoints
  let direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL'
  let score = 50
  if (bullPoints > bearPoints + 1) { direction = 'BULLISH'; score = 55 + bullPoints * 5 }
  if (bearPoints > bullPoints + 1) { direction = 'BEARISH'; score = 55 + bearPoints * 5 }

  return {
    name: 'Momentum',
    score: Math.min(95, score),
    weight: 0.10,
    direction,
    detail: `EMA9 ${e9 > e21 ? '>' : '<'} EMA21 | RSI: ${rsiVal.toFixed(1)} | MACD: ${macdH > 0 ? '+' : ''}${macdH.toFixed(4)}`,
    ema9: e9, ema21: e21, rsiVal, macdLine: last(macdData.line), macdSignal: last(macdData.signal), macdHist: macdH
  }
}

// ─── Layer 10: Volatility Compression ────────────────────────────────────────

function analyzeVolatility(candles: Candle[]): LayerResult & { atrVal: number; bbUpper: number; bbLower: number; bbWidth: number; squeeze: boolean } {
  const closes = candles.map(c => c.close)
  const atrValues = atr(candles, 14)
  const bb = bollingerBands(closes, 20, 2)

  const currentATR = last(atrValues)
  const avgATR = atrValues.slice(-30).reduce((a, b) => a + b, 0) / Math.min(30, atrValues.length)
  const bbW = last(bb.width)
  const avgBBW = bb.width.filter(w => !isNaN(w)).slice(-30).reduce((a, b) => a + b, 0) / 30
  const squeeze = bbW < avgBBW * 0.7 && currentATR < avgATR * 0.7

  let score = 50
  let direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL'
  if (squeeze) {
    score = 75
    direction = 'NEUTRAL' // direction TBD on breakout
  } else if (bbW > avgBBW * 1.3) {
    score = 60
    const recentDir = last(candles).close > prev(candles, 3).close ? 'BULLISH' : 'BEARISH'
    direction = recentDir
  }

  return {
    name: 'Volatility',
    score: Math.min(95, score),
    weight: 0.10,
    direction,
    detail: `BB Width: ${bbW.toFixed(3)}% | ATR: ${currentATR.toFixed(2)} | ${squeeze ? 'SQUEEZE DETECTED' : 'Normal'}`,
    atrVal: currentATR, bbUpper: last(bb.upper), bbLower: last(bb.lower), bbWidth: bbW, squeeze
  }
}

// ─── AI Probability Engine ───────────────────────────────────────────────────

function computeProbability(layers: LayerResult[], regime: MarketRegime): { probability: number; direction: SignalDirection | null; label: string } {
  let bullishWeighted = 0, bearishWeighted = 0
  let activeWeight = 0

  for (const layer of layers) {
    const w = layer.weight
    if (layer.direction === 'BULLISH') {
      bullishWeighted += layer.score * w
      activeWeight += w
    } else if (layer.direction === 'BEARISH') {
      bearishWeighted += layer.score * w
      activeWeight += w
    }
    // NEUTRAL layers are excluded — they don't dilute the score
  }

  if (activeWeight === 0) {
    return { probability: 0, direction: null, label: 'LOW' }
  }

  const bullProb = Math.round(bullishWeighted / activeWeight)
  const bearProb = Math.round(bearishWeighted / activeWeight)

  const bullishCount = layers.filter(l => l.direction === 'BULLISH').length
  const bearishCount = layers.filter(l => l.direction === 'BEARISH').length
  const neutralCount = layers.filter(l => l.direction === 'NEUTRAL').length

  let direction: SignalDirection | null = null
  let probability = 0

  if (bullishCount > bearishCount && bullishCount >= 3) {
    direction = 'BUY'
    probability = bullProb
  } else if (bearishCount > bullishCount && bearishCount >= 3) {
    direction = 'SELL'
    probability = bearProb
  }

  // Conflict penalty: if opposing layers exist, reduce confidence
  const opposingCount = direction === 'BUY' ? bearishCount : bullishCount
  if (opposingCount >= 2) probability = Math.max(0, probability - opposingCount * 5)

  // Consensus bonus: many layers agree
  const agreeCount = direction === 'BUY' ? bullishCount : bearishCount
  if (agreeCount >= 6) probability = Math.min(100, probability + 8)
  else if (agreeCount >= 5) probability = Math.min(100, probability + 5)

  // Too many neutrals = low conviction
  if (neutralCount >= 5) probability = Math.max(0, probability - 8)

  // Regime alignment bonus
  if (regime === 'TRENDING_UP' && direction === 'BUY') probability = Math.min(100, probability + 5)
  if (regime === 'TRENDING_DOWN' && direction === 'SELL') probability = Math.min(100, probability + 5)
  // Regime conflict penalty
  if (regime === 'TRENDING_UP' && direction === 'SELL') probability = Math.max(0, probability - 10)
  if (regime === 'TRENDING_DOWN' && direction === 'BUY') probability = Math.max(0, probability - 10)
  if (regime === 'HIGH_VOLATILITY') probability = Math.max(0, probability - 5)

  const label = probability >= 90 ? 'EXTREME OPPORTUNITY' :
    probability >= 85 ? 'INSTITUTIONAL SETUP' :
    probability >= 75 ? 'HIGH PROBABILITY' :
    probability >= 60 ? 'MODERATE' : 'LOW'

  return { probability, direction, label }
}

// ─── Signal Generation ───────────────────────────────────────────────────────

function getDynamicSLTP(regime: MarketRegime, probability: number): { slMult: number; tpMult: number } {
  if (regime === 'TRENDING_UP' || regime === 'TRENDING_DOWN') {
    if (probability >= 85) return { slMult: 1.2, tpMult: 4.0 }
    if (probability >= 75) return { slMult: 1.3, tpMult: 3.5 }
    return { slMult: 1.5, tpMult: 3.0 }
  }
  if (regime === 'RANGE_BOUND') {
    if (probability >= 85) return { slMult: 0.8, tpMult: 2.0 }
    return { slMult: 1.0, tpMult: 1.8 }
  }
  if (regime === 'HIGH_VOLATILITY') {
    return { slMult: 2.0, tpMult: 3.5 }
  }
  if (regime === 'LOW_VOLATILITY') {
    if (probability >= 80) return { slMult: 1.0, tpMult: 2.5 }
    return { slMult: 1.2, tpMult: 2.0 }
  }
  return { slMult: 1.5, tpMult: 3.0 }
}

function generateSignal(
  pair: string,
  price: number,
  direction: SignalDirection,
  probability: number,
  label: string,
  atrVal: number,
  regime: MarketRegime,
  layers: LayerResult[]
): QuantSignal {
  const { slMult, tpMult } = getDynamicSLTP(regime, probability)
  const sl = direction === 'BUY' ? price - slMult * atrVal : price + slMult * atrVal
  const tp = direction === 'BUY' ? price + tpMult * atrVal : price - tpMult * atrVal
  const rr = (tpMult / slMult).toFixed(1)

  return {
    id: `${pair}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    pair,
    direction,
    entry: price,
    stopLoss: sl,
    takeProfit: tp,
    probability,
    strengthLabel: label,
    regime,
    layers,
    timestamp: new Date().toISOString(),
    atr: atrVal,
    riskReward: `1:${rr}`
  }
}

// ─── Main Analysis Function ──────────────────────────────────────────────────

export function runQuantAnalysis(
  pair: string,
  candles: Candle[],
  orderBook: OrderBook,
  fundingRate: number,
  oiCurrent: number,
  oiPrevious: number,
  realOrderFlow?: RealOrderFlow
): QuantAnalysis {
  if (candles.length < 50) {
    const emptyAnalysis: QuantAnalysis = {
      pair,
      price: candles.length > 0 ? last(candles).close : 0,
      regime: 'RANGE_BOUND',
      regimeDetail: 'Insufficient data',
      layers: [],
      probability: 0,
      strengthLabel: 'LOW',
      signal: null,
      swingPoints: [],
      liquidityClusters: [],
      momentum: { ema9: 0, ema21: 0, rsi: 50, macdLine: 0, macdSignal: 0, macdHist: 0 },
      volatility: { atr: 0, bbUpper: 0, bbLower: 0, bbWidth: 0, squeeze: false },
      orderFlow: { buyVolume: 0, sellVolume: 0, delta: 0, dominance: 'NEUTRAL', volumeSpike: false },
      orderBook: { bidWall: 0, askWall: 0, imbalance: 0, imbalanceDirection: 'NEUTRAL' },
      openInterest: { current: 0, change: 0, changePct: 0, priceCorrelation: 'NEUTRAL' },
      fundingRate: { rate: 0, sentiment: 'NEUTRAL' },
      liquidations: { shortLiquidations: 0, longLiquidations: 0, netDirection: 'NEUTRAL' }
    }
    return emptyAnalysis
  }

  const price = last(candles).close
  const atrValues = atr(candles, 14)
  const atrVal = last(atrValues)
  const priceChange = ((last(candles).close - candles[candles.length - 10].close) / candles[candles.length - 10].close) * 100

  // Detect regime
  const { regime, detail: regimeDetail } = detectRegime(candles, atrValues)

  // Run all layers
  const swingPoints = detectSwingPoints(candles)
  const liquidityClusters = detectLiquidityClusters(candles)

  const structureLayer = analyzeStructure(swingPoints)
  const liquidityLayer = analyzeLiquidity(liquidityClusters, candles)
  const orderFlowLayer = analyzeOrderFlow(candles, realOrderFlow)
  const orderBookLayer = analyzeOrderBook(orderBook)
  const oiChangePct = oiPrevious > 0 ? ((oiCurrent - oiPrevious) / oiPrevious) * 100 : 0
  const liquidationLayer = analyzeLiquidations(candles, oiChangePct)
  const oiLayer = analyzeOpenInterest(oiCurrent, oiPrevious, priceChange)
  const fundingLayer = analyzeFundingRate(fundingRate)
  const momentumLayer = analyzeMomentum(candles)
  const volatilityLayer = analyzeVolatility(candles)

  const layers: LayerResult[] = [
    structureLayer,
    liquidityLayer,
    orderFlowLayer,
    momentumLayer,
    volatilityLayer,
    orderBookLayer,
    liquidationLayer,
    oiLayer,
    fundingLayer,
  ]

  // Compute probability
  const { probability, direction, label } = computeProbability(layers, regime)

  // Generate signal with quality filter
  let signal: QuantSignal | null = null
  const agreeingLayers = layers.filter(l =>
    (direction === 'BUY' && l.direction === 'BULLISH') ||
    (direction === 'SELL' && l.direction === 'BEARISH')
  ).length
  const opposingLayers = layers.filter(l =>
    (direction === 'BUY' && l.direction === 'BEARISH') ||
    (direction === 'SELL' && l.direction === 'BULLISH')
  ).length

  const passesFilter = probability >= 65
    && direction !== null
    && agreeingLayers >= 3
    && opposingLayers <= 2
    && !(regime === 'HIGH_VOLATILITY' && probability < 75)

  if (passesFilter) {
    signal = generateSignal(pair, price, direction!, probability, label, atrVal, regime, layers)
  }

  return {
    pair,
    price,
    regime,
    regimeDetail,
    layers,
    probability,
    strengthLabel: label,
    signal,
    swingPoints,
    liquidityClusters,
    momentum: {
      ema9: momentumLayer.ema9,
      ema21: momentumLayer.ema21,
      rsi: momentumLayer.rsiVal,
      macdLine: momentumLayer.macdLine,
      macdSignal: momentumLayer.macdSignal,
      macdHist: momentumLayer.macdHist,
    },
    volatility: {
      atr: volatilityLayer.atrVal,
      bbUpper: volatilityLayer.bbUpper,
      bbLower: volatilityLayer.bbLower,
      bbWidth: volatilityLayer.bbWidth,
      squeeze: volatilityLayer.squeeze,
    },
    orderFlow: {
      buyVolume: orderFlowLayer.buyVol,
      sellVolume: orderFlowLayer.sellVol,
      delta: orderFlowLayer.delta,
      dominance: orderFlowLayer.dominance,
      volumeSpike: orderFlowLayer.spike,
    },
    orderBook: {
      bidWall: orderBookLayer.bidWall,
      askWall: orderBookLayer.askWall,
      imbalance: orderBookLayer.imbalance,
      imbalanceDirection: orderBookLayer.imbalanceDir,
    },
    openInterest: {
      current: oiLayer.current,
      change: oiLayer.change,
      changePct: oiLayer.changePct,
      priceCorrelation: oiLayer.correlation,
    },
    fundingRate: {
      rate: fundingLayer.rate,
      sentiment: fundingLayer.sentiment,
    },
    liquidations: {
      shortLiquidations: liquidationLayer.shortLiq,
      longLiquidations: liquidationLayer.longLiq,
      netDirection: liquidationLayer.net,
    },
  }
}

// ─── Backtesting Engine ─────────────────────────────────────────────────────

export function backtestStrategy(
  pair: string,
  candles: Candle[],
  orderBook: OrderBook
): BacktestResult {
  const windowSize = 200
  const maxBarsToHold = 50
  const stepSize = 3
  const signals: BacktestSignalResult[] = []

  if (candles.length < windowSize + maxBarsToHold) {
    return { totalSignals: 0, wins: 0, losses: 0, winRate: 0, avgWinPct: 0, avgLossPct: 0, profitFactor: 0, expectancy: 0, maxConsecutiveLosses: 0, signals: [] }
  }

  for (let i = windowSize; i < candles.length - maxBarsToHold; i += stepSize) {
    const window = candles.slice(i - windowSize, i)
    const analysis = runQuantAnalysis(pair, window, orderBook, 0, 0, 0)

    if (!analysis.signal) continue

    const sig = analysis.signal
    const future = candles.slice(i, i + maxBarsToHold)

    let exitPrice = future[future.length - 1].close
    let result: 'WIN' | 'LOSS' = 'LOSS'
    let barsToExit = maxBarsToHold

    for (let j = 0; j < future.length; j++) {
      const bar = future[j]
      if (sig.direction === 'BUY') {
        if (bar.low <= sig.stopLoss) {
          exitPrice = sig.stopLoss
          result = 'LOSS'
          barsToExit = j + 1
          break
        }
        if (bar.high >= sig.takeProfit) {
          exitPrice = sig.takeProfit
          result = 'WIN'
          barsToExit = j + 1
          break
        }
      } else {
        if (bar.high >= sig.stopLoss) {
          exitPrice = sig.stopLoss
          result = 'LOSS'
          barsToExit = j + 1
          break
        }
        if (bar.low <= sig.takeProfit) {
          exitPrice = sig.takeProfit
          result = 'WIN'
          barsToExit = j + 1
          break
        }
      }
    }

    const pnlPct = sig.direction === 'BUY'
      ? ((exitPrice - sig.entry) / sig.entry) * 100
      : ((sig.entry - exitPrice) / sig.entry) * 100

    signals.push({
      index: i,
      direction: sig.direction,
      entry: sig.entry,
      stopLoss: sig.stopLoss,
      takeProfit: sig.takeProfit,
      probability: sig.probability,
      regime: sig.regime,
      exitPrice,
      result,
      pnlPct,
      barsToExit,
    })
  }

  const wins = signals.filter(s => s.result === 'WIN').length
  const losses = signals.filter(s => s.result === 'LOSS').length
  const totalSignals = signals.length
  const winRate = totalSignals > 0 ? (wins / totalSignals) * 100 : 0

  const winPnls = signals.filter(s => s.result === 'WIN').map(s => s.pnlPct)
  const lossPnls = signals.filter(s => s.result === 'LOSS').map(s => Math.abs(s.pnlPct))

  const avgWinPct = winPnls.length > 0 ? winPnls.reduce((a, b) => a + b, 0) / winPnls.length : 0
  const avgLossPct = lossPnls.length > 0 ? lossPnls.reduce((a, b) => a + b, 0) / lossPnls.length : 0

  const totalWinPct = winPnls.reduce((a, b) => a + b, 0)
  const totalLossPct = lossPnls.reduce((a, b) => a + b, 0)
  const profitFactor = totalLossPct > 0 ? totalWinPct / totalLossPct : totalWinPct > 0 ? 999 : 0

  const expectancy = totalSignals > 0
    ? (winRate / 100 * avgWinPct) - ((100 - winRate) / 100 * avgLossPct)
    : 0

  let maxConsecutiveLosses = 0, currentLosses = 0
  for (const s of signals) {
    if (s.result === 'LOSS') { currentLosses++; maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLosses) }
    else currentLosses = 0
  }

  return { totalSignals, wins, losses, winRate, avgWinPct, avgLossPct, profitFactor, expectancy, maxConsecutiveLosses, signals }
}
