'use client'

import { useEffect, useState, useCallback } from 'react'
import { MarketClock } from '@/components/MarketClock'
import { MarketPrice } from '@/lib/types'

export default function MarketsPage() {
  const [prices, setPrices] = useState<MarketPrice[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPrices = useCallback(async () => {
    try {
      const res = await fetch('/api/market')
      const json = await res.json()
      if (json.success) setPrices(json.data.prices)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchPrices()
    const timer = window.setInterval(fetchPrices, 30000)
    return () => window.clearInterval(timer)
  }, [fetchPrices])

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">حالة الأسواق</h1>
      <p className="text-sm text-neutral-500 mb-6">بيانات حية من Binance</p>

      <MarketClock />

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">أسعار العملات الرقمية</h2>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="card animate-pulse h-24" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {prices.map((p) => (
              <div key={p.symbol} className="card-glow">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold">{p.symbol}</h3>
                    <div className="text-2xl font-mono font-bold mt-1">
                      ${p.price > 1 ? p.price.toLocaleString('en-US', { maximumFractionDigits: 2 }) : p.price.toFixed(6)}
                    </div>
                  </div>
                  <span
                    className={`badge ${p.change >= 0 ? 'badge-buy' : 'badge-sell'}`}
                  >
                    {p.change >= 0 ? '▲' : '▼'} {Math.abs(p.change).toFixed(2)}%
                  </span>
                </div>
                <div className="flex gap-4 mt-3 text-xs text-neutral-500">
                  <span>أعلى: <span className="text-white font-mono">${p.high > 1 ? p.high.toLocaleString() : p.high.toFixed(6)}</span></span>
                  <span>أدنى: <span className="text-white font-mono">${p.low > 1 ? p.low.toLocaleString() : p.low.toFixed(6)}</span></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Best Trading Times */}
      <div className="mt-12">
        <h2 className="text-lg font-semibold mb-4">أفضل أوقات التداول</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card-glow">
            <h3 className="font-semibold text-sm mb-2">تداخل لندن + نيويورك</h3>
            <div className="text-accent font-mono text-lg">14:00 - 17:00 UTC</div>
            <p className="text-xs text-neutral-400 mt-1">أعلى سيولة وتقلب — أفضل وقت للتداول</p>
          </div>
          <div className="card-glow">
            <h3 className="font-semibold text-sm mb-2">تداخل طوكيو + لندن</h3>
            <div className="text-accent font-mono text-lg">08:00 - 09:00 UTC</div>
            <p className="text-xs text-neutral-400 mt-1">افتتاح أوروبا — حركة قوية</p>
          </div>
          <div className="card-glow">
            <h3 className="font-semibold text-sm mb-2">Crypto 24/7</h3>
            <div className="text-accent font-mono text-lg">مفتوح دائماً</div>
            <p className="text-xs text-neutral-400 mt-1">أفضل تقلب: 14:00 - 20:00 UTC</p>
          </div>
        </div>
      </div>
    </main>
  )
}
