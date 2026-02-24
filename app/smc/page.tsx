'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { formatPrice, SIGNAL_PAIRS } from '@/lib/binance'
import { useBinanceWS } from '@/hooks/useBinanceWS'
import { ProtectedPage } from '@/components/ProtectedPage'
import { useAuth } from '@/components/AuthProvider'

interface LiquidityLevel {
  price: number
  type: string
  label: string
  swept: boolean
}

interface SMCSignal {
  id: string
  symbol: string
  displaySymbol: string
  price: number
  action: 'BUY' | 'SELL' | 'WAIT'
  actionText: string
  reason: string
  reasons: string[]
  entry: number
  stopLoss: number
  target1: number
  target2: number
  profitPct: string
  riskPct: string
  riskReward: string
  filters: {
    volumeSpike: boolean
    volumeRatio: number
    pdhBreak: boolean
    pdlBreak: boolean
    nySession: boolean
    hasTrigger: boolean
  }
  liquidity: {
    levels: LiquidityLevel[]
    sweptLevel: LiquidityLevel | null
    atLiquidity: boolean
  }
  displacement: {
    detected: boolean
    direction: 'UP' | 'DOWN' | 'NONE'
    strength: number
    avgBodyRatio: number
  }
  exhaustion: {
    detected: boolean
    wickRatio: number
    followThrough: boolean
    volumeSlowdown: boolean
  }
  structure: {
    dailyRange: number
    dailyRangePct: number
    vwap: number
    pdh: number
    pdl: number
    asianHigh: number
    asianLow: number
  }
  confidence: number
  confidenceLabel: string
  signalSince: string
  signalAgeSeconds: number
  cancelReasons: string[]
  timestamp: string
}

export default function SMCPage() {
  const { user } = useAuth()
  const [signals, setSignals] = useState<SMCSignal[]>([])
  const [timeframe, setTimeframe] = useState('15m')
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState('')
  const [showDetails, setShowDetails] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [executingTrade, setExecutingTrade] = useState<string | null>(null)
  const [executedTrades, setExecutedTrades] = useState<Record<string, boolean>>({})
  const lastSignalsRef = useRef<Record<string, string>>({})
  const isFirstLoad = useRef(true)
  const [lotSizes, setLotSizes] = useState<Record<string, number>>({})
  const [customLotInput, setCustomLotInput] = useState<Record<string, string>>({})

  const wsSymbols = useMemo(() => SIGNAL_PAIRS, [])
  const { prices: livePrices, connected: wsConnected } = useBinanceWS(wsSymbols)

  useEffect(() => {
    try {
      const savedLots = localStorage.getItem('smc_lot_sizes')
      if (savedLots) setLotSizes(JSON.parse(savedLots))
    } catch {}
  }, [])

  const setLotSize = (symbol: string, lot: number) => {
    const updated = { ...lotSizes, [symbol]: lot }
    setLotSizes(updated)
    try { localStorage.setItem('smc_lot_sizes', JSON.stringify(updated)) } catch {}
  }

  const getLotSize = (symbol: string) => lotSizes[symbol] || (user?.auto_trade_lot_size ?? 0.1)

  const sendNotification = (title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' })
    }
  }

  const fetchSignals = async () => {
    try {
      const res = await fetch(`/api/smc?interval=${timeframe}`)
      const data = await res.json()
      if (data.success) {
        setSignals(data.data.signals)
        setLastUpdate(new Date().toLocaleTimeString('ar-EG'))

        if (!isFirstLoad.current && soundEnabled) {
          for (const sig of data.data.signals) {
            if (sig.action !== 'WAIT') {
              const prev = lastSignalsRef.current[sig.symbol]
              if (prev !== sig.action) {
                try { new Audio('/alert.mp3').play() } catch {}
                sendNotification(
                  `SMC: ${sig.action === 'BUY' ? 'شراء' : 'بيع'} ${sig.displaySymbol}`,
                  sig.reason
                )
              }
            }
          }
        }

        const newMap: Record<string, string> = {}
        for (const sig of data.data.signals) {
          newMap[sig.symbol] = sig.action
        }
        lastSignalsRef.current = newMap
        isFirstLoad.current = false
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    fetchSignals()
    const interval = setInterval(fetchSignals, 15000)
    return () => clearInterval(interval)
  }, [timeframe, soundEnabled])

  const actionable = signals.filter(s => s.action !== 'WAIT')
  const waiting = signals.filter(s => s.action === 'WAIT')

  return (
    <ProtectedPage>
      <div className="max-w-6xl mx-auto px-4 py-8" dir="rtl">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              🏦 Smart Money — سحب السيولة
            </h1>
            <p className="text-sm text-neutral-400 mt-1">
              نظام Liquidity Sweep — الدخول فقط بعد سرقة السيولة
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Timeframe */}
            <div className="flex bg-surface rounded-xl overflow-hidden">
              {[{ v: '5m', l: '5 د' }, { v: '15m', l: '15 د' }].map((tf) => (
                <button
                  key={tf.v}
                  onClick={() => { setTimeframe(tf.v); setLoading(true) }}
                  className={`px-4 py-2 text-sm font-medium transition-all ${
                    timeframe === tf.v
                      ? 'bg-accent text-white'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {tf.l}
                </button>
              ))}
            </div>

            {/* Sound */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl transition-all ${
                soundEnabled ? 'bg-accent/20 text-accent' : 'bg-surface text-neutral-500'
              }`}
            >
              {soundEnabled ? '🔔' : '🔕'}
            </button>

            {/* Status */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-bullish animate-pulse' : 'bg-bearish'}`} />
              <span className="text-xs text-neutral-500">{lastUpdate || '...'}</span>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="card bg-surface/50 text-center py-3">
            <div className="text-2xl font-bold text-accent">{signals.length}</div>
            <div className="text-[10px] text-neutral-500">عملات مراقبة</div>
          </div>
          <div className="card bg-surface/50 text-center py-3">
            <div className="text-2xl font-bold text-bullish">{actionable.length}</div>
            <div className="text-[10px] text-neutral-500">فرص متاحة</div>
          </div>
          <div className="card bg-surface/50 text-center py-3">
            <div className="text-2xl font-bold text-yellow-400">
              {signals.filter(s => s.filters.hasTrigger).length}
            </div>
            <div className="text-[10px] text-neutral-500">محفّزات نشطة</div>
          </div>
          <div className="card bg-surface/50 text-center py-3">
            <div className="text-2xl font-bold text-neutral-300">
              {signals.filter(s => s.liquidity.sweptLevel).length}
            </div>
            <div className="text-[10px] text-neutral-500">Sweeps مكتشفة</div>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin text-4xl mb-4">🏦</div>
            <div className="text-neutral-400">جاري تحليل مناطق السيولة...</div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Actionable signals first */}
            {actionable.map((sig) => (
              <div
                key={sig.symbol}
                onClick={() => setShowDetails(showDetails === sig.symbol ? null : sig.symbol)}
                className={`card cursor-pointer transition-all hover:scale-[1.01] ${
                  sig.action === 'BUY'
                    ? 'border border-bullish/20 bg-bullish/[0.03]'
                    : 'border border-bearish/20 bg-bearish/[0.03]'
                }`}
              >
                {/* Signal Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-lg font-bold">{sig.displaySymbol}</div>
                    <div className="font-mono text-sm text-neutral-300">
                      ${livePrices[sig.symbol] ? formatPrice(livePrices[sig.symbol].price) : formatPrice(sig.price)}
                    </div>
                  </div>
                  <div className={`px-3 py-1.5 rounded-xl text-sm font-bold ${
                    sig.action === 'BUY'
                      ? 'bg-bullish/20 text-bullish'
                      : 'bg-bearish/20 text-bearish'
                  }`}>
                    {sig.actionText}
                  </div>
                </div>

                {/* Reason + Confidence */}
                <div className="mt-2 text-sm text-neutral-300">{sig.reason}</div>

                <div className="mt-2 flex items-center gap-3 flex-wrap">
                  {/* Confidence */}
                  {sig.confidence > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className={`w-10 h-1.5 rounded-full overflow-hidden bg-surface`}>
                        <div
                          className={`h-full rounded-full transition-all ${
                            sig.confidence >= 70 ? 'bg-bullish' :
                            sig.confidence >= 50 ? 'bg-accent' :
                            sig.confidence >= 35 ? 'bg-yellow-500' : 'bg-bearish'
                          }`}
                          style={{ width: `${sig.confidence}%` }}
                        />
                      </div>
                      <span className={`text-xs font-bold font-mono ${
                        sig.confidence >= 70 ? 'text-bullish' :
                        sig.confidence >= 50 ? 'text-accent' :
                        sig.confidence >= 35 ? 'text-yellow-400' : 'text-bearish'
                      }`}>
                        {sig.confidence}%
                      </span>
                    </div>
                  )}

                  {/* Signal age */}
                  <span className="text-[10px] text-neutral-500">
                    {sig.signalAgeSeconds < 60
                      ? `منذ ${sig.signalAgeSeconds} ث`
                      : sig.signalAgeSeconds < 3600
                        ? `منذ ${Math.floor(sig.signalAgeSeconds / 60)} د`
                        : `منذ ${Math.floor(sig.signalAgeSeconds / 3600)} س`}
                  </span>

                  {/* Filter badges */}
                  {sig.filters.volumeSpike && (
                    <span className="text-[9px] bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded-full">📊 فوليوم 150%+</span>
                  )}
                  {sig.filters.nySession && (
                    <span className="text-[9px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full">🏦 نيويورك</span>
                  )}
                  {sig.filters.pdhBreak && (
                    <span className="text-[9px] bg-bearish/10 text-bearish px-2 py-0.5 rounded-full">⬆️ كسر PDH</span>
                  )}
                  {sig.filters.pdlBreak && (
                    <span className="text-[9px] bg-bullish/10 text-bullish px-2 py-0.5 rounded-full">⬇️ كسر PDL</span>
                  )}

                  {/* Cancel warnings */}
                  {sig.cancelReasons.map((cr, i) => (
                    <span key={i} className="text-[9px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full">{cr}</span>
                  ))}
                </div>

                {/* Entry / SL / TP row */}
                <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                  <div className="bg-surface/50 rounded-lg p-2">
                    <div className="text-[9px] text-neutral-500">الدخول</div>
                    <div className="text-xs font-mono font-bold text-white">${formatPrice(sig.entry)}</div>
                  </div>
                  <div className="bg-surface/50 rounded-lg p-2">
                    <div className="text-[9px] text-neutral-500">وقف خسارة</div>
                    <div className="text-xs font-mono font-bold text-bearish">${formatPrice(sig.stopLoss)}</div>
                  </div>
                  <div className="bg-surface/50 rounded-lg p-2">
                    <div className="text-[9px] text-neutral-500">هدف 1 (70%)</div>
                    <div className="text-xs font-mono font-bold text-bullish">${formatPrice(sig.target1)}</div>
                  </div>
                  <div className="bg-surface/50 rounded-lg p-2">
                    <div className="text-[9px] text-neutral-500">هدف 2 (30%)</div>
                    <div className="text-xs font-mono font-bold text-accent">${formatPrice(sig.target2)}</div>
                  </div>
                </div>

                {/* Expanded Details */}
                {showDetails === sig.symbol && (
                  <div className="mt-4 pt-4 border-t border-white/[0.06]">
                    {/* Reasons */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {sig.reasons.map((r, i) => (
                        <span key={i} className="px-2.5 py-1 bg-surface-light/50 rounded-lg text-[11px] text-neutral-300">
                          {r}
                        </span>
                      ))}
                    </div>

                    {/* Checklist Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      {/* Trigger */}
                      <div className={`p-3 rounded-xl ${sig.filters.hasTrigger ? 'bg-bullish/5 border border-bullish/20' : 'bg-surface/50'}`}>
                        <div className="text-[10px] text-neutral-500 mb-1">1. المحفّز</div>
                        <div className={`text-sm font-bold ${sig.filters.hasTrigger ? 'text-bullish' : 'text-bearish'}`}>
                          {sig.filters.hasTrigger ? '✅ موجود' : '❌ غير موجود'}
                        </div>
                        <div className="text-[9px] text-neutral-500 mt-1">
                          Vol: {(sig.filters.volumeRatio * 100).toFixed(0)}%
                        </div>
                      </div>

                      {/* Liquidity */}
                      <div className={`p-3 rounded-xl ${sig.liquidity.sweptLevel ? 'bg-bullish/5 border border-bullish/20' : sig.liquidity.atLiquidity ? 'bg-yellow-500/5 border border-yellow-500/20' : 'bg-surface/50'}`}>
                        <div className="text-[10px] text-neutral-500 mb-1">2. السيولة</div>
                        <div className={`text-sm font-bold ${sig.liquidity.sweptLevel ? 'text-bullish' : sig.liquidity.atLiquidity ? 'text-yellow-400' : 'text-bearish'}`}>
                          {sig.liquidity.sweptLevel ? '✅ تم سحبها' : sig.liquidity.atLiquidity ? '⏳ قريب' : '❌ بعيد'}
                        </div>
                        {sig.liquidity.sweptLevel && (
                          <div className="text-[9px] text-neutral-500 mt-1">{sig.liquidity.sweptLevel.label}</div>
                        )}
                      </div>

                      {/* Displacement */}
                      <div className={`p-3 rounded-xl ${sig.displacement.detected ? 'bg-bullish/5 border border-bullish/20' : 'bg-surface/50'}`}>
                        <div className="text-[10px] text-neutral-500 mb-1">3. الاندفاع</div>
                        <div className={`text-sm font-bold ${sig.displacement.detected ? 'text-bullish' : 'text-bearish'}`}>
                          {sig.displacement.detected
                            ? `✅ ${sig.displacement.direction === 'UP' ? 'صاعد' : 'هابط'} (${sig.displacement.strength})`
                            : '❌ لا يوجد'}
                        </div>
                      </div>

                      {/* Exhaustion */}
                      <div className={`p-3 rounded-xl ${sig.exhaustion.detected ? 'bg-bullish/5 border border-bullish/20' : 'bg-surface/50'}`}>
                        <div className="text-[10px] text-neutral-500 mb-1">4. الاستنزاف</div>
                        <div className={`text-sm font-bold ${sig.exhaustion.detected ? 'text-bullish' : 'text-bearish'}`}>
                          {sig.exhaustion.detected ? '✅ مكتشف' : '❌ لا يوجد'}
                        </div>
                        {sig.exhaustion.wickRatio > 0 && (
                          <div className="text-[9px] text-neutral-500 mt-1">
                            Wick: {(sig.exhaustion.wickRatio * 100).toFixed(0)}%
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Structure Info */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      <div className="p-3 bg-surface/50 rounded-xl">
                        <div className="text-[10px] text-neutral-500 mb-1">VWAP</div>
                        <div className="text-sm font-mono font-bold text-accent">${formatPrice(sig.structure.vwap)}</div>
                      </div>
                      <div className="p-3 bg-surface/50 rounded-xl">
                        <div className="text-[10px] text-neutral-500 mb-1">PDH / PDL</div>
                        <div className="text-[10px] font-mono">
                          <span className="text-bearish">${formatPrice(sig.structure.pdh)}</span>
                          {' / '}
                          <span className="text-bullish">${formatPrice(sig.structure.pdl)}</span>
                        </div>
                      </div>
                      <div className="p-3 bg-surface/50 rounded-xl">
                        <div className="text-[10px] text-neutral-500 mb-1">الجلسة الآسيوية</div>
                        <div className="text-[10px] font-mono">
                          <span className="text-bearish">${formatPrice(sig.structure.asianHigh)}</span>
                          {' / '}
                          <span className="text-bullish">${formatPrice(sig.structure.asianLow)}</span>
                        </div>
                      </div>
                      <div className="p-3 bg-surface/50 rounded-xl">
                        <div className="text-[10px] text-neutral-500 mb-1">النطاق اليومي</div>
                        <div className="text-sm font-mono font-bold text-white">
                          {sig.structure.dailyRangePct.toFixed(2)}%
                        </div>
                      </div>
                    </div>

                    {/* Liquidity Levels */}
                    {sig.liquidity.levels.length > 0 && (
                      <div className="mb-4">
                        <div className="text-[10px] text-neutral-500 mb-2">مستويات السيولة</div>
                        <div className="flex flex-wrap gap-2">
                          {sig.liquidity.levels.map((l, i) => (
                            <div
                              key={i}
                              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono ${
                                l.swept
                                  ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                                  : l.type.includes('HIGH')
                                    ? 'bg-bearish/5 text-bearish border border-bearish/10'
                                    : 'bg-bullish/5 text-bullish border border-bullish/10'
                              }`}
                            >
                              {l.swept ? '💥 ' : ''}{l.label}: ${formatPrice(l.price)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Lot Size + Execute */}
                    {(sig.action === 'BUY' || sig.action === 'SELL') && (
                      <div className="space-y-3">
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
                            <span className="text-[10px] text-neutral-600 mr-auto">
                              الحالي: <span className="text-accent font-bold font-mono">{getLotSize(sig.symbol)}</span>
                            </span>
                          </div>
                        </div>

                        {/* Execute Button */}
                        <div className="flex justify-center">
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
                                      takeProfit: sig.target1,
                                      lotSize: getLotSize(sig.symbol),
                                      api_key: user?.api_key,
                                    }),
                                  })
                                  const data = await res.json()
                                  if (data.success) {
                                    setExecutedTrades(prev => ({ ...prev, [sig.symbol]: true }))
                                    setTimeout(() => setExecutedTrades(prev => ({ ...prev, [sig.symbol]: false })), 10000)
                                  } else {
                                    alert('فشل إرسال الأمر: ' + (data.error || 'خطأ'))
                                  }
                                } catch {
                                  alert('فشل الاتصال بالسيرفر')
                                } finally {
                                  setExecutingTrade(null)
                                }
                              }}
                              disabled={executingTrade === sig.symbol}
                              className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${
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

            {/* Waiting signals */}
            {waiting.map((sig) => (
              <div
                key={sig.symbol}
                onClick={() => setShowDetails(showDetails === sig.symbol ? null : sig.symbol)}
                className="card cursor-pointer transition-all hover:scale-[1.005] bg-surface/30 border border-white/[0.04]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-lg font-bold text-neutral-400">{sig.displaySymbol}</div>
                    <div className="font-mono text-sm text-neutral-500">
                      ${livePrices[sig.symbol] ? formatPrice(livePrices[sig.symbol].price) : formatPrice(sig.price)}
                    </div>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl text-xs font-medium bg-white/5 text-neutral-500">
                    ⏳ انتظر
                  </div>
                </div>

                <div className="mt-2 text-xs text-neutral-500">{sig.reason}</div>

                {/* Mini filter status */}
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className={`text-[9px] px-2 py-0.5 rounded-full ${sig.filters.hasTrigger ? 'bg-bullish/10 text-bullish' : 'bg-white/5 text-neutral-600'}`}>
                    {sig.filters.hasTrigger ? '✅' : '❌'} محفّز
                  </span>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full ${sig.liquidity.atLiquidity || sig.liquidity.sweptLevel ? 'bg-bullish/10 text-bullish' : 'bg-white/5 text-neutral-600'}`}>
                    {sig.liquidity.atLiquidity || sig.liquidity.sweptLevel ? '✅' : '❌'} سيولة
                  </span>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full ${sig.displacement.detected ? 'bg-bullish/10 text-bullish' : 'bg-white/5 text-neutral-600'}`}>
                    {sig.displacement.detected ? '✅' : '❌'} اندفاع
                  </span>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full ${sig.exhaustion.detected ? 'bg-bullish/10 text-bullish' : 'bg-white/5 text-neutral-600'}`}>
                    {sig.exhaustion.detected ? '✅' : '❌'} استنزاف
                  </span>
                </div>

                {/* Expanded Details */}
                {showDetails === sig.symbol && (
                  <div className="mt-4 pt-4 border-t border-white/[0.06]">
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {sig.reasons.map((r, i) => (
                        <span key={i} className="px-2.5 py-1 bg-surface-light/50 rounded-lg text-[11px] text-neutral-300">
                          {r}
                        </span>
                      ))}
                    </div>

                    {/* Structure */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      <div className="p-3 bg-surface/50 rounded-xl">
                        <div className="text-[10px] text-neutral-500 mb-1">VWAP</div>
                        <div className="text-sm font-mono font-bold text-accent">${formatPrice(sig.structure.vwap)}</div>
                      </div>
                      <div className="p-3 bg-surface/50 rounded-xl">
                        <div className="text-[10px] text-neutral-500 mb-1">PDH / PDL</div>
                        <div className="text-[10px] font-mono">
                          <span className="text-bearish">${formatPrice(sig.structure.pdh)}</span>
                          {' / '}
                          <span className="text-bullish">${formatPrice(sig.structure.pdl)}</span>
                        </div>
                      </div>
                      <div className="p-3 bg-surface/50 rounded-xl">
                        <div className="text-[10px] text-neutral-500 mb-1">الجلسة الآسيوية</div>
                        <div className="text-[10px] font-mono">
                          <span className="text-bearish">${formatPrice(sig.structure.asianHigh)}</span>
                          {' / '}
                          <span className="text-bullish">${formatPrice(sig.structure.asianLow)}</span>
                        </div>
                      </div>
                      <div className="p-3 bg-surface/50 rounded-xl">
                        <div className="text-[10px] text-neutral-500 mb-1">النطاق اليومي</div>
                        <div className="text-sm font-mono font-bold text-white">
                          {sig.structure.dailyRangePct.toFixed(2)}%
                        </div>
                      </div>
                    </div>

                    {/* Liquidity Levels */}
                    {sig.liquidity.levels.length > 0 && (
                      <div>
                        <div className="text-[10px] text-neutral-500 mb-2">مستويات السيولة</div>
                        <div className="flex flex-wrap gap-2">
                          {sig.liquidity.levels.map((l, i) => (
                            <div
                              key={i}
                              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono ${
                                l.swept
                                  ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                                  : l.type.includes('HIGH')
                                    ? 'bg-bearish/5 text-bearish border border-bearish/10'
                                    : 'bg-bullish/5 text-bullish border border-bullish/10'
                              }`}
                            >
                              {l.swept ? '💥 ' : ''}{l.label}: ${formatPrice(l.price)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Rules Card */}
        <div className="mt-12 card bg-surface/30">
          <h3 className="font-semibold mb-3 text-sm">📌 قواعد النظام</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-neutral-400">
            <div className="flex gap-2">
              <span className="text-accent">1.</span>
              <span>لا تدخل بدون <strong className="text-white">محفّز واضح</strong> (فوليوم، كسر، جلسة)</span>
            </div>
            <div className="flex gap-2">
              <span className="text-accent">2.</span>
              <span>السعر لازم يكون عند <strong className="text-yellow-400">منطقة سيولة</strong> — مو في النص</span>
            </div>
            <div className="flex gap-2">
              <span className="text-accent">3.</span>
              <span>انتظر <strong className="text-white">سحب السيولة</strong> ثم الانعكاس — لا تتوقع</span>
            </div>
            <div className="flex gap-2">
              <span className="text-accent">4.</span>
              <span>أقصى مخاطرة <strong className="text-bearish">1.5%</strong> — لا مضاعفة — أقصى 2 صفقات يومياً</span>
            </div>
          </div>
        </div>
      </div>
    </ProtectedPage>
  )
}
