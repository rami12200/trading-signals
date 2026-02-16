'use client'

import { Signal } from '@/lib/types'
import { useEffect, useState } from 'react'
import { formatPrice } from '@/lib/binance'

interface SignalCardProps {
  signal: Signal
  compact?: boolean
}

export function SignalCard({ signal, compact = false }: SignalCardProps) {
  const isLong = signal.direction === 'LONG'
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Correct profit calculation for both LONG and SHORT
  const calcProfit = (target: number) => {
    if (isLong) {
      return (((target - signal.entry) / signal.entry) * 100).toFixed(2)
    }
    return (((signal.entry - target) / signal.entry) * 100).toFixed(2)
  }

  const calcRisk = () => {
    if (isLong) {
      return (((signal.entry - signal.sl) / signal.entry) * 100).toFixed(2)
    }
    return (((signal.sl - signal.entry) / signal.entry) * 100).toFixed(2)
  }

  const profitTp1 = calcProfit(signal.tp1)
  const profitTp2 = calcProfit(signal.tp2)
  const risk = calcRisk()

  const formatTime = (timestamp: string) => {
    if (!mounted) return '--:--'
    return new Date(timestamp).toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getTimeframeLabel = (tf: string) => {
    const labels: Record<string, string> = {
      '1m': 'دقيقة',
      '5m': '5 دقائق',
      '15m': 'ربع ساعة',
      '1h': 'ساعة',
      '4h': '4 ساعات',
      '1d': 'يومي',
      '1w': 'أسبوعي',
    }
    return labels[tf] || tf
  }

  const statusConfig: Record<string, { class: string; label: string }> = {
    ACTIVE: { class: 'badge-buy', label: 'نشط' },
    TP_HIT: { class: 'bg-accent/15 text-accent border border-accent/20', label: 'هدف محقق ✓' },
    SL_HIT: { class: 'badge-sell', label: 'وقف ضُرب' },
    EXPIRED: { class: 'badge-neutral', label: 'منتهي' },
  }

  if (compact) {
    return (
      <div className={`card-glow p-4 ${isLong ? 'signal-long' : 'signal-short'}`}>
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <span className={`badge ${isLong ? 'badge-buy' : 'badge-sell'}`}>
              {isLong ? 'شراء' : 'بيع'}
            </span>
            <span className="font-bold">{signal.symbol}</span>
          </div>
          <span className="text-xs text-neutral-500">{getTimeframeLabel(signal.timeframe)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <div>
            <span className="text-neutral-400">دخول: </span>
            <span className="font-mono">{formatPrice(signal.entry)}</span>
          </div>
          <div>
            <span className="text-neutral-400">ربح: </span>
            <span className="font-mono text-bullish">+{profitTp1}%</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`card-glow ${isLong ? 'signal-long' : 'signal-short'} animate-fade-in`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold ${
              isLong ? 'bg-bullish/15 text-bullish' : 'bg-bearish/15 text-bearish'
            }`}
          >
            {isLong ? '↑' : '↓'}
          </div>
          <div>
            <h3 className="text-lg font-bold">{signal.symbol}</h3>
            <span className="text-xs text-neutral-500">{signal.exchange}</span>
          </div>
        </div>
        <div className="text-left">
          <span className={`badge ${statusConfig[signal.status]?.class || 'badge-neutral'}`}>
            {statusConfig[signal.status]?.label || signal.status}
          </span>
          <div className="text-xs text-neutral-500 mt-1">{formatTime(signal.timestamp)}</div>
        </div>
      </div>

      {/* Price Levels */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <PriceLevel label="دخول" value={formatPrice(signal.entry)} color="text-white" />
        <PriceLevel label="وقف الخسارة" value={formatPrice(signal.sl)} color="text-bearish" extra={`-${risk}%`} />
        <PriceLevel label="الهدف 1" value={formatPrice(signal.tp1)} color="text-bullish" extra={`+${profitTp1}%`} />
        <PriceLevel label="الهدف 2" value={formatPrice(signal.tp2)} color="text-bullish" extra={`+${profitTp2}%`} />
      </div>

      {/* Confidence & Timeframe */}
      <div className="flex justify-between items-center py-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-xs text-neutral-500">الإطار</span>
            <div className="font-medium text-sm">{getTimeframeLabel(signal.timeframe)}</div>
          </div>
          <div>
            <span className="text-xs text-neutral-500">الثقة</span>
            <div className="font-medium text-sm text-accent">{signal.confidence}%</div>
          </div>
        </div>
        <div className="text-xs text-bearish">المخاطرة: {risk}%</div>
      </div>

      {/* Indicators */}
      <div className="flex gap-2 flex-wrap pt-3 border-t border-white/[0.06]">
        <IndicatorBadge label="RSI" value={signal.indicators.rsi.toFixed(1)} />
        <IndicatorBadge label="MACD" value={signal.indicators.macd.trend} />
        <IndicatorBadge label="EMA" value={signal.indicators.ema.position} />
      </div>

      {/* Analysis */}
      <div className="mt-4 p-3 bg-background/50 rounded-xl">
        <p className="text-sm text-neutral-300 leading-relaxed">{signal.analysis}</p>
      </div>
    </div>
  )
}

function PriceLevel({
  label,
  value,
  color,
  extra,
}: {
  label: string
  value: string
  color: string
  extra?: string
}) {
  return (
    <div className="p-2.5 bg-background/50 rounded-xl">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className={`font-mono font-semibold text-sm ${color}`}>{value}</div>
      {extra && <div className="text-xs text-bullish mt-0.5">{extra}</div>}
    </div>
  )
}

function IndicatorBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2.5 py-1 bg-surface-light/50 rounded-lg text-xs">
      <span className="text-neutral-500">{label}: </span>
      <span className="text-white font-medium">{value}</span>
    </div>
  )
}
