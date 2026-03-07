// =============================================================================
// Quant Signal Logger — persists every generated signal to Supabase
// =============================================================================

import { getServiceSupabase } from '@/lib/supabase'
import { QuantSignal, LayerResult, MarketRegime } from '@/lib/quant-engine'

export type SignalResult = 'WIN' | 'LOSS' | 'PENDING' | 'EXPIRED'

export interface LoggedSignal {
  id: string
  signal_id: string
  pair: string
  interval: string
  direction: 'BUY' | 'SELL'
  entry: number
  stop_loss: number
  take_profit: number
  probability: number
  strength_label: string
  regime: MarketRegime
  risk_reward: string
  atr: number
  layers: LayerResult[]
  result: SignalResult
  exit_price: number | null
  exit_time: string | null
  created_at: string
}

// ─── Log a new signal ────────────────────────────────────────────────────────

export async function logSignal(signal: QuantSignal, interval: string): Promise<void> {
  try {
    const db = getServiceSupabase()
    await db.from('quant_signals').insert({
      signal_id: signal.id,
      pair: signal.pair,
      interval,
      direction: signal.direction,
      entry: signal.entry,
      stop_loss: signal.stopLoss,
      take_profit: signal.takeProfit,
      probability: signal.probability,
      strength_label: signal.strengthLabel,
      regime: signal.regime,
      risk_reward: signal.riskReward,
      atr: signal.atr,
      layers: signal.layers,
      result: 'PENDING',
      exit_price: null,
      exit_time: null,
    })
  } catch (err) {
    // Log to console only — never throw, logging must not break the main flow
    console.error('[SignalLogger] Failed to log signal:', err)
  }
}

// ─── Verify pending signals against current price ────────────────────────────

export async function verifyPendingSignals(currentPrices: Record<string, number>): Promise<number> {
  try {
    const db = getServiceSupabase()

    // Fetch all PENDING signals
    const { data: pending, error } = await db
      .from('quant_signals')
      .select('*')
      .eq('result', 'PENDING')

    if (error || !pending || pending.length === 0) return 0

    const now = new Date().toISOString()
    let updated = 0

    for (const sig of pending) {
      const price = currentPrices[sig.pair]
      if (!price) continue

      const createdAt = new Date(sig.created_at).getTime()
      const ageMs = Date.now() - createdAt
      const maxAge = 24 * 60 * 60 * 1000 // 24 hours

      let result: SignalResult | null = null
      let exitPrice: number | null = null

      if (sig.direction === 'BUY') {
        if (price <= sig.stop_loss) { result = 'LOSS'; exitPrice = sig.stop_loss }
        else if (price >= sig.take_profit) { result = 'WIN'; exitPrice = sig.take_profit }
      } else {
        if (price >= sig.stop_loss) { result = 'LOSS'; exitPrice = sig.stop_loss }
        else if (price <= sig.take_profit) { result = 'WIN'; exitPrice = sig.take_profit }
      }

      // Expire signals older than 24 hours with no result
      if (!result && ageMs > maxAge) {
        result = 'EXPIRED'
        exitPrice = price
      }

      if (result) {
        await db
          .from('quant_signals')
          .update({ result, exit_price: exitPrice, exit_time: now })
          .eq('id', sig.id)
        updated++
      }
    }

    return updated
  } catch (err) {
    console.error('[SignalLogger] Verification error:', err)
    return 0
  }
}

// ─── Fetch signal performance stats ──────────────────────────────────────────

export async function getSignalStats(pair?: string, days: number = 30): Promise<{
  total: number
  wins: number
  losses: number
  pending: number
  winRate: number
  profitFactor: number
  avgRR: number
} | null> {
  try {
    const db = getServiceSupabase()
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    let query = db
      .from('quant_signals')
      .select('*')
      .gte('created_at', since)

    if (pair) query = query.eq('pair', pair)

    const { data, error } = await query
    if (error || !data) return null

    const wins = data.filter(s => s.result === 'WIN').length
    const losses = data.filter(s => s.result === 'LOSS').length
    const pending = data.filter(s => s.result === 'PENDING').length
    const total = data.length
    const winRate = (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0

    // Profit factor: sum of win pnl / sum of loss pnl (estimated via RR)
    const rrValues = data
      .filter(s => s.risk_reward)
      .map(s => parseFloat(s.risk_reward.replace('1:', '')))
      .filter(v => !isNaN(v))
    const avgRR = rrValues.length > 0 ? rrValues.reduce((a, b) => a + b, 0) / rrValues.length : 0

    const winRR = rrValues.slice(0, wins).reduce((a, b) => a + b, 0)
    const profitFactor = losses > 0 ? winRR / losses : winRR > 0 ? 999 : 0

    return { total, wins, losses, pending, winRate, profitFactor, avgRR }
  } catch (err) {
    console.error('[SignalLogger] Stats error:', err)
    return null
  }
}
