// ============================================
// High-Frequency Correlation Scalping Engine
// BTC leads → Altcoins lag → Exploit the gap (HF Mode)
// ============================================

import { OHLCV, parseKlines, calcATR, calcEMA, latestRSI, latestMACD } from './indicators'

// ─── Configuration (HF Mode — aggressive) ──────────────────────────────────────

export const CORRELATION_TARGETS: TargetConfig[] = [
  { symbol: 'ETHUSDT', label: 'ETH', beta: 1.1, minLag: 0.05, source: 'binance' },
  { symbol: 'SOLUSDT', label: 'SOL', beta: 1.8, minLag: 0.08, source: 'binance' },
  { symbol: 'BNBUSDT', label: 'BNB', beta: 0.8, minLag: 0.04, source: 'binance' },
  { symbol: 'XRPUSDT', label: 'XRP', beta: 1.3, minLag: 0.06, source: 'binance' },
  { symbol: 'ADAUSDT', label: 'ADA', beta: 1.4, minLag: 0.07, source: 'binance' },
]

const BTC_EVENT_THRESHOLDS = {
  '5s': 0.03,
  '10s': 0.04,
  '30s': 0.05,
  '1m': 0.08,
  '3m': 0.15,
  '5m': 0.25,
}

const MIN_CORRELATION = 0.25
const SIGNAL_COOLDOWN_MS = 15 * 1000  // 15 seconds
const MAX_OPEN_TRADES_PER_SYMBOL = 3
const MAX_TOTAL_TRADES = 15
const TRADE_TIMEOUT_MS = 2 * 60 * 1000  // 2 minutes

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface TargetConfig {
  symbol: string
  label: string
  beta: number
  minLag: number
  source: 'binance' | 'fastforex' | 'twelvedata'
}

export interface PriceSnapshot {
  price: number
  timestamp: number
}

export interface OrderBookImbalance {
  bidVolume: number
  askVolume: number
  ratio: number
  direction: 'BUY' | 'SELL' | 'NEUTRAL'
  strength: number
}

export interface BTCState {
  currentPrice: number
  changes: {
    '5s': number
    '10s': number
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
  orderBookAligned: boolean
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
  change5s: number
  change10s: number
  correlation: number
  lagScore: number
  lagDetected: boolean
  opportunity: LagOpportunity | null
  atr: number
  rsi: number | null
  orderBook: OrderBookImbalance | null
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
const MAX_HISTORY_LENGTH = 1200 // ~10 min at 500ms intervals

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

export function calculateCorrelation(seriesA: number[], seriesB: number[]): number {
  const n = Math.min(seriesA.length, seriesB.length)
  if (n < 10) return 0

  const a = seriesA.slice(-n)
  const b = seriesB.slice(-n)

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

// ─── Order Book Analysis ───────────────────────────────────────────────────────

export function analyzeOrderBook(depthData: { bids: [string, string][], asks: [string, string][] } | null): OrderBookImbalance | null {
  if (!depthData || !depthData.bids || !depthData.asks) return null

  const topLevels = 10
  let bidVol = 0
  let askVol = 0

  for (let i = 0; i < Math.min(topLevels, depthData.bids.length); i++) {
    bidVol += parseFloat(depthData.bids[i][1])
  }
  for (let i = 0; i < Math.min(topLevels, depthData.asks.length); i++) {
    askVol += parseFloat(depthData.asks[i][1])
  }

  const total = bidVol + askVol
  if (total === 0) return null

  const ratio = bidVol / (askVol || 1)
  let direction: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL'
  let strength = 0

  if (ratio > 1.3) {
    direction = 'BUY'
    strength = Math.min(100, (ratio - 1) * 50)
  } else if (ratio < 0.7) {
    direction = 'SELL'
    strength = Math.min(100, (1 / ratio - 1) * 50)
  }

  return { bidVolume: bidVol, askVolume: askVol, ratio, direction, strength }
}

// ─── BTC Monitor ───────────────────────────────────────────────────────────────

export function analyzeBTC(currentPrice: number): BTCState {
  addPriceSnapshot(btcPriceHistory, currentPrice)

  const changes = {
    '5s': getChangePercent(btcPriceHistory, 5),
    '10s': getChangePercent(btcPriceHistory, 10),
    '30s': getChangePercent(btcPriceHistory, 30),
    '1m': getChangePercent(btcPriceHistory, 60),
    '3m': getChangePercent(btcPriceHistory, 180),
    '5m': getChangePercent(btcPriceHistory, 300),
  }

  const momentum = changes['10s'] * 6 // normalize 10s to per-minute rate

  let acceleration = 0
  if (btcPriceHistory.length > 10) {
    const prevMomentum = getChangePercent(btcPriceHistory.slice(0, -3), 10) * 6
    acceleration = momentum - prevMomentum
  }

  let direction: BTCState['direction'] = 'NEUTRAL'
  if (changes['10s'] > 0.06 || (changes['30s'] > 0.1 && changes['5s'] > 0.02)) direction = 'STRONG_BULLISH'
  else if (changes['10s'] > 0.02 || changes['30s'] > 0.04) direction = 'BULLISH'
  else if (changes['10s'] < -0.06 || (changes['30s'] < -0.1 && changes['5s'] < -0.02)) direction = 'STRONG_BEARISH'
  else if (changes['10s'] < -0.02 || changes['30s'] < -0.04) direction = 'BEARISH'

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
    priceHistory: btcPriceHistory.slice(-120),
  }
}

// ─── Lag Detection (HF — immediate entry) ──────────────────────────────────────

export function detectLag(
  btcState: BTCState,
  target: TargetConfig,
  targetPrice: number,
  targetKlines: OHLCV[],
  btcKlines: OHLCV[],
  orderBook: OrderBookImbalance | null
): LagOpportunity | null {
  if (!btcState.isEvent) return null

  if (!targetPriceHistories[target.symbol]) {
    targetPriceHistories[target.symbol] = []
  }
  addPriceSnapshot(targetPriceHistories[target.symbol], targetPrice)

  const targetHistory = targetPriceHistories[target.symbol]

  // Use shortest meaningful window for HF
  const targetChange10s = getChangePercent(targetHistory, 10)
  const targetChange30s = getChangePercent(targetHistory, 30)
  const targetChange1m = getChangePercent(targetHistory, 60)

  // Pick the BTC window that triggered the event
  let btcChange = btcState.changes['10s']
  let targetChange = targetChange10s
  if (Math.abs(btcState.changes['30s']) > Math.abs(btcState.changes['10s']) * 1.3) {
    btcChange = btcState.changes['30s']
    targetChange = targetChange30s
  }
  if (Math.abs(btcState.changes['1m']) > Math.abs(btcState.changes['30s']) * 1.5) {
    btcChange = btcState.changes['1m']
    targetChange = targetChange1m
  }

  const btcCloses = btcKlines.map(k => k.close)
  const targetCloses = targetKlines.map(k => k.close)
  const correlation = calculateCorrelation(btcCloses, targetCloses)

  if (correlation < MIN_CORRELATION) return null

  const expectedTargetChange = btcChange * correlation * target.beta
  const lagGap = Math.abs(expectedTargetChange) - Math.abs(targetChange)
  const lagScore = lagGap

  if (lagScore < target.minLag) return null

  const direction: 'BUY' | 'SELL' = btcChange > 0 ? 'BUY' : 'SELL'

  // Softer counter-move filter for HF
  if (direction === 'BUY' && targetChange < -0.5) return null
  if (direction === 'SELL' && targetChange > 0.5) return null

  // Order book alignment check
  let orderBookAligned = false
  if (orderBook && orderBook.direction !== 'NEUTRAL') {
    orderBookAligned = orderBook.direction === direction
  }

  let confidence = 35
  confidence += Math.min(20, lagScore * 100)
  confidence += Math.min(10, correlation * 12)
  confidence += Math.min(10, btcState.eventStrength / 10)
  if (orderBookAligned) confidence += 10
  if (btcState.direction === 'STRONG_BULLISH' || btcState.direction === 'STRONG_BEARISH') confidence += 5
  confidence = Math.min(95, Math.round(confidence))

  const reason = [
    `BTC ${btcChange > 0 ? '+' : ''}${btcChange.toFixed(3)}%`,
    `${target.label} ${targetChange > 0 ? '+' : ''}${targetChange.toFixed(3)}%`,
    `Lag: ${lagScore.toFixed(3)}%`,
    `Corr: ${correlation.toFixed(2)}`,
    orderBookAligned ? 'OB aligned' : '',
  ].filter(Boolean).join(' | ')

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
    microPullbackDetected: false, // disabled for HF
    orderBookAligned,
    reason,
  }
}

// ─── Signal Generation (HF — no RSI, no pullback wait) ─────────────────────────

export function generateCorrelationSignal(
  lag: LagOpportunity,
  targetPrice: number,
  targetKlines: OHLCV[],
  btcState: BTCState
): CorrelationSignal | null {
  const now = Date.now()
  const lastTime = lastSignalTime[lag.symbol] || 0
  if (now - lastTime < SIGNAL_COOLDOWN_MS) return null

  if (lag.confidence < 40) return null

  // RSI filter DISABLED for HF mode

  const atr = calcATR(targetKlines) || targetPrice * 0.005

  // Tight scalping SL/TP for HF
  const slMultiplier = 0.8
  const tpMultiplier = lag.orderBookAligned ? 1.2 : 1.0

  let stopLoss: number
  let takeProfit: number

  if (lag.direction === 'BUY') {
    stopLoss = targetPrice - atr * slMultiplier
    takeProfit = targetPrice + atr * tpMultiplier
  } else {
    stopLoss = targetPrice + atr * slMultiplier
    takeProfit = targetPrice - atr * tpMultiplier
  }

  // Min SL distance: 0.08% for HF
  const minSLDist = targetPrice * 0.0008
  if (Math.abs(targetPrice - stopLoss) < minSLDist) {
    stopLoss = lag.direction === 'BUY'
      ? targetPrice - minSLDist
      : targetPrice + minSLDist
  }

  const risk = Math.abs(targetPrice - stopLoss)
  const reward = Math.abs(takeProfit - targetPrice)
  const riskReward = risk > 0 ? reward / risk : 0

  if (riskReward < 0.8) return null // lower R:R threshold for HF

  lastSignalTime[lag.symbol] = now

  return {
    id: `hf_${now}_${Math.random().toString(36).substr(2, 6)}`,
    symbol: lag.symbol,
    label: lag.label,
    action: lag.direction,
    entry: targetPrice,
    stopLoss: Math.round(stopLoss * 100) / 100,
    takeProfit: Math.round(takeProfit * 100) / 100,
    confidence: lag.confidence,
    lagScore: lag.lagScore,
    btcChange: lag.btcChange,
    btcDirection: btcState.direction,
    correlation: lag.correlation,
    reason: lag.reason,
    timestamp: now,
    riskReward: Math.round(riskReward * 100) / 100,
  }
}

// ─── Trade Management (HF — multiple entries allowed) ──────────────────────────

export function openTrade(signal: CorrelationSignal): ActiveTrade | null {
  const symbolTrades = activeTrades.filter(
    t => t.signal.symbol === signal.symbol && t.status === 'OPEN'
  )
  if (symbolTrades.length >= MAX_OPEN_TRADES_PER_SYMBOL) return null

  const openTrades = activeTrades.filter(t => t.status === 'OPEN')
  if (openTrades.length >= MAX_TOTAL_TRADES) return null

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
  while (activeTrades.length > 200) activeTrades.shift()

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

// ─── Emergency Exit (HF — faster) ──────────────────────────────────────────────

export function checkEmergencyExit(
  btcState: BTCState,
  trade: ActiveTrade
): EmergencyExitReason {
  if (trade.signal.action === 'BUY') {
    if (btcState.changes['10s'] < -0.08 && (btcState.direction === 'STRONG_BEARISH' || btcState.direction === 'BEARISH')) {
      return { shouldExit: true, reason: 'انعكاس BTC سريع (هبوط)' }
    }
  } else {
    if (btcState.changes['10s'] > 0.08 && (btcState.direction === 'STRONG_BULLISH' || btcState.direction === 'BULLISH')) {
      return { shouldExit: true, reason: 'انعكاس BTC سريع (صعود)' }
    }
  }

  // Target caught up — take profit early
  const targetHistory = targetPriceHistories[trade.signal.symbol]
  if (targetHistory && targetHistory.length > 5) {
    const targetChange10s = getChangePercent(targetHistory, 10)
    const isTargetCaughtUp = Math.abs(targetChange10s) > Math.abs(trade.signal.btcChange) * 0.6
    if (isTargetCaughtUp && trade.pnl > 0) {
      return { shouldExit: true, reason: 'العملة لحقت — تأمين الربح' }
    }
  }

  // Time stop: 2 minutes for HF
  const tradeAge = Date.now() - trade.openedAt
  if (tradeAge > TRADE_TIMEOUT_MS && Math.abs(trade.pnlPercent) < 0.02) {
    return { shouldExit: true, reason: 'انتهى الوقت — 2 دقيقة بدون حركة' }
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
    depth?: { bids: [string, string][], asks: [string, string][] } | null
  }>,
  currentPrices: Record<string, number>
): CorrelationAnalysis {
  const btcState = analyzeBTC(btcPrice)

  updateTrades(currentPrices)

  for (const trade of activeTrades.filter(t => t.status === 'OPEN')) {
    const exitCheck = checkEmergencyExit(btcState, trade)
    if (exitCheck.shouldExit) {
      emergencyCloseTrade(trade.id, exitCheck.reason)
    }
  }

  const targets: TargetAnalysis[] = []
  const signals: CorrelationSignal[] = []

  for (const td of targetData) {
    if (!targetPriceHistories[td.config.symbol]) {
      targetPriceHistories[td.config.symbol] = []
    }
    addPriceSnapshot(targetPriceHistories[td.config.symbol], td.price)

    const targetHistory = targetPriceHistories[td.config.symbol]
    const change1m = getChangePercent(targetHistory, 60)
    const change5m = getChangePercent(targetHistory, 300)
    const change5s = getChangePercent(targetHistory, 5)
    const change10s = getChangePercent(targetHistory, 10)

    const btcCloses = btcKlines.map(k => k.close)
    const targetCloses = td.klines.map(k => k.close)
    const correlation = calculateCorrelation(btcCloses, targetCloses)

    const atr = calcATR(td.klines) || td.price * 0.005
    const rsi = latestRSI(targetCloses)

    const orderBook = analyzeOrderBook(td.depth || null)

    const lag = detectLag(btcState, td.config, td.price, td.klines, btcKlines, orderBook)

    const lagScore = lag ? lag.lagScore : 0
    const lagDetected = lag !== null

    const analysis: TargetAnalysis = {
      symbol: td.config.symbol,
      label: td.config.label,
      currentPrice: td.price,
      change1m,
      change5m,
      change5s,
      change10s,
      correlation,
      lagScore,
      lagDetected,
      opportunity: lag,
      atr,
      rsi,
      orderBook,
    }
    targets.push(analysis)

    if (lag && lag.confidence >= 40) {
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
    activeTrades: [...activeTrades].reverse().slice(0, 100),
    timestamp: Date.now(),
  }
}

export function getActiveTrades(): ActiveTrade[] {
  return activeTrades.filter(t => t.status === 'OPEN')
}

export function getAllTrades(): ActiveTrade[] {
  return [...activeTrades].reverse()
}

export function resetState() {
  btcPriceHistory.length = 0
  Object.keys(targetPriceHistories).forEach(k => delete targetPriceHistories[k])
  Object.keys(lastSignalTime).forEach(k => delete lastSignalTime[k])
  activeTrades.length = 0
}
