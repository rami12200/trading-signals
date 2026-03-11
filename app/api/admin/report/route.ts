import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function isAdmin(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return false
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return false
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  return profile?.is_admin === true
}

export async function GET(request: Request) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const pair = searchParams.get('pair') || undefined
  const days = parseInt(searchParams.get('days') || '30', 10)

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  let query = supabase
    .from('quant_signals')
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  if (pair) query = query.eq('pair', pair)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'No data' }, { status: 500 })

  const wins = data.filter(s => s.result === 'WIN')
  const losses = data.filter(s => s.result === 'LOSS')
  const pending = data.filter(s => s.result === 'PENDING')
  const expired = data.filter(s => s.result === 'EXPIRED')

  const winRate = (wins.length + losses.length) > 0
    ? (wins.length / (wins.length + losses.length)) * 100
    : 0

  const rrValues = data
    .filter(s => s.risk_reward)
    .map(s => parseFloat(s.risk_reward.replace('1:', '')))
    .filter(v => !isNaN(v))
  const avgRR = rrValues.length > 0
    ? rrValues.reduce((a: number, b: number) => a + b, 0) / rrValues.length
    : 0

  // Profit factor from actual PnL
  const winPnl = wins.reduce((sum: number, s: any) => {
    if (s.exit_price == null) return sum
    const pnl = s.direction === 'BUY'
      ? (s.exit_price - s.entry) / s.entry * 100
      : (s.entry - s.exit_price) / s.entry * 100
    return sum + Math.max(0, pnl)
  }, 0)
  const lossPnl = losses.reduce((sum: number, s: any) => {
    if (s.exit_price == null) return sum
    const pnl = s.direction === 'BUY'
      ? (s.entry - s.exit_price) / s.entry * 100
      : (s.exit_price - s.entry) / s.entry * 100
    return sum + Math.max(0, pnl)
  }, 0)
  const profitFactor = lossPnl > 0 ? winPnl / lossPnl : winPnl > 0 ? 999 : 0

  // Max consecutive losses
  let maxConsecLosses = 0, currentStreak = 0
  for (const s of [...data].reverse()) {
    if (s.result === 'LOSS') { currentStreak++; maxConsecLosses = Math.max(maxConsecLosses, currentStreak) }
    else if (s.result === 'WIN') currentStreak = 0
  }

  // Average probability of signals
  const avgProbability = data.length > 0
    ? data.reduce((sum: number, s: any) => sum + (s.probability || 0), 0) / data.length
    : 0

  return NextResponse.json({
    success: true,
    summary: {
      total: data.length,
      wins: wins.length,
      losses: losses.length,
      pending: pending.length,
      expired: expired.length,
      winRate: Math.round(winRate * 100) / 100,
      profitFactor: Math.round(profitFactor * 1000) / 1000,
      avgRR: Math.round(avgRR * 100) / 100,
      maxConsecLosses,
      avgProbability: Math.round(avgProbability),
      days,
      pair: pair || 'ALL',
    },
    signals: data.map((s: any) => ({
      id: s.id,
      signal_id: s.signal_id,
      pair: s.pair,
      interval: s.interval,
      direction: s.direction,
      entry: s.entry,
      stop_loss: s.stop_loss,
      take_profit: s.take_profit,
      probability: s.probability,
      strength_label: s.strength_label,
      regime: s.regime,
      risk_reward: s.risk_reward,
      result: s.result,
      exit_price: s.exit_price,
      exit_time: s.exit_time,
      created_at: s.created_at,
      layers: s.layers,
    })),
  })
}
