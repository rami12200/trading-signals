'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { formatPrice, SIGNAL_PAIRS } from '@/lib/binance'
import { useBinanceWS } from '@/hooks/useBinanceWS'
import { ProtectedPage } from '@/components/ProtectedPage'
import { useAuth } from '@/components/AuthProvider'

interface QuickScalpSignal {
  id: string
  symbol: string
  displaySymbol: string
  price: number
  action: 'BUY' | 'SELL' | 'EXIT_BUY' | 'EXIT_SELL' | 'WAIT'
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

interface MyTrade {
  id: string
  symbol: string
  displaySymbol: string
  direction: 'BUY' | 'SELL'
  entry: number
  stopLoss: number
  target: number
  reason: string
  openedAt: string
  currentPrice: number
}

interface ClosedTrade {
  id: string
  symbol: string
  displaySymbol: string
  direction: 'BUY' | 'SELL'
  entry: number
  exitPrice: number
  stopLoss: number
  target: number
  reason: string
  openedAt: string
  closedAt: string
  pnl: number
  pnlPct: number
  result: 'WIN' | 'LOSS'
}

const TRADES_KEY = 'quickscalp_my_trades'
const HISTORY_KEY = 'quickscalp_trade_history'
const LAST_SIGNALS_KEY = 'quickscalp_last_signals'
const FAVORITES_KEY = 'quickscalp_favorites'
const SHOW_FAV_KEY = 'quickscalp_show_fav_only'

function loadTrades(): MyTrade[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(TRADES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveTrades(trades: MyTrade[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(TRADES_KEY, JSON.stringify(trades))
}

function loadFavorites(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(FAVORITES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveFavorites(favs: string[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs))
}

function loadShowFavOnly(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(SHOW_FAV_KEY) === 'true'
  } catch { return false }
}

function saveShowFavOnly(show: boolean) {
  if (typeof window === 'undefined') return
  localStorage.setItem(SHOW_FAV_KEY, String(show))
}

function loadHistory(): ClosedTrade[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveHistory(history: ClosedTrade[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50)))
}

function loadLastSignals(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(LAST_SIGNALS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveLastSignals(signals: Record<string, string>) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LAST_SIGNALS_KEY, JSON.stringify(signals))
}

function sendNotification(title: string, body: string) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico', tag: 'trade-signal' })
    }
  } catch {}
}

function playAlertSound(type: 'buy' | 'sell' | 'exit') {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    gain.gain.value = 0.15
    if (type === 'buy') {
      osc.frequency.value = 800
      osc.type = 'sine'
    } else if (type === 'sell') {
      osc.frequency.value = 400
      osc.type = 'square'
    } else {
      osc.frequency.value = 600
      osc.type = 'triangle'
    }
    osc.start()
    osc.stop(ctx.currentTime + 0.25)
    setTimeout(() => {
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      gain2.gain.value = 0.15
      osc2.frequency.value = type === 'buy' ? 1000 : type === 'sell' ? 300 : 700
      osc2.type = osc.type
      osc2.start()
      osc2.stop(ctx.currentTime + 0.3)
    }, 280)
  } catch {}
}

const timeframes = [
  { value: '5m', label: '5 دقائق' },
  { value: '15m', label: '15 دقيقة' },
]

export default function QuickScalpPage() {
  const { user } = useAuth()
  const [signals, setSignals] = useState<QuickScalpSignal[]>([])
  const [timeframe, setTimeframe] = useState('15m')
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState('')
  const [showDetails, setShowDetails] = useState<string | null>(null)
  const [myTrades, setMyTrades] = useState<MyTrade[]>([])
  const [tradeHistory, setTradeHistory] = useState<ClosedTrade[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [executingTrade, setExecutingTrade] = useState<string | null>(null)
  const [executedTrades, setExecutedTrades] = useState<Record<string, boolean>>({})
  const [favorites, setFavorites] = useState<string[]>([])
  const [showFavOnly, setShowFavOnly] = useState(false)
  const lastSignalsRef = useRef<Record<string, string>>({})
  const isFirstLoad = useRef(true)
  const autoTradeExecutedRef = useRef<Record<string, number>>({})
  const autoTradeLastSignalsRef = useRef<Record<string, string>>({})
  const autoTradeFirstRun = useRef(true)
  const [autoTradeLog, setAutoTradeLog] = useState<string[]>([])
  const [lotSizes, setLotSizes] = useState<Record<string, number>>({})
  const [customLotInput, setCustomLotInput] = useState<Record<string, string>>({})

  // WebSocket for live prices — stable reference to avoid reconnects
  const wsSymbols = useMemo(() => SIGNAL_PAIRS, [])
  const { prices: livePrices, connected: wsConnected } = useBinanceWS(wsSymbols)

  // Load trades + history + favorites + lot sizes from localStorage on mount
  useEffect(() => {
    setMyTrades(loadTrades())
    setTradeHistory(loadHistory())
    setFavorites(loadFavorites())
    setShowFavOnly(loadShowFavOnly())
    lastSignalsRef.current = loadLastSignals()
    try {
      const savedLots = localStorage.getItem('quickscalp_lot_sizes')
      if (savedLots) setLotSizes(JSON.parse(savedLots))
    } catch {}
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const setLotSize = (symbol: string, lot: number) => {
    const updated = { ...lotSizes, [symbol]: lot }
    setLotSizes(updated)
    try { localStorage.setItem('quickscalp_lot_sizes', JSON.stringify(updated)) } catch {}
  }

  const getLotSize = (symbol: string) => lotSizes[symbol] || 0.1

  const toggleFavorite = (symbol: string) => {
    const updated = favorites.includes(symbol)
      ? favorites.filter(f => f !== symbol)
      : [...favorites, symbol]
    setFavorites(updated)
    saveFavorites(updated)
  }

  const toggleShowFavOnly = () => {
    const newVal = !showFavOnly
    setShowFavOnly(newVal)
    saveShowFavOnly(newVal)
  }

  // Update active trades with WebSocket live prices
  useEffect(() => {
    if (Object.keys(livePrices).length === 0) return
    setMyTrades((prev) => {
      let changed = false
      const updated = prev.map((t) => {
        const lp = livePrices[t.symbol]
        if (lp && lp.price !== t.currentPrice) {
          changed = true
          return { ...t, currentPrice: lp.price }
        }
        return t
      })
      if (changed) saveTrades(updated)
      return changed ? updated : prev
    })
  }, [livePrices])

  // Helper: get live price for a symbol (WebSocket first, fallback to signal price)
  const getLivePrice = (symbol: string, fallback: number) => {
    return livePrices[symbol]?.price ?? fallback
  }

  // Check if already in a trade for this symbol
  const hasActiveTrade = (symbol: string) => {
    return myTrades.some((t) => t.symbol === symbol)
  }

  // Save trade locally (no API call)
  const saveTradLocally = (sig: QuickScalpSignal) => {
    const livePrice = getLivePrice(sig.symbol, sig.price)
    const trade: MyTrade = {
      id: `trade-${sig.symbol}-${Date.now()}`,
      symbol: sig.symbol,
      displaySymbol: sig.displaySymbol,
      direction: sig.action === 'BUY' ? 'BUY' : 'SELL',
      entry: sig.entry,
      stopLoss: sig.stopLoss,
      target: sig.target,
      reason: sig.reason,
      openedAt: new Date().toLocaleTimeString('ar-EG'),
      currentPrice: livePrice,
    }
    const updated = [trade, ...myTrades]
    setMyTrades(updated)
    saveTrades(updated)
  }

  // openTrade is now only for local save (button "احفظ البيانات")
  const openTrade = (sig: QuickScalpSignal) => {
    saveTradLocally(sig)
  }

  const closeTrade = (tradeId: string) => {
    const trade = myTrades.find((t) => t.id === tradeId)
    if (trade) {
      const exitPrice = getLivePrice(trade.symbol, trade.currentPrice)
      const pnl = trade.direction === 'BUY' ? exitPrice - trade.entry : trade.entry - exitPrice
      const pnlPct = (pnl / trade.entry) * 100
      const closed: ClosedTrade = {
        id: trade.id,
        symbol: trade.symbol,
        displaySymbol: trade.displaySymbol,
        direction: trade.direction,
        entry: trade.entry,
        exitPrice,
        stopLoss: trade.stopLoss,
        target: trade.target,
        reason: trade.reason,
        openedAt: trade.openedAt,
        closedAt: new Date().toLocaleTimeString('ar-EG'),
        pnl,
        pnlPct,
        result: pnl >= 0 ? 'WIN' : 'LOSS',
      }
      const updatedHistory = [closed, ...tradeHistory]
      setTradeHistory(updatedHistory)
      saveHistory(updatedHistory)
    }
    const updated = myTrades.filter((t) => t.id !== tradeId)
    setMyTrades(updated)
    saveTrades(updated)
  }

  // Trade history stats
  const historyStats = useMemo(() => {
    if (tradeHistory.length === 0) return null
    const wins = tradeHistory.filter((t) => t.result === 'WIN').length
    const losses = tradeHistory.filter((t) => t.result === 'LOSS').length
    const winRate = (wins / tradeHistory.length) * 100
    const totalPnlPct = tradeHistory.reduce((sum, t) => sum + t.pnlPct, 0)
    return { wins, losses, winRate, totalPnlPct, total: tradeHistory.length }
  }, [tradeHistory])

  // REST API for signals/indicators (every 15s — WebSocket handles live prices)
  const fetchSignals = useCallback(async () => {
    try {
      const res = await fetch(`/api/quickscalp?interval=${timeframe}`)
      const json = await res.json()
      if (json.success) {
        const newSignals = json.data.signals as QuickScalpSignal[]
        setSignals(newSignals)
        setLastUpdate(new Date().toLocaleTimeString('ar-EG'))

        // Sound alert for NEW actionable signals
        if (!isFirstLoad.current && soundEnabled) {
          const prev = lastSignalsRef.current
          for (const sig of newSignals) {
            // Skip alert if we are in "Fav Only" mode and this symbol is not a favorite
            if (showFavOnly && !favorites.includes(sig.symbol)) continue

            const prevAction = prev[sig.symbol]
            if (sig.action === 'BUY' && prevAction !== 'BUY') {
              playAlertSound('buy')
              sendNotification(`🟢 شراء ${sig.displaySymbol}`, sig.reason)
            } else if (sig.action === 'SELL' && prevAction !== 'SELL') {
              playAlertSound('sell')
              sendNotification(`🔴 بيع ${sig.displaySymbol}`, sig.reason)
            } else if ((sig.action === 'EXIT_BUY' || sig.action === 'EXIT_SELL') && prevAction !== sig.action) {
              playAlertSound('exit')
              sendNotification(`⚠️ اخرج ${sig.displaySymbol}`, sig.reason)
            }
          }
        }
        isFirstLoad.current = false

        // Save current signals for next comparison
        const sigMap: Record<string, string> = {}
        for (const s of newSignals) sigMap[s.symbol] = s.action
        lastSignalsRef.current = sigMap
        saveLastSignals(sigMap)
      }
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }, [timeframe, soundEnabled, showFavOnly, favorites]) // Display-only dependencies

  useEffect(() => {
    setLoading(true)
    fetchSignals()
    const timer = window.setInterval(fetchSignals, 15000)
    return () => window.clearInterval(timer)
  }, [fetchSignals])

  // === AUTO-TRADE: Independent fetch using profile timeframe ===
  useEffect(() => {
    if (!user?.auto_trade || !user?.api_key || user?.plan !== 'vip') return

    const autoTradeTimeframe = user.auto_trade_timeframe || '15m'
    const minConf = user.auto_trade_min_confidence ?? 65

    const runAutoTrade = async () => {
      try {
        const res = await fetch(`/api/quickscalp?interval=${autoTradeTimeframe}`)
        const json = await res.json()
        if (!json.success) return

        const atSignals = json.data.signals as QuickScalpSignal[]

        // Skip first run to avoid executing existing signals
        if (autoTradeFirstRun.current) {
          const sigMap: Record<string, string> = {}
          for (const s of atSignals) sigMap[s.symbol] = s.action
          autoTradeLastSignalsRef.current = sigMap
          autoTradeFirstRun.current = false
          return
        }

        const prev = autoTradeLastSignalsRef.current
        for (const sig of atSignals) {
          if (sig.action !== 'BUY' && sig.action !== 'SELL') continue
          if (prev[sig.symbol] === sig.action) continue
          if ((sig.confidence ?? 0) < minConf) continue
          const lastExec = autoTradeExecutedRef.current[sig.symbol]
          if (lastExec && Date.now() - lastExec < 5 * 60 * 1000) continue
          if (myTrades.some(t => t.symbol === sig.symbol)) continue

          autoTradeExecutedRef.current[sig.symbol] = Date.now()
          const time = new Date().toLocaleTimeString('ar-EG')
          setAutoTradeLog(l => [`🤖 ${time} — ${sig.action === 'BUY' ? 'شراء' : 'بيع'} ${sig.displaySymbol} (${sig.confidence}%)`, ...l.slice(0, 9)])

          fetch('/api/signals/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              symbol: sig.symbol,
              action: sig.action,
              entry: sig.entry,
              stopLoss: sig.stopLoss,
              takeProfit: sig.target,
              lotSize: getLotSize(sig.symbol),
              api_key: user.api_key,
            }),
          }).then(r => r.json()).then(data => {
            if (data.success) {
              saveTradLocally(sig)
              sendNotification(`🤖 تنفيذ تلقائي: ${sig.action === 'BUY' ? 'شراء' : 'بيع'} ${sig.displaySymbol}`, `ثقة ${sig.confidence}%`)
            }
          }).catch(() => {})
        }

        // Update auto-trade signal map
        const sigMap: Record<string, string> = {}
        for (const s of atSignals) sigMap[s.symbol] = s.action
        autoTradeLastSignalsRef.current = sigMap
      } catch {}
    }

    runAutoTrade()
    const timer = window.setInterval(runAutoTrade, 15000)
    return () => window.clearInterval(timer)
  }, [user?.auto_trade, user?.api_key, user?.plan, user?.auto_trade_timeframe, user?.auto_trade_min_confidence, myTrades])

  // Apply favorites filter
  const displayedSignals = showFavOnly
    ? signals.filter(s => favorites.includes(s.symbol))
    : signals

  const actionable = displayedSignals.filter((s) => s.action !== 'WAIT')
  const buySignals = displayedSignals.filter((s) => s.action === 'BUY')
  const sellSignals = displayedSignals.filter((s) => s.action === 'SELL')
  const exitSignals = displayedSignals.filter((s) => s.action === 'EXIT_BUY' || s.action === 'EXIT_SELL')

  const getMomentumText = (m: string) => {
    const map: Record<string, string> = {
      STRONG_UP: 'صعود قوي',
      UP: 'صاعد',
      WEAK: 'ضعيف',
      DOWN: 'هابط',
      STRONG_DOWN: 'هبوط قوي',
    }
    return map[m] || m
  }

  const getMomentumColor = (m: string) => {
    if (m === 'STRONG_UP' || m === 'UP') return 'text-bullish'
    if (m === 'STRONG_DOWN' || m === 'DOWN') return 'text-bearish'
    return 'text-neutral'
  }

  const getActionBg = (action: string) => {
    if (action === 'BUY') return 'border-bullish/30 bg-bullish/[0.03]'
    if (action === 'SELL') return 'border-bearish/30 bg-bearish/[0.03]'
    if (action === 'EXIT_BUY' || action === 'EXIT_SELL') return 'border-yellow-500/30 bg-yellow-500/[0.03]'
    return 'border-white/[0.06]'
  }

  const getActionColor = (action: string) => {
    if (action === 'BUY') return 'text-bullish'
    if (action === 'SELL') return 'text-bearish'
    if (action === 'EXIT_BUY' || action === 'EXIT_SELL') return 'text-yellow-400'
    return 'text-neutral-400'
  }

  return (
    <ProtectedPage requiredPlan="pro" pageName="quickscalp" featureName="السكالبينج السريع">
    <main className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">السكالبينج السريع</h1>
          <p className="text-sm text-neutral-500 mt-1">
            استراتيجية أرباح صغيرة متكررة — EMA 9/21 + RSI + MACD
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleShowFavOnly}
            className={`px-3 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
              showFavOnly
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                : 'bg-surface border border-white/10 text-neutral-400 hover:text-white'
            }`}
            title="إظهار المفضلة فقط"
          >
            <span>⭐</span>
            <span className="hidden md:inline">{showFavOnly ? 'المفضلة فقط' : 'كل العملات'}</span>
          </button>
          
          <div className="flex gap-2">
            {timeframes.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setTimeframe(tf.value)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  timeframe === tf.value
                    ? 'bg-accent text-white shadow-lg shadow-accent/20'
                    : 'bg-surface border border-white/10 hover:bg-surface-light'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-2.5 py-1.5 rounded-lg text-xs transition-all ${
              soundEnabled ? 'bg-accent/20 text-accent border border-accent/30' : 'bg-surface border border-white/10 text-neutral-500'
            }`}
            title={soundEnabled ? 'الصوت مفعّل' : 'الصوت مغلق'}
          >
            {soundEnabled ? '🔔' : '🔕'}
          </button>
          <div className="flex items-center gap-1.5">
            <span className={`inline-block w-2 h-2 rounded-full ${wsConnected ? 'bg-bullish animate-pulse' : 'bg-bearish'}`} />
            <span className="text-[10px] text-neutral-500">
              {wsConnected ? 'لحظي' : 'غير متصل'}
            </span>
          </div>
          {lastUpdate && (
            <span className="text-xs text-neutral-500">تحديث: {lastUpdate}</span>
          )}
        </div>
      </div>

      {/* Strategy Explanation */}
      <div className="card mb-6 bg-gradient-to-r from-accent/5 to-purple-500/5 border-accent/10">
        <div className="flex flex-col md:flex-row gap-4 text-sm">
          <div className="flex-1">
            <h3 className="font-semibold mb-2">كيف تعمل الاستراتيجية؟</h3>
            <div className="space-y-1 text-neutral-400 text-xs">
              <p>🟢 <strong className="text-bullish">اشترِ</strong> — EMA 9 تعبر فوق EMA 21 أو ارتداد من دعم + RSI مناسب</p>
              <p>🔴 <strong className="text-bearish">بِع</strong> — EMA 9 تعبر تحت EMA 21 أو ارتداد من مقاومة + RSI مناسب</p>
              <p>⚠️ <strong className="text-yellow-400">اخرج</strong> — RSI في ذروة + MACD يضعف = قرب يعكس</p>
              <p>⏳ <strong className="text-neutral-400">انتظر</strong> — لا توجد فرصة واضحة حالياً</p>
            </div>
          </div>
          <div className="md:w-48 text-center">
            <div className="text-xs text-neutral-500 mb-1">الهدف لكل صفقة</div>
            <div className="text-2xl font-bold text-accent">$5 - $20</div>
            <div className="text-xs text-neutral-500 mt-1">أرباح صغيرة × صفقات كثيرة</div>
          </div>
        </div>
      </div>

      {/* Auto-Trade Status Banner */}
      {user?.auto_trade && user?.plan === 'vip' && (
        <div className="card mb-6 border-amber-500/20 bg-gradient-to-r from-amber-500/[0.03] to-orange-500/[0.03]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-bullish animate-pulse" />
              <span className="text-sm font-bold text-amber-400">🤖 التنفيذ التلقائي مفعّل</span>
            </div>
            <span className="text-[10px] text-neutral-500">
              {user.auto_trade_timeframe === '5m' ? '5 دقائق' : '15 دقيقة'} · الحد الأدنى: {user.auto_trade_min_confidence ?? 65}% ثقة
            </span>
          </div>
          {autoTradeLog.length > 0 && (
            <div className="space-y-0.5 mt-2 max-h-24 overflow-y-auto">
              {autoTradeLog.map((log, i) => (
                <div key={i} className="text-[10px] text-neutral-400 font-mono">{log}</div>
              ))}
            </div>
          )}
          {autoTradeLog.length === 0 && (
            <div className="text-[10px] text-neutral-500">في انتظار إشارات جديدة تحقق شروط الثقة...</div>
          )}
        </div>
      )}

      {/* Price Disclaimer */}
      <div className="card mb-6 border-yellow-500/20 bg-yellow-500/[0.03]">
        <div className="flex items-start gap-3 text-xs">
          <span className="text-yellow-400 text-lg leading-none">⚠️</span>
          <div className="text-neutral-400">
            <strong className="text-yellow-400">الأسعار تقريبية</strong> — البيانات من Binance وقد تختلف عن سعر Exness بـ $10-$70.
            اعتمد على <strong className="text-white">اتجاه الإشارة</strong> (اشترِ/بِع/اخرج) وادخل بالسعر الموجود على Exness.
            عدّل الوقف والهدف بنفس الفرق.
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="card text-center py-3">
          <div className="text-2xl font-bold">{signals.length}</div>
          <div className="text-[10px] text-neutral-500">عملات</div>
        </div>
        <div className="card text-center py-3">
          <div className="text-2xl font-bold text-accent">{actionable.length}</div>
          <div className="text-[10px] text-neutral-500">فرص الآن</div>
        </div>
        <div className="card text-center py-3">
          <div className="text-2xl font-bold text-bullish">{buySignals.length}</div>
          <div className="text-[10px] text-neutral-500">شراء</div>
        </div>
        <div className="card text-center py-3">
          <div className="text-2xl font-bold text-bearish">{sellSignals.length}</div>
          <div className="text-[10px] text-neutral-500">بيع</div>
        </div>
        <div className="card text-center py-3">
          <div className="text-2xl font-bold text-yellow-400">{exitSignals.length}</div>
          <div className="text-[10px] text-neutral-500">اخرج</div>
        </div>
      </div>

      {/* My Active Trades */}
      {myTrades.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            📋 صفقاتي النشطة
            <span className="text-xs font-normal text-neutral-500 bg-surface px-2 py-0.5 rounded-full">
              {myTrades.length}
            </span>
          </h2>
          <div className="space-y-2">
            {myTrades.map((trade) => {
              const pnl = trade.direction === 'BUY'
                ? trade.currentPrice - trade.entry
                : trade.entry - trade.currentPrice
              const pnlPct = (pnl / trade.entry) * 100
              const isProfit = pnl >= 0
              const hitSL = trade.direction === 'BUY'
                ? trade.currentPrice <= trade.stopLoss
                : trade.currentPrice >= trade.stopLoss
              const hitTP = trade.direction === 'BUY'
                ? trade.currentPrice >= trade.target
                : trade.currentPrice <= trade.target

              return (
                <div
                  key={trade.id}
                  className={`card border ${
                    hitSL ? 'border-bearish/40 bg-bearish/[0.05]' :
                    hitTP ? 'border-bullish/40 bg-bullish/[0.05]' :
                    isProfit ? 'border-bullish/20 bg-bullish/[0.02]' :
                    'border-bearish/20 bg-bearish/[0.02]'
                  }`}
                >
                  <div className="flex flex-col md:flex-row justify-between gap-3">
                    {/* Trade Info */}
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="font-bold">{trade.displaySymbol}</div>
                        <div className={`text-xs font-bold ${trade.direction === 'BUY' ? 'text-bullish' : 'text-bearish'}`}>
                          {trade.direction === 'BUY' ? '🟢 شراء' : '🔴 بيع'}
                        </div>
                      </div>
                      <div className="text-xs text-neutral-500">
                        <div>دخول: {trade.openedAt}</div>
                        <div className="text-neutral-600">{trade.reason}</div>
                      </div>
                    </div>

                    {/* Levels */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-center px-2.5 py-1 bg-background/50 rounded-lg">
                        <div className="text-[9px] text-neutral-500">دخول</div>
                        <div className="font-mono text-xs font-bold">${formatPrice(trade.entry)}</div>
                      </div>
                      <div className="text-center px-2.5 py-1 bg-bearish/5 rounded-lg">
                        <div className="text-[9px] text-neutral-500">وقف</div>
                        <div className={`font-mono text-xs font-bold ${hitSL ? 'text-bearish animate-pulse' : 'text-bearish'}`}>
                          ${formatPrice(trade.stopLoss)}
                        </div>
                      </div>
                      <div className="text-center px-2.5 py-1 bg-bullish/5 rounded-lg">
                        <div className="text-[9px] text-neutral-500">هدف</div>
                        <div className={`font-mono text-xs font-bold ${hitTP ? 'text-bullish animate-pulse' : 'text-bullish'}`}>
                          ${formatPrice(trade.target)}
                        </div>
                      </div>
                      <div className="text-center px-2.5 py-1 bg-background/50 rounded-lg">
                        <div className="text-[9px] text-neutral-500">الآن</div>
                        <div className="font-mono text-xs font-bold text-white">
                          ${formatPrice(trade.currentPrice)}
                        </div>
                      </div>
                      <div className={`text-center px-3 py-1 rounded-lg ${isProfit ? 'bg-bullish/10' : 'bg-bearish/10'}`}>
                        <div className="text-[9px] text-neutral-500">الربح</div>
                        <div className={`font-mono text-sm font-bold ${isProfit ? 'text-bullish' : 'text-bearish'}`}>
                          {isProfit ? '+' : ''}{pnlPct.toFixed(3)}%
                        </div>
                      </div>
                    </div>

                    {/* Status + Close */}
                    <div className="flex items-center gap-2">
                      {hitSL && (
                        <span className="text-xs text-bearish font-bold animate-pulse">⛔ وصل الوقف!</span>
                      )}
                      {hitTP && (
                        <span className="text-xs text-bullish font-bold animate-pulse">🎯 وصل الهدف!</span>
                      )}
                      <button
                        onClick={() => closeTrade(trade.id)}
                        className="px-3 py-1.5 bg-surface border border-white/10 rounded-lg text-xs hover:bg-white/10 transition-all"
                      >
                        أغلقت الصفقة ✕
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Trade History & Stats */}
      {(tradeHistory.length > 0 || historyStats) && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              📊 إحصائيات الأداء
              <span className="text-xs font-normal text-neutral-500 bg-surface px-2 py-0.5 rounded-full">
                {tradeHistory.length} صفقة
              </span>
            </h2>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs text-accent hover:text-accent/80 transition-all"
            >
              {showHistory ? 'إخفاء التاريخ ▲' : 'عرض التاريخ ▼'}
            </button>
          </div>

          {historyStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div className="card text-center py-3">
                <div className={`text-2xl font-bold ${historyStats.winRate >= 50 ? 'text-bullish' : 'text-bearish'}`}>
                  {historyStats.winRate.toFixed(0)}%
                </div>
                <div className="text-[10px] text-neutral-500">نسبة النجاح</div>
              </div>
              <div className="card text-center py-3">
                <div className="text-2xl font-bold text-bullish">{historyStats.wins}</div>
                <div className="text-[10px] text-neutral-500">رابحة</div>
              </div>
              <div className="card text-center py-3">
                <div className="text-2xl font-bold text-bearish">{historyStats.losses}</div>
                <div className="text-[10px] text-neutral-500">خاسرة</div>
              </div>
              <div className="card text-center py-3">
                <div className={`text-2xl font-bold ${historyStats.totalPnlPct >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                  {historyStats.totalPnlPct >= 0 ? '+' : ''}{historyStats.totalPnlPct.toFixed(3)}%
                </div>
                <div className="text-[10px] text-neutral-500">إجمالي الربح</div>
              </div>
            </div>
          )}

          {showHistory && (
            <div className="space-y-1.5">
              {tradeHistory.map((t) => (
                <div
                  key={t.id}
                  className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-xs ${
                    t.result === 'WIN' ? 'bg-bullish/[0.05] border border-bullish/10' : 'bg-bearish/[0.05] border border-bearish/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`font-bold ${t.direction === 'BUY' ? 'text-bullish' : 'text-bearish'}`}>
                      {t.direction === 'BUY' ? '🟢' : '🔴'} {t.displaySymbol}
                    </span>
                    <span className="text-neutral-500">
                      ${formatPrice(t.entry)} → ${formatPrice(t.exitPrice)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-neutral-600">{t.openedAt} → {t.closedAt}</span>
                    <span className={`font-bold font-mono ${t.result === 'WIN' ? 'text-bullish' : 'text-bearish'}`}>
                      {t.pnlPct >= 0 ? '+' : ''}{t.pnlPct.toFixed(3)}%
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      t.result === 'WIN' ? 'bg-bullish/20 text-bullish' : 'bg-bearish/20 text-bearish'
                    }`}>
                      {t.result === 'WIN' ? 'ربح' : 'خسارة'}
                    </span>
                  </div>
                </div>
              ))}
              {tradeHistory.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm('هل تريد مسح تاريخ الصفقات؟')) {
                      setTradeHistory([])
                      saveHistory([])
                    }
                  }}
                  className="text-[10px] text-neutral-600 hover:text-bearish transition-all mt-2"
                >
                  مسح التاريخ
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Signals */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card animate-pulse h-32" />
          ))}
        </div>
      ) : displayedSignals.length === 0 ? (
        <div className="card text-center py-20">
          <p className="text-neutral-400 text-lg">لا توجد بيانات حالياً</p>
          <p className="text-neutral-500 text-sm mt-2">
            {showFavOnly ? 'لم تختر أي عملات مفضلة، أو لا توجد إشارات لها' : 'جاري الاتصال بـ Binance...'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedSignals.map((sig) => (
            <div
              key={sig.symbol}
              className={`card border ${getActionBg(sig.action)} transition-all`}
            >
              {/* Main Row */}
              <div
                className="flex flex-col md:flex-row justify-between gap-4 cursor-pointer"
                onClick={() => setShowDetails(showDetails === sig.symbol ? null : sig.symbol)}
              >
                {/* Left: Symbol + Action */}
                <div className="flex items-center gap-4 flex-1">
                  
                  {/* Favorite Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFavorite(sig.symbol)
                    }}
                    className={`p-2 rounded-full transition-all hover:bg-white/5 ${
                      favorites.includes(sig.symbol) ? 'text-yellow-400 scale-110' : 'text-neutral-600 hover:text-yellow-400'
                    }`}
                    title={favorites.includes(sig.symbol) ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
                  >
                    <span className="text-xl">{favorites.includes(sig.symbol) ? '★' : '☆'}</span>
                  </button>

                  <div className="min-w-[120px]">
                    <div className="font-bold text-lg">{sig.displaySymbol}</div>
                    <div className="font-mono text-sm text-neutral-400">
                      ${formatPrice(getLivePrice(sig.symbol, sig.price))}
                      {livePrices[sig.symbol] && (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-bullish animate-pulse mr-1" />
                      )}
                    </div>
                  </div>

                  {/* Action Badge */}
                  <div className="text-center min-w-[130px]">
                    <div className={`text-lg font-bold ${getActionColor(sig.action)}`}>
                      {sig.actionText}
                    </div>
                    <div className={`text-xs ${getMomentumColor(sig.momentum)}`}>
                      الزخم: {getMomentumText(sig.momentum)}
                    </div>
                    {sig.action !== 'WAIT' && sig.signalQuality && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-md mt-0.5 inline-block ${
                        sig.signalQuality === 'STRONG' ? 'bg-bullish/20 text-bullish' :
                        sig.signalQuality === 'WEAK' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-accent/20 text-accent'
                      }`}>
                        {sig.signalQuality === 'STRONG' ? '💪 إشارة قوية' :
                         sig.signalQuality === 'WEAK' ? '⚡ فوليوم ضعيف' :
                         '✓ إشارة عادية'}
                      </span>
                    )}
                    {/* Confidence + Signal Age */}
                    {sig.action !== 'WAIT' && sig.confidence > 0 && (
                      <div className="mt-1 flex flex-col items-center gap-0.5">
                        <div className="flex items-center gap-1">
                          <div className={`w-8 h-1.5 rounded-full overflow-hidden bg-surface`}>
                            <div
                              className={`h-full rounded-full transition-all ${
                                sig.confidence >= 70 ? 'bg-bullish' :
                                sig.confidence >= 50 ? 'bg-accent' :
                                sig.confidence >= 35 ? 'bg-yellow-500' : 'bg-bearish'
                              }`}
                              style={{ width: `${sig.confidence}%` }}
                            />
                          </div>
                          <span className={`text-[9px] font-bold font-mono ${
                            sig.confidence >= 70 ? 'text-bullish' :
                            sig.confidence >= 50 ? 'text-accent' :
                            sig.confidence >= 35 ? 'text-yellow-400' : 'text-bearish'
                          }`}>
                            {sig.confidence}%
                          </span>
                        </div>
                        <span className="text-[8px] text-neutral-500">
                          {sig.signalAgeSeconds < 60
                            ? `منذ ${sig.signalAgeSeconds} ث`
                            : sig.signalAgeSeconds < 3600
                              ? `منذ ${Math.floor(sig.signalAgeSeconds / 60)} د`
                              : `منذ ${Math.floor(sig.signalAgeSeconds / 3600)} س`}
                          {sig.signalAgeSeconds > 600 && ' ⚠️'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Reason */}
                  <div className="flex-1 hidden md:block">
                    <div className="text-sm text-neutral-300">{sig.reason}</div>
                    {sig.reversalWarning && (
                      <div className="text-xs text-yellow-400 mt-1">
                        ⚠️ {sig.reversalReason}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Levels */}
                {sig.action !== 'WAIT' && (
                  <div className="flex gap-3 items-center">
                    <div className="text-center px-3 py-1.5 bg-background/50 rounded-lg">
                      <div className="text-[10px] text-neutral-500">دخول</div>
                      <div className="font-mono text-sm font-bold">${formatPrice(sig.entry)}</div>
                    </div>
                    <div className="text-center px-3 py-1.5 bg-bearish/5 rounded-lg">
                      <div className="text-[10px] text-neutral-500">وقف</div>
                      <div className="font-mono text-sm font-bold text-bearish">
                        ${formatPrice(sig.stopLoss)}
                      </div>
                      <div className="text-[9px] text-bearish/70">-{sig.riskPct}%</div>
                    </div>
                    <div className="text-center px-3 py-1.5 bg-bullish/5 rounded-lg">
                      <div className="text-[10px] text-neutral-500">هدف</div>
                      <div className="font-mono text-sm font-bold text-bullish">
                        ${formatPrice(sig.target)}
                      </div>
                      <div className="text-[9px] text-bullish/70">+{sig.profitPct}%</div>
                    </div>
                    <div className="text-center px-3 py-1.5 bg-accent/5 rounded-lg">
                      <div className="text-[10px] text-neutral-500">R/R</div>
                      <div className="font-mono text-sm font-bold text-accent">{sig.riskReward}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile reason */}
              <div className="md:hidden mt-3">
                <div className="text-sm text-neutral-300">{sig.reason}</div>
                {sig.reversalWarning && (
                  <div className="text-xs text-yellow-400 mt-1">⚠️ {sig.reversalReason}</div>
                )}
              </div>

              {/* Expanded Details */}
              {showDetails === sig.symbol && (
                <div className="mt-4 pt-4 border-t border-white/[0.06]">
                  {/* Reasons */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {sig.reasons.map((r, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 bg-surface-light/50 rounded-lg text-[11px] text-neutral-300"
                      >
                        {r}
                      </span>
                    ))}
                  </div>

                  {/* Indicators Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {/* RSI */}
                    <div className="p-3 bg-background/50 rounded-xl">
                      <div className="text-[10px] text-neutral-500 mb-1">RSI (14)</div>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-xl font-bold font-mono ${
                          sig.indicators.rsi > 70 ? 'text-bearish' :
                          sig.indicators.rsi < 30 ? 'text-bullish' : 'text-white'
                        }`}>
                          {sig.indicators.rsi.toFixed(1)}
                        </span>
                        <span className="text-[10px] text-neutral-500">{sig.indicators.rsiStatus}</span>
                      </div>
                      {/* RSI Bar */}
                      <div className="mt-2 h-1.5 bg-surface rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            sig.indicators.rsi > 70 ? 'bg-bearish' :
                            sig.indicators.rsi < 30 ? 'bg-bullish' : 'bg-accent'
                          }`}
                          style={{ width: `${Math.min(100, sig.indicators.rsi)}%` }}
                        />
                      </div>
                    </div>

                    {/* EMA */}
                    <div className="p-3 bg-background/50 rounded-xl">
                      <div className="text-[10px] text-neutral-500 mb-1">EMA 9 / 21</div>
                      <div className="font-mono text-sm">
                        <div>9: <span className="text-white">${formatPrice(sig.indicators.ema9)}</span></div>
                        <div>21: <span className="text-white">${formatPrice(sig.indicators.ema21)}</span></div>
                      </div>
                      <div className={`text-[10px] mt-1 ${
                        sig.indicators.emaTrend === 'CROSS_UP' ? 'text-bullish font-bold' :
                        sig.indicators.emaTrend === 'CROSS_DOWN' ? 'text-bearish font-bold' :
                        sig.indicators.emaTrend === 'UP' ? 'text-bullish' : 'text-bearish'
                      }`}>
                        {sig.indicators.emaTrend === 'CROSS_UP' ? '✦ تقاطع صاعد!' :
                         sig.indicators.emaTrend === 'CROSS_DOWN' ? '✦ تقاطع هابط!' :
                         sig.indicators.emaTrend === 'UP' ? 'اتجاه صاعد' : 'اتجاه هابط'}
                      </div>
                    </div>

                    {/* MACD */}
                    <div className="p-3 bg-background/50 rounded-xl">
                      <div className="text-[10px] text-neutral-500 mb-1">MACD</div>
                      <div className={`text-lg font-bold font-mono ${
                        sig.indicators.macdHistogram > 0 ? 'text-bullish' : 'text-bearish'
                      }`}>
                        {sig.indicators.macdHistogram > 0 ? '+' : ''}{sig.indicators.macdHistogram.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-neutral-500">{sig.indicators.macdTrend}</div>
                    </div>

                    {/* Volume + BB */}
                    <div className="p-3 bg-background/50 rounded-xl">
                      <div className="text-[10px] text-neutral-500 mb-1">حجم + بولنجر</div>
                      <div className="text-sm">
                        <span className={sig.indicators.volumeSpike ? 'text-yellow-400 font-bold' : 'text-neutral-400'}>
                          {sig.indicators.volumeSpike ? '📊 حجم مرتفع!' : 'حجم عادي'}
                        </span>
                      </div>
                      <div className="text-[10px] text-neutral-500 mt-1">
                        بولنجر: {sig.indicators.bbPosition.toFixed(0)}%
                      </div>
                      <div className="mt-1 h-1.5 bg-surface rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full transition-all"
                          style={{ width: `${Math.min(100, sig.indicators.bbPosition)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Lot Size Selector + Trade Action Buttons */}
                  {(sig.action === 'BUY' || sig.action === 'SELL') && (
                    <div className="mt-4 space-y-3">
                      {/* Lot Size Selector */}
                      <div className="bg-background/50 rounded-xl p-3">
                        <div className="text-[10px] text-neutral-500 mb-2">حجم اللوت</div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {[0.01, 0.05, 0.1, 0.5, 1.0].map((lot) => (
                            <button
                              key={lot}
                              onClick={(e) => { e.stopPropagation(); setLotSize(sig.symbol, lot); setCustomLotInput(p => ({ ...p, [sig.symbol]: '' })) }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                                getLotSize(sig.symbol) === lot && !customLotInput[sig.symbol]
                                  ? 'bg-accent text-white shadow-lg shadow-accent/20'
                                  : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                              }`}
                            >
                              {lot}
                            </button>
                          ))}
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              placeholder="مخصص"
                              value={customLotInput[sig.symbol] || ''}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                const val = e.target.value
                                setCustomLotInput(p => ({ ...p, [sig.symbol]: val }))
                                const num = parseFloat(val)
                                if (num > 0) setLotSize(sig.symbol, num)
                              }}
                              className="w-20 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-white text-center focus:border-accent/50 focus:outline-none"
                            />
                          </div>
                          <span className="text-[10px] text-neutral-600 mr-auto">
                            الحالي: <span className="text-accent font-bold font-mono">{getLotSize(sig.symbol)}</span>
                          </span>
                        </div>
                      </div>

                      {/* Buttons */}
                      <div className="flex flex-col sm:flex-row justify-center gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openTrade(sig)
                          }}
                          className="px-6 py-3 rounded-xl font-bold text-sm bg-accent hover:bg-accent/80 text-white transition-all shadow-lg shadow-accent/20"
                        >
                          📋 دخلت الصفقة — احفظ البيانات
                        </button>
                        {executedTrades[sig.symbol] ? (
                          <div className="px-6 py-3 rounded-xl font-bold text-sm text-center bg-bullish/20 text-bullish border border-bullish/30">
                            ✅ تم إرسال الأمر لـ MT5
                          </div>
                        ) : (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation()
                              setExecutingTrade(sig.symbol)
                              try {
                                const res = await fetch('/api/signals/execute', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    symbol: sig.symbol,
                                    action: sig.action,
                                    entry: sig.entry,
                                    stopLoss: sig.stopLoss,
                                    takeProfit: sig.target,
                                    lotSize: getLotSize(sig.symbol),
                                    api_key: user?.api_key,
                                  }),
                                })
                                const data = await res.json()
                                if (data.success) {
                                  setExecutedTrades((prev) => ({ ...prev, [sig.symbol]: true }))
                                  setTimeout(() => setExecutedTrades((prev) => ({ ...prev, [sig.symbol]: false })), 10000)
                                  saveTradLocally(sig)
                                } else {
                                  alert('فشل إرسال الأمر: ' + (data.error || 'خطأ غير معروف'))
                                }
                              } catch {
                                alert('فشل الاتصال بالسيرفر')
                              } finally {
                                setExecutingTrade(null)
                              }
                            }}
                            disabled={executingTrade === sig.symbol}
                            className={`px-6 py-3 rounded-xl font-bold text-sm text-center transition-all ${
                              sig.action === 'BUY'
                                ? 'bg-bullish/20 hover:bg-bullish/30 text-bullish border border-bullish/30'
                                : 'bg-bearish/20 hover:bg-bearish/30 text-bearish border border-bearish/30'
                            } ${executingTrade === sig.symbol ? 'opacity-50 cursor-wait' : ''}`}
                          >
                            {executingTrade === sig.symbol
                              ? '⏳ جاري الإرسال...'
                              : sig.action === 'BUY'
                                ? `🟢 نفّذ شراء على MT5 (${getLotSize(sig.symbol)} لوت)`
                                : `🔴 نفّذ بيع على MT5 (${getLotSize(sig.symbol)} لوت)`}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tips */}
      <div className="mt-12 card bg-surface/30">
        <h3 className="font-semibold mb-3 text-sm">نصائح مهمة</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-neutral-400">
          <div className="flex gap-2">
            <span className="text-accent">1.</span>
            <span>لا تدخل صفقة إلا عند ظهور إشارة <strong className="text-white">اشترِ</strong> أو <strong className="text-white">بِع</strong></span>
          </div>
          <div className="flex gap-2">
            <span className="text-accent">2.</span>
            <span>اخرج فوراً عند ظهور إشارة <strong className="text-yellow-400">اخرج</strong> أو عند الوصول للهدف</span>
          </div>
          <div className="flex gap-2">
            <span className="text-accent">3.</span>
            <span>استخدم لوت صغير — الهدف أرباح صغيرة متكررة وليس ضربة واحدة</span>
          </div>
          <div className="flex gap-2">
            <span className="text-accent">4.</span>
            <span>ضع وقف الخسارة دائماً — لا تترك صفقة بدون وقف</span>
          </div>
        </div>
      </div>
    </main>
    </ProtectedPage>
  )
}
