// ============================================
// Trade Execution Queue API
// POST: User clicks "Execute Trade" → saves order (per-user)
// GET: EA polls for pending orders → executes them (per-user)
// ============================================

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// === Per-user order queue ===
interface TradeOrder {
  id: string
  api_key: string
  symbol: string
  mt5Symbol: string
  action: 'BUY' | 'SELL'
  entry: number
  stopLoss: number
  takeProfit: number
  status: 'PENDING' | 'EXECUTED' | 'FAILED'
  createdAt: string
  executedAt?: string
}

const orderQueue: TradeOrder[] = []
const ORDER_EXPIRY_MS = 30_000

function cleanExpiredOrders() {
  const now = Date.now()
  for (let i = orderQueue.length - 1; i >= 0; i--) {
    const orderAge = now - new Date(orderQueue[i].createdAt).getTime()
    if (orderQueue[i].status === 'PENDING' && orderAge > ORDER_EXPIRY_MS) {
      orderQueue[i].status = 'FAILED'
    }
    if (orderQueue[i].status !== 'PENDING' && orderAge > 300_000) {
      orderQueue.splice(i, 1)
    }
  }
}

function extractApiKey(request: Request): string | null {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }
  const url = new URL(request.url)
  return url.searchParams.get('key')
}

async function validateApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey) return false
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, plan')
    .eq('api_key', apiKey)
    .eq('plan', 'vip')
    .single()
  return !!data
}

// === POST /api/signals/execute — User sends trade order ===
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { symbol, action, entry, stopLoss, takeProfit, api_key } = body

    if (!api_key) {
      return NextResponse.json(
        { success: false, error: 'API key is required' },
        { status: 401 }
      )
    }

    if (!(await validateApiKey(api_key))) {
      return NextResponse.json(
        { success: false, error: 'Invalid API key or not VIP' },
        { status: 401 }
      )
    }

    if (!symbol || !action || !entry) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: symbol, action, entry' },
        { status: 400 }
      )
    }

    if (action !== 'BUY' && action !== 'SELL') {
      return NextResponse.json(
        { success: false, error: 'Action must be BUY or SELL' },
        { status: 400 }
      )
    }

    const mt5Symbol = symbol.replace('USDT', 'USD')

    const order: TradeOrder = {
      id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      api_key,
      symbol,
      mt5Symbol,
      action,
      entry: parseFloat(entry),
      stopLoss: parseFloat(stopLoss) || 0,
      takeProfit: parseFloat(takeProfit) || 0,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    }

    orderQueue.push(order)

    // Keep only last 50 orders per user
    const userOrders = orderQueue.filter((o) => o.api_key === api_key)
    if (userOrders.length > 50) {
      const oldest = userOrders[0]
      const idx = orderQueue.indexOf(oldest)
      if (idx !== -1) orderQueue.splice(idx, 1)
    }

    return NextResponse.json({
      success: true,
      message: 'Trade order queued successfully',
      order: {
        id: order.id,
        symbol: order.symbol,
        mt5Symbol: order.mt5Symbol,
        action: order.action,
        entry: order.entry,
        stopLoss: order.stopLoss,
        takeProfit: order.takeProfit,
        status: order.status,
      },
    })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    )
  }
}

// === GET /api/signals/execute — EA polls for pending orders ===
export async function GET(request: Request) {
  const apiKey = extractApiKey(request)
  if (!apiKey || !(await validateApiKey(apiKey))) {
    return NextResponse.json(
      { success: false, error: 'Invalid API key' },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(request.url)
  const markExecuted = searchParams.get('executed')

  // Mark order as executed (only if it belongs to this user)
  if (markExecuted) {
    const order = orderQueue.find((o) => o.id === markExecuted && o.api_key === apiKey)
    if (order) {
      order.status = 'EXECUTED'
      order.executedAt = new Date().toISOString()
      return NextResponse.json({ success: true, message: 'Order marked as executed' })
    }
    return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
  }

  cleanExpiredOrders()

  // Return only THIS user's pending orders
  const pendingOrders = orderQueue.filter((o) => o.status === 'PENDING' && o.api_key === apiKey)

  return NextResponse.json({
    success: true,
    count: pendingOrders.length,
    orders: pendingOrders.map(({ api_key: _key, ...rest }) => rest),
    timestamp: new Date().toISOString(),
  })
}
