'use client'

import { useEffect, useState, useCallback } from 'react'
import { KFOOSignal } from '@/lib/types'
import { formatPrice } from '@/lib/binance'

const timeframes = [
  { value: '1m', label: '1 دقيقة' },
  { value: '5m', label: '5 دقائق' },
  { value: '15m', label: 'ربع ساعة' },
  { value: '1h', label: 'ساعة' },
]

export default function SignalsPage() {
  const [signals, setSignals] = useState<KFOOSignal[]>([])
  const [timeframe, setTimeframe] = useState('15m')
  const [loading, setLoading] = useState(true)
  const [tracked, setTracked] = useState<string[]>([])

  const fetchSignals = useCallback(async () => {
    try {
      const res = await fetch(`/api/kfoo?interval=${timeframe}`)
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
    const timer = window.setInterval(fetchSignals, 15000)
    return () => window.clearInterval(timer)
  }, [fetchSignals])

  const toggleTrack = (id: string) => {
    setTracked((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]))
  }

  const buyCount = signals.filter((s) => s.signal === 'BUY').length
  const sellCount = signals.filter((s) => s.signal === 'SELL').length

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">جدول الإشارات</h1>
          <p className="text-sm text-neutral-500 mt-1">تحديث كل 15 ثانية • بيانات Binance حية</p>
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

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card text-center">
          <div className="text-2xl font-bold text-bullish">{buyCount}</div>
          <div className="text-xs text-neutral-500">شراء</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-bearish">{sellCount}</div>
          <div className="text-xs text-neutral-500">بيع</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-neutral">{signals.length - buyCount - sellCount}</div>
          <div className="text-xs text-neutral-500">محايد</div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="card animate-pulse">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-surface-light rounded-lg" />
            ))}
          </div>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="p-3 text-right text-neutral-500 font-medium">العملة</th>
                <th className="p-3 text-right text-neutral-500 font-medium">السعر</th>
                <th className="p-3 text-right text-neutral-500 font-medium">الاتجاه</th>
                <th className="p-3 text-right text-neutral-500 font-medium">RSI</th>
                <th className="p-3 text-right text-neutral-500 font-medium">شراء</th>
                <th className="p-3 text-right text-neutral-500 font-medium">بيع</th>
                <th className="p-3 text-right text-neutral-500 font-medium">دخول</th>
                <th className="p-3 text-right text-neutral-500 font-medium">وقف</th>
                <th className="p-3 text-right text-neutral-500 font-medium">هدف</th>
                <th className="p-3 text-right text-neutral-500 font-medium">R/R</th>
                <th className="p-3 text-right text-neutral-500 font-medium">تتبع</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((sig) => (
                <tr
                  key={sig.id}
                  className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors ${
                    tracked.includes(sig.id) ? 'bg-accent/5' : ''
                  }`}
                >
                  <td className="p-3 font-semibold">{sig.symbol}</td>
                  <td className="p-3 font-mono">${formatPrice(sig.price)}</td>
                  <td className="p-3">
                    <span
                      className={`badge ${
                        sig.signal === 'BUY'
                          ? 'badge-buy'
                          : sig.signal === 'SELL'
                          ? 'badge-sell'
                          : 'badge-neutral'
                      }`}
                    >
                      {sig.signal === 'BUY' ? 'شراء' : sig.signal === 'SELL' ? 'بيع' : 'محايد'}
                    </span>
                  </td>
                  <td className="p-3 font-mono">{sig.indicators.rsi.toFixed(1)}</td>
                  <td className="p-3 text-bullish font-mono">{sig.buyScore}</td>
                  <td className="p-3 text-bearish font-mono">{sig.sellScore}</td>
                  <td className="p-3 font-mono">${formatPrice(sig.entry)}</td>
                  <td className="p-3 font-mono text-bearish">${formatPrice(sig.stopLoss)}</td>
                  <td className="p-3 font-mono text-bullish">${formatPrice(sig.target1)}</td>
                  <td className="p-3 font-mono">{sig.riskReward}</td>
                  <td className="p-3">
                    <button
                      onClick={() => toggleTrack(sig.id)}
                      className={`text-xs px-2 py-1 rounded ${
                        tracked.includes(sig.id)
                          ? 'bg-accent text-white'
                          : 'bg-surface-light hover:bg-accent/20'
                      }`}
                    >
                      {tracked.includes(sig.id) ? '✓' : '+'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tracked */}
      {tracked.length > 0 && (
        <div className="card mt-6">
          <h3 className="font-semibold text-sm mb-3">صفقاتي ({tracked.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {signals
              .filter((s) => tracked.includes(s.id))
              .map((sig) => (
                <div key={sig.id} className="p-3 bg-background/50 rounded-xl flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-sm">{sig.symbol}</span>
                    <span className={`mr-2 text-xs ${sig.signal === 'BUY' ? 'text-bullish' : 'text-bearish'}`}>
                      {sig.signal}
                    </span>
                  </div>
                  <div className="text-xs font-mono">
                    ${formatPrice(sig.entry)} → ${formatPrice(sig.target1)}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </main>
  )
}
