import { NextResponse } from 'next/server'
import { getSignalStats } from '@/lib/signal-logger'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const pair = searchParams.get('pair') || undefined
    const days = parseInt(searchParams.get('days') || '30', 10)

    const stats = await getSignalStats(pair, days)
    if (!stats) {
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: stats })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
