'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { CRYPTO_CATEGORIES, CryptoCategory, getCategoryPairs, getCategorySource } from '@/lib/binance'
import { useBinanceWS } from '@/hooks/useBinanceWS'
import { ProtectedPage } from '@/components/ProtectedPage'
import { useAuth } from '@/components/AuthProvider'

interface BollingerSignal {
  symbol: string
  displaySymbol: string
  price: number
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
    pricePosition: 'UPPER' | 'MIDDLE' | 'LOWER'
  }
  signalTime: string
  source: string
}

const timeframes = [
  { value: '5m', label: '5 دقائق' },
  { value: '15m', label: '15 دقيقة' },
  { value: '1h', label: 'ساعة' },
  { value: '4h', label: '4 ساعات' },
]

export default function BollingerPage() {
  const { user } = useAuth()
  const [signals, setSignals] = useState<BollingerSignal[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<CryptoCategory>('major')
  const [timeframe, setTimeframe] = useState('15m')
  const [lastUpdate, setLastUpdate] = useState('')
  const [favorites, setFavorites] = useState<string[]>([])
  const [showFavOnly, setShowFavOnly] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [executingTrade, setExecutingTrade] = useState<string | null>(null)
  const [executedTrades, setExecutedTrades] = useState<Record<string, boolean>>({})
  const prevSignalsRef = useRef<Record<string, string>>({})
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const getLotSize = (symbol: string) => user?.auto_trade_lot_size ?? 0.1

  const isCrypto = ['major', 'defi', 'layer1', 'layer2', 'meme', 'gaming'].includes(category)
  const wsPairs = isCrypto ? getCategoryPairs(category) : []
  const ws = useBinanceWS(wsPairs)

  useEffect(() => {
    const saved = localStorage.getItem('bb_favorites')
    if (saved) setFavorites(JSON.parse(saved))
  }, [])

  const toggleFavorite = useCallback((symbol: string) => {
    setFavorites(prev => {
      const next = prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]
      localStorage.setItem('bb_favorites', JSON.stringify(next))
      return next
    })
  }, [])

  const fetchSignals = useCallback(async () => {
    try {
      const res = await fetch(`/api/bollinger?category=${category}&interval=${timeframe}`)
      const data = await res.json()
      if (data.signals) {
        if (soundEnabled && audioRef.current) {
          for (const sig of data.signals) {
            const prev = prevSignalsRef.current[sig.symbol]
            if (prev && prev === 'WAIT' && (sig.action === 'BUY' || sig.action === 'SELL')) {
              audioRef.current.play().catch(() => {})
              break
            }
          }
        }
        const tracker: Record<string, string> = {}
        for (const sig of data.signals) tracker[sig.symbol] = sig.action
        prevSignalsRef.current = tracker

        setSignals(data.signals)
        setLastUpdate(new Date().toLocaleTimeString('ar-SA'))
      }
    } catch (e) {
      console.error('خطأ في جلب إشارات البولنجر:', e)
    } finally {
      setLoading(false)
    }
  }, [category, timeframe, soundEnabled])

  useEffect(() => {
    setLoading(true)
    setShowFavOnly(false)
    fetchSignals()
    const interval = setInterval(fetchSignals, 30000)
    return () => clearInterval(interval)
  }, [fetchSignals])

  const displayedSignals = (showFavOnly ? signals.filter(s => favorites.includes(s.symbol)) : signals)
    .map(sig => {
      if (isCrypto && ws.prices[sig.symbol.toLowerCase()]) {
        return { ...sig, price: ws.prices[sig.symbol.toLowerCase()].price }
      }
      return sig
    })

  const buyCount = signals.filter(s => s.action === 'BUY').length
  const sellCount = signals.filter(s => s.action === 'SELL').length
  const waitCount = signals.filter(s => s.action === 'WAIT').length

  const getActionColor = (a: string) => {
    if (a === 'BUY') return 'text-emerald-400'
    if (a === 'SELL') return 'text-red-400'
    return 'text-neutral-400'
  }

  const getActionBg = (a: string) => {
    if (a === 'BUY') return 'border-emerald-500/30 bg-emerald-500/[0.03]'
    if (a === 'SELL') return 'border-red-500/30 bg-red-500/[0.03]'
    return 'border-white/5'
  }

  const getActionText = (a: string) => {
    if (a === 'BUY') return '🟢 شراء'
    if (a === 'SELL') return '🔴 بيع'
    return '⏸️ انتظر'
  }

  const getPosText = (p: string) => {
    if (p === 'UPPER') return '🔺 عند العلوي'
    if (p === 'LOWER') return '🔻 عند السفلي'
    return '➡️ المنتصف'
  }

  const getPosColor = (p: string) => {
    if (p === 'UPPER') return 'text-red-400'
    if (p === 'LOWER') return 'text-emerald-400'
    return 'text-neutral-400'
  }

  const formatPrice = (p: number) => {
    if (p >= 1000) return p.toFixed(2)
    if (p >= 1) return p.toFixed(4)
    return p.toFixed(6)
  }

  const getTimeSince = (isoTime: string) => {
    const diff = Date.now() - new Date(isoTime).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'الآن'
    if (mins < 60) return `${mins} د`
    const hrs = Math.floor(mins / 60)
    return `${hrs} س ${mins % 60} د`
  }

  const categories = Object.entries(CRYPTO_CATEGORIES) as [CryptoCategory, any][]

  return (
    <ProtectedPage>
      <audio ref={audioRef} src="/alert.mp3" preload="auto" />
      <div className="min-h-screen bg-background text-white p-4 max-w-7xl mx-auto" dir="rtl">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">
              📊 البولنجر باوند
              <span className="text-sm font-normal text-neutral-400 mr-2">Bollinger Bounce</span>
            </h1>
            <p className="text-xs text-neutral-500 mt-1">
              Bollinger Bands + RSI + EMA 50 — بيع عند القمة، شراء عند القاع
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setSoundEnabled(!soundEnabled)}
              className={`px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                soundEnabled ? 'bg-accent/20 text-accent border border-accent/30' : 'bg-surface border border-white/10 text-neutral-500'
              }`}>
              {soundEnabled ? '🔔' : '🔕'}
            </button>
            <div className="flex items-center gap-1.5">
              <span className={`inline-block w-2 h-2 rounded-full ${isCrypto ? 'bg-emerald-400 animate-pulse' : 'bg-blue-400 animate-pulse'}`} />
              <span className="text-[10px] text-neutral-500">{isCrypto ? 'Binance' : 'Databento'}</span>
            </div>
            {lastUpdate && <span className="text-xs text-neutral-500">تحديث: {lastUpdate}</span>}
          </div>
        </div>

        {/* الفريم */}
        <div className="flex gap-2 mb-4">
          {timeframes.map(tf => (
            <button key={tf.value} onClick={() => setTimeframe(tf.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                timeframe === tf.value
                  ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-surface border border-white/10 text-neutral-400 hover:text-white'
              }`}>
              {tf.label}
            </button>
          ))}
        </div>

        {/* الفئات */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {categories.map(([key, config]) => (
            <button key={key} onClick={() => setCategory(key)}
              className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${
                category === key
                  ? 'bg-accent/20 text-accent border border-accent/30 font-medium'
                  : 'bg-surface border border-white/10 text-neutral-400 hover:text-white'
              }`}>
              {config.label}
            </button>
          ))}
        </div>

        {/* المفضلة */}
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => setShowFavOnly(!showFavOnly)}
            className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
              showFavOnly ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-surface border border-white/10 text-neutral-400'
            }`}>
            {showFavOnly ? '⭐ المفضلة فقط' : '☆ الكل'}
          </button>
        </div>

        {/* إحصائيات */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="card text-center py-3">
            <div className="text-2xl font-bold">{signals.length}</div>
            <div className="text-[10px] text-neutral-500">إجمالي</div>
          </div>
          <div className="card text-center py-3">
            <div className="text-2xl font-bold text-emerald-400">{buyCount}</div>
            <div className="text-[10px] text-neutral-500">شراء (عند السفلي)</div>
          </div>
          <div className="card text-center py-3">
            <div className="text-2xl font-bold text-red-400">{sellCount}</div>
            <div className="text-[10px] text-neutral-500">بيع (عند العلوي)</div>
          </div>
          <div className="card text-center py-3">
            <div className="text-2xl font-bold text-neutral-400">{waitCount}</div>
            <div className="text-[10px] text-neutral-500">في المنتصف</div>
          </div>
        </div>

        {/* شرح الاستراتيجية */}
        <div className="card mb-6 border-blue-500/20 bg-blue-500/[0.03]">
          <div className="flex items-start gap-3 text-xs">
            <span className="text-blue-400 text-lg leading-none">📊</span>
            <div className="text-neutral-400">
              <strong className="text-blue-400">البولنجر باوند</strong> — الشمعة توصل <strong className="text-red-400">البولنجر العلوي</strong> = بيع (ارتداد نزول).
              الشمعة توصل <strong className="text-emerald-400">البولنجر السفلي</strong> = شراء (ارتداد صعود).
              <strong className="text-white"> RSI يأكد التشبع + EMA 50 يحدد الاتجاه.</strong>
            </div>
          </div>
        </div>

        {/* الإشارات */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="card animate-pulse h-48" />
            ))}
          </div>
        ) : displayedSignals.length === 0 ? (
          <div className="card text-center py-20">
            <p className="text-neutral-400 text-lg">لا توجد بيانات حالياً</p>
            <p className="text-neutral-500 text-sm mt-2">
              {showFavOnly ? 'لم تختر مفضلة — أوقف فلتر المفضلة' : 'جاري جلب البيانات...'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedSignals.map(sig => (
              <div key={sig.symbol} className={`card border ${getActionBg(sig.action)} transition-all`}>

                {/* الرمز + الإشارة + الوقت */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleFavorite(sig.symbol)} className="text-lg">
                      {favorites.includes(sig.symbol) ? '⭐' : '☆'}
                    </button>
                    <div>
                      <div className="font-bold text-lg">{sig.displaySymbol}</div>
                      <div className="text-xs text-neutral-500">{formatPrice(sig.price)} USD</div>
                    </div>
                  </div>
                  <div className="text-left">
                    <div className={`text-lg font-bold ${getActionColor(sig.action)}`}>
                      {getActionText(sig.action)}
                    </div>
                    <div className="text-xs text-neutral-500">ثقة {sig.confidence}%</div>
                  </div>
                </div>

                {/* وقت التوصية */}
                <div className="flex items-center gap-3 mb-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${getPosColor(sig.indicators.pricePosition)} border-current/20`}>
                    {getPosText(sig.indicators.pricePosition)}
                  </span>
                  <span className="text-[10px] text-neutral-500">
                    🕐 {getTimeSince(sig.signalTime)}
                  </span>
                  <span className="text-[10px] text-neutral-600">
                    RSI: {sig.indicators.rsi} | BB: {sig.indicators.bbWidth}%
                  </span>
                </div>

                {/* المؤشرات البصرية */}
                <div className="mb-3">
                  {/* شريط البولنجر المرئي */}
                  <div className="relative h-8 bg-white/5 rounded-lg overflow-hidden">
                    {/* البولنجر العلوي */}
                    <div className="absolute right-0 top-0 h-full w-[15%] bg-red-500/10 border-r border-red-500/30" />
                    {/* البولنجر السفلي */}
                    <div className="absolute left-0 top-0 h-full w-[15%] bg-emerald-500/10 border-l border-emerald-500/30" />
                    {/* EMA 50 */}
                    <div className="absolute left-1/2 top-0 h-full w-px bg-amber-500/40" />
                    {/* السعر */}
                    <div
                      className={`absolute top-1 bottom-1 w-3 rounded-sm ${
                        sig.action === 'BUY' ? 'bg-emerald-400' : sig.action === 'SELL' ? 'bg-red-400' : 'bg-white/40'
                      }`}
                      style={{
                        left: `${Math.max(2, Math.min(95, ((sig.price - sig.indicators.bbLower) / (sig.indicators.bbUpper - sig.indicators.bbLower)) * 100))}%`,
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-between px-2 text-[9px] text-neutral-600">
                      <span>سفلي {formatPrice(sig.indicators.bbLower)}</span>
                      <span className="text-amber-500/60">EMA50</span>
                      <span>علوي {formatPrice(sig.indicators.bbUpper)}</span>
                    </div>
                  </div>

                  {/* شريط RSI */}
                  <div className="relative h-4 bg-white/5 rounded-lg overflow-hidden mt-2">
                    <div className="absolute left-0 top-0 h-full w-[30%] bg-emerald-500/10" />
                    <div className="absolute right-0 top-0 h-full w-[30%] bg-red-500/10" />
                    <div
                      className={`absolute top-0.5 bottom-0.5 w-2 rounded-sm ${
                        sig.indicators.rsi >= 70 ? 'bg-red-400' : sig.indicators.rsi <= 30 ? 'bg-emerald-400' : 'bg-white/40'
                      }`}
                      style={{ left: `${sig.indicators.rsi}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-between px-2 text-[8px] text-neutral-600">
                      <span>30</span>
                      <span>RSI {sig.indicators.rsi}</span>
                      <span>70</span>
                    </div>
                  </div>
                </div>

                {/* الأسباب */}
                <div className="space-y-1 mb-3">
                  {sig.reasons.map((reason, i) => (
                    <div key={i} className="text-xs text-neutral-400">{reason}</div>
                  ))}
                </div>

                {/* مستويات الدخول */}
                {sig.action !== 'WAIT' && (
                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/5">
                    <div>
                      <div className="text-[10px] text-neutral-500">دخول</div>
                      <div className="text-sm font-mono text-white">{formatPrice(sig.entry)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-neutral-500">وقف خسارة</div>
                      <div className="text-sm font-mono text-red-400">{formatPrice(sig.stopLoss)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-neutral-500">هدف</div>
                      <div className="text-sm font-mono text-emerald-400">{formatPrice(sig.takeProfit)}</div>
                    </div>
                  </div>
                )}

                {/* R:R */}
                {sig.riskReward > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] text-neutral-500">R:R</span>
                    <span className={`text-sm font-bold ${sig.riskReward >= 2 ? 'text-emerald-400' : sig.riskReward >= 1.5 ? 'text-yellow-400' : 'text-red-400'}`}>
                      1:{sig.riskReward}
                    </span>
                  </div>
                )}

                {/* شريط الثقة */}
                <div className="mt-3">
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        sig.confidence >= 70 ? 'bg-emerald-400' : sig.confidence >= 50 ? 'bg-yellow-400' : 'bg-red-400'
                      }`}
                      style={{ width: `${sig.confidence}%` }}
                    />
                  </div>
                </div>

                {/* زر تنفيذ MT5 */}
                {sig.action !== 'WAIT' && (
                  <div className="mt-4 pt-3 border-t border-white/5">
                    {executedTrades[sig.symbol] ? (
                      <div className="px-6 py-3 rounded-xl font-bold text-sm text-center bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
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
                                takeProfit: sig.takeProfit,
                                lotSize: getLotSize(sig.symbol),
                                api_key: user?.api_key,
                              }),
                            })
                            const data = await res.json()
                            if (data.success) {
                              setExecutedTrades(prev => ({ ...prev, [sig.symbol]: true }))
                              setTimeout(() => setExecutedTrades(prev => ({ ...prev, [sig.symbol]: false })), 10000)
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
                        className={`w-full px-6 py-3 rounded-xl font-bold text-sm text-center transition-all ${
                          sig.action === 'BUY'
                            ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
                            : 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30'
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
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-neutral-600 mt-8 mb-4">
          📊 البولنجر باوند — Bollinger Bands + RSI + EMA 50
          <br />
          <span className="text-neutral-700">بيع عند القمة • شراء عند القاع • RSI تأكيد</span>
        </div>
      </div>
    </ProtectedPage>
  )
}
