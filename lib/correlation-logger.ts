// ============================================
// Correlation Signal Logger — Supabase
// Logs signals, tracks results, provides stats
// ============================================

import { createClient } from '@supabase/supabase-js'
import type { CorrelationSignal, ActiveTrade } from './correlation-engine'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

// ─── Log a new signal ──────────────────────────────────────────────────────────

export async function logCorrelationSignal(signal: CorrelationSignal): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return

  try {
    await supabase.from('correlation_signals').insert({
      signal_id: signal.id,
      symbol: signal.symbol,
      label: signal.label,
      action: signal.action,
      entry: signal.entry,
      stop_loss: signal.stopLoss,
      take_profit: signal.takeProfit,
      confidence: signal.confidence,
      lag_score: signal.lagScore,
      btc_change: signal.btcChange,
      btc_direction: signal.btcDirection,
      correlation: signal.correlation,
      risk_reward: signal.riskReward,
      reason: signal.reason,
      result: 'PENDING',
    })
  } catch (e) {
    console.error('[CorrLogger] Error logging signal:', e)
  }
}

// ─── Update signal result ──────────────────────────────────────────────────────

export async function updateSignalResult(
  signalId: string,
  result: 'WIN' | 'LOSS' | 'BREAKEVEN' | 'EMERGENCY',
  exitPrice: number
): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return

  try {
    await supabase
      .from('correlation_signals')
      .update({
        result,
        exit_price: exitPrice,
        exit_time: new Date().toISOString(),
      })
      .eq('signal_id', signalId)
  } catch (e) {
    console.error('[CorrLogger] Error updating result:', e)
  }
}

// ─── Log completed trade ───────────────────────────────────────────────────────

export async function logCompletedTrade(trade: ActiveTrade): Promise<void> {
  let result: 'WIN' | 'LOSS' | 'BREAKEVEN' | 'EMERGENCY' = 'LOSS'
  if (trade.status === 'TP_HIT') result = 'WIN'
  else if (trade.status === 'EMERGENCY_CLOSE') result = trade.pnl >= 0 ? 'BREAKEVEN' : 'EMERGENCY'
  else if (trade.status === 'MANUAL_CLOSE') result = trade.pnl >= 0 ? 'WIN' : 'LOSS'
  else if (trade.pnl >= 0) result = 'WIN'

  await updateSignalResult(trade.signal.id, result, trade.currentPrice)
}

// ─── Get performance stats ─────────────────────────────────────────────────────

export interface CorrelationStats {
  total: number
  wins: number
  losses: number
  pending: number
  winRate: number
  profitFactor: number
  avgConfidence: number
  avgLagScore: number
  avgRiskReward: number
  bySymbol: Record<string, {
    total: number
    wins: number
    winRate: number
  }>
}

export async function getCorrelationStats(days: number = 30): Promise<CorrelationStats | null> {
  const supabase = getSupabase()
  if (!supabase) return null

  try {
    const since = new Date(Date.now() - days * 86400000).toISOString()
    const { data, error } = await supabase
      .from('correlation_signals')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false })

    if (error || !data) return null

    const total = data.length
    const wins = data.filter(d => d.result === 'WIN').length
    const losses = data.filter(d => d.result === 'LOSS' || d.result === 'EMERGENCY').length
    const pending = data.filter(d => d.result === 'PENDING').length

    const decided = wins + losses
    const winRate = decided > 0 ? (wins / decided) * 100 : 0

    // Profit factor approximation from R:R
    const winRR = data.filter(d => d.result === 'WIN').reduce((s, d) => s + (d.risk_reward || 1), 0)
    const lossCount = losses || 1
    const profitFactor = lossCount > 0 ? winRR / lossCount : winRR

    const avgConfidence = total > 0
      ? data.reduce((s, d) => s + (d.confidence || 0), 0) / total : 0
    const avgLagScore = total > 0
      ? data.reduce((s, d) => s + (d.lag_score || 0), 0) / total : 0
    const avgRiskReward = total > 0
      ? data.reduce((s, d) => s + (d.risk_reward || 0), 0) / total : 0

    // By symbol breakdown
    const bySymbol: Record<string, { total: number; wins: number; winRate: number }> = {}
    for (const row of data) {
      if (!bySymbol[row.symbol]) bySymbol[row.symbol] = { total: 0, wins: 0, winRate: 0 }
      bySymbol[row.symbol].total++
      if (row.result === 'WIN') bySymbol[row.symbol].wins++
    }
    for (const sym of Object.keys(bySymbol)) {
      const s = bySymbol[sym]
      s.winRate = s.total > 0 ? (s.wins / s.total) * 100 : 0
    }

    return {
      total, wins, losses, pending, winRate,
      profitFactor: Math.round(profitFactor * 1000) / 1000,
      avgConfidence: Math.round(avgConfidence * 10) / 10,
      avgLagScore: Math.round(avgLagScore * 1000) / 1000,
      avgRiskReward: Math.round(avgRiskReward * 100) / 100,
      bySymbol,
    }
  } catch (e) {
    console.error('[CorrLogger] Error fetching stats:', e)
    return null
  }
}
