'use client'

import { useEffect, useState, useCallback } from 'react'
import { KFOOSignal } from '@/lib/types'
import { formatPrice } from '@/lib/binance'
import { ProtectedPage } from '@/components/ProtectedPage'

const timeframes = [
  { value: '1m', label: '1 دقيقة' },
  { value: '5m', label: '5 دقائق' },
  { value: '15m', label: 'ربع ساعة' },
]

export default function ScalpingPage() {
  const [signals, setSignals] = useState<KFOOSignal[]>([])
  const [timeframe, setTimeframe] = useState('5m')
  const [loading, setLoading] = useState(true)

  const fetchSignals = useCallback(async () => {
    try {
      const res = await fetch(`/api/qabas?interval=${timeframe}`)
      const json = await res.json()
      if (json.success) setSignals(json.data.signals)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }, [timeframe])

  useEffect(() => {
    setLoading(true)
    fetchSignals()
    const timer = window.setInterval(fetchSignals, 10000)
    return () => window.clearInterval(timer)
  }, [fetchSignals])

  const active = signals.filter((s) => s.signal !== 'NEUTRAL')
  const buyCount = signals.filter((s) => s.signal === 'BUY').length
  const sellCount = signals.filter((s) => s.signal === 'SELL').length

  return (
    <ProtectedPage requiredPlan="pro" pageName="scalping" featureName="المضاربة اللحظية">
    <main className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">المضاربة اللحظية</h1>
          <p className="text-sm text-neutral-500 mt-1">إشارات سريعة — تحديث كل 10 ثوانٍ</p>
        </div>
        <div className="flex gap-2">
          {timeframes.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setTimeframe(tf.value)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                timeframe === tf.value
                  ? 'bg-accent text-white'
                  : 'bg-surface border border-white/10 hover:bg-surface-light'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card text-center">
          <div className="text-2xl font-bold">{active.length}</div>
          <div className="text-xs text-neutral-500">إشارات نشطة</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-bullish">{buyCount}</div>
          <div className="text-xs text-neutral-500">شراء</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-bearish">{sellCount}</div>
          <div className="text-xs text-neutral-500">بيع</div>
        </div>
      </div>

      {/* Signals */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse h-48" />
          ))}
        </div>
      ) : signals.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-neutral-400">لا توجد إشارات حالياً</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {signals.map((sig) => {
            const isBuy = sig.signal === 'BUY'
            const isNeutral = sig.signal === 'NEUTRAL'
            return (
              <div
                key={sig.id}
                className={`card-glow ${
                  isNeutral ? '' : isBuy ? 'signal-long' : 'signal-short'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold">{sig.symbol}</h3>
                    <span className="text-xs text-neutral-500 font-mono">
                      ${formatPrice(sig.price)}
                    </span>
                  </div>
                  <span
                    className={`badge ${
                      isBuy ? 'badge-buy' : isNeutral ? 'badge-neutral' : 'badge-sell'
                    }`}
                  >
                    {isBuy ? 'شراء' : isNeutral ? 'انتظر' : 'بيع'}
                  </span>
                </div>

                <div className="text-xs text-neutral-400 mb-3">{sig.reason}</div>

                {!isNeutral && (
                  <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
                    <div className="p-2 bg-background/50 rounded-lg">
                      <div className="text-neutral-500">دخول</div>
                      <div className="font-mono font-medium">${formatPrice(sig.entry)}</div>
                    </div>
                    <div className="p-2 bg-bearish/5 rounded-lg">
                      <div className="text-neutral-500">وقف</div>
                      <div className="font-mono text-bearish">${formatPrice(sig.stopLoss)}</div>
                    </div>
                    <div className="p-2 bg-bullish/5 rounded-lg">
                      <div className="text-neutral-500">هدف</div>
                      <div className="font-mono text-bullish">${formatPrice(sig.target1)}</div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between text-xs text-neutral-500 pt-2 border-t border-white/[0.06]">
                  <span>RSI: {sig.indicators.rsi.toFixed(1)}</span>
                  <span>الثقة: <span className="text-accent">{sig.confidence}%</span></span>
                  <span>R/R: {sig.riskReward}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
    </ProtectedPage>
  )
}
