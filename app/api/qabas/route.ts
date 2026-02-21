import { NextResponse } from 'next/server'
import { getKlines, SIGNAL_PAIRS, formatSymbol, formatPrice } from '@/lib/binance'
import {
  parseKlines,
  latestEMA,
  latestRSI,
  latestMACD,
  calcATR,
  calcBollingerBands,
  findSupportResistance,
  detectBOS,
  analyzeVolume,
  generateSignalScore,
  calcTradeSetup,
} from '@/lib/indicators'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const interval = new URL(request.url).searchParams.get('interval') || '15m'

  try {
    const signals = await Promise.all(
      SIGNAL_PAIRS.map(async (symbol) => {
        try {
          const rawKlines = await getKlines(symbol, interval, 200)
          if (!rawKlines || rawKlines.length < 50) return null

          const candles = parseKlines(rawKlines)
          const closes = candles.map((c) => c.close)
          const currentPrice = closes[closes.length - 1]

          // Calculate all indicators
          const ema20 = latestEMA(closes, 20)
          const ema50 = latestEMA(closes, 50)
          const ema200 = latestEMA(closes, 200)
          const rsi = latestRSI(closes)
          const macd = latestMACD(closes)
          const atr = calcATR(candles)
          const bb = calcBollingerBands(closes)
          const sr = findSupportResistance(candles)
          const bos = detectBOS(candles)
          const vol = analyzeVolume(candles.map((c) => c.volume))

          // Generate signal
          const score = generateSignalScore(candles, closes)
          const setup = calcTradeSetup(
            score.signal,
            currentPrice,
            atr,
            sr.support,
            sr.resistance
          )

          return {
            id: `${symbol}_${Date.now()}`,
            symbol: formatSymbol(symbol),
            price: currentPrice,
            signal: score.signal,
            reason: score.signal === 'BUY'
              ? 'إشارات شراء'
              : score.signal === 'SELL'
              ? 'إشارات بيع'
              : 'محايد — انتظر',
            reasons: score.reasons,
            buyScore: score.buyScore,
            sellScore: score.sellScore,
            confidence: score.confidence,
            indicators: {
              rsi: rsi !== null ? Math.round(rsi * 10) / 10 : 50,
              rsiStatus:
                rsi !== null
                  ? rsi < 30
                    ? 'ذروة بيع'
                    : rsi > 70
                    ? 'ذروة شراء'
                    : 'محايد'
                  : 'محايد',
              ema20: ema20 ?? 0,
              ema50: ema50 ?? 0,
              ema200: ema200,
              macdLine: macd?.line ?? 0,
              macdSignal: macd?.signal ?? 0,
              macdHistogram: macd?.histogram ?? 0,
              macdTrend:
                macd !== null
                  ? macd.histogram > 0
                    ? 'صاعد'
                    : 'هابط'
                  : 'محايد',
              bbPosition: bb?.position ?? 50,
              atr: atr ?? 0,
            },
            volume: {
              current: Math.round(vol.current),
              average: Math.round(vol.average),
              spike: vol.spike,
            },
            smartMoney: { bos },
            support: sr.support.map((s) => Math.round(s * 100) / 100),
            resistance: sr.resistance.map((r) => Math.round(r * 100) / 100),
            entry: setup.entry,
            stopLoss: Math.round(setup.sl * 100) / 100,
            target1: Math.round(setup.tp1 * 100) / 100,
            target2: Math.round(setup.tp2 * 100) / 100,
            riskReward: setup.riskReward,
            timestamp: new Date().toISOString(),
          }
        } catch {
          return null
        }
      })
    )

    const valid = signals.filter(Boolean)
    const active = valid.filter((s: any) => s.signal !== 'NEUTRAL')

    return NextResponse.json({
      success: true,
      data: {
        signals: valid,
        activeSignals: active,
        total: valid.length,
        active: active.length,
        interval,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error: any) {
    console.error('Qabas API Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
