'use client'

import { useEffect, useState, useCallback } from 'react'
import { KFOOSignal } from '@/lib/types'
import { formatPrice } from '@/lib/binance'

const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT']
const intervals = [
  { value: '1m', label: '1 دقيقة' },
  { value: '5m', label: '5 دقائق' },
  { value: '15m', label: 'ربع ساعة' },
  { value: '1h', label: 'ساعة' },
]

export default function KFOOPage() {
  const [symbol, setSymbol] = useState('BTCUSDT')
  const [timeframe, setTimeframe] = useState('15m')
  const [data, setData] = useState<KFOOSignal | null>(null)
  const [allSignals, setAllSignals] = useState<KFOOSignal[]>([])
  const [loading, setLoading] = useState(true)
  const [lotSize, setLotSize] = useState(0.01)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/kfoo?interval=${timeframe}`)
      const json = await res.json()
      if (json.success && json.data.signals) {
        setAllSignals(json.data.signals)
        const found = json.data.signals.find(
          (s: KFOOSignal) => s.symbol === symbol.replace('USDT', '/USDT')
        )
        if (found) setData(found)
      }
    } catch (error) {
      console.error('Error:', error)
    }
    setLoading(false)
  }, [symbol, timeframe])

  useEffect(() => {
    loadData()
    const timer = window.setInterval(loadData, 15000)
    return () => window.clearInterval(timer)
  }, [loadData])

  const signalColor = (sig: string) =>
    sig === 'BUY' ? 'text-bullish' : sig === 'SELL' ? 'text-bearish' : 'text-neutral'

  const signalBg = (sig: string) =>
    sig === 'BUY'
      ? 'bg-bullish/10 border-bullish/30'
      : sig === 'SELL'
      ? 'bg-bearish/10 border-bearish/30'
      : 'bg-neutral/10 border-neutral/30'

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400 text-sm">جاري تحميل البيانات...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-neutral-400 mb-4">خطأ في تحميل البيانات</p>
          <button onClick={loadData} className="btn-primary text-sm">
            إعادة المحاولة
          </button>
        </div>
      </div>
    )
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">المؤشر المتقدم</h1>
        <p className="text-sm text-neutral-500">تحليل فني حقيقي + Smart Money</p>
      </div>

      {/* Controls */}
      <div className="card mb-6">
        <div className="flex gap-4 flex-wrap items-end">
          <div>
            <label className="block text-xs text-neutral-500 mb-1.5">العملة</label>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="bg-background border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            >
              {symbols.map((s) => (
                <option key={s} value={s}>
                  {s.replace('USDT', '/USDT')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1.5">الإطار</label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="bg-background border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            >
              {intervals.map((i) => (
                <option key={i.value} value={i.value}>
                  {i.label}
                </option>
              ))}
            </select>
          </div>
          <button onClick={loadData} className="btn-primary text-sm !px-4 !py-2">
            تحديث
          </button>
        </div>
      </div>

      {/* Main Signal */}
      <div className={`card mb-6 border-2 ${signalBg(data.signal)}`}>
        <div className="text-center py-6">
          <div className="text-5xl mb-2">
            {data.signal === 'BUY' ? '↑' : data.signal === 'SELL' ? '↓' : '—'}
          </div>
          <h2 className={`text-4xl font-bold ${signalColor(data.signal)}`}>
            {data.signal === 'BUY' ? 'اشتري' : data.signal === 'SELL' ? 'بيع' : 'انتظر'}
          </h2>
          <p className="text-neutral-400 mt-2">{data.reason}</p>
          <p className="text-3xl font-bold mt-4 font-mono">${formatPrice(data.price)}</p>
          <p className="text-xs text-neutral-500 mt-1">
            الثقة: <span className="text-accent">{data.confidence}%</span> • R/R:{' '}
            <span className="text-white">{data.riskReward}</span>
          </p>
        </div>
      </div>

      {/* Scores */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card text-center">
          <div className="text-3xl font-bold text-bullish">{data.buyScore}</div>
          <div className="text-xs text-neutral-500">نقاط شراء</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-bearish">{data.sellScore}</div>
          <div className="text-xs text-neutral-500">نقاط بيع</div>
        </div>
      </div>

      {/* Reasons */}
      {data.reasons.length > 0 && (
        <div className="card mb-6">
          <h3 className="font-semibold text-sm mb-3 text-center">الأسباب</h3>
          <div className="flex flex-wrap gap-2 justify-center">
            {data.reasons.map((r, i) => (
              <span key={i} className="px-3 py-1 bg-accent/10 border border-accent/20 rounded-full text-xs">
                {r}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Indicators */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <h3 className="font-semibold text-sm mb-2">RSI (Wilder)</h3>
          <div className="text-2xl font-bold">{data.indicators.rsi.toFixed(1)}</div>
          <div className={`text-xs ${
            data.indicators.rsiStatus === 'ذروة بيع' ? 'text-bullish' :
            data.indicators.rsiStatus === 'ذروة شراء' ? 'text-bearish' : 'text-neutral'
          }`}>
            {data.indicators.rsiStatus}
          </div>
        </div>
        <div className="card">
          <h3 className="font-semibold text-sm mb-2">EMA</h3>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-neutral-500">20:</span>
              <span className="font-mono">${formatPrice(data.indicators.ema20)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">50:</span>
              <span className="font-mono">${formatPrice(data.indicators.ema50)}</span>
            </div>
            {data.indicators.ema200 !== null && (
              <div className="flex justify-between">
                <span className="text-neutral-500">200:</span>
                <span className="font-mono">${formatPrice(data.indicators.ema200)}</span>
              </div>
            )}
          </div>
        </div>
        <div className="card">
          <h3 className="font-semibold text-sm mb-2">MACD</h3>
          <div className="text-2xl font-bold">{data.indicators.macdTrend}</div>
          <div className="text-xs text-neutral-500 space-y-0.5 mt-1">
            <div>Line: {data.indicators.macdLine.toFixed(2)}</div>
            <div>Signal: {data.indicators.macdSignal.toFixed(2)}</div>
            <div>Histogram: {data.indicators.macdHistogram.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Volume & Smart Money */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="card">
          <h3 className="font-semibold text-sm mb-2">الحجم</h3>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-neutral-500">الحالي:</span>
              <span>{data.volume.current.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">المتوسط:</span>
              <span>{data.volume.average.toLocaleString()}</span>
            </div>
            {data.volume.spike && (
              <div className="text-bullish font-semibold mt-1">⚡ ارتفاع حجم!</div>
            )}
          </div>
        </div>
        <div className="card">
          <h3 className="font-semibold text-sm mb-2">Smart Money</h3>
          <div className="text-xs">
            <div className="flex justify-between">
              <span className="text-neutral-500">Break of Structure:</span>
              <span className={data.smartMoney.bos !== 'NONE' ? 'text-accent font-semibold' : 'text-neutral'}>
                {data.smartMoney.bos === 'BULLISH' ? 'صاعد' : data.smartMoney.bos === 'BEARISH' ? 'هابط' : 'لا يوجد'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Support & Resistance */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="card border-bullish/10">
          <h3 className="font-semibold text-sm mb-2 text-bullish">الدعم</h3>
          <div className="space-y-1">
            {data.support.map((s, i) => (
              <div key={i} className="flex justify-between p-1.5 bg-bullish/5 rounded text-xs">
                <span>دعم {i + 1}</span>
                <span className="font-mono">${formatPrice(s)}</span>
              </div>
            ))}
            {data.support.length === 0 && (
              <p className="text-xs text-neutral-500">لا توجد مستويات</p>
            )}
          </div>
        </div>
        <div className="card border-bearish/10">
          <h3 className="font-semibold text-sm mb-2 text-bearish">المقاومة</h3>
          <div className="space-y-1">
            {data.resistance.map((r, i) => (
              <div key={i} className="flex justify-between p-1.5 bg-bearish/5 rounded text-xs">
                <span>مقاومة {i + 1}</span>
                <span className="font-mono">${formatPrice(r)}</span>
              </div>
            ))}
            {data.resistance.length === 0 && (
              <p className="text-xs text-neutral-500">لا توجد مستويات</p>
            )}
          </div>
        </div>
      </div>

      {/* Trade Setup */}
      <div className="card mb-6">
        <h3 className="font-semibold text-sm mb-4 text-center">إعداد الصفقة (ATR-based)</h3>
        <div className="grid grid-cols-4 gap-3 text-center">
          <div className="p-3 bg-background/50 rounded-xl">
            <div className="text-[10px] text-neutral-500">دخول</div>
            <div className="font-mono font-bold text-sm">${formatPrice(data.entry)}</div>
          </div>
          <div className="p-3 bg-bearish/5 rounded-xl">
            <div className="text-[10px] text-neutral-500">وقف</div>
            <div className="font-mono font-bold text-sm text-bearish">${formatPrice(data.stopLoss)}</div>
          </div>
          <div className="p-3 bg-bullish/5 rounded-xl">
            <div className="text-[10px] text-neutral-500">هدف 1</div>
            <div className="font-mono font-bold text-sm text-bullish">${formatPrice(data.target1)}</div>
          </div>
          <div className="p-3 bg-bullish/5 rounded-xl">
            <div className="text-[10px] text-neutral-500">هدف 2</div>
            <div className="font-mono font-bold text-sm text-bullish">${formatPrice(data.target2)}</div>
          </div>
        </div>
      </div>

      {/* Calculator */}
      <div className="card mb-6">
        <h3 className="font-semibold text-sm mb-4 text-center">حاسبة الصفقة</h3>
        <div className="flex flex-wrap gap-2 justify-center mb-4">
          {[0.01, 0.05, 0.1, 0.5, 1, 2, 5].map((lot) => (
            <button
              key={lot}
              onClick={() => setLotSize(lot)}
              className={`px-3 py-1.5 rounded-lg text-xs ${
                lotSize === lot ? 'bg-accent text-white' : 'bg-surface border border-white/10'
              }`}
            >
              {lot}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 bg-background/50 rounded-xl">
            <div className="text-[10px] text-neutral-500">القيمة</div>
            <div className="font-mono font-bold text-sm">${(data.entry * lotSize).toFixed(2)}</div>
          </div>
          <div className="p-3 bg-bearish/5 rounded-xl">
            <div className="text-[10px] text-neutral-500">الخسارة</div>
            <div className="font-mono font-bold text-sm text-bearish">
              -${(Math.abs(data.entry - data.stopLoss) * lotSize).toFixed(2)}
            </div>
          </div>
          <div className="p-3 bg-bullish/5 rounded-xl">
            <div className="text-[10px] text-neutral-500">الربح</div>
            <div className="font-mono font-bold text-sm text-bullish">
              +${(Math.abs(data.target1 - data.entry) * lotSize).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* All Signals Table */}
      {allSignals.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-sm mb-4">كل الإشارات</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="p-2 text-right text-neutral-500">العملة</th>
                  <th className="p-2 text-right text-neutral-500">السعر</th>
                  <th className="p-2 text-right text-neutral-500">الاتجاه</th>
                  <th className="p-2 text-right text-neutral-500">RSI</th>
                  <th className="p-2 text-right text-neutral-500">الثقة</th>
                  <th className="p-2 text-right text-neutral-500">R/R</th>
                </tr>
              </thead>
              <tbody>
                {allSignals.map((sig) => (
                  <tr
                    key={sig.id}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] cursor-pointer"
                    onClick={() => {
                      setSymbol(sig.symbol.replace('/USDT', 'USDT'))
                      setData(sig)
                    }}
                  >
                    <td className="p-2 font-semibold">{sig.symbol}</td>
                    <td className="p-2 font-mono">${formatPrice(sig.price)}</td>
                    <td className="p-2">
                      <span className={signalColor(sig.signal)}>
                        {sig.signal === 'BUY' ? '↑' : sig.signal === 'SELL' ? '↓' : '—'} {sig.signal}
                      </span>
                    </td>
                    <td className="p-2 font-mono">{sig.indicators.rsi.toFixed(1)}</td>
                    <td className="p-2 text-accent">{sig.confidence}%</td>
                    <td className="p-2">{sig.riskReward}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  )
}
