'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { ProtectedPage } from '@/components/ProtectedPage'
import { useAuth } from '@/components/AuthProvider'

// ─── Types ───────────────────────────────────────────────────────────────────

interface LayerResult {
  name: string
  score: number
  weight: number
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  detail: string
}

interface QuantSignal {
  id: string
  pair: string
  direction: 'BUY' | 'SELL'
  entry: number
  stopLoss: number
  takeProfit: number
  probability: number
  strengthLabel: string
  regime: string
  layers: LayerResult[]
  timestamp: string
  atr: number
  riskReward: string
}

interface QuantData {
  pair: string
  price: number
  regime: string
  regimeDetail: string
  layers: LayerResult[]
  probability: number
  strengthLabel: string
  signal: QuantSignal | null
  interval: string
  timestamp: string
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
    priceCorrelation: string
  }
  fundingRate: {
    rate: number
    sentiment: string
  }
  liquidations: {
    shortLiquidations: number
    longLiquidations: number
    netDirection: string
  }
}

interface SignalHistory {
  signal: QuantSignal
  currentPrice: number
  pnlPct: number
  result: 'ACTIVE' | 'WIN' | 'LOSS'
}

interface ExecutedTrade {
  id: string
  signalId: string
  pair: string
  direction: 'BUY' | 'SELL'
  entry: number
  stopLoss: number
  takeProfit: number
  currentPrice: number
  pnlPct: number
  probability: number
  regime: string
  openedAt: string
  status: 'OPEN' | 'TP_HIT' | 'SL_HIT' | 'MANUAL_CLOSE'
}

interface ClosedTrade {
  id: string
  pair: string
  direction: 'BUY' | 'SELL'
  entry: number
  exitPrice: number
  stopLoss: number
  takeProfit: number
  pnlPct: number
  probability: number
  result: 'WIN' | 'LOSS'
  openedAt: string
  closedAt: string
  closeReason: 'TP_HIT' | 'SL_HIT' | 'MANUAL_CLOSE'
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PAIRS = ['BTCUSDT', 'ETHUSDT']
const INTERVALS = ['1m', '5m', '15m']
const PAIR_LABELS: Record<string, string> = { BTCUSDT: 'BTC/USDT', ETHUSDT: 'ETH/USDT' }
const PAIR_ICONS: Record<string, string> = { BTCUSDT: '₿', ETHUSDT: 'Ξ' }
const INTERVAL_LABELS: Record<string, string> = { '1m': '1 دقيقة', '5m': '5 دقائق', '15m': '15 دقيقة' }
const REGIME_LABELS: Record<string, string> = {
  TRENDING_UP: '📈 سوق صاعد',
  TRENDING_DOWN: '📉 سوق هابط',
  RANGE_BOUND: '↔️ سوق متذبذب',
  HIGH_VOLATILITY: '⚡ تقلب عالي',
  LOW_VOLATILITY: '😴 تقلب منخفض',
}
const REGIME_COLORS: Record<string, string> = {
  TRENDING_UP: 'text-emerald-400',
  TRENDING_DOWN: 'text-red-400',
  RANGE_BOUND: 'text-yellow-400',
  HIGH_VOLATILITY: 'text-orange-400',
  LOW_VOLATILITY: 'text-blue-400',
}

const SCANNING_MESSAGES = [
  'تحليل مجمعات السيولة والبنية المجهرية للسوق...',
  'مسح هيكل السوق وكشف نقاط السوينج...',
  'تحليل تدفق الأوامر وضغط الحجم...',
  'فحص دفتر الأوامر والجدران الكبيرة...',
  'مراقبة التصفيات وتغيرات العقود المفتوحة...',
  'تحليل معدل التمويل ومشاعر السوق...',
  'حساب نسبة الاحتمالية بالذكاء الاصطناعي...',
  'كشف ضغط التقلبات ونقاط الاختراق...',
  'تأكيد الزخم عبر EMA و RSI و MACD...',
  'فحص أحداث مسح السيولة...',
]

const SIGNALS_STORAGE_KEY = 'quant_signal_history'
const TRADES_STORAGE_KEY = 'quant_active_trades'
const CLOSED_TRADES_KEY = 'quant_closed_trades'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(price: number, pair: string) {
  if (pair.includes('BTC')) return price.toFixed(2)
  return price.toFixed(2)
}

function formatLargeNumber(n: number) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toFixed(0)
}

function loadSignalHistory(): SignalHistory[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(SIGNALS_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveSignalHistory(history: SignalHistory[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(SIGNALS_STORAGE_KEY, JSON.stringify(history.slice(0, 100)))
}

function loadActiveTrades(): ExecutedTrade[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(TRADES_STORAGE_KEY)
    const trades: ExecutedTrade[] = raw ? JSON.parse(raw) : []
    // Deduplicate by id
    const seen = new Set<string>()
    return trades.filter(t => { if (seen.has(t.id)) return false; seen.add(t.id); return true })
  } catch { return [] }
}

function saveActiveTrades(trades: ExecutedTrade[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(TRADES_STORAGE_KEY, JSON.stringify(trades))
}

function loadClosedTrades(): ClosedTrade[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CLOSED_TRADES_KEY)
    const trades: ClosedTrade[] = raw ? JSON.parse(raw) : []
    // Deduplicate by id
    const seen = new Set<string>()
    return trades.filter(t => { if (seen.has(t.id)) return false; seen.add(t.id); return true })
  } catch { return [] }
}

function saveClosedTrades(trades: ClosedTrade[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(CLOSED_TRADES_KEY, JSON.stringify(trades.slice(0, 200)))
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function QuantPage() {
  const { user } = useAuth()
  const [pair, setPair] = useState('BTCUSDT')
  const [interval, setInterval_] = useState('15m')
  const [data, setData] = useState<Record<string, QuantData | null>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scanMsg, setScanMsg] = useState(SCANNING_MESSAGES[0])
  const [signalHistory, setSignalHistory] = useState<SignalHistory[]>([])
  const [showAllLayers, setShowAllLayers] = useState(false)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'signals' | 'analytics'>('dashboard')
  const [activeTrades, setActiveTrades] = useState<ExecutedTrade[]>([])
  const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>([])
  const [executingSignalId, setExecutingSignalId] = useState<string | null>(null)
  const [executeStatus, setExecuteStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const scanMsgIdx = useRef(0)
  const knownSignalIds = useRef<Set<string>>(new Set())

  // Execute a trade from a signal — sends to API for EA pickup + local tracking
  const executeRef = useRef(false)
  const executeTrade = useCallback(async (signal: QuantSignal) => {
    // Prevent double-fire
    if (executeRef.current) return
    executeRef.current = true

    setExecutingSignalId(signal.id)
    setExecuteStatus(null)
    try {
      const apiKey = user?.api_key || ''

      let apiOk = false
      if (apiKey) {
        const res = await fetch('/api/signals/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: apiKey,
            symbol: signal.pair,
            action: signal.direction,
            entry: signal.entry,
            stopLoss: signal.stopLoss,
            takeProfit: signal.takeProfit,
            lotSize: user?.auto_trade_lot_size || 0.01,
          }),
        })
        const json = await res.json()
        if (res.ok && json.success) {
          apiOk = true
        } else {
          setExecuteStatus({ type: 'error', msg: json.error || 'فشل إرسال الأمر للسيرفر' })
        }
      } else {
        setExecuteStatus({ type: 'error', msg: 'لا يوجد مفتاح API — روح للملف الشخصي' })
      }

      // Track locally — unique ID per trade
      const tradeId = `trade-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const trade: ExecutedTrade = {
        id: tradeId,
        signalId: signal.id,
        pair: signal.pair,
        direction: signal.direction,
        entry: signal.entry,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
        currentPrice: signal.entry,
        pnlPct: 0,
        probability: signal.probability,
        regime: signal.regime,
        openedAt: new Date().toISOString(),
        status: 'OPEN',
      }
      setActiveTrades(prev => {
        // Prevent duplicate signalId
        if (prev.some(t => t.signalId === signal.id)) return prev
        const updated = [trade, ...prev]
        saveActiveTrades(updated)
        return updated
      })

      if (apiOk) {
        setExecuteStatus({ type: 'success', msg: `✅ تم إرسال أمر ${signal.direction === 'BUY' ? 'الشراء' : 'البيع'} — ينتظر EA التنفيذ` })
      }

      setTimeout(() => setExecuteStatus(null), 5000)
    } catch (err) {
      console.error('Execute trade error:', err)
      setExecuteStatus({ type: 'error', msg: 'خطأ في الاتصال بالسيرفر' })
      setTimeout(() => setExecuteStatus(null), 5000)
    }
    setExecutingSignalId(null)
    executeRef.current = false
  }, [user])

  // Close a trade manually
  const closeTrade = useCallback((tradeId: string, currentPrice: number) => {
    setActiveTrades(prev => {
      const trade = prev.find(t => t.id === tradeId)
      if (!trade) return prev
      const pnlPct = trade.direction === 'BUY'
        ? ((currentPrice - trade.entry) / trade.entry) * 100
        : ((trade.entry - currentPrice) / trade.entry) * 100
      const closed: ClosedTrade = {
        id: trade.id,
        pair: trade.pair,
        direction: trade.direction,
        entry: trade.entry,
        exitPrice: currentPrice,
        stopLoss: trade.stopLoss,
        takeProfit: trade.takeProfit,
        pnlPct,
        probability: trade.probability,
        result: pnlPct >= 0 ? 'WIN' : 'LOSS',
        openedAt: trade.openedAt,
        closedAt: new Date().toISOString(),
        closeReason: 'MANUAL_CLOSE',
      }
      setClosedTrades(prevClosed => {
        const updatedClosed = [closed, ...prevClosed]
        saveClosedTrades(updatedClosed)
        return updatedClosed
      })
      const updated = prev.filter(t => t.id !== tradeId)
      saveActiveTrades(updated)
      return updated
    })
  }, [])

  // Cycle scanning messages
  useEffect(() => {
    const timer = setInterval(() => {
      scanMsgIdx.current = (scanMsgIdx.current + 1) % SCANNING_MESSAGES.length
      setScanMsg(SCANNING_MESSAGES[scanMsgIdx.current])
    }, 3000)
    return () => clearInterval(timer)
  }, [])

  // Load signal history + trades on mount
  useEffect(() => {
    const h = loadSignalHistory()
    setSignalHistory(h)
    h.forEach(s => knownSignalIds.current.add(s.signal.id))
    setActiveTrades(loadActiveTrades())
    setClosedTrades(loadClosedTrades())
  }, [])

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const results = await Promise.all(
        PAIRS.map(async (p) => {
          const res = await fetch(`/api/quant?pair=${p}&interval=${interval}`)
          if (!res.ok) throw new Error(`API error for ${p}`)
          const json = await res.json()
          return { pair: p, data: json.data as QuantData }
        })
      )

      const newData: Record<string, QuantData> = {}
      const newHistory = [...signalHistory]

      for (const r of results) {
        newData[r.pair] = r.data
        // Track new signals
        if (r.data.signal && !knownSignalIds.current.has(r.data.signal.id)) {
          knownSignalIds.current.add(r.data.signal.id)
          newHistory.unshift({
            signal: r.data.signal,
            currentPrice: r.data.price,
            pnlPct: 0,
            result: 'ACTIVE',
          })
        }
      }

      // Update existing signal P&L
      for (const h of newHistory) {
        if (h.result === 'ACTIVE') {
          const pairData = newData[h.signal.pair]
          if (pairData) {
            h.currentPrice = pairData.price
            if (h.signal.direction === 'BUY') {
              h.pnlPct = ((pairData.price - h.signal.entry) / h.signal.entry) * 100
              if (pairData.price >= h.signal.takeProfit) h.result = 'WIN'
              if (pairData.price <= h.signal.stopLoss) h.result = 'LOSS'
            } else {
              h.pnlPct = ((h.signal.entry - pairData.price) / h.signal.entry) * 100
              if (pairData.price <= h.signal.takeProfit) h.result = 'WIN'
              if (pairData.price >= h.signal.stopLoss) h.result = 'LOSS'
            }
          }
        }
      }

      // Update active trades P&L and auto-close on TP/SL
      setActiveTrades(prev => {
        const stillOpen: ExecutedTrade[] = []
        const newClosed: ClosedTrade[] = []
        for (const t of prev) {
          const pairData = newData[t.pair]
          if (!pairData) { stillOpen.push(t); continue }
          const cp = pairData.price
          const pnl = t.direction === 'BUY'
            ? ((cp - t.entry) / t.entry) * 100
            : ((t.entry - cp) / t.entry) * 100
          // Check TP hit
          const tpHit = t.direction === 'BUY' ? cp >= t.takeProfit : cp <= t.takeProfit
          // Check SL hit
          const slHit = t.direction === 'BUY' ? cp <= t.stopLoss : cp >= t.stopLoss
          if (tpHit || slHit) {
            newClosed.push({
              id: t.id, pair: t.pair, direction: t.direction,
              entry: t.entry, exitPrice: cp,
              stopLoss: t.stopLoss, takeProfit: t.takeProfit,
              pnlPct: pnl, probability: t.probability,
              result: tpHit ? 'WIN' : 'LOSS',
              openedAt: t.openedAt, closedAt: new Date().toISOString(),
              closeReason: tpHit ? 'TP_HIT' : 'SL_HIT',
            })
          } else {
            stillOpen.push({ ...t, currentPrice: cp, pnlPct: pnl })
          }
        }
        if (newClosed.length > 0) {
          setClosedTrades(prevC => {
            const existingIds = new Set(prevC.map(c => c.id))
            const deduped = newClosed.filter(c => !existingIds.has(c.id))
            if (deduped.length === 0) return prevC
            const updated = [...deduped, ...prevC]
            saveClosedTrades(updated)
            return updated
          })
        }
        saveActiveTrades(stillOpen)
        return stillOpen
      })

      setData(newData)
      setSignalHistory(newHistory.slice(0, 100))
      saveSignalHistory(newHistory.slice(0, 100))
      setLoading(false)
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }, [interval, signalHistory])

  useEffect(() => {
    fetchData()
    const timer = setInterval(fetchData, 10_000)
    return () => clearInterval(timer)
  }, [interval]) // eslint-disable-line react-hooks/exhaustive-deps

  // Stats
  const totalSignals = signalHistory.length
  const wins = signalHistory.filter(s => s.result === 'WIN').length
  const losses = signalHistory.filter(s => s.result === 'LOSS').length
  const closedTotal = wins + losses
  const winRate = closedTotal > 0 ? ((wins / closedTotal) * 100).toFixed(1) : '—'
  const avgPnl = closedTotal > 0
    ? (signalHistory.filter(s => s.result !== 'ACTIVE').reduce((s, h) => s + h.pnlPct, 0) / closedTotal).toFixed(2)
    : '—'

  const currentData = data[pair]
  const btcPrice = data['BTCUSDT']?.price || 0
  const ethPrice = data['ETHUSDT']?.price || 0

  return (
    <ProtectedPage>
      <div className="min-h-screen bg-background">
        {/* Background grid pattern */}
        <div className="fixed inset-0 bg-grid-pattern bg-grid opacity-30 pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 py-6 space-y-6">
          {/* ─── Header ─────────────────────────────────────────── */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                <span className="text-gradient">🧠 محرك التداول الكمي المؤسسي</span>
              </h1>
              <p className="text-sm text-neutral-400 mt-1">
                Institutional Quant AI — تحليل متعدد الطبقات بالذكاء الاصطناعي
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Pair selector */}
              <div className="flex bg-surface/80 rounded-xl border border-white/[0.06] p-1">
                {PAIRS.map(p => (
                  <button
                    key={p}
                    onClick={() => setPair(p)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      pair === p
                        ? 'bg-accent/20 text-accent border border-accent/30'
                        : 'text-neutral-400 hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    {PAIR_ICONS[p]} {PAIR_LABELS[p]}
                  </button>
                ))}
              </div>

              {/* Interval selector */}
              <div className="flex bg-surface/80 rounded-xl border border-white/[0.06] p-1">
                {INTERVALS.map(i => (
                  <button
                    key={i}
                    onClick={() => setInterval_(i)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      interval === i
                        ? 'bg-accent/20 text-accent border border-accent/30'
                        : 'text-neutral-400 hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ─── Live Prices + AI Status ─────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* BTC Price */}
            <div className="card flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-2xl">₿</div>
              <div>
                <p className="text-xs text-neutral-400">Bitcoin</p>
                <p className="text-xl font-bold text-white">${btcPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              {data['BTCUSDT'] && (
                <div className="mr-auto">
                  <span className={`badge ${data['BTCUSDT'].probability >= 75 ? 'badge-buy' : data['BTCUSDT'].probability >= 60 ? 'badge-neutral' : 'badge-sell'}`}>
                    {data['BTCUSDT'].probability}%
                  </span>
                </div>
              )}
            </div>

            {/* ETH Price */}
            <div className="card flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-2xl">Ξ</div>
              <div>
                <p className="text-xs text-neutral-400">Ethereum</p>
                <p className="text-xl font-bold text-white">${ethPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              {data['ETHUSDT'] && (
                <div className="mr-auto">
                  <span className={`badge ${data['ETHUSDT'].probability >= 75 ? 'badge-buy' : data['ETHUSDT'].probability >= 60 ? 'badge-neutral' : 'badge-sell'}`}>
                    {data['ETHUSDT'].probability}%
                  </span>
                </div>
              )}
            </div>

            {/* AI Engine Status */}
            <div className="card flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-neutral-400">محرك AI نشط</p>
                <p className="text-sm text-accent truncate animate-pulse">{scanMsg}</p>
              </div>
            </div>
          </div>

          {/* ─── Tabs ────────────────────────────────────────────── */}
          <div className="flex bg-surface/50 rounded-xl border border-white/[0.06] p-1 w-fit">
            {([
              { key: 'dashboard', label: '📊 لوحة التحكم' },
              { key: 'signals', label: '📡 الإشارات' },
              { key: 'analytics', label: '📈 الإحصائيات' },
            ] as { key: typeof activeTab; label: string }[]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? 'bg-accent/20 text-accent'
                    : 'text-neutral-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ─── Loading ─────────────────────────────────────────── */}
          {loading && (
            <div className="card text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-accent/30 border-t-accent animate-spin" />
              <p className="text-neutral-400">جاري تشغيل المحرك الكمي...</p>
            </div>
          )}

          {error && (
            <div className="card border-red-500/20 bg-red-500/5 text-center py-8">
              <p className="text-red-400">{error}</p>
              <button onClick={fetchData} className="btn-primary mt-4 text-sm">إعادة المحاولة</button>
            </div>
          )}

          {/* ─── Dashboard Tab ───────────────────────────────────── */}
          {!loading && activeTab === 'dashboard' && currentData && (
            <>
              {/* MT5 Execution Panel */}
              {(() => {
                const hasSignal = !!currentData.signal
                const regime = currentData.regime
                const prob = currentData.probability
                const atr = currentData.volatility.atr
                const price = currentData.price
                const bullishLayers = currentData.layers.filter((l: LayerResult) => l.direction === 'BULLISH').length
                const bearishLayers = currentData.layers.filter((l: LayerResult) => l.direction === 'BEARISH').length
                const recommendedDir: 'BUY' | 'SELL' = hasSignal
                  ? currentData.signal!.direction
                  : bearishLayers > bullishLayers ? 'SELL' : 'BUY'
                const canExecute = hasSignal && !!user?.api_key && executingSignalId === null

                return (
                  <div className="card"
                    style={{
                      borderColor: hasSignal
                        ? (recommendedDir === 'BUY' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)')
                        : 'rgba(255,255,255,0.06)',
                      background: hasSignal
                        ? (recommendedDir === 'BUY' ? 'rgba(16,185,129,0.03)' : 'rgba(239,68,68,0.03)')
                        : 'transparent',
                    }}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold border`}
                          style={{
                            background: hasSignal
                              ? (recommendedDir === 'BUY' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)')
                              : 'rgba(255,255,255,0.05)',
                            borderColor: hasSignal
                              ? (recommendedDir === 'BUY' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)')
                              : 'rgba(255,255,255,0.1)',
                            color: hasSignal
                              ? (recommendedDir === 'BUY' ? '#34d399' : '#f87171')
                              : '#6b7280',
                          }}
                        >
                          {hasSignal ? (recommendedDir === 'BUY' ? '↗' : '↘') : '⏸'}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            تنفيذ عبر MT5
                            <span className="px-2 py-0.5 rounded text-[10px] bg-white/[0.06] text-neutral-400 border border-white/[0.08]">
                              {user?.api_key ? '🟢 متصل' : '🔴 غير متصل'}
                            </span>
                          </h3>
                          <p className="text-xs text-neutral-500 mt-0.5">
                            {hasSignal ? (
                              <>
                                التوصية: <span className={recommendedDir === 'BUY' ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                                  {recommendedDir === 'BUY' ? '🟢 شراء' : '🔴 بيع'}
                                </span>
                                {' — '}{REGIME_LABELS[regime] || regime}{' — '}احتمالية {prob}%
                              </>
                            ) : (
                              <span className="text-neutral-500">
                                {REGIME_LABELS[regime] || regime}{' — '}احتمالية {prob}% — بانتظار إشارة (65%+)
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Execute Button */}
                    <button
                      disabled={!canExecute}
                      onClick={() => hasSignal && executeTrade(currentData.signal!)}
                      className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-bold text-base transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
                      style={{
                        background: hasSignal
                          ? (recommendedDir === 'BUY' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)')
                          : 'rgba(255,255,255,0.03)',
                        borderWidth: '1px',
                        borderColor: hasSignal
                          ? (recommendedDir === 'BUY' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)')
                          : 'rgba(255,255,255,0.08)',
                        color: hasSignal
                          ? (recommendedDir === 'BUY' ? '#34d399' : '#f87171')
                          : '#6b7280',
                      }}
                    >
                      {executingSignalId !== null ? (
                        <>
                          <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          جاري التنفيذ...
                        </>
                      ) : hasSignal ? (
                        <>
                          <span className="text-xl">{recommendedDir === 'BUY' ? '🚀' : '📉'}</span>
                          {recommendedDir === 'BUY' ? 'تنفيذ شراء' : 'تنفيذ بيع'} {PAIR_LABELS[pair]} عبر MT5
                        </>
                      ) : (
                        <>
                          <span className="text-xl">⏸</span>
                          لا توجد إشارة — الزر معطل
                        </>
                      )}
                    </button>

                    {/* Execution status feedback */}
                    {executeStatus && (
                      <div className={`mt-3 p-3 rounded-lg text-sm font-medium text-center ${
                        executeStatus.type === 'success'
                          ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                          : 'bg-red-500/10 border border-red-500/20 text-red-400'
                      }`}>
                        {executeStatus.msg}
                      </div>
                    )}

                    {/* Price info */}
                    {hasSignal && (
                      <div className="mt-3 flex items-center justify-between text-[11px] text-neutral-500">
                        <span>الدخول: <span className="font-mono text-neutral-300">${currentData.signal!.entry.toFixed(2)}</span></span>
                        <span>
                          SL: <span className="font-mono text-red-400">${currentData.signal!.stopLoss.toFixed(2)}</span>
                          {' | '}
                          TP: <span className="font-mono text-emerald-400">${currentData.signal!.takeProfit.toFixed(2)}</span>
                          {' | '}
                          R:R <span className="font-mono text-neutral-300">{currentData.signal!.riskReward}</span>
                        </span>
                      </div>
                    )}

                    {!user?.api_key && (
                      <div className="mt-3 p-3 rounded-lg bg-red-500/5 border border-red-500/10 text-xs text-red-400">
                        ⚠️ لتفعيل التنفيذ، ربط مفتاح API من <a href="/profile" className="underline hover:text-red-300">الملف الشخصي</a> وتثبيت QuantEngine EA على MT5
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Active Signal Card */}
              {currentData.signal && (
                <SignalCard
                  signal={currentData.signal}
                  onExecute={executeTrade}
                  isExecuting={executingSignalId === currentData.signal.id}
                  alreadyExecuted={activeTrades.some(t => t.signalId === currentData.signal!.id)}
                />
              )}

              {/* ─── Active Trades Panel ─────────────────────────── */}
              {activeTrades.length > 0 && (
                <div className="card space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      الصفقات النشطة ({activeTrades.length})
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {activeTrades.map(trade => (
                      <ActiveTradeCard
                        key={trade.id}
                        trade={trade}
                        onClose={(id) => closeTrade(id, trade.currentPrice)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* ─── Recently Closed Trades ──────────────────────── */}
              {closedTrades.length > 0 && (
                <div className="card space-y-4">
                  <h3 className="text-sm font-semibold text-neutral-300">آخر الصفقات المغلقة ({closedTrades.length})</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-neutral-500 text-xs border-b border-white/[0.06]">
                          <th className="py-2 px-3 text-right">الزوج</th>
                          <th className="py-2 px-3 text-right">النوع</th>
                          <th className="py-2 px-3 text-right">الدخول</th>
                          <th className="py-2 px-3 text-right">الخروج</th>
                          <th className="py-2 px-3 text-right">P&L</th>
                          <th className="py-2 px-3 text-right">السبب</th>
                          <th className="py-2 px-3 text-right">النتيجة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {closedTrades.slice(0, 10).map((ct) => (
                          <tr key={ct.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                            <td className="py-2.5 px-3 font-medium">{PAIR_LABELS[ct.pair] || ct.pair}</td>
                            <td className="py-2.5 px-3">
                              <span className={`badge ${ct.direction === 'BUY' ? 'badge-buy' : 'badge-sell'}`}>
                                {ct.direction === 'BUY' ? 'شراء' : 'بيع'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-xs">{ct.entry.toFixed(2)}</td>
                            <td className="py-2.5 px-3 font-mono text-xs">{ct.exitPrice.toFixed(2)}</td>
                            <td className={`py-2.5 px-3 font-mono text-xs font-bold ${ct.pnlPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {ct.pnlPct >= 0 ? '+' : ''}{ct.pnlPct.toFixed(2)}%
                            </td>
                            <td className="py-2.5 px-3 text-xs text-neutral-400">
                              {ct.closeReason === 'TP_HIT' ? '🎯 هدف' : ct.closeReason === 'SL_HIT' ? '🛑 وقف' : '✋ يدوي'}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`badge text-xs ${ct.result === 'WIN' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : 'bg-red-500/15 text-red-400 border-red-500/20'}`}>
                                {ct.result === 'WIN' ? '✅ ربح' : '❌ خسارة'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Market Regime + Probability */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Regime */}
                <div className="card space-y-3">
                  <h3 className="text-sm font-semibold text-neutral-300">حالة السوق</h3>
                  <div className={`text-2xl font-bold ${REGIME_COLORS[currentData.regime] || 'text-white'}`}>
                    {REGIME_LABELS[currentData.regime] || currentData.regime}
                  </div>
                  <p className="text-xs text-neutral-500">{currentData.regimeDetail}</p>
                </div>

                {/* Probability Gauge */}
                <div className="card space-y-3">
                  <h3 className="text-sm font-semibold text-neutral-300">نسبة الاحتمالية AI</h3>
                  <div className="flex items-center gap-4">
                    <ProbabilityGauge value={currentData.probability} />
                    <div>
                      <p className={`text-3xl font-bold ${
                        currentData.probability >= 85 ? 'text-emerald-400' :
                        currentData.probability >= 75 ? 'text-yellow-400' :
                        currentData.probability >= 60 ? 'text-orange-400' : 'text-neutral-400'
                      }`}>
                        {currentData.probability}%
                      </p>
                      <p className={`text-sm font-medium ${
                        currentData.probability >= 90 ? 'text-emerald-400' :
                        currentData.probability >= 85 ? 'text-emerald-400' :
                        currentData.probability >= 75 ? 'text-yellow-400' : 'text-neutral-500'
                      }`}>
                        {currentData.strengthLabel === 'EXTREME OPPORTUNITY' ? '🔥 فرصة استثنائية' :
                         currentData.strengthLabel === 'INSTITUTIONAL SETUP' ? '🏦 إعداد مؤسسي' :
                         currentData.strengthLabel === 'HIGH PROBABILITY' ? '⚡ احتمالية عالية' :
                         currentData.strengthLabel === 'MODERATE' ? '📊 متوسط' : '⏸️ منخفض'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Analysis Layers */}
              <div className="card space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-neutral-300">طبقات التحليل الكمي</h3>
                  <button
                    onClick={() => setShowAllLayers(!showAllLayers)}
                    className="text-xs text-accent hover:text-accent/80 transition-colors"
                  >
                    {showAllLayers ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
                  </button>
                </div>
                <div className="space-y-3">
                  {currentData.layers.map((layer, idx) => (
                    <LayerBar key={idx} layer={layer} showDetail={showAllLayers} />
                  ))}
                </div>
              </div>

              {/* Detailed Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Momentum */}
                <MetricCard
                  title="الزخم"
                  icon="🚀"
                  items={[
                    { label: 'EMA 9', value: formatPrice(currentData.momentum.ema9, pair) },
                    { label: 'EMA 21', value: formatPrice(currentData.momentum.ema21, pair) },
                    { label: 'RSI', value: currentData.momentum.rsi.toFixed(1), color: currentData.momentum.rsi > 55 ? 'text-emerald-400' : currentData.momentum.rsi < 45 ? 'text-red-400' : 'text-neutral-300' },
                    { label: 'MACD', value: currentData.momentum.macdHist > 0 ? '+' + currentData.momentum.macdHist.toFixed(4) : currentData.momentum.macdHist.toFixed(4), color: currentData.momentum.macdHist > 0 ? 'text-emerald-400' : 'text-red-400' },
                  ]}
                />

                {/* Volatility */}
                <MetricCard
                  title="التقلبات"
                  icon="📊"
                  items={[
                    { label: 'ATR', value: currentData.volatility.atr.toFixed(2) },
                    { label: 'BB Width', value: currentData.volatility.bbWidth.toFixed(3) + '%' },
                    { label: 'BB Upper', value: formatPrice(currentData.volatility.bbUpper, pair) },
                    { label: 'BB Lower', value: formatPrice(currentData.volatility.bbLower, pair) },
                    { label: 'Squeeze', value: currentData.volatility.squeeze ? '🔴 نعم' : '🟢 لا', color: currentData.volatility.squeeze ? 'text-red-400' : 'text-emerald-400' },
                  ]}
                />

                {/* Order Flow */}
                <MetricCard
                  title="تدفق الأوامر"
                  icon="🌊"
                  items={[
                    { label: 'حجم الشراء', value: formatLargeNumber(currentData.orderFlow.buyVolume), color: 'text-emerald-400' },
                    { label: 'حجم البيع', value: formatLargeNumber(currentData.orderFlow.sellVolume), color: 'text-red-400' },
                    { label: 'الدلتا', value: (currentData.orderFlow.delta > 0 ? '+' : '') + formatLargeNumber(currentData.orderFlow.delta), color: currentData.orderFlow.delta > 0 ? 'text-emerald-400' : 'text-red-400' },
                    { label: 'السيطرة', value: currentData.orderFlow.dominance === 'BUY' ? '🟢 مشترين' : currentData.orderFlow.dominance === 'SELL' ? '🔴 بائعين' : '⚪ متعادل' },
                    { label: 'ارتفاع مفاجئ', value: currentData.orderFlow.volumeSpike ? '🔥 نعم' : 'لا', color: currentData.orderFlow.volumeSpike ? 'text-orange-400' : 'text-neutral-500' },
                  ]}
                />

                {/* Order Book */}
                <MetricCard
                  title="دفتر الأوامر"
                  icon="📖"
                  items={[
                    { label: 'جدار الشراء', value: '$' + formatLargeNumber(currentData.orderBook.bidWall), color: 'text-emerald-400' },
                    { label: 'جدار البيع', value: '$' + formatLargeNumber(currentData.orderBook.askWall), color: 'text-red-400' },
                    { label: 'عدم التوازن', value: (currentData.orderBook.imbalance * 100).toFixed(1) + '%', color: currentData.orderBook.imbalance > 0 ? 'text-emerald-400' : 'text-red-400' },
                    { label: 'الاتجاه', value: currentData.orderBook.imbalanceDirection === 'BUY' ? '🟢 شراء' : currentData.orderBook.imbalanceDirection === 'SELL' ? '🔴 بيع' : '⚪ متوازن' },
                  ]}
                />

                {/* Open Interest */}
                <MetricCard
                  title="العقود المفتوحة"
                  icon="📋"
                  items={[
                    { label: 'OI الحالي', value: formatLargeNumber(currentData.openInterest.current) },
                    { label: 'التغير', value: (currentData.openInterest.changePct > 0 ? '+' : '') + currentData.openInterest.changePct.toFixed(2) + '%', color: currentData.openInterest.changePct > 0 ? 'text-emerald-400' : 'text-red-400' },
                    { label: 'الارتباط', value: currentData.openInterest.priceCorrelation === 'STRONG_TREND' ? '💪 اتجاه قوي' : currentData.openInterest.priceCorrelation === 'WEAK_MOVE' ? '⚠️ حركة ضعيفة' : '⚪ محايد' },
                  ]}
                />

                {/* Funding + Liquidations */}
                <MetricCard
                  title="التمويل والتصفيات"
                  icon="💰"
                  items={[
                    { label: 'معدل التمويل', value: (currentData.fundingRate.rate * 100).toFixed(4) + '%', color: currentData.fundingRate.rate > 0 ? 'text-emerald-400' : currentData.fundingRate.rate < 0 ? 'text-red-400' : 'text-neutral-300' },
                    { label: 'المشاعر', value: currentData.fundingRate.sentiment === 'EXTREME_LONG' ? '🔴 إفراط شراء' : currentData.fundingRate.sentiment === 'EXTREME_SHORT' ? '🟢 إفراط بيع' : '⚪ محايد' },
                    { label: 'التصفيات', value: currentData.liquidations.netDirection === 'BULLISH_SQUEEZE' ? '🟢 ضغط صعودي' : currentData.liquidations.netDirection === 'BEARISH_CASCADE' ? '🔴 انهيار هبوطي' : '⚪ عادي' },
                  ]}
                />
              </div>

              {/* TradingView Chart */}
              <div className="card overflow-hidden" style={{ padding: 0 }}>
                <div className="p-4 border-b border-white/[0.06]">
                  <h3 className="text-sm font-semibold text-neutral-300">📈 الرسم البياني المباشر — {PAIR_LABELS[pair]}</h3>
                </div>
                <div className="h-[500px]">
                  <iframe
                    key={`${pair}-${interval}`}
                    src={`https://s.tradingview.com/widgetembed/?frameElementId=tv_chart&symbol=BINANCE:${pair}&interval=${interval === '1m' ? '1' : interval === '5m' ? '5' : '15'}&hidesidetoolbar=0&symboledit=1&saveimage=0&toolbarbg=0a0f1e&studies=[]&theme=dark&style=1&timezone=exchange&withdateranges=1&showpopupbutton=0&studies_overrides={}&overrides={}&enabled_features=[]&disabled_features=[]&locale=ar&utm_source=localhost`}
                    className="w-full h-full border-0"
                    allowFullScreen
                  />
                </div>
              </div>
            </>
          )}

          {/* ─── Signals Tab ─────────────────────────────────────── */}
          {!loading && activeTab === 'signals' && (
            <div className="space-y-4">
              {/* Active signals for both pairs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PAIRS.map(p => {
                  const d = data[p]
                  if (!d?.signal) return (
                    <div key={p} className="card text-center py-8">
                      <p className="text-2xl mb-2">{PAIR_ICONS[p]}</p>
                      <p className="text-neutral-400 text-sm">{PAIR_LABELS[p]} — لا توجد إشارة حالياً</p>
                      <p className="text-neutral-500 text-xs mt-1">الاحتمالية: {d?.probability || 0}%</p>
                    </div>
                  )
                  return (
                    <SignalCard
                      key={p}
                      signal={d.signal}
                      onExecute={executeTrade}
                      isExecuting={executingSignalId === d.signal.id}
                      alreadyExecuted={activeTrades.some(t => t.signalId === d.signal!.id)}
                    />
                  )
                })}
              </div>

              {/* Signal History Table */}
              <div className="card space-y-4">
                <h3 className="text-sm font-semibold text-neutral-300">📜 سجل الإشارات (آخر {signalHistory.length})</h3>
                {signalHistory.length === 0 ? (
                  <p className="text-neutral-500 text-sm text-center py-8">لا توجد إشارات مسجلة بعد</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-neutral-500 text-xs border-b border-white/[0.06]">
                          <th className="py-2 px-3 text-right">الزوج</th>
                          <th className="py-2 px-3 text-right">النوع</th>
                          <th className="py-2 px-3 text-right">الدخول</th>
                          <th className="py-2 px-3 text-right">SL</th>
                          <th className="py-2 px-3 text-right">TP</th>
                          <th className="py-2 px-3 text-right">الاحتمالية</th>
                          <th className="py-2 px-3 text-right">P&L</th>
                          <th className="py-2 px-3 text-right">الحالة</th>
                          <th className="py-2 px-3 text-right">الوقت</th>
                        </tr>
                      </thead>
                      <tbody>
                        {signalHistory.slice(0, 20).map((h, idx) => (
                          <tr key={idx} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                            <td className="py-2.5 px-3 font-medium">{PAIR_LABELS[h.signal.pair] || h.signal.pair}</td>
                            <td className="py-2.5 px-3">
                              <span className={`badge ${h.signal.direction === 'BUY' ? 'badge-buy' : 'badge-sell'}`}>
                                {h.signal.direction === 'BUY' ? 'شراء' : 'بيع'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-xs">{h.signal.entry.toFixed(2)}</td>
                            <td className="py-2.5 px-3 font-mono text-xs text-red-400">{h.signal.stopLoss.toFixed(2)}</td>
                            <td className="py-2.5 px-3 font-mono text-xs text-emerald-400">{h.signal.takeProfit.toFixed(2)}</td>
                            <td className="py-2.5 px-3">
                              <span className={`font-bold ${h.signal.probability >= 85 ? 'text-emerald-400' : h.signal.probability >= 75 ? 'text-yellow-400' : 'text-neutral-400'}`}>
                                {h.signal.probability}%
                              </span>
                            </td>
                            <td className={`py-2.5 px-3 font-mono text-xs font-bold ${h.pnlPct > 0 ? 'text-emerald-400' : h.pnlPct < 0 ? 'text-red-400' : 'text-neutral-400'}`}>
                              {h.pnlPct > 0 ? '+' : ''}{h.pnlPct.toFixed(2)}%
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`badge text-xs ${h.result === 'WIN' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : h.result === 'LOSS' ? 'bg-red-500/15 text-red-400 border-red-500/20' : 'bg-blue-500/15 text-blue-400 border-blue-500/20'}`}>
                                {h.result === 'WIN' ? '✅ ربح' : h.result === 'LOSS' ? '❌ خسارة' : '🔄 نشط'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-xs text-neutral-500">
                              {new Date(h.signal.timestamp).toLocaleTimeString('ar-EG')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── Analytics Tab ───────────────────────────────────── */}
          {!loading && activeTab === 'analytics' && (
            <div className="space-y-4">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="إجمالي الإشارات" value={totalSignals.toString()} icon="📡" />
                <StatCard label="نسبة الفوز" value={winRate + '%'} icon="🏆" color="text-emerald-400" />
                <StatCard label="الأرباح" value={wins.toString()} icon="✅" color="text-emerald-400" />
                <StatCard label="الخسائر" value={losses.toString()} icon="❌" color="text-red-400" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card space-y-3">
                  <h3 className="text-sm font-semibold text-neutral-300">متوسط الربح/الخسارة</h3>
                  <p className={`text-3xl font-bold ${parseFloat(avgPnl as string) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {avgPnl}%
                  </p>
                </div>

                <div className="card space-y-3">
                  <h3 className="text-sm font-semibold text-neutral-300">توزيع الإشارات</h3>
                  <div className="flex gap-4">
                    <div>
                      <p className="text-xs text-neutral-500">شراء</p>
                      <p className="text-xl font-bold text-emerald-400">
                        {signalHistory.filter(s => s.signal.direction === 'BUY').length}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">بيع</p>
                      <p className="text-xl font-bold text-red-400">
                        {signalHistory.filter(s => s.signal.direction === 'SELL').length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Win rate visualization */}
              {closedTotal > 0 && (
                <div className="card space-y-4">
                  <h3 className="text-sm font-semibold text-neutral-300">نسبة النجاح البصرية</h3>
                  <div className="flex h-8 rounded-lg overflow-hidden">
                    <div
                      className="bg-emerald-500/40 flex items-center justify-center text-xs font-bold text-emerald-300"
                      style={{ width: `${(wins / closedTotal) * 100}%` }}
                    >
                      {wins > 0 && `${((wins / closedTotal) * 100).toFixed(0)}%`}
                    </div>
                    <div
                      className="bg-red-500/40 flex items-center justify-center text-xs font-bold text-red-300"
                      style={{ width: `${(losses / closedTotal) * 100}%` }}
                    >
                      {losses > 0 && `${((losses / closedTotal) * 100).toFixed(0)}%`}
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-neutral-500">
                    <span>✅ أرباح: {wins}</span>
                    <span>❌ خسائر: {losses}</span>
                  </div>
                </div>
              )}

              {/* Performance by pair */}
              <div className="card space-y-4">
                <h3 className="text-sm font-semibold text-neutral-300">الأداء حسب الزوج</h3>
                {PAIRS.map(p => {
                  const pairSignals = signalHistory.filter(s => s.signal.pair === p)
                  const pairWins = pairSignals.filter(s => s.result === 'WIN').length
                  const pairLosses = pairSignals.filter(s => s.result === 'LOSS').length
                  const pairClosed = pairWins + pairLosses
                  const pairWR = pairClosed > 0 ? ((pairWins / pairClosed) * 100).toFixed(1) : '—'
                  return (
                    <div key={p} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{PAIR_ICONS[p]}</span>
                        <span className="font-medium">{PAIR_LABELS[p]}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-neutral-400">{pairSignals.length} إشارة</span>
                        <span className="text-emerald-400">{pairWins}W</span>
                        <span className="text-red-400">{pairLosses}L</span>
                        <span className="font-bold">{pairWR}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedPage>
  )
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function SignalCard({ signal, onExecute, isExecuting, alreadyExecuted }: {
  signal: QuantSignal
  onExecute?: (signal: QuantSignal) => void
  isExecuting?: boolean
  alreadyExecuted?: boolean
}) {
  const isBuy = signal.direction === 'BUY'
  const isInstitutional = signal.probability >= 85
  const isExtreme = signal.probability >= 90

  return (
    <div
      className={`relative rounded-2xl p-6 border transition-all duration-500 ${
        isBuy
          ? `bg-emerald-500/[0.04] border-emerald-500/20 ${isInstitutional ? 'shadow-lg shadow-emerald-500/10' : ''} ${isExtreme ? 'animate-glow' : ''}`
          : `bg-red-500/[0.04] border-red-500/20 ${isInstitutional ? 'shadow-lg shadow-red-500/10' : ''} ${isExtreme ? 'shadow-lg shadow-red-500/20' : ''}`
      }`}
      style={isExtreme ? {
        boxShadow: isBuy
          ? '0 0 30px rgba(16, 185, 129, 0.15), 0 0 60px rgba(16, 185, 129, 0.05)'
          : '0 0 30px rgba(239, 68, 68, 0.15), 0 0 60px rgba(239, 68, 68, 0.05)'
      } : undefined}
    >
      {/* Glow indicator for high prob */}
      {isInstitutional && (
        <div className={`absolute top-3 left-3 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
          isExtreme ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-accent/20 text-accent border border-accent/30'
        }`}>
          {isExtreme ? '🔥 EXTREME' : '🏦 INSTITUTIONAL'}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center gap-4">
        {/* Direction badge */}
        <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold ${
          isBuy ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/15 text-red-400 border border-red-500/20'
        }`}>
          {isBuy ? '↗' : '↘'}
        </div>

        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className={`badge ${isBuy ? 'badge-buy' : 'badge-sell'}`}>
              {isBuy ? '🟢 شراء' : '🔴 بيع'}
            </span>
            <span className="text-sm font-medium">{PAIR_LABELS[signal.pair] || signal.pair}</span>
            <span className="text-xs text-neutral-500">{REGIME_LABELS[signal.regime] || signal.regime}</span>
          </div>
          <p className="text-xs text-neutral-400">
            R:R {signal.riskReward} | ATR: {signal.atr.toFixed(2)} | {signal.strengthLabel}
          </p>
        </div>

        {/* Price levels */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-[10px] text-neutral-500 uppercase tracking-wider">الدخول</p>
            <p className="text-sm font-bold font-mono">{signal.entry.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[10px] text-red-400 uppercase tracking-wider">وقف الخسارة</p>
            <p className="text-sm font-bold font-mono text-red-400">{signal.stopLoss.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[10px] text-emerald-400 uppercase tracking-wider">الهدف</p>
            <p className="text-sm font-bold font-mono text-emerald-400">{signal.takeProfit.toFixed(2)}</p>
          </div>
        </div>

        {/* Probability */}
        <div className="text-center">
          <div className={`text-3xl font-black ${
            signal.probability >= 90 ? 'text-emerald-400' :
            signal.probability >= 85 ? 'text-emerald-400' :
            signal.probability >= 75 ? 'text-yellow-400' : 'text-orange-400'
          }`}>
            {signal.probability}%
          </div>
          <p className="text-[10px] text-neutral-500">احتمالية</p>
        </div>
      </div>

      {/* Execute Button */}
      {onExecute && (
        <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4">
          <div className="text-[10px] text-neutral-600">
            {new Date(signal.timestamp).toLocaleString('ar-EG')}
          </div>
          {alreadyExecuted ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-neutral-500 text-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              تم التنفيذ — الصفقة نشطة
            </div>
          ) : isExecuting ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent/10 border border-accent/20 text-accent text-sm">
              <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              جاري التنفيذ...
            </div>
          ) : (
            <button
              onClick={() => onExecute(signal)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                isBuy
                  ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/10'
                  : 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 shadow-lg shadow-red-500/10'
              }`}
            >
              {isBuy ? '🚀 تنفيذ شراء' : '📉 تنفيذ بيع'}
            </button>
          )}
        </div>
      )}

      {/* Timestamp (only if no execute section) */}
      {!onExecute && (
        <div className="mt-3 text-[10px] text-neutral-600 text-left">
          {new Date(signal.timestamp).toLocaleString('ar-EG')}
        </div>
      )}
    </div>
  )
}

function ActiveTradeCard({ trade, onClose }: { trade: ExecutedTrade; onClose: (id: string) => void }) {
  const isBuy = trade.direction === 'BUY'
  const pnlColor = trade.pnlPct >= 0 ? 'text-emerald-400' : 'text-red-400'

  // Progress towards TP (0% = entry, 100% = TP, negative = towards SL)
  const range = Math.abs(trade.takeProfit - trade.entry)
  const progress = isBuy
    ? ((trade.currentPrice - trade.entry) / range) * 100
    : ((trade.entry - trade.currentPrice) / range) * 100
  const clampedProgress = Math.max(-100, Math.min(100, progress))

  const elapsed = Date.now() - new Date(trade.openedAt).getTime()
  const mins = Math.floor(elapsed / 60000)
  const timeStr = mins < 60 ? `${mins}د` : `${Math.floor(mins / 60)}س ${mins % 60}د`

  return (
    <div className={`rounded-xl p-4 border transition-all ${
      isBuy ? 'bg-emerald-500/[0.03] border-emerald-500/15' : 'bg-red-500/[0.03] border-red-500/15'
    }`}>
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        {/* Info */}
        <div className="flex items-center gap-3 flex-1">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold ${
            isBuy ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
          }`}>
            {isBuy ? '↗' : '↘'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`badge text-xs ${isBuy ? 'badge-buy' : 'badge-sell'}`}>
                {isBuy ? 'شراء' : 'بيع'}
              </span>
              <span className="text-sm font-medium">{PAIR_LABELS[trade.pair]}</span>
              <span className="text-xs text-neutral-600">{timeStr}</span>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              الدخول: <span className="font-mono">{trade.entry.toFixed(2)}</span>
              {' | '}SL: <span className="font-mono text-red-400">{trade.stopLoss.toFixed(2)}</span>
              {' | '}TP: <span className="font-mono text-emerald-400">{trade.takeProfit.toFixed(2)}</span>
            </p>
          </div>
        </div>

        {/* Current Price + P&L */}
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-[10px] text-neutral-500">السعر الحالي</p>
            <p className="text-sm font-bold font-mono">{trade.currentPrice.toFixed(2)}</p>
          </div>
          <div className="text-center min-w-[60px]">
            <p className="text-[10px] text-neutral-500">P&L</p>
            <p className={`text-lg font-black font-mono ${pnlColor}`}>
              {trade.pnlPct >= 0 ? '+' : ''}{trade.pnlPct.toFixed(2)}%
            </p>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={() => onClose(trade.id)}
          className="px-4 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.08] hover:border-white/[0.15] text-sm font-medium text-neutral-300 hover:text-white transition-all"
        >
          ✋ إغلاق يدوي
        </button>
      </div>

      {/* Progress bar towards TP */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] text-neutral-600 mb-1">
          <span>🛑 SL</span>
          <span>الدخول</span>
          <span>🎯 TP</span>
        </div>
        <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden relative">
          {/* Center marker (entry) */}
          <div className="absolute left-1/2 top-0 w-px h-full bg-white/20 -translate-x-1/2" />
          {/* Progress fill */}
          {clampedProgress >= 0 ? (
            <div
              className="absolute top-0 h-full bg-emerald-500/60 rounded-full transition-all duration-500"
              style={{ left: '50%', width: `${clampedProgress / 2}%` }}
            />
          ) : (
            <div
              className="absolute top-0 h-full bg-red-500/60 rounded-full transition-all duration-500"
              style={{ right: '50%', width: `${Math.abs(clampedProgress) / 2}%` }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function LayerBar({ layer, showDetail }: { layer: LayerResult; showDetail: boolean }) {
  const color = layer.direction === 'BULLISH' ? 'bg-emerald-500' :
    layer.direction === 'BEARISH' ? 'bg-red-500' : 'bg-neutral-500'
  const textColor = layer.direction === 'BULLISH' ? 'text-emerald-400' :
    layer.direction === 'BEARISH' ? 'text-red-400' : 'text-neutral-400'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-neutral-300 font-medium">{layer.name}</span>
        <div className="flex items-center gap-2">
          <span className={textColor}>
            {layer.direction === 'BULLISH' ? '↗ صعودي' : layer.direction === 'BEARISH' ? '↘ هبوطي' : '→ محايد'}
          </span>
          <span className="font-bold text-white">{layer.score}%</span>
          <span className="text-neutral-600">({(layer.weight * 100).toFixed(0)}%)</span>
        </div>
      </div>
      <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700`}
          style={{ width: `${layer.score}%`, opacity: 0.6 + (layer.score / 250) }}
        />
      </div>
      {showDetail && (
        <p className="text-[11px] text-neutral-500 pr-2">{layer.detail}</p>
      )}
    </div>
  )
}

function ProbabilityGauge({ value }: { value: number }) {
  const circumference = 2 * Math.PI * 40
  const offset = circumference - (value / 100) * circumference
  const color = value >= 85 ? '#10B981' : value >= 75 ? '#F59E0B' : value >= 60 ? '#F97316' : '#6B7280'

  return (
    <svg width="96" height="96" className="transform -rotate-90">
      <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
      <circle
        cx="48" cy="48" r="40" fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-1000"
        style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
      />
    </svg>
  )
}

function MetricCard({ title, icon, items }: { title: string; icon: string; items: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="card space-y-3">
      <h4 className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
        <span>{icon}</span> {title}
      </h4>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between text-xs">
            <span className="text-neutral-500">{item.label}</span>
            <span className={`font-medium font-mono ${item.color || 'text-neutral-300'}`}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color?: string }) {
  return (
    <div className="card text-center space-y-2">
      <p className="text-2xl">{icon}</p>
      <p className={`text-2xl font-bold ${color || 'text-white'}`}>{value}</p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  )
}
