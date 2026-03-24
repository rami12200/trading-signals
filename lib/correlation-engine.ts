// ============================================
// Smart Correlation Scalping Engine
// BTC leads → Altcoins/Gold lag → Exploit the gap
// ============================================

import { OHLCV, parseKlines, calcATR, calcEMA, latestRSI, latestMACD } from './indicators'

// ─── Configuration ─────────────────────────────────────────────────────────────

export const CORRELATION_TARGETS: TargetConfig[] = [
  { symbol: 'ETHUSDT', label: 'ETH', beta: 1.1, minLag: 0.15, source: 'binance' },
  { symbol: 'SOLUSDT', label: 'SOL', beta: 1.8, minLag: 0.20, source: 'binance' },
  { symbol: 'BNBUSDT', label: 'BNB', beta: 0.8, minLag: 0.12, source: 'binance' },
  { symbol: 'XRPUSDT', label: 'XRP', beta: 1.3, minLag: 0.18, source: 'binance' },
  { symbol: 'ADAUSDT', label: 'ADA', beta: 1.4, minLag: 0.20, source: 'binance' },
]

const BTC_EVENT_THRESHOLDS = {
  '30s': 0.15,
  '1m': 0.25,
  '3m': 0.40,
  '5m': 0.60,
}

const MIN_CORRELATION = 0.45
const SIGNAL_COOLDOWN_MS = 5 * 60 * 1000
const MAX_OPEN_TRADES_PER_SYMBOL = 1
const MAX_TOTAL_TRADES = 5

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface TargetConfig {
  symbol: string
  label: string
  beta: number      // expected move multiplier relative to BTC
  minLag: number    // minimum lag % to trigger opportunity
  source: 'binance' | 'fastforex' | 'twelvedata'
}

export interface PriceSnapshot {
  price: number
  timestamp: number
}

export interface BTCState {
  currentPrice: number
  changes: {
    '30s': number
    '1m': number
    '3m': number
    '5m': number
  }
  momentum: number
  acceleration: number
  direction: 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG_BEARISH'
  isEvent: boolean
  eventStrength: number
  priceHistory: PriceSnapshot[]
}

export interface LagOpportunity {
  symbol: string
  label: string
  lagScore: number
  btcChange: number
  targetChange: number
  expectedTargetChange: number
  correlation: number
  direction: 'BUY' | 'SELL'
  confidence: number
  microPullbackDetected: boolean
  reason: string
}

export interface CorrelationSignal {
  id: string
  symbol: string
  label: string
  action: 'BUY' | 'SELL'
  entry: number
  stopLoss: number
  takeProfit: number
  confidence: number
  lagScore: number
  btcChange: number
  btcDirection: string
  correlation: number
  reason: string
  timestamp: number
  riskReward: number
}

export interface ActiveTrade {
  id: string
  signal: CorrelationSignal
  openPrice: number
  currentPrice: number
  pnl: number
  pnlPercent: number
  status: 'OPEN' | 'TP_HIT' | 'SL_HIT' | 'EMERGENCY_CLOSE' | 'MANUAL_CLOSE'
  openedAt: number
}

export interface EmergencyExitReason {
  shouldExit: boolean
  reason: string
}

export interface TargetAnalysis {
  symbol: string
  label: string
  currentPrice: number
  change1m: number
  change5m: number
  correlation: number
  lagScore: number
  lagDetected: boolean
  opportunity: LagOpportunity | null
  atr: number
  rsi: number | null
}

export interface CorrelationAnalysis {
  btc: BTCState
  targets: TargetAnalysis[]
  signals: CorrelationSignal[]
  activeTrades: ActiveTrade[]
  timestamp: number
}

// ─── In-memory State ───────────────────────────────────────────────────────────

const btcPriceHistory: PriceSnapshot[] = []
const targetPriceHistories: Record<string, PriceSnapshot[]> = {}
const lastSignalTime: Record<string, number> = {}
const activeTrades: ActiveTrade[] = []
const MAX_HISTORY_LENGTH = 600 // 10 minutes at 1-second intervals

// ─── Core Functions ────────────────────────────────────────────────────────────

function addPriceSnapshot(history: PriceSnapshot[], price: number, maxLen = MAX_HISTORY_LENGTH) {
  history.push({ price, timestamp: Date.now() })
  while (history.length > maxLen) history.shift()
}

function getChangePercent(history: PriceSnapshot[], secondsBack: number): number {
  if (history.length < 2) return 0
  const now = Date.now()
  const cutoff = now - secondsBack * 1000
  const oldEntry = history.find(p => p.timestamp >= cutoff) || history[0]
  const current = history[history.length - 1]
  if (!oldEntry || oldEntry.price === 0) return 0
  return ((current.price - oldEntry.price) / oldEntry.price) * 100
}

/**
 * Pearson correlation coefficient between two price series.
 * Returns value between -1 and 1.
 */
export function calculateCorrelation(seriesA: number[], seriesB: number[]): number {
  const n = Math.min(seriesA.length, seriesB.length)
  if (n < 10) return 0

  const a = seriesA.slice(-n)
  const b = seriesB.slice(-n)

  // Use returns (% changes) instead of raw prices for correlation
  const returnsA: number[] = []
  const returnsB: number[] = []
  for (let i = 1; i < n; i++) {
    if (a[i - 1] !== 0 && b[i - 1] !== 0) {
      returnsA.push((a[i] - a[i - 1]) / a[i - 1])
      returnsB.push((b[i] - b[i - 1]) / b[i - 1])
    }
  }

  if (returnsA.length < 5) return 0

  const meanA = returnsA.reduce((s, v) => s + v, 0) / returnsA.length
  const meanB = returnsB.reduce((s, v) => s + v, 0) / returnsB.length

  let covAB = 0, varA = 0, varB = 0
  for (let i = 0; i < returnsA.length; i++) {
    const dA = returnsA[i] - meanA
    const dB = returnsB[i] - meanB
    covAB += dA * dB
    varA += dA * dA
    varB += dB * dB
  }

  const denom = Math.sqrt(varA * varB)
  if (denom === 0) return 0
  return covAB / denom
}

// ─── BTC Monitor ───────────────────────────────────────────────────────────────

export function analyzeBTC(currentPrice: number): BTCState {
  addPriceSnapshot(btcPriceHistory, currentPrice)

  const changes = {
    '30s': getChangePercent(btcPriceHistory, 30),
    '1m': getChangePercent(btcPriceHistory, 60),
    '3m': getChangePercent(btcPriceHistory, 180),
    '5m': getChangePercent(btcPriceHistory, 300),
  }

  // Momentum = rate of change (1m change speed)
  const momentum = changes['1m']

  // Acceleration = change in momentum
  let acceleration = 0
  if (btcPriceHistory.length > 10) {
    const prevMomentum = getChangePercent(
      btcPriceHistory.slice(0, -5), 60
    )
    acceleration = momentum - prevMomentum
  }

  // Direction classification
  let direction: BTCState['direction'] = 'NEUTRAL'
  if (changes['1m'] > 0.4 && changes['3m'] > 0.6) direction = 'STRONG_BULLISH'
  else if (changes['1m'] > 0.15) direction = 'BULLISH'
  else if (changes['1m'] < -0.4 && changes['3m'] < -0.6) direction = 'STRONG_BEARISH'
  else if (changes['1m'] < -0.15) direction = 'BEARISH'

  // Event detection: BTC moved significantly in a short time
  let isEvent = false
  let eventStrength = 0

  for (const [period, threshold] of Object.entries(BTC_EVENT_THRESHOLDS)) {
    const key = period as keyof typeof changes
    const absChange = Math.abs(changes[key])
    if (absChange >= threshold) {
      isEvent = true
      const strength = (absChange / threshold) * 25
      eventStrength = Math.max(eventStrength, Math.min(100, strength))
    }
  }

  return {
    currentPrice,
    changes,
    momentum,
    acceleration,
    direction,
    isEvent,
    eventStrength,
    priceHistory: btcPriceHistory.slice(-60),
  }
}

// ─── Lag Detection ─────────────────────────────────────────────────────────────

export function detectLag(
  btcState: BTCState,
  target: TargetConfig,
  targetPrice: number,
  targetKlines: OHLCV[],
  btcKlines: OHLCV[]
): LagOpportunity | null {
  if (!btcState.isEvent) return null

  // Initialize target price history
  if (!targetPriceHistories[target.symbol]) {
    targetPriceHistories[target.symbol] = []
  }
  addPriceSnapshot(targetPriceHistories[target.symbol], targetPrice)

  const targetHistory = targetPriceHistories[target.symbol]

  // Calculate target's change over same periods
  const targetChange1m = getChangePercent(targetHistory, 60)
  const targetChange3m = getChangePercent(targetHistory, 180)

  // Use the BTC change from the period with strongest event
  let btcChange = btcState.changes['1m']
  let targetChange = targetChange1m
  if (Math.abs(btcState.changes['3m']) > Math.abs(btcState.changes['1m']) * 1.5) {
    btcChange = btcState.changes['3m']
    targetChange = targetChange3m
  }

  // Calculate rolling correlation from klines
  const btcCloses = btcKlines.map(k => k.close)
  const targetCloses = targetKlines.map(k => k.close)
  const correlation = calculateCorrelation(btcCloses, targetCloses)

  if (correlation < MIN_CORRELATION) return null

  // Expected target move based on BTC move, correlation, and beta
  const expectedTargetChange = btcChange * correlation * target.beta

  // Lag score: how much the target is behind its expected move
  const lagGap = Math.abs(expectedTargetChange) - Math.abs(targetChange)
  const lagScore = lagGap

  if (lagScore < target.minLag) return null

  // Direction: follow BTC's direction
  const direction: 'BUY' | 'SELL' = btcChange > 0 ? 'BUY' : 'SELL'

  // Verify target isn't already moving in wrong direction
  if (direction === 'BUY' && targetChange < -0.3) return null
  if (direction === 'SELL' && targetChange > 0.3) return null

  // Micro pullback detection: small retracement in the entry direction
  let microPullbackDetected = false
  if (targetHistory.length >= 10) {
    const last10 = targetHistory.slice(-10)
    const recentHigh = Math.max(...last10.map(p => p.price))
    const recentLow = Math.min(...last10.map(p => p.price))
    const currentTargetPrice = targetHistory[targetHistory.length - 1].price

    if (direction === 'BUY') {
      // Price pulled back slightly from recent high
      const pullback = (recentHigh - currentTargetPrice) / recentHigh * 100
      microPullbackDetected = pullback > 0.03 && pullback < 0.3
    } else {
      const pullback = (currentTargetPrice - recentLow) / recentLow * 100
      microPullbackDetected = pullback > 0.03 && pullback < 0.3
    }
  }

  // Confidence calculation
  let confidence = 40
  confidence += Math.min(20, lagScore * 40)
  confidence += Math.min(15, correlation * 15)
  confidence += Math.min(10, btcState.eventStrength / 10)
  if (microPullbackDetected) confidence += 10
  if (btcState.direction === 'STRONG_BULLISH' || btcState.direction === 'STRONG_BEARISH') confidence += 5
  confidence = Math.min(95, Math.round(confidence))

  const reason = [
    `BTC ${btcChange > 0 ? '+' : ''}${btcChange.toFixed(2)}%`,
    `${target.label} ${targetChange > 0 ? '+' : ''}${targetChange.toFixed(2)}% (expected ${expectedTargetChange > 0 ? '+' : ''}${expectedTargetChange.toFixed(2)}%)`,
    `Lag: ${lagScore.toFixed(2)}%`,
    `Correlation: ${correlation.toFixed(2)}`,
    microPullbackDetected ? 'Micro pullback confirmed' : 'Waiting for pullback',
  ].join(' | ')

  return {
    symbol: target.symbol,
    label: target.label,
    lagScore,
    btcChange,
    targetChange,
    expectedTargetChange,
    correlation,
    direction,
    confidence,
    microPullbackDetected,
    reason,
  }
}

// ─── Signal Generation ─────────────────────────────────────────────────────────

export function generateCorrelationSignal(
  lag: LagOpportunity,
  targetPrice: number,
  targetKlines: OHLCV[],
  btcState: BTCState
): CorrelationSignal | null {
  // Cooldown check
  const now = Date.now()
  const lastTime = lastSignalTime[lag.symbol] || 0
  if (now - lastTime < SIGNAL_COOLDOWN_MS) return null

  // Must have reasonable confidence
  if (lag.confidence < 55) return null

  // RSI filter: don't buy overbought or sell oversold
  const closes = targetKlines.map(k => k.close)
  const rsi = latestRSI(closes)
  if (rsi !== null) {
    if (lag.direction === 'BUY' && rsi > 75) return null
    if (lag.direction === 'SELL' && rsi < 25) return null
  }

  // MACD confirmation (bonus, not required)
  const macd = latestMACD(closes)
  let macdAligned = false
  if (macd) {
    macdAligned = (lag.direction === 'BUY' && macd.histogram > 0) ||
                  (lag.direction === 'SELL' && macd.histogram < 0)
  }

  // ATR for SL/TP calculation
  const atr = calcATR(targetKlines) || targetPrice * 0.005

  // Scalping SL/TP: tight but reasonable
  const slMultiplier = 1.2
  const tpMultiplier = macdAligned ? 2.0 : 1.5

  let stopLoss: number
  let takeProfit: number

  if (lag.direction === 'BUY') {
    stopLoss = targetPrice - atr * slMultiplier
    takeProfit = targetPrice + atr * tpMultiplier
  } else {
    stopLoss = targetPrice + atr * slMultiplier
    takeProfit = targetPrice - atr * tpMultiplier
  }

  // Minimum SL distance: 0.15% of entry price
  const minSLDist = targetPrice * 0.0015
  if (Math.abs(targetPrice - stopLoss) < minSLDist) {
    stopLoss = lag.direction === 'BUY'
      ? targetPrice - minSLDist
      : targetPrice + minSLDist
  }

  const risk = Math.abs(targetPrice - stopLoss)
  const reward = Math.abs(takeProfit - targetPrice)
  const riskReward = risk > 0 ? reward / risk : 0

  if (riskReward < 1.2) return null

  // Apply MACD bonus to confidence
  let finalConfidence = lag.confidence
  if (macdAligned) finalConfidence = Math.min(95, finalConfidence + 5)

  lastSignalTime[lag.symbol] = now

  return {
    id: `corr_${now}_${Math.random().toString(36).substr(2, 6)}`,
    symbol: lag.symbol,
    label: lag.label,
    action: lag.direction,
    entry: targetPrice,
    stopLoss: Math.round(stopLoss * 100) / 100,
    takeProfit: Math.round(takeProfit * 100) / 100,
    confidence: finalConfidence,
    lagScore: lag.lagScore,
    btcChange: lag.btcChange,
    btcDirection: btcState.direction,
    correlation: lag.correlation,
    reason: lag.reason,
    timestamp: now,
    riskReward: Math.round(riskReward * 100) / 100,
  }
}

// ─── Trade Management ──────────────────────────────────────────────────────────

export function openTrade(signal: CorrelationSignal): ActiveTrade | null {
  // Check max trades per symbol
  const symbolTrades = activeTrades.filter(
    t => t.signal.symbol === signal.symbol && t.status === 'OPEN'
  )
  if (symbolTrades.length >= MAX_OPEN_TRADES_PER_SYMBOL) return null

  // Check max total trades
  const openTrades = activeTrades.filter(t => t.status === 'OPEN')
  if (openTrades.length >= MAX_TOTAL_TRADES) return null

  // Check no duplicate direction
  const sameDirTrade = symbolTrades.find(t => t.signal.action === signal.action)
  if (sameDirTrade) return null

  const trade: ActiveTrade = {
    id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    signal,
    openPrice: signal.entry,
    currentPrice: signal.entry,
    pnl: 0,
    pnlPercent: 0,
    status: 'OPEN',
    openedAt: Date.now(),
  }

  activeTrades.push(trade)

  // Keep only last 100 trades in memory
  while (activeTrades.length > 100) activeTrades.shift()

  return trade
}

export function updateTrades(prices: Record<string, number>): ActiveTrade[] {
  const updatedTrades: ActiveTrade[] = []

  for (const trade of activeTrades) {
    if (trade.status !== 'OPEN') continue

    const currentPrice = prices[trade.signal.symbol]
    if (!currentPrice) continue

    trade.currentPrice = currentPrice

    if (trade.signal.action === 'BUY') {
      trade.pnl = currentPrice - trade.openPrice
      trade.pnlPercent = (trade.pnl / trade.openPrice) * 100
      if (currentPrice >= trade.signal.takeProfit) trade.status = 'TP_HIT'
      if (currentPrice <= trade.signal.stopLoss) trade.status = 'SL_HIT'
    } else {
      trade.pnl = trade.openPrice - currentPrice
      trade.pnlPercent = (trade.pnl / trade.openPrice) * 100
      if (currentPrice <= trade.signal.takeProfit) trade.status = 'TP_HIT'
      if (currentPrice >= trade.signal.stopLoss) trade.status = 'SL_HIT'
    }

    updatedTrades.push(trade)
  }

  return updatedTrades
}

// ─── Emergency Exit ────────────────────────────────────────────────────────────

export function checkEmergencyExit(
  btcState: BTCState,
  trade: ActiveTrade
): EmergencyExitReason {
  // BTC reversed strongly against our trade direction
  if (trade.signal.action === 'BUY') {
    if (btcState.changes['1m'] < -0.3 && btcState.direction === 'STRONG_BEARISH') {
      return { shouldExit: true, reason: 'BTC reversed strongly (bearish)' }
    }
  } else {
    if (btcState.changes['1m'] > 0.3 && btcState.direction === 'STRONG_BULLISH') {
      return { shouldExit: true, reason: 'BTC reversed strongly (bullish)' }
    }
  }

  // Lag disappeared: target caught up and moved past expected
  const targetHistory = targetPriceHistories[trade.signal.symbol]
  if (targetHistory && targetHistory.length > 5) {
    const targetChange1m = getChangePercent(targetHistory, 60)
    const isTargetCaughtUp = Math.abs(targetChange1m) > Math.abs(trade.signal.btcChange) * 0.8
    if (isTargetCaughtUp && trade.pnl > 0) {
      return { shouldExit: true, reason: 'Lag closed — target caught up (profit lock)' }
    }
  }

  // Time stop: 10 minutes without significant profit
  const tradeAge = Date.now() - trade.openedAt
  if (tradeAge > 10 * 60 * 1000 && Math.abs(trade.pnlPercent) < 0.05) {
    return { shouldExit: true, reason: 'Time stop — no significant move in 10 minutes' }
  }

  return { shouldExit: false, reason: '' }
}

export function emergencyCloseTrade(tradeId: string, reason: string): ActiveTrade | null {
  const trade = activeTrades.find(t => t.id === tradeId)
  if (!trade || trade.status !== 'OPEN') return null
  trade.status = 'EMERGENCY_CLOSE'
  return trade
}

export function manualCloseTrade(tradeId: string): ActiveTrade | null {
  const trade = activeTrades.find(t => t.id === tradeId)
  if (!trade || trade.status !== 'OPEN') return null
  trade.status = 'MANUAL_CLOSE'
  return trade
}

// ─── Main Analysis Function ────────────────────────────────────────────────────

export function runCorrelationAnalysis(
  btcPrice: number,
  btcKlines: OHLCV[],
  targetData: Array<{
    config: TargetConfig
    price: number
    klines: OHLCV[]
  }>,
  currentPrices: Record<string, number>
): CorrelationAnalysis {
  const btcState = analyzeBTC(btcPrice)

  // Update existing trades
  updateTrades(currentPrices)

  // Check emergency exits
  for (const trade of activeTrades.filter(t => t.status === 'OPEN')) {
    const exitCheck = checkEmergencyExit(btcState, trade)
    if (exitCheck.shouldExit) {
      emergencyCloseTrade(trade.id, exitCheck.reason)
    }
  }

  const targets: TargetAnalysis[] = []
  const signals: CorrelationSignal[] = []

  for (const td of targetData) {
    // Update target price history
    if (!targetPriceHistories[td.config.symbol]) {
      targetPriceHistories[td.config.symbol] = []
    }
    addPriceSnapshot(targetPriceHistories[td.config.symbol], td.price)

    const targetHistory = targetPriceHistories[td.config.symbol]
    const change1m = getChangePercent(targetHistory, 60)
    const change5m = getChangePercent(targetHistory, 300)

    const btcCloses = btcKlines.map(k => k.close)
    const targetCloses = td.klines.map(k => k.close)
    const correlation = calculateCorrelation(btcCloses, targetCloses)

    const atr = calcATR(td.klines) || td.price * 0.005
    const rsi = latestRSI(targetCloses)

    // Lag detection
    const lag = detectLag(btcState, td.config, td.price, td.klines, btcKlines)

    const lagScore = lag ? lag.lagScore : 0
    const lagDetected = lag !== null

    const analysis: TargetAnalysis = {
      symbol: td.config.symbol,
      label: td.config.label,
      currentPrice: td.price,
      change1m,
      change5m,
      correlation,
      lagScore,
      lagDetected,
      opportunity: lag,
      atr,
      rsi,
    }
    targets.push(analysis)

    // Generate signal if lag detected
    if (lag && lag.confidence >= 55) {
      const signal = generateCorrelationSignal(lag, td.price, td.klines, btcState)
      if (signal) {
        signals.push(signal)
      }
    }
  }

  return {
    btc: btcState,
    targets,
    signals,
    activeTrades: [...activeTrades].reverse().slice(0, 50),
    timestamp: Date.now(),
  }
}

// ─── Utility: Get active trades (read-only) ────────────────────────────────────

export function getActiveTrades(): ActiveTrade[] {
  return activeTrades.filter(t => t.status === 'OPEN')
}

export function getAllTrades(): ActiveTrade[] {
  return [...activeTrades].reverse()
}

// ─── Utility: Reset state (for testing) ────────────────────────────────────────

export function resetState() {
  btcPriceHistory.length = 0
  Object.keys(targetPriceHistories).forEach(k => delete targetPriceHistories[k])
  Object.keys(lastSignalTime).forEach(k => delete lastSignalTime[k])
  activeTrades.length = 0
}
