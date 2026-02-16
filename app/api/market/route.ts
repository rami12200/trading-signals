import { NextResponse } from 'next/server'
import { getMultipleTickers, CRYPTO_PAIRS, formatSymbol } from '@/lib/binance'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const tickers = await getMultipleTickers(CRYPTO_PAIRS)

    if (!tickers || tickers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch market data' },
        { status: 502 }
      )
    }

    const prices = tickers.map((t) => ({
      symbol: formatSymbol(t.symbol),
      price: parseFloat(t.lastPrice),
      change: parseFloat(t.priceChangePercent),
      high: parseFloat(t.highPrice),
      low: parseFloat(t.lowPrice),
      volume: parseFloat(t.volume),
    }))

    return NextResponse.json({
      success: true,
      data: {
        prices,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Market API Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
