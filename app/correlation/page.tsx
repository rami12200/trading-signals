'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { ProtectedPage } from '@/components/ProtectedPage'
import { useAuth } from '@/components/AuthProvider'
import { useBinanceWS } from '@/hooks/useBinanceWS'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface BTCState {
  currentPrice: number
  changes: { '5s': number; '10s': number; '30s': number; '1m': number; '3m': number; '5m': number }
  momentum: number
  acceleration: number
  direction: string
  isEvent: boolean
  eventStrength: number
}

interface OrderBookImbalance {
  bidVolume: number
  askVolume: number
  ratio: number
  direction: 'BUY' | 'SELL' | 'NEUTRAL'
  strength: number
}

interface LagOpportunity {
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

interface TargetAnalysis {
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

interface CorrelationSignal {
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

interface ActiveTrade {
  id: string
  signal: CorrelationSignal
  openPrice: number
  currentPrice: number
  pnl: number
  pnlPercent: number
  status: string
  openedAt: number
}

interface CorrelationAnalysis {
  btc: BTCState
  targets: TargetAnalysis[]
  signals: CorrelationSignal[]
  activeTrades: ActiveTrade[]
  timestamp: number
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const ALL_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT']

const LOT_PRESETS = [0.01, 0.05, 0.1, 0.5, 1.0]

const DIR_LABELS: Record<string, string> = {
  'STRONG_BULLISH': 'صعود قوي',
  'BULLISH': 'صاعد',
  'NEUTRAL': 'محايد',
  'BEARISH': 'هابط',
  'STRONG_BEARISH': 'هبوط قوي',
}

const POLL_INTERVAL = 500 // HF: 500ms

// ─── Component ─────────────────────────────────────────────────────────────────

export default function CorrelationPage() {
  const { user } = useAuth()
  const { prices, connected } = useBinanceWS(ALL_SYMBOLS)

  const [analysis, setAnalysis] = useState<CorrelationAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoTrade, setAutoTrade] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [signalFlash, setSignalFlash] = useState(false)
  const [selectedLot, setSelectedLot] = useState(0.01)
  const [customLot, setCustomLot] = useState('')
  const [isCustomLot, setIsCustomLot] = useState(false)
  const [tradeLog, setTradeLog] = useState<string[]>([])
  const [executing, setExecuting] = useState<string | null>(null)
  const [lastSignalId, setLastSignalId] = useState<string | null>(null)
  const [signalCount, setSignalCount] = useState(0)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fetchingRef = useRef(false)

  // ─── Sound Alert ─────────────────────────────────────────────────────────────

  const playAlert = useCallback(() => {
    if (!soundEnabled) return
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
      const ctx = audioCtxRef.current
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      gain.gain.value = 0.3

      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1)
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.3)
    } catch {}
  }, [soundEnabled])

  const triggerFlash = useCallback(() => {
    setSignalFlash(true)
    setTimeout(() => setSignalFlash(false), 2000)
  }, [])

  // ─── Fetch Analysis ──────────────────────────────────────────────────────────

  const fetchAnalysis = useCallback(async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    try {
      const res = await fetch('/api/correlation?interval=1m')
      const json = await res.json()
      if (json.success && json.data) {
        setAnalysis(json.data)
        setError(null)

        if (json.data.signals && json.data.signals.length > 0) {
          const newest = json.data.signals[0]
          if (newest.id !== lastSignalId) {
            setLastSignalId(newest.id)
            setSignalCount(c => c + 1)
            playAlert()
            triggerFlash()
            addLog(`إشارة جديدة: ${newest.action === 'BUY' ? 'شراء' : 'بيع'} ${newest.label} @ ${newest.entry} (تأخر: ${newest.lagScore.toFixed(3)}%)`)

            if (autoTrade && user) {
              executeTrade(newest)
            }
          }
        }
      }
    } catch (e) {
      setError('فشل في جلب التحليل')
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [lastSignalId, autoTrade, user, playAlert, triggerFlash])

  // ─── Execute Trade ───────────────────────────────────────────────────────────

  const executeTrade = useCallback(async (signal: CorrelationSignal) => {
    if (!user?.api_key) {
      addLog('خطأ: لا يوجد مفتاح API')
      return
    }

    setExecuting(signal.id)
    const lot = isCustomLot ? parseFloat(customLot) || 0.01 : selectedLot

    try {
      const res = await fetch('/api/signals/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: signal.symbol,
          action: signal.action,
          entry: signal.entry,
          stopLoss: signal.stopLoss,
          takeProfit: signal.takeProfit,
          lotSize: lot,
          api_key: user.api_key,
        }),
      })
      const data = await res.json()
      if (data.success) {
        addLog(`تم التنفيذ: ${signal.action === 'BUY' ? 'شراء' : 'بيع'} ${signal.label} | لوت: ${lot} | وقف: ${signal.stopLoss} | هدف: ${signal.takeProfit}`)
      } else {
        addLog(`فشل التنفيذ: ${data.error}`)
      }
    } catch {
      addLog('خطأ في التنفيذ: مشكلة في الاتصال')
    } finally {
      setExecuting(null)
    }
  }, [user, selectedLot, customLot, isCustomLot])

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false })
    setTradeLog(prev => [`[${time}] ${msg}`, ...prev.slice(0, 199)])
  }

  // ─── Polling (500ms HF) ────────────────────────────────────────────────────

  useEffect(() => {
    fetchAnalysis()
    pollRef.current = setInterval(fetchAnalysis, POLL_INTERVAL)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchAnalysis])

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  const fmt = (n: number, d = 2) => n?.toFixed(d) ?? '—'
  const fmtPrice = (p: number) => {
    if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 2 })
    if (p >= 1) return p.toFixed(4)
    return p.toFixed(6)
  }

  const dirColor = (dir: string) => {
    if (dir.includes('BULLISH') || dir === 'BUY') return 'text-emerald-400'
    if (dir.includes('BEARISH') || dir === 'SELL') return 'text-red-400'
    return 'text-neutral-400'
  }

  const obLabel = (ob: OrderBookImbalance | null) => {
    if (!ob) return null
    if (ob.direction === 'BUY') return { text: `شراء ${ob.strength.toFixed(0)}%`, cls: 'text-emerald-400' }
    if (ob.direction === 'SELL') return { text: `بيع ${ob.strength.toFixed(0)}%`, cls: 'text-red-400' }
    return { text: 'متوازن', cls: 'text-neutral-500' }
  }

  const btc = analysis?.btc
  const btcLivePrice = prices['BTCUSDT']?.price

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <ProtectedPage requiredPlan="vip" featureName="Smart Correlation Scalping">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-5" dir="rtl">

        {signalFlash && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500/90 text-black text-center py-3 font-bold text-lg animate-pulse">
            تم اكتشاف تأخر — فرصة تداول جديدة!
          </div>
        )}

        {/* الهيدر */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">سكالبينج عالي التردد (HF)</h1>
            <p className="text-neutral-400 text-sm mt-1">BTC يقود ← العملات تتأخر ← دخول فوري ← خروج سريع</p>
          </div>
          <div className="flex items-center gap-3" dir="ltr">
            <span className="text-xs font-mono text-neutral-500 bg-neutral-800/50 px-2 py-1 rounded">
              إشارات: {signalCount}
            </span>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                soundEnabled ? 'bg-emerald-600/30 text-emerald-400' : 'bg-neutral-800 text-neutral-500'
              }`}
            >
              {soundEnabled ? '🔔' : '🔕'}
            </button>

            <button
              onClick={() => {
                setAutoTrade(!autoTrade)
                addLog(autoTrade ? 'التداول التلقائي: متوقف' : 'التداول التلقائي: مفعّل')
              }}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                autoTrade
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
              }`}
            >
              تلقائي: {autoTrade ? 'مفعّل' : 'متوقف'}
            </button>

            <div className={`w-3 h-3 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`}
                 title={connected ? 'متصل' : 'غير متصل'} />
          </div>
        </div>

        {/* حالة BTC القائد */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <span className="text-yellow-500">₿</span> حالة البتكوين (القائد)
            </h2>
            {btc?.isEvent && (
              <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-bold animate-pulse">
                حدث BTC — القوة: {btc.eventStrength.toFixed(0)}%
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-8 gap-3" dir="ltr">
            <div className="text-center">
              <p className="text-neutral-500 text-xs mb-1">السعر</p>
              <p className="text-xl font-bold font-mono">
                ${fmtPrice(btcLivePrice || btc?.currentPrice || 0)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-neutral-500 text-xs mb-1">5 ثواني</p>
              <p className={`text-sm font-bold font-mono ${(btc?.changes['5s'] || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmt(btc?.changes['5s'] || 0, 4)}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-neutral-500 text-xs mb-1">10 ثواني</p>
              <p className={`text-sm font-bold font-mono ${(btc?.changes['10s'] || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmt(btc?.changes['10s'] || 0, 4)}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-neutral-500 text-xs mb-1">30 ثانية</p>
              <p className={`text-sm font-bold font-mono ${(btc?.changes['30s'] || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmt(btc?.changes['30s'] || 0, 4)}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-neutral-500 text-xs mb-1">1 دقيقة</p>
              <p className={`text-sm font-bold font-mono ${(btc?.changes['1m'] || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmt(btc?.changes['1m'] || 0, 4)}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-neutral-500 text-xs mb-1">5 دقائق</p>
              <p className={`text-sm font-bold font-mono ${(btc?.changes['5m'] || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmt(btc?.changes['5m'] || 0, 4)}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-neutral-500 text-xs mb-1">الزخم</p>
              <p className={`text-sm font-bold font-mono ${(btc?.momentum || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmt(btc?.momentum || 0, 3)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-neutral-500 text-xs mb-1">الاتجاه</p>
              <p className={`text-sm font-bold ${dirColor(btc?.direction || 'NEUTRAL')}`}>
                {DIR_LABELS[btc?.direction || 'NEUTRAL'] || 'محايد'}
              </p>
            </div>
          </div>
        </div>

        {/* الأسواق المستهدفة */}
        <div>
          <h2 className="text-lg font-bold mb-3">الأسواق المستهدفة</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {analysis?.targets.map(target => {
              const livePrice = prices[target.symbol]?.price || target.currentPrice
              const ob = obLabel(target.orderBook)
              return (
                <div key={target.symbol}
                     className={`card p-4 transition-all ${
                       target.lagDetected
                         ? 'ring-2 ring-yellow-500/50 bg-yellow-500/5'
                         : ''
                     }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base">{target.label}</span>
                      <span className="text-neutral-500 text-xs">{target.symbol}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {ob && (
                        <span className={`text-xs ${ob.cls}`} title="Order Book">
                          OB: {ob.text}
                        </span>
                      )}
                      {target.lagDetected && (
                        <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs font-bold animate-pulse">
                          تأخر!
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-sm mb-2" dir="ltr">
                    <div className="text-center">
                      <p className="text-neutral-500 text-xs">السعر</p>
                      <p className="font-mono font-bold text-xs">${fmtPrice(livePrice)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-neutral-500 text-xs">10 ث</p>
                      <p className={`font-mono font-bold text-xs ${target.change10s >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {fmt(target.change10s, 4)}%
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-neutral-500 text-xs">1 د</p>
                      <p className={`font-mono font-bold text-xs ${target.change1m >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {fmt(target.change1m, 4)}%
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-neutral-500 text-xs">الارتباط</p>
                      <p className={`font-mono font-bold text-xs ${
                        target.correlation > 0.6 ? 'text-emerald-400' :
                        target.correlation > 0.25 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {fmt(target.correlation, 2)}
                      </p>
                    </div>
                  </div>

                  {/* شريط التأخر */}
                  <div className="mt-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-neutral-500">درجة التأخر</span>
                      <span className={target.lagScore > 0.05 ? 'text-yellow-400' : 'text-neutral-500'}>
                        {fmt(target.lagScore, 4)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          target.lagScore > 0.15 ? 'bg-yellow-500' :
                          target.lagScore > 0.05 ? 'bg-yellow-600' : 'bg-neutral-600'
                        }`}
                        style={{ width: `${Math.min(100, target.lagScore * 500)}%` }}
                      />
                    </div>
                  </div>

                  {/* تفاصيل الفرصة */}
                  {target.opportunity && (
                    <div className="mt-3 p-2 rounded bg-yellow-500/10 border border-yellow-500/20 text-xs">
                      <div className="flex justify-between mb-1">
                        <span className={`font-bold ${target.opportunity.direction === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {target.opportunity.direction === 'BUY' ? 'شراء' : 'بيع'}
                        </span>
                        <div className="flex items-center gap-2">
                          {target.opportunity.orderBookAligned && (
                            <span className="text-blue-400 text-xs">OB✓</span>
                          )}
                          <span className="text-yellow-400">
                            الثقة: {target.opportunity.confidence}%
                          </span>
                        </div>
                      </div>
                      <p className="text-neutral-400 leading-relaxed" dir="ltr">
                        BTC {target.opportunity.btcChange > 0 ? '+' : ''}{fmt(target.opportunity.btcChange, 3)}%
                        → {target.label} متوقع {fmt(target.opportunity.expectedTargetChange, 3)}%
                        لكن فقط {fmt(target.opportunity.targetChange, 3)}%
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* الإشارات + التنفيذ */}
        {analysis?.signals && analysis.signals.length > 0 && (
          <div className="card p-5 ring-2 ring-yellow-500/30">
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
              إشارات نشطة
            </h2>
            {analysis.signals.map(sig => (
              <div key={sig.id} className="p-4 bg-neutral-800/50 rounded-lg mb-3">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded font-bold text-sm ${
                      sig.action === 'BUY' ? 'bg-emerald-600/30 text-emerald-400' : 'bg-red-600/30 text-red-400'
                    }`}>
                      {sig.action === 'BUY' ? 'شراء' : 'بيع'}
                    </span>
                    <span className="font-bold text-lg">{sig.label}</span>
                    <span className="text-neutral-500 text-sm">{sig.symbol}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm" dir="ltr">
                    <span className="text-yellow-400">تأخر: {fmt(sig.lagScore, 3)}%</span>
                    <span className="text-neutral-400">ارتباط: {fmt(sig.correlation, 2)}</span>
                    <span className="text-blue-400">ثقة: {sig.confidence}%</span>
                    <span className="text-purple-400">R:R {fmt(sig.riskReward)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm mb-4" dir="ltr">
                  <div className="text-center">
                    <p className="text-neutral-500 text-xs">سعر الدخول</p>
                    <p className="font-mono font-bold">${fmtPrice(sig.entry)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-neutral-500 text-xs">وقف الخسارة</p>
                    <p className="font-mono font-bold text-red-400">${fmtPrice(sig.stopLoss)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-neutral-500 text-xs">جني الأرباح</p>
                    <p className="font-mono font-bold text-emerald-400">${fmtPrice(sig.takeProfit)}</p>
                  </div>
                </div>

                {/* اختيار حجم اللوت */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="text-neutral-500 text-xs">اللوت:</span>
                  {LOT_PRESETS.map(lot => (
                    <button
                      key={lot}
                      onClick={() => { setSelectedLot(lot); setIsCustomLot(false) }}
                      className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                        !isCustomLot && selectedLot === lot
                          ? 'bg-accent text-white'
                          : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                      }`}
                    >
                      {lot}
                    </button>
                  ))}
                  <input
                    type="number"
                    placeholder="مخصص"
                    value={customLot}
                    onChange={e => { setCustomLot(e.target.value); setIsCustomLot(true) }}
                    className="w-20 px-2 py-1 rounded text-xs bg-neutral-800 text-white border border-neutral-700 font-mono"
                    dir="ltr"
                    step="0.01"
                    min="0.01"
                  />
                </div>

                {/* زر التنفيذ */}
                <button
                  onClick={() => executeTrade(sig)}
                  disabled={executing === sig.id}
                  className={`w-full py-3 rounded-lg font-bold text-sm transition-all ${
                    sig.action === 'BUY'
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-red-600 hover:bg-red-500 text-white'
                  } ${executing === sig.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {executing === sig.id
                    ? 'جاري التنفيذ...'
                    : `تنفيذ ${sig.action === 'BUY' ? 'شراء' : 'بيع'} على MT5 — ${isCustomLot ? customLot : selectedLot} لوت`}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* حالة عدم وجود إشارة */}
        {(!analysis?.signals || analysis.signals.length === 0) && !loading && (
          <div className="card p-6 text-center">
            <p className="text-neutral-400 text-lg mb-1">جاري مراقبة الأسواق بتردد عالي...</p>
            <p className="text-neutral-500 text-sm">
              {btc?.isEvent
                ? 'تم رصد حدث BTC — جاري فحص العملات المستهدفة'
                : 'في انتظار حركة من البتكوين (الحد الأدنى: 0.03%)'
              }
            </p>
          </div>
        )}

        {/* الصفقات المفتوحة */}
        {analysis?.activeTrades && analysis.activeTrades.some(t => t.status === 'OPEN') && (
          <div className="card p-5">
            <h2 className="text-lg font-bold mb-3">الصفقات المفتوحة ({analysis.activeTrades.filter(t => t.status === 'OPEN').length}/{MAX_TOTAL_DISPLAY})</h2>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {analysis.activeTrades.filter(t => t.status === 'OPEN').map(trade => (
                <div key={trade.id} className="flex flex-wrap items-center justify-between gap-3 p-3 bg-neutral-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      trade.signal.action === 'BUY' ? 'bg-emerald-600/30 text-emerald-400' : 'bg-red-600/30 text-red-400'
                    }`}>
                      {trade.signal.action === 'BUY' ? 'شراء' : 'بيع'}
                    </span>
                    <span className="font-bold">{trade.signal.label}</span>
                    <span className="text-neutral-500 text-sm" dir="ltr">@ {fmtPrice(trade.openPrice)}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`font-mono font-bold ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`} dir="ltr">
                      {trade.pnl >= 0 ? '+' : ''}{fmt(trade.pnlPercent, 3)}%
                    </span>
                    <span className="text-neutral-500 text-xs" dir="ltr">
                      {Math.round((Date.now() - trade.openedAt) / 1000)}s
                    </span>
                    <button
                      onClick={async () => {
                        await fetch('/api/correlation', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'close_trade', tradeId: trade.id }),
                        })
                        addLog(`تم إغلاق الصفقة: ${trade.signal.action === 'BUY' ? 'شراء' : 'بيع'} ${trade.signal.label}`)
                      }}
                      className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 rounded text-xs transition-colors"
                    >
                      إغلاق
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* تاريخ الصفقات */}
        {analysis?.activeTrades && analysis.activeTrades.some(t => t.status !== 'OPEN') && (
          <div className="card p-5">
            <h2 className="text-lg font-bold mb-3">آخر الصفقات</h2>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {analysis.activeTrades.filter(t => t.status !== 'OPEN').slice(0, 30).map(trade => {
                const statusLabels: Record<string, string> = {
                  'TP_HIT': 'وصل الهدف',
                  'SL_HIT': 'وصل الوقف',
                  'EMERGENCY_CLOSE': 'إغلاق طوارئ',
                  'MANUAL_CLOSE': 'إغلاق يدوي',
                }
                return (
                  <div key={trade.id} className="flex items-center justify-between p-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        trade.status === 'TP_HIT' ? 'bg-emerald-500' :
                        trade.status === 'EMERGENCY_CLOSE' ? 'bg-yellow-500' : 'bg-red-500'
                      }`} />
                      <span className={trade.signal.action === 'BUY' ? 'text-emerald-400' : 'text-red-400'}>
                        {trade.signal.action === 'BUY' ? 'شراء' : 'بيع'}
                      </span>
                      <span>{trade.signal.label}</span>
                      <span className="text-neutral-500" dir="ltr">@ {fmtPrice(trade.openPrice)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`font-mono ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`} dir="ltr">
                        {trade.pnl >= 0 ? '+' : ''}{fmt(trade.pnlPercent, 3)}%
                      </span>
                      <span className="text-neutral-500 text-xs">
                        {statusLabels[trade.status] || trade.status}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* سجل النشاط */}
        <div className="card p-5">
          <h2 className="text-lg font-bold mb-3">سجل النشاط</h2>
          <div className="bg-neutral-900 rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs space-y-1" dir="ltr">
            {tradeLog.length === 0 ? (
              <p className="text-neutral-600">لا يوجد نشاط بعد...</p>
            ) : (
              tradeLog.map((log, i) => (
                <p key={i} className="text-neutral-400">{log}</p>
              ))
            )}
          </div>
        </div>

        {/* شريط الحالة */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500 px-1">
          <span>
            الاتصال: {connected ? '🟢 متصل' : '🔴 غير متصل'}
            {' | '}
            التحديث: كل 500 مللي ثانية
            {' | '}
            الأهداف: {analysis?.targets.length || 0}
            {' | '}
            صفقات مفتوحة: {analysis?.activeTrades.filter(t => t.status === 'OPEN').length || 0}/15
          </span>
          <span>
            آخر تحديث: {analysis ? new Date(analysis.timestamp).toLocaleTimeString() : '—'}
          </span>
        </div>

      </div>
    </ProtectedPage>
  )
}

const MAX_TOTAL_DISPLAY = 15
