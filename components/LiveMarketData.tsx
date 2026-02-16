'use client'

import { useEffect, useState, useCallback } from 'react'
import { MarketPrice, KFOOSignal } from '@/lib/types'
import { formatPrice } from '@/lib/binance'

// ============================================
// Live Market Prices Component
// ============================================
export function LiveMarketPrices() {
  const [prices, setPrices] = useState<MarketPrice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<string>('')

  const fetchPrices = useCallback(async () => {
    try {
      const response = await fetch('/api/market')
      const result = await response.json()

      if (result.success) {
        setPrices(result.data.prices)
        setLastUpdate(result.data.timestamp)
        setError(null)
      } else {
        setError('فشل في جلب البيانات')
      }
    } catch {
      setError('خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPrices()
    const interval = setInterval(fetchPrices, 30000)
    return () => clearInterval(interval)
  }, [fetchPrices])

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-4 bg-surface-light rounded w-1/4 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-surface-light rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card border-bearish/20">
        <div className="text-bearish text-sm">⚠️ {error}</div>
        <button
          onClick={fetchPrices}
          className="text-xs text-accent hover:underline mt-2"
        >
          إعادة المحاولة
        </button>
      </div>
    )
  }

  return (
    <div className="card-glow">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-sm">أسعار حية</h3>
        <span className="text-xs text-neutral-500">
          {lastUpdate ? new Date(lastUpdate).toLocaleTimeString('ar-SA') : ''}
        </span>
      </div>

      <div className="space-y-1.5">
        {prices.slice(0, 8).map((item) => (
          <div
            key={item.symbol}
            className="flex justify-between items-center p-2.5 bg-background/50 rounded-lg hover:bg-surface-light/30 transition-colors"
          >
            <span className="font-medium text-sm">{item.symbol}</span>
            <div className="text-left">
              <div className="font-mono text-sm">
                ${item.price > 1 ? item.price.toLocaleString() : item.price.toFixed(6)}
              </div>
              <div
                className={`text-xs font-medium ${
                  item.change >= 0 ? 'text-bullish' : 'text-bearish'
                }`}
              >
                {item.change >= 0 ? '▲' : '▼'} {Math.abs(item.change).toFixed(2)}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================
// Live Signals Component (fetches from KFOO API)
// ============================================
export function LiveSignals() {
  const [signals, setSignals] = useState<KFOOSignal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSignals = useCallback(async () => {
    try {
      const response = await fetch('/api/kfoo?interval=15m')
      const result = await response.json()

      if (result.success && result.data.signals) {
        setSignals(result.data.signals)
        setError(null)
      } else {
        setError('فشل في توليد الإشارات')
      }
    } catch {
      setError('خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSignals()
    const interval = setInterval(fetchSignals, 60000)
    return () => clearInterval(interval)
  }, [fetchSignals])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card animate-pulse">
            <div className="h-4 bg-surface-light rounded w-1/2 mb-4" />
            <div className="h-24 bg-surface-light rounded-lg" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="card border-bearish/20 text-center py-12">
        <div className="text-3xl mb-3">⚠️</div>
        <p className="text-bearish text-sm">{error}</p>
        <button
          onClick={fetchSignals}
          className="mt-3 text-sm text-accent hover:underline"
        >
          إعادة المحاولة
        </button>
      </div>
    )
  }

  const activeSignals = signals.filter((s) => s.signal !== 'NEUTRAL')

  return (
    <div>
      {/* Active Signals */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2 h-2 bg-bullish rounded-full animate-pulse" />
          <h3 className="font-semibold text-sm">
            إشارات نشطة ({activeSignals.length})
          </h3>
          <span className="text-xs text-neutral-500">(بيانات حقيقية من Binance)</span>
        </div>

        {activeSignals.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeSignals.map((sig) => (
              <LiveSignalCard key={sig.id} signal={sig} />
            ))}
          </div>
        ) : (
          <div className="card text-center py-10">
            <div className="text-3xl mb-3">⏳</div>
            <p className="text-neutral-400 text-sm">لا توجد إشارات نشطة حالياً</p>
            <p className="text-xs text-neutral-500 mt-1">السوق في حالة محايدة</p>
          </div>
        )}
      </div>

      {/* All Signals Summary */}
      {signals.length > 0 && (
        <div className="card-glow bg-gradient-to-r from-accent/5 to-purple-500/5 border-accent/10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="text-xl">📊</div>
              <div>
                <h4 className="font-semibold text-sm">ملخص السوق</h4>
                <p className="text-xs text-neutral-400">
                  {signals.filter((s) => s.signal === 'BUY').length} شراء •{' '}
                  {signals.filter((s) => s.signal === 'SELL').length} بيع •{' '}
                  {signals.filter((s) => s.signal === 'NEUTRAL').length} محايد
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <StatusBadge label="Crypto" status="open" />
              <StatusBadge label="Binance" status="open" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// Sub-components
// ============================================
function LiveSignalCard({ signal }: { signal: KFOOSignal }) {
  const isBuy = signal.signal === 'BUY'

  return (
    <div
      className={`card-glow ${
        isBuy ? 'signal-long' : 'signal-short'
      } animate-fade-in`}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
              isBuy ? 'bg-bullish/15 text-bullish' : 'bg-bearish/15 text-bearish'
            }`}
          >
            {isBuy ? '↑' : '↓'}
          </div>
          <div>
            <h4 className="font-bold text-sm">{signal.symbol}</h4>
            <span className="text-xs text-neutral-500">
              ${formatPrice(signal.price)}
            </span>
          </div>
        </div>
        <span className={`badge ${isBuy ? 'badge-buy' : 'badge-sell'}`}>
          {isBuy ? 'شراء' : 'بيع'}
        </span>
      </div>

      <div className="text-xs text-neutral-400 mb-3">{signal.reason}</div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="p-2 bg-background/50 rounded-lg">
          <div className="text-neutral-500">دخول</div>
          <div className="font-mono font-medium">${formatPrice(signal.entry)}</div>
        </div>
        <div className="p-2 bg-bearish/5 rounded-lg">
          <div className="text-neutral-500">وقف</div>
          <div className="font-mono font-medium text-bearish">
            ${formatPrice(signal.stopLoss)}
          </div>
        </div>
        <div className="p-2 bg-bullish/5 rounded-lg">
          <div className="text-neutral-500">هدف</div>
          <div className="font-mono font-medium text-bullish">
            ${formatPrice(signal.target1)}
          </div>
        </div>
      </div>

      {signal.reasons.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {signal.reasons.slice(0, 3).map((r, i) => (
            <span
              key={i}
              className="px-2 py-0.5 bg-surface-light/50 rounded text-[10px] text-neutral-400"
            >
              {r}
            </span>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/[0.06]">
        <span className="text-xs text-neutral-500">
          الثقة: <span className="text-accent font-medium">{signal.confidence}%</span>
        </span>
        <span className="text-xs text-neutral-500">
          R/R: <span className="text-white font-medium">{signal.riskReward}</span>
        </span>
      </div>
    </div>
  )
}

function StatusBadge({ label, status }: { label: string; status: 'open' | 'closed' }) {
  return (
    <div className="px-3 py-1.5 rounded-lg bg-surface/80 border border-white/[0.06] flex items-center gap-2">
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          status === 'open' ? 'bg-bullish' : 'bg-bearish'
        }`}
      />
      <span className="text-xs">{label}</span>
    </div>
  )
}
