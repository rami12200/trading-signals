'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { ProtectedPage } from '@/components/ProtectedPage'
import { useAuth } from '@/components/AuthProvider'

interface SPXSignal {
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
    bbSqueeze: boolean
    pricePosition: 'UPPER' | 'MIDDLE' | 'LOWER'
    atr: number
  }
  signalTime: string
  source: string
}

const timeframes = [
  { value: '5m', label: '5 دقائق' },
  { value: '15m', label: '15 دقيقة' },
  { value: '30m', label: '30 دقيقة' },
  { value: '1h', label: 'ساعة' },
  { value: '4h', label: '4 ساعات' },
  { value: '1d', label: 'يومي' },
]

export default function SPXPage() {
  const { user } = useAuth()
  const [signal, setSignal] = useState<SPXSignal | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeframe, setTimeframe] = useState('15m')
  const [lastUpdate, setLastUpdate] = useState('')
  const [error, setError] = useState('')
  const [executingTrade, setExecutingTrade] = useState(false)
  const [executed, setExecuted] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const prevActionRef = useRef<string>('WAIT')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const getLotSize = () => user?.auto_trade_lot_size ?? 0.1

  const fetchSignal = useCallback(async () => {
    try {
      setError('')
      const res = await fetch(`/api/spx?interval=${timeframe}`)
      const data = await res.json()

      if (data.signal) {
        // تنبيه صوتي لو تغيرت الإشارة
        if (soundEnabled && audioRef.current) {
          if (prevActionRef.current === 'WAIT' && (data.signal.action === 'BUY' || data.signal.action === 'SELL')) {
            audioRef.current.play().catch(() => {})
          }
        }
        prevActionRef.current = data.signal.action
        setSignal(data.signal)
      } else {
        setSignal(null)
        if (data.error) setError(data.error)
      }
      setLastUpdate(new Date().toLocaleTimeString('ar-SA'))
    } catch (e) {
      console.error('خطأ في جلب إشارة SPX:', e)
      setError('فشل الاتصال بالسيرفر')
    } finally {
      setLoading(false)
    }
  }, [timeframe, soundEnabled])

  useEffect(() => {
    setLoading(true)
    fetchSignal()
    const interval = setInterval(fetchSignal, 60000) // دقيقة — حفاظاً على رصيد Twelve Data
    return () => clearInterval(interval)
  }, [fetchSignal])

  const formatPrice = (p: number) => p.toFixed(2)

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

  const getTimeSince = (isoTime: string) => {
    const diff = Date.now() - new Date(isoTime).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'الآن'
    if (mins < 60) return `${mins} د`
    const hrs = Math.floor(mins / 60)
    return `${hrs} س ${mins % 60} د`
  }

  return (
    <ProtectedPage>
      <audio ref={audioRef} src="/alert.mp3" preload="auto" />
      <div className="min-h-screen bg-background text-white p-4 max-w-3xl mx-auto" dir="rtl">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">
              📈 S&P 500
              <span className="text-sm font-normal text-neutral-400 mr-2">SPX Bollinger Bounce</span>
            </h1>
            <p className="text-xs text-neutral-500 mt-1">
              ارتداد البولنجر + RSI + BB Width — شراء عند القاع، بيع عند القمة
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
              <span className="inline-block w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              <span className="text-[10px] text-neutral-500">Twelve Data</span>
            </div>
            {lastUpdate && <span className="text-xs text-neutral-500">تحديث: {lastUpdate}</span>}
          </div>
        </div>

        {/* الفريم */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {timeframes.map(tf => (
            <button key={tf.value} onClick={() => setTimeframe(tf.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                timeframe === tf.value
                  ? 'bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-purple-400 border border-purple-500/30'
                  : 'bg-surface border border-white/10 text-neutral-400 hover:text-white'
              }`}>
              {tf.label}
            </button>
          ))}
        </div>

        {/* شرح الاستراتيجية */}
        <div className="card mb-6 border-purple-500/20 bg-purple-500/[0.03]">
          <div className="flex items-start gap-3 text-xs">
            <span className="text-purple-400 text-lg leading-none">📈</span>
            <div className="text-neutral-400">
              <strong className="text-purple-400">SPX Bollinger Bounce</strong> — السعر يوصل{' '}
              <strong className="text-red-400">البولنجر العلوي</strong> + RSI تشبع = بيع.
              السعر يوصل <strong className="text-emerald-400">البولنجر السفلي</strong> + RSI تشبع = شراء.
              <strong className="text-white"> BB Width يفلتر الترند القوي.</strong>
              {' '}<span className="text-yellow-400">⚠️ السوق مفتوح 9:30 - 4:00 بتوقيت نيويورك</span>
            </div>
          </div>
        </div>

        {/* المحتوى */}
        {loading ? (
          <div className="space-y-4">
            <div className="card animate-pulse h-64" />
          </div>
        ) : error && !signal ? (
          <div className="card text-center py-20">
            <p className="text-neutral-400 text-lg">⚠️ {error}</p>
            <p className="text-neutral-500 text-sm mt-2">قد يكون السوق مغلق — جرب فريم يومي (1d)</p>
          </div>
        ) : signal ? (
          <div className={`card border ${getActionBg(signal.action)} transition-all`}>

            {/* الرمز + السعر + الإشارة */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-bold text-2xl">{signal.displaySymbol}</div>
                <div className="text-sm text-neutral-400">{formatPrice(signal.price)} USD</div>
              </div>
              <div className="text-left">
                <div className={`text-2xl font-bold ${getActionColor(signal.action)}`}>
                  {getActionText(signal.action)}
                </div>
                <div className="text-xs text-neutral-500">ثقة {signal.confidence}%</div>
              </div>
            </div>

            {/* حالة السعر + الوقت */}
            <div className="flex items-center gap-3 mb-4">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${getPosColor(signal.indicators.pricePosition)} border-current/20`}>
                {getPosText(signal.indicators.pricePosition)}
              </span>
              {signal.indicators.bbSqueeze && (
                <span className="text-xs px-2 py-0.5 rounded-full border border-yellow-500/30 text-yellow-400">
                  🔒 BB Squeeze
                </span>
              )}
              <span className="text-[10px] text-neutral-500">
                🕐 {getTimeSince(signal.signalTime)}
              </span>
            </div>

            {/* المؤشرات البصرية — البولنجر */}
            <div className="mb-4">
              <div className="text-[10px] text-neutral-500 mb-1">موقع السعر في البولنجر</div>
              <div className="relative h-10 bg-white/5 rounded-lg overflow-hidden">
                <div className="absolute right-0 top-0 h-full w-[15%] bg-red-500/10 border-r border-red-500/30" />
                <div className="absolute left-0 top-0 h-full w-[15%] bg-emerald-500/10 border-l border-emerald-500/30" />
                <div className="absolute left-1/2 top-0 h-full w-px bg-amber-500/40" />
                <div
                  className={`absolute top-1 bottom-1 w-4 rounded-sm ${
                    signal.action === 'BUY' ? 'bg-emerald-400' : signal.action === 'SELL' ? 'bg-red-400' : 'bg-white/40'
                  }`}
                  style={{
                    left: `${Math.max(2, Math.min(95, ((signal.price - signal.indicators.bbLower) / (signal.indicators.bbUpper - signal.indicators.bbLower)) * 100))}%`,
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-between px-3 text-[9px] text-neutral-600">
                  <span>سفلي {formatPrice(signal.indicators.bbLower)}</span>
                  <span className="text-amber-500/60">EMA50 {formatPrice(signal.indicators.ema50)}</span>
                  <span>علوي {formatPrice(signal.indicators.bbUpper)}</span>
                </div>
              </div>

              {/* RSI */}
              <div className="text-[10px] text-neutral-500 mb-1 mt-3">RSI ({signal.indicators.rsi})</div>
              <div className="relative h-5 bg-white/5 rounded-lg overflow-hidden">
                <div className="absolute left-0 top-0 h-full w-[30%] bg-emerald-500/10" />
                <div className="absolute right-0 top-0 h-full w-[30%] bg-red-500/10" />
                <div
                  className={`absolute top-0.5 bottom-0.5 w-2.5 rounded-sm ${
                    signal.indicators.rsi >= 70 ? 'bg-red-400' : signal.indicators.rsi <= 30 ? 'bg-emerald-400' : 'bg-white/40'
                  }`}
                  style={{ left: `${signal.indicators.rsi}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-between px-2 text-[8px] text-neutral-600">
                  <span>30</span>
                  <span>{signal.indicators.rsiStatus}</span>
                  <span>70</span>
                </div>
              </div>

              {/* BB Width */}
              <div className="text-[10px] text-neutral-500 mb-1 mt-3">BB Width ({signal.indicators.bbWidth}%)</div>
              <div className="relative h-4 bg-white/5 rounded-lg overflow-hidden">
                <div
                  className={`h-full rounded-lg transition-all ${
                    signal.indicators.bbWidth < 1.5 ? 'bg-yellow-500/40' : signal.indicators.bbWidth > 3 ? 'bg-red-500/30' : 'bg-blue-500/30'
                  }`}
                  style={{ width: `${Math.min(100, (signal.indicators.bbWidth / 5) * 100)}%` }}
                />
                <div className="absolute inset-0 flex items-center px-2 text-[8px] text-neutral-500">
                  {signal.indicators.bbSqueeze ? '🔒 ضيق — ارتداد قوي' : signal.indicators.bbWidth > 3 ? '⚠️ واسع — ترند قوي' : 'طبيعي'}
                </div>
              </div>
            </div>

            {/* المعلومات المهمة */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-center">
              <div className="bg-white/[0.03] rounded-lg p-2">
                <div className="text-[10px] text-neutral-500">ATR</div>
                <div className="text-sm font-mono text-white">{signal.indicators.atr}</div>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-2">
                <div className="text-[10px] text-neutral-500">BB Width</div>
                <div className={`text-sm font-mono ${signal.indicators.bbSqueeze ? 'text-yellow-400' : 'text-white'}`}>{signal.indicators.bbWidth}%</div>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-2">
                <div className="text-[10px] text-neutral-500">EMA 50</div>
                <div className={`text-sm font-mono ${signal.indicators.emaTrend === 'ABOVE' ? 'text-emerald-400' : signal.indicators.emaTrend === 'BELOW' ? 'text-red-400' : 'text-white'}`}>
                  {signal.indicators.emaTrend === 'ABOVE' ? '↑ فوق' : signal.indicators.emaTrend === 'BELOW' ? '↓ تحت' : '= عند'}
                </div>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-2">
                <div className="text-[10px] text-neutral-500">RSI</div>
                <div className={`text-sm font-mono ${signal.indicators.rsi >= 70 ? 'text-red-400' : signal.indicators.rsi <= 30 ? 'text-emerald-400' : 'text-white'}`}>
                  {signal.indicators.rsi}
                </div>
              </div>
            </div>

            {/* الأسباب */}
            <div className="space-y-1 mb-4">
              {signal.reasons.map((reason, i) => (
                <div key={i} className="text-xs text-neutral-400">{reason}</div>
              ))}
            </div>

            {/* مستويات الدخول */}
            {signal.action !== 'WAIT' && (
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/5">
                <div>
                  <div className="text-[10px] text-neutral-500">دخول</div>
                  <div className="text-sm font-mono text-white">{formatPrice(signal.entry)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-500">وقف خسارة</div>
                  <div className="text-sm font-mono text-red-400">{formatPrice(signal.stopLoss)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-500">هدف</div>
                  <div className="text-sm font-mono text-emerald-400">{formatPrice(signal.takeProfit)}</div>
                </div>
              </div>
            )}

            {/* R:R */}
            {signal.riskReward > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[10px] text-neutral-500">المخاطرة:العائد</span>
                <span className={`text-sm font-bold ${signal.riskReward >= 2 ? 'text-emerald-400' : signal.riskReward >= 1.5 ? 'text-yellow-400' : 'text-red-400'}`}>
                  1:{signal.riskReward}
                </span>
              </div>
            )}

            {/* شريط الثقة */}
            <div className="mt-4">
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    signal.confidence >= 70 ? 'bg-emerald-400' : signal.confidence >= 50 ? 'bg-yellow-400' : 'bg-red-400'
                  }`}
                  style={{ width: `${signal.confidence}%` }}
                />
              </div>
            </div>

            {/* زر تنفيذ MT5 */}
            {signal.action !== 'WAIT' && (
              <div className="mt-4 pt-3 border-t border-white/5">
                {executed ? (
                  <div className="px-6 py-3 rounded-xl font-bold text-sm text-center bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    ✅ تم إرسال الأمر لـ MT5
                  </div>
                ) : (
                  <button
                    onClick={async () => {
                      setExecutingTrade(true)
                      try {
                        const res = await fetch('/api/signals/execute', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            symbol: 'SPY',
                            action: signal.action,
                            entry: signal.entry,
                            stopLoss: signal.stopLoss,
                            takeProfit: signal.takeProfit,
                            lotSize: getLotSize(),
                            api_key: user?.api_key,
                          }),
                        })
                        const data = await res.json()
                        if (data.success) {
                          setExecuted(true)
                          setTimeout(() => setExecuted(false), 10000)
                        } else {
                          alert('فشل إرسال الأمر: ' + (data.error || 'خطأ غير معروف'))
                        }
                      } catch {
                        alert('فشل الاتصال بالسيرفر')
                      } finally {
                        setExecutingTrade(false)
                      }
                    }}
                    disabled={executingTrade}
                    className={`w-full px-6 py-3 rounded-xl font-bold text-sm text-center transition-all ${
                      signal.action === 'BUY'
                        ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
                        : 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30'
                    } ${executingTrade ? 'opacity-50 cursor-wait' : ''}`}
                  >
                    {executingTrade
                      ? '⏳ جاري الإرسال...'
                      : signal.action === 'BUY'
                        ? `🟢 نفّذ شراء US500 على MT5 (${getLotSize()} لوت)`
                        : `🔴 نفّذ بيع US500 على MT5 (${getLotSize()} لوت)`}
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="card text-center py-20">
            <p className="text-neutral-400 text-lg">لا توجد بيانات</p>
            <p className="text-neutral-500 text-sm mt-2">السوق مغلق — جرب فريم يومي</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-neutral-600 mt-8 mb-4">
          📈 S&P 500 — Bollinger Bounce + RSI + BB Width
          <br />
          <span className="text-neutral-700">السوق: الإثنين-الجمعة 9:30 - 4:00 بتوقيت نيويورك</span>
        </div>
      </div>
    </ProtectedPage>
  )
}
