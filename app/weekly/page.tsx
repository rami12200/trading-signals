'use client'

import { useEffect, useState, useCallback } from 'react'
import { KFOOSignal } from '@/lib/types'
import { formatPrice } from '@/lib/binance'
import { ProtectedPage } from '@/components/ProtectedPage'

export default function WeeklyPage() {
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
    const timer = window.setInterval(fetchSignals, 120000)
    return () => window.clearInterval(timer)
  }, [fetchSignals])

  const buyCount = signals.filter((s) => s.signal === 'BUY').length
  const sellCount = signals.filter((s) => s.signal === 'SELL').length

  return (
    <ProtectedPage requiredPlan="pro" pageName="weekly" featureName="التحليل الأسبوعي">
    <main className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">التحليل الأسبوعي</h1>
      <p className="text-sm text-neutral-500 mb-6">نظرة شاملة على اتجاه السوق</p>

      {/* Week Summary */}
      <div className="card mb-8 bg-gradient-to-r from-accent/5 to-purple-500/5 border-accent/10">
        <div className="text-center">
          <h2 className="text-lg font-semibold mb-2">ملخص الأسبوع</h2>
          <div className="flex justify-center gap-8">
            <div>
              <div className="text-3xl font-bold text-bullish">{buyCount}</div>
              <div className="text-xs text-neutral-500">صاعد</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-bearish">{sellCount}</div>
              <div className="text-xs text-neutral-500">هابط</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-neutral">{signals.length - buyCount - sellCount}</div>
              <div className="text-xs text-neutral-500">محايد</div>
            </div>
          </div>
          <p className="text-sm text-neutral-400 mt-4">
            {buyCount > sellCount
              ? 'الاتجاه العام صاعد — فرص شراء أكثر'
              : sellCount > buyCount
              ? 'الاتجاه العام هابط — حذر مطلوب'
              : 'السوق متذبذب — انتظر تأكيد الاتجاه'}
          </p>
        </div>
      </div>

      {/* Signals */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse h-48" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {signals.map((sig) => {
            const isBuy = sig.signal === 'BUY'
            const isNeutral = sig.signal === 'NEUTRAL'
            return (
              <div
                key={sig.id}
                className={`card-glow ${isNeutral ? '' : isBuy ? 'signal-long' : 'signal-short'}`}
              >
                {/* Header */}
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold">{sig.symbol}</h3>
                    <span
                      className={`badge ${
                        isBuy ? 'badge-buy' : isNeutral ? 'badge-neutral' : 'badge-sell'
                      }`}
                    >
                      {isBuy ? 'صاعد' : isNeutral ? 'محايد' : 'هابط'}
                    </span>
                  </div>
                  <div className="text-2xl font-mono font-bold">${formatPrice(sig.price)}</div>
                </div>

                {/* Analysis */}
                <p className="text-sm text-neutral-400 mb-4">{sig.reason}</p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {sig.reasons.map((r, i) => (
                    <span key={i} className="px-2 py-0.5 bg-surface-light/50 rounded text-[10px] text-neutral-400">
                      {r}
                    </span>
                  ))}
                </div>

                {/* Key Levels */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  {sig.support.slice(0, 2).map((s, i) => (
                    <div key={`s${i}`} className="p-2.5 bg-bullish/5 rounded-xl text-center">
                      <div className="text-[10px] text-neutral-500">دعم {i + 1}</div>
                      <div className="font-mono font-bold text-sm text-bullish">${formatPrice(s)}</div>
                    </div>
                  ))}
                  {sig.resistance.slice(0, 2).map((r, i) => (
                    <div key={`r${i}`} className="p-2.5 bg-bearish/5 rounded-xl text-center">
                      <div className="text-[10px] text-neutral-500">مقاومة {i + 1}</div>
                      <div className="font-mono font-bold text-sm text-bearish">${formatPrice(r)}</div>
                    </div>
                  ))}
                </div>

                {/* Indicators Row */}
                <div className="flex flex-wrap gap-3 text-xs text-neutral-500 pt-3 border-t border-white/[0.06]">
                  <span>RSI: <span className="text-white font-medium">{sig.indicators.rsi.toFixed(1)}</span></span>
                  <span>MACD: <span className="text-white font-medium">{sig.indicators.macdTrend}</span></span>
                  <span>الحجم: <span className="text-white font-medium">{sig.volume.spike ? 'مرتفع' : 'عادي'}</span></span>
                  <span>BoS: <span className="text-white font-medium">{sig.smartMoney.bos === 'BULLISH' ? 'صاعد' : sig.smartMoney.bos === 'BEARISH' ? 'هابط' : '—'}</span></span>
                  <span>الثقة: <span className="text-accent font-medium">{sig.confidence}%</span></span>
                  <span>R/R: <span className="text-white font-medium">{sig.riskReward}</span></span>
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
