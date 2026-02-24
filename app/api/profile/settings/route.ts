import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getServiceSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

// Update user profile settings (auto_trade, etc.)
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { user_id, auto_trade, auto_trade_min_confidence, auto_trade_timeframe, auto_trade_lot_size } = body

    if (!user_id) {
      return NextResponse.json({ success: false, error: 'Missing user_id' }, { status: 400 })
    }

    const supabase = getServiceSupabase()

    // Verify user is VIP
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', user_id)
      .single()

    if (!profile || profile.plan !== 'vip') {
      return NextResponse.json(
        { success: false, error: 'Auto-trade is only available for VIP users' },
        { status: 403 }
      )
    }

    // Build update object
    const updates: Record<string, any> = {}
    if (typeof auto_trade === 'boolean') updates.auto_trade = auto_trade
    if (typeof auto_trade_min_confidence === 'number') {
      updates.auto_trade_min_confidence = Math.max(30, Math.min(95, auto_trade_min_confidence))
    }
    if (auto_trade_timeframe === '5m' || auto_trade_timeframe === '15m') {
      updates.auto_trade_timeframe = auto_trade_timeframe
    }
    if (typeof auto_trade_lot_size === 'number' && auto_trade_lot_size > 0) {
      updates.auto_trade_lot_size = Math.max(0.01, Math.min(10, auto_trade_lot_size))
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 })
    }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user_id)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, updated: updates })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
