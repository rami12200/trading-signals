'use client'

import { useEffect, useState, useCallback } from 'react'
import { KFOOSignal } from '@/lib/types'
import { formatPrice } from '@/lib/binance'
import { ProtectedPage } from '@/components/ProtectedPage'

export default function DailyPage() {
  const [signals, setSignals] = useState<KFOOSignal[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSignals = useCallback(async () => {
    try {
      const res = await fetch('/api/qabas?interval=1h')
      const json = await res.json()
      if (json.success) setSignals(json.data.signals)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchSignals()
    const timer = window.setInterval(fetchSignals, 60000)
    return () => window.clearInterval(timer)
  }, [fetchSignals])

  const buyCount = signals.filter((s) => s.signal === 'BUY').length
  const sellCount = signals.filter((s) => s.signal === 'SELL').length
  const neutralCount = signals.filter((s) => s.signal === 'NEUTRAL').length

  return (
    <ProtectedPage requiredPlan="pro" featureName="التوصيات اليومية">
    <main className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">التوصيات اليومية</h1>
      <p className="text-sm text-neutral-500 mb-6">تحليل على إطار الساعة — تحديث كل دقيقة</p>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="card text-center border-bullish/10">
          <div className="text-3xl font-bold text-bullish">{buyCount}</div>
          <div className="text-xs text-neutral-500">صاعد</div>
        </div>
        <div className="card text-center border-bearish/10">
          <div className="text-3xl font-bold text-bearish">{sellCount}</div>
          <div className="text-xs text-neutral-500">هابط</div>
        </div>
        <div className="card text-center border-neutral/10">
          <div className="text-3xl font-bold text-neutral">{neutralCount}</div>
          <div className="text-xs text-neutral-500">محايد</div>
        </div>
      </div>

      {/* Signals */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse h-40" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {signals.map((sig) => {
            const isBuy = sig.signal === 'BUY'
            const isNeutral = sig.signal === 'NEUTRAL'
            return (
              <div
                key={sig.id}
                className={`card-glow ${isNeutral ? '' : isBuy ? 'signal-long' : 'signal-short'}`}
              >
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  {/* Left: Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-lg font-bold">{sig.symbol}</h3>
                      <span
                        className={`badge ${
                          isBuy ? 'badge-buy' : isNeutral ? 'badge-neutral' : 'badge-sell'
                        }`}
                      >
                        {isBuy ? 'صاعد' : isNeutral ? 'محايد' : 'هابط'}
                      </span>
                      <span className="text-xs text-neutral-500">الثقة: {sig.confidence}%</span>
                    </div>

                    <p className="text-sm text-neutral-400 mb-3">{sig.reason}</p>

                    {/* Reasons */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {sig.reasons.map((r, i) => (
                        <span key={i} className="px-2 py-0.5 bg-surface-light/50 rounded text-[10px] text-neutral-400">
                          {r}
                        </span>
                      ))}
                    </div>

                    {/* Indicators */}
                    <div className="flex gap-3 text-xs text-neutral-500">
                      <span>RSI: <span className="text-white">{sig.indicators.rsi.toFixed(1)}</span></span>
                      <span>MACD: <span className="text-white">{sig.indicators.macdTrend}</span></span>
                      <span>BoS: <span className="text-white">{sig.smartMoney.bos === 'BULLISH' ? 'صاعد' : sig.smartMoney.bos === 'BEARISH' ? 'هابط' : '—'}</span></span>
                    </div>
                  </div>

                  {/* Right: Trade Setup */}
                  {!isNeutral && (
                    <div className="md:w-64 grid grid-cols-2 gap-2">
                      <div className="p-2.5 bg-background/50 rounded-xl text-center">
                        <div className="text-[10px] text-neutral-500">دخول</div>
                        <div className="font-mono font-bold text-sm">${formatPrice(sig.entry)}</div>
                      </div>
                      <div className="p-2.5 bg-bearish/5 rounded-xl text-center">
                        <div className="text-[10px] text-neutral-500">وقف</div>
                        <div className="font-mono font-bold text-sm text-bearish">${formatPrice(sig.stopLoss)}</div>
                      </div>
                      <div className="p-2.5 bg-bullish/5 rounded-xl text-center">
                        <div className="text-[10px] text-neutral-500">هدف 1</div>
                        <div className="font-mono font-bold text-sm text-bullish">${formatPrice(sig.target1)}</div>
                      </div>
                      <div className="p-2.5 bg-bullish/5 rounded-xl text-center">
                        <div className="text-[10px] text-neutral-500">هدف 2</div>
                        <div className="font-mono font-bold text-sm text-bullish">${formatPrice(sig.target2)}</div>
                      </div>
                    </div>
                  )}
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
