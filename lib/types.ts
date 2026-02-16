// ============================================
// Trading Signals - Type Definitions
// ============================================

export type Direction = 'LONG' | 'SHORT'
export type SignalStatus = 'ACTIVE' | 'TP_HIT' | 'SL_HIT' | 'EXPIRED'
export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w'
export type Outlook = 'BULLISH' | 'BEARISH' | 'NEUTRAL'
export type MarketStatus = 'OPEN' | 'CLOSED'

export interface Signal {
  id: string
  symbol: string
  exchange: string
  direction: Direction
  entry: number
  sl: number
  tp1: number
  tp2: number
  tp3: number
  timeframe: Timeframe
  confidence: number
  status: SignalStatus
  timestamp: string
  indicators: SignalIndicators
  analysis: string
}

export interface SignalIndicators {
  rsi: number
  macd: {
    line: number
    signal: number
    histogram: number
    trend: string
  }
  ema: {
    ema20: number
    ema50: number
    ema200: number | null
    position: string
  }
  bbPosition: number
  atr: number
}

export interface KFOOSignal {
  id: string
  symbol: string
  price: number
  signal: 'BUY' | 'SELL' | 'NEUTRAL'
  reason: string
  reasons: string[]
  buyScore: number
  sellScore: number
  confidence: number
  indicators: {
    rsi: number
    rsiStatus: string
    ema20: number
    ema50: number
    ema200: number | null
    macdLine: number
    macdSignal: number
    macdHistogram: number
    macdTrend: string
  }
  volume: {
    current: number
    average: number
    spike: boolean
  }
  smartMoney: {
    bos: string
  }
  support: number[]
  resistance: number[]
  entry: number
  stopLoss: number
  target1: number
  target2: number
  riskReward: number
  timestamp: string
}

export interface MarketSession {
  name: string
  region: string
  city: string
  opens: number
  closes: number
}

export interface MarketPrice {
  symbol: string
  price: number
  change: number
  high: number
  low: number
  volume: number
}

export interface DailyRecommendation {
  id: string
  symbol: string
  exchange: string
  analysis: string
  entry: number
  sl: number
  tp: number
  timeframe: '1d'
  outlook: Outlook
  keyLevels: {
    support: number[]
    resistance: number[]
  }
  indicators: {
    rsi: number
    macd: string
    ema: string
  }
  riskReward: number
  status: 'ACTIVE' | 'CLOSED'
  timestamp: string
}

export interface WeeklyRecommendation {
  symbol: string
  exchange: string
  outlook: Outlook
  summary: string
  keyLevels: {
    support: number[]
    resistance: number[]
  }
  prediction: {
    high: number
    low: number
    likely: number
  }
  indicators: {
    trend: string
    strength: string
    rsi: number
  }
  sentiment: string
}

export interface PricingPlan {
  name: string
  nameEn: string
  price: number
  period: string
  description: string
  features: string[]
  notIncluded: string[]
  cta: string
  popular: boolean
}
