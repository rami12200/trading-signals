'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { CRYPTO_CATEGORIES, CryptoCategory, getCategoryPairs, getCategorySource } from '@/lib/binance'
import { useBinanceWS } from '@/hooks/useBinanceWS'
import { ProtectedPage } from '@/components/ProtectedPage'
import { useAuth } from '@/components/AuthProvider'

interface ICTSignal {
  symbol: string
  displaySymbol: string
  price: number
  action: 'BUY' | 'SELL' | 'WAIT'
  confidence: number
  entry: number
  stopLoss: number
  takeProfit1: number
  takeProfit2: number
  riskReward: number
  reasons: string[]
  marketStructure: 'BULLISH' | 'BEARISH' | 'RANGING'
  killZone: string | null
  orderBlocks: number
  fvgs: number
  liquidityZones: number
  structureBreaks: number
  mode: string
  source: string
}

type Mode = 'fast' | 'normal'

export default function ICTPage() {
  const { user } = useAuth()
  const [signals, setSignals] = useState<ICTSignal[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<CryptoCategory>('major')
  const [mode, setMode] = useState<Mode>('fast')
  const [lastUpdate, setLastUpdate] = useState<string>('')
  const [favorites, setFavorites] = useState<string[]>([])
  const [showFavOnly, setShowFavOnly] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const prevSignalsRef = useRef<Record<string, string>>({})
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const isCrypto = ['major', 'defi', 'layer1', 'layer2', 'meme', 'gaming'].includes(category)
  const pairs = getCategoryPairs(category)
  const wsPairs = isCrypto ? pairs : []
  const ws = useBinanceWS(wsPairs)

  // تحميل المفضلة
  useEffect(() => {
    const saved = localStorage.getItem('ict_favorites')
    if (saved) setFavorites(JSON.parse(saved))
  }, [])

  const toggleFavorite = useCallback((symbol: string) => {
    setFavorites(prev => {
      const next = prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]
      localStorage.setItem('ict_favorites', JSON.stringify(next))
      return next
    })
  }, [])

  // جلب الإشارات
  const fetchSignals = useCallback(async () => {
    try {
      const res = await fetch(`/api/ict?category=${category}&mode=${mode}`)
      const data = await res.json()
      if (data.signals) {
        // تحقق من إشارات جديدة للصوت
        if (soundEnabled && audioRef.current) {
          for (const sig of data.signals) {
            const prev = prevSignalsRef.current[sig.symbol]
            if (prev && prev === 'WAIT' && (sig.action === 'BUY' || sig.action === 'SELL')) {
              audioRef.current.play().catch(() => {})
              break
            }
          }
        }
        // حفظ الإشارات السابقة
        const tracker: Record<string, string> = {}
        for (const sig of data.signals) tracker[sig.symbol] = sig.action
        prevSignalsRef.current = tracker

        setSignals(data.signals)
        setLastUpdate(new Date().toLocaleTimeString('ar-SA'))
      }
    } catch (e) {
      console.error('خطأ في جلب إشارات ICT:', e)
    } finally {
      setLoading(false)
    }
  }, [category, mode, soundEnabled])

  useEffect(() => {
    setLoading(true)
    setShowFavOnly(false)
    fetchSignals()
    const interval = setInterval(fetchSignals, mode === 'fast' ? 30000 : 60000)
    return () => clearInterval(interval)
  }, [fetchSignals, mode])

  // تحديث الأسعار من WebSocket
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

  const getActionColor = (action: string) => {
    if (action === 'BUY') return 'text-emerald-400'
    if (action === 'SELL') return 'text-red-400'
    return 'text-neutral-400'
  }

  const getActionBg = (action: string) => {
    if (action === 'BUY') return 'border-emerald-500/30 bg-emerald-500/[0.03]'
    if (action === 'SELL') return 'border-red-500/30 bg-red-500/[0.03]'
    return 'border-white/5'
  }

  const getActionText = (action: string) => {
    if (action === 'BUY') return '🟢 شراء'
    if (action === 'SELL') return '🔴 بيع'
    return '⏸️ انتظر'
  }

  const getStructureText = (s: string) => {
    if (s === 'BULLISH') return '📈 صاعد'
    if (s === 'BEARISH') return '📉 هابط'
    return '↔️ عرضي'
  }

  const getStructureColor = (s: string) => {
    if (s === 'BULLISH') return 'text-emerald-400'
    if (s === 'BEARISH') return 'text-red-400'
    return 'text-yellow-400'
  }

  const formatPrice = (p: number) => {
    if (p >= 1000) return p.toFixed(2)
    if (p >= 1) return p.toFixed(4)
    return p.toFixed(6)
  }

  // الفئات المتاحة
  const categories = Object.entries(CRYPTO_CATEGORIES) as [CryptoCategory, any][]

  return (
    <ProtectedPage>
      <audio ref={audioRef} src="/alert.mp3" preload="auto" />
      <div className="min-h-screen bg-background text-white p-4 max-w-7xl mx-auto" dir="rtl">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">
              🎯 القناص
              <span className="text-sm font-normal text-neutral-400 mr-2">ICT Smart Money</span>
            </h1>
            <p className="text-xs text-neutral-500 mt-1">
              Order Blocks • Fair Value Gaps • السيولة • هيكل السوق
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* زر الصوت */}
            <button onClick={() => setSoundEnabled(!soundEnabled)}
              className={`px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                soundEnabled ? 'bg-accent/20 text-accent border border-accent/30' : 'bg-surface border border-white/10 text-neutral-500'
              }`}>
              {soundEnabled ? '🔔' : '🔕'}
            </button>

            {/* حالة الاتصال */}
            <div className="flex items-center gap-1.5">
              <span className={`inline-block w-2 h-2 rounded-full ${isCrypto ? 'bg-emerald-400 animate-pulse' : 'bg-blue-400 animate-pulse'}`} />
              <span className="text-[10px] text-neutral-500">
                {isCrypto ? 'Binance' : 'Databento'}
              </span>
            </div>

            {lastUpdate && (
              <span className="text-xs text-neutral-500">تحديث: {lastUpdate}</span>
            )}
          </div>
        </div>

        {/* وضع التداول: سريع / عادي */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('fast')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              mode === 'fast'
                ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-surface border border-white/10 text-neutral-400 hover:text-white'
            }`}>
            ⚡ سريع <span className="text-[10px] opacity-70">15 دقيقة</span>
          </button>
          <button
            onClick={() => setMode('normal')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              mode === 'normal'
                ? 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-surface border border-white/10 text-neutral-400 hover:text-white'
            }`}>
            🎯 عادي <span className="text-[10px] opacity-70">ساعة</span>
          </button>
        </div>

        {/* فلتر الفئات */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {categories.map(([key, config]) => (
            <button
              key={key}
              onClick={() => setCategory(key)}
              className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${
                category === key
                  ? 'bg-accent/20 text-accent border border-accent/30 font-medium'
                  : 'bg-surface border border-white/10 text-neutral-400 hover:text-white'
              }`}>
              {config.label}
            </button>
          ))}
        </div>

        {/* فلتر المفضلة */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setShowFavOnly(!showFavOnly)}
            className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
              showFavOnly ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-surface border border-white/10 text-neutral-400'
            }`}>
            {showFavOnly ? '⭐ المفضلة فقط' : '☆ الكل'}
          </button>
        </div>

        {/* إحصائيات سريعة */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="card text-center py-3">
            <div className="text-2xl font-bold">{signals.length}</div>
            <div className="text-[10px] text-neutral-500">إجمالي</div>
          </div>
          <div className="card text-center py-3">
            <div className="text-2xl font-bold text-emerald-400">{buyCount}</div>
            <div className="text-[10px] text-neutral-500">شراء</div>
          </div>
          <div className="card text-center py-3">
            <div className="text-2xl font-bold text-red-400">{sellCount}</div>
            <div className="text-[10px] text-neutral-500">بيع</div>
          </div>
          <div className="card text-center py-3">
            <div className="text-2xl font-bold text-neutral-400">{waitCount}</div>
            <div className="text-[10px] text-neutral-500">انتظار</div>
          </div>
          <div className="card text-center py-3">
            <div className="text-2xl font-bold text-amber-400">
              {mode === 'fast' ? '15m' : '1h'}
            </div>
            <div className="text-[10px] text-neutral-500">الفريم</div>
          </div>
        </div>

        {/* تنبيه */}
        <div className="card mb-6 border-amber-500/20 bg-amber-500/[0.03]">
          <div className="flex items-start gap-3 text-xs">
            <span className="text-amber-400 text-lg leading-none">👑</span>
            <div className="text-neutral-400">
              <strong className="text-amber-400">القناص</strong> — مبني على أسلوب ICT (Smart Money).
              يعتمد على Order Blocks والسيولة وهيكل السوق بدل المؤشرات التقليدية.
              <strong className="text-white"> الإشارات أقل بس أدق.</strong>
            </div>
          </div>
        </div>

        {/* الإشارات */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card animate-pulse h-40" />
            ))}
          </div>
        ) : displayedSignals.length === 0 ? (
          <div className="card text-center py-20">
            <p className="text-neutral-400 text-lg">لا توجد بيانات حالياً</p>
            <p className="text-neutral-500 text-sm mt-2">
              {showFavOnly ? 'لم تختر أي عملات مفضلة — أوقف فلتر المفضلة' : isCrypto ? 'جاري الاتصال بـ Binance...' : 'جاري جلب البيانات من Databento...'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedSignals.map((sig) => (
              <div key={sig.symbol} className={`card border ${getActionBg(sig.action)} transition-all`}>

                {/* الصف الأول: الرمز + الإشارة */}
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

                {/* هيكل السوق + Kill Zone */}
                <div className="flex items-center gap-3 mb-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${getStructureColor(sig.marketStructure)} border-current/20`}>
                    {getStructureText(sig.marketStructure)}
                  </span>
                  {sig.killZone && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {sig.killZone}
                    </span>
                  )}
                  <span className="text-[10px] text-neutral-600">
                    OB:{sig.orderBlocks} FVG:{sig.fvgs} LQ:{sig.liquidityZones}
                  </span>
                </div>

                {/* أسباب الإشارة */}
                <div className="space-y-1 mb-3">
                  {sig.reasons.map((reason, i) => (
                    <div key={i} className="text-xs text-neutral-400">
                      {reason}
                    </div>
                  ))}
                </div>

                {/* مستويات الدخول */}
                {sig.action !== 'WAIT' && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-3 border-t border-white/5">
                    <div>
                      <div className="text-[10px] text-neutral-500">دخول</div>
                      <div className="text-sm font-mono text-white">{formatPrice(sig.entry)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-neutral-500">وقف خسارة</div>
                      <div className="text-sm font-mono text-red-400">{formatPrice(sig.stopLoss)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-neutral-500">هدف ١</div>
                      <div className="text-sm font-mono text-emerald-400">{formatPrice(sig.takeProfit1)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-neutral-500">هدف ٢</div>
                      <div className="text-sm font-mono text-emerald-400">{formatPrice(sig.takeProfit2)}</div>
                    </div>
                  </div>
                )}

                {/* Risk/Reward */}
                {sig.riskReward > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] text-neutral-500">R:R</span>
                    <span className={`text-sm font-bold ${sig.riskReward >= 2 ? 'text-emerald-400' : sig.riskReward >= 1.5 ? 'text-yellow-400' : 'text-red-400'}`}>
                      1:{sig.riskReward}
                    </span>
                    {sig.riskReward >= 2 && <span className="text-[10px] text-emerald-400">ممتاز</span>}
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
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-neutral-600 mt-8 mb-4">
          القناص 🎯 — ICT Smart Money Concepts
          <br />
          <span className="text-neutral-700">Order Blocks • FVG • Liquidity • BOS/CHoCH</span>
        </div>
      </div>
    </ProtectedPage>
  )
}
