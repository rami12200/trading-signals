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
  const admin = await isAdmin(request)
  if (!admin) {
    // Public: return active plans only
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ plans: data })
  }

  // Admin: return all plans
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .order('sort_order')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ plans: data })
}

export async function POST(request: Request) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { data, error } = await supabase
    .from('plans')
    .insert({
      name: body.name,
      slug: body.slug,
      price: body.price,
      currency: body.currency || 'USD',
      interval: body.interval || 'month',
      paddle_price_id: body.paddle_price_id || null,
      features: body.features || [],
      is_active: body.is_active ?? true,
      sort_order: body.sort_order || 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ plan: data })
}

export async function PUT(request: Request) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  if (!body.id) return NextResponse.json({ error: 'Plan ID required' }, { status: 400 })

  const { data, error } = await supabase
    .from('plans')
    .update({
      name: body.name,
      price: body.price,
      currency: body.currency,
      interval: body.interval,
      paddle_price_id: body.paddle_price_id,
      features: body.features,
      is_active: body.is_active,
      sort_order: body.sort_order,
      updated_at: new Date().toISOString(),
    })
    .eq('id', body.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ plan: data })
}

export async function DELETE(request: Request) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Plan ID required' }, { status: 400 })

  const { error } = await supabase.from('plans').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
