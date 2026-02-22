// ============================================
// Trade Execution Queue API
// POST: User clicks "Execute Trade" → saves order to Supabase
// GET: EA polls for pending orders → executes them
// ============================================

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create Supabase Admin Client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const EA_API_KEY = process.env.EA_API_KEY || 'ts_ea_test_key_2026_rami12200'

// === Fallback In-memory Queue (if DB fails) ===
interface TradeOrder {
  id: string
  symbol: string
  mt5Symbol: string
  action: 'BUY' | 'SELL'
  entry: number
  stopLoss: number
  takeProfit: number
  status: 'PENDING' | 'EXECUTED' | 'FAILED'
  createdAt: string
  executedAt?: string
  executedUsers?: Set<string> // Track per-user execution in memory
}
const fallbackQueue: TradeOrder[] = []

function extractApiKey(request: Request): string | null {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }
  const url = new URL(request.url)
  return url.searchParams.get('key')
}

// === POST /api/signals/execute ===
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { symbol, action, entry, stopLoss, takeProfit } = body

    if (!symbol || !action || !entry) {
      return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 })
    }

    const mt5Symbol = symbol.replace('USDT', 'USD')

    // Try saving to Supabase
    const { data, error } = await supabaseAdmin
      .from('trade_signals')
      .insert({
        symbol,
        mt5_symbol: mt5Symbol,
        action,
        entry: parseFloat(entry),
        stop_loss: parseFloat(stopLoss) || 0,
        take_profit: parseFloat(takeProfit) || 0,
        status: 'PENDING'
      })
      .select()
      .single()

    if (error) {
      console.error('Supabase Error:', error)
      // Fallback to memory
      const order: TradeOrder = {
        id: `mem_${Date.now()}`,
        symbol,
        mt5Symbol,
        action,
        entry: parseFloat(entry),
        stopLoss: parseFloat(stopLoss) || 0,
        takeProfit: parseFloat(takeProfit) || 0,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        executedUsers: new Set()
      }
      fallbackQueue.push(order)
      return NextResponse.json({ success: true, message: 'Queued (Memory)', order })
    }

    return NextResponse.json({ success: true, message: 'Queued (DB)', order: data })

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// === GET /api/signals/execute ===
export async function GET(request: Request) {
  const url = new URL(request.url)
  const apiKey = extractApiKey(request)
  
  // Basic validation
  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'Missing API Key' }, { status: 401 })
  }

  // 1. Identify User
  let userId: string | null = null
  if (apiKey === EA_API_KEY) {
    userId = 'MASTER_EA'
  } else {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('api_key', apiKey)
      .single()
    
    if (data) userId = data.id
  }

  if (!userId) {
    return NextResponse.json({ success: false, error: 'Invalid API Key' }, { status: 401 })
  }

  const markExecuted = url.searchParams.get('executed')

  // Mark as executed
  if (markExecuted) {
    if (userId === 'MASTER_EA') {
      // Legacy: Update global status
      await supabaseAdmin
        .from('trade_signals')
        .update({ status: 'EXECUTED', executed_at: new Date().toISOString() })
        .eq('id', markExecuted)
      
      // Memory
      const memOrder = fallbackQueue.find(o => o.id === markExecuted)
      if (memOrder) {
        memOrder.status = 'EXECUTED'
        memOrder.executedAt = new Date().toISOString()
      }
    } else {
      // User-specific execution
      // Try to insert execution record
      const { error } = await supabaseAdmin
        .from('user_signal_executions')
        .insert({
          user_id: userId,
          signal_id: markExecuted
        })
      
      if (error) {
        // Fallback to memory tracking if DB fails or table missing
        // Note: If table is missing, this will fail silently here but memory queue will work for memory orders
        const memOrder = fallbackQueue.find(o => o.id === markExecuted)
        if (memOrder) {
          if (!memOrder.executedUsers) memOrder.executedUsers = new Set()
          memOrder.executedUsers.add(userId)
        }
      }
    }
    
    return NextResponse.json({ success: true })
  }

  // Fetch Pending
  // 1. From DB
  const { data: dbOrders } = await supabaseAdmin
    .from('trade_signals')
    .select('*')
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false })
    .limit(20)

  // 2. Filter executed for THIS user
  let validDbOrders = dbOrders || []
  if (userId !== 'MASTER_EA' && validDbOrders.length > 0) {
    // Fetch executions for this user
    const signalIds = validDbOrders.map((o: any) => o.id)
    const { data: executions } = await supabaseAdmin
      .from('user_signal_executions')
      .select('signal_id')
      .eq('user_id', userId)
      .in('signal_id', signalIds)
    
    const executedIds = new Set(executions?.map((e: any) => e.signal_id) || [])
    validDbOrders = validDbOrders.filter((o: any) => !executedIds.has(o.id))
  }

  // 3. From Memory
  const memOrders = fallbackQueue.filter(o => {
    if (o.status !== 'PENDING') return false
    if (userId === 'MASTER_EA') return true
    return !o.executedUsers?.has(userId!)
  })

  // Combine (Map DB fields to API format)
  const orders = [
    ...validDbOrders.map((o: any) => ({
      id: o.id,
      symbol: o.symbol,
      mt5Symbol: o.mt5_symbol,
      action: o.action,
      entry: o.entry,
      stopLoss: o.stop_loss,
      takeProfit: o.take_profit,
      status: o.status,
      createdAt: o.created_at
    })),
    ...memOrders
  ]

  return NextResponse.json({
    success: true,
    count: orders.length,
    orders,
    timestamp: new Date().toISOString()
  })
}
