// ============================================
// Trade Execution Queue API
// POST: User clicks "Execute Trade" → saves order
// GET: EA polls for pending orders → executes them
// ============================================

import { NextResponse } from 'next/server'

const EA_API_KEY = process.env.EA_API_KEY || 'ts_ea_test_key_2026_rami12200'

// === In-memory order queue (will move to Supabase later) ===
interface TradeOrder {
  id: string
  symbol: string       // BTCUSDT (Binance format)
  mt5Symbol: string    // BTCUSD (MT5 format)
  action: 'BUY' | 'SELL'
  entry: number
  stopLoss: number
  takeProfit: number
  status: 'PENDING' | 'EXECUTED' | 'FAILED'
  createdAt: string
  executedAt?: string
}

// Global order queue
const orderQueue: TradeOrder[] = []

function validateApiKey(request: Request): boolean {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7) === EA_API_KEY
  }
  const url = new URL(request.url)
  const keyParam = url.searchParams.get('key')
  return keyParam === EA_API_KEY
}

// === POST /api/signals/execute — User sends trade order ===
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { symbol, action, entry, stopLoss, takeProfit } = body

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

    // Convert Binance symbol to MT5 format
    const mt5Symbol = symbol.replace('USDT', 'USD')

    const order: TradeOrder = {
      id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
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

    // Keep only last 50 orders
    if (orderQueue.length > 50) {
      orderQueue.splice(0, orderQueue.length - 50)
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
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    )
  }
}

// === GET /api/signals/execute — EA polls for pending orders ===
export async function GET(request: Request) {
  if (!validateApiKey(request)) {
    return NextResponse.json(
      { success: false, error: 'Invalid API key' },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(request.url)
  const markExecuted = searchParams.get('executed') // order ID to mark as executed

  // Mark order as executed if ID provided
  if (markExecuted) {
    const order = orderQueue.find((o) => o.id === markExecuted)
    if (order) {
      order.status = 'EXECUTED'
      order.executedAt = new Date().toISOString()
      return NextResponse.json({ success: true, message: 'Order marked as executed' })
    }
    return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
  }

  // Return pending orders
  const pendingOrders = orderQueue.filter((o) => o.status === 'PENDING')

  return NextResponse.json({
    success: true,
    count: pendingOrders.length,
    orders: pendingOrders,
    timestamp: new Date().toISOString(),
  })
}
