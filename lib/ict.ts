// ============================================
// ICT (Inner Circle Trader) Engine — مؤشر أبو خالد 👑
// Order Blocks, Fair Value Gaps, Liquidity, BOS/CHoCH
// يشتغل مع كريبتو + أسهم
// ============================================

export interface OHLCV {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// ---- Order Block (منطقة مؤسسات) ----
export interface OrderBlock {
  type: 'bullish' | 'bearish'
  top: number
  bottom: number
  time: number
  strength: number      // 1-100 قوة الـ OB
  mitigated: boolean    // هل تم اختراقه؟
  touches: number       // عدد مرات لمس المنطقة
}

// ---- Fair Value Gap (فجوة سعرية) ----
export interface FairValueGap {
  type: 'bullish' | 'bearish'
  top: number
  bottom: number
  time: number
  filled: boolean       // هل تم ملء الفجوة؟
  fillPercent: number   // نسبة الملء 0-100
}

// ---- Liquidity Zone (منطقة سيولة) ----
export interface LiquidityZone {
  type: 'buy_side' | 'sell_side'  // فوق قمة = buy side, تحت قاع = sell side
  level: number
  strength: number     // عدد القمم/القيعان المتساوية
  swept: boolean       // هل تم جمع السيولة؟
  time: number
}

// ---- Break of Structure / Change of Character ----
export interface StructureBreak {
  type: 'BOS' | 'CHoCH'
  direction: 'bullish' | 'bearish'
  level: number
  time: number
}

// ---- الإشارة النهائية ----
export interface ICTSignal {
  action: 'BUY' | 'SELL' | 'WAIT'
  confidence: number
  entry: number
  stopLoss: number
  takeProfit1: number
  takeProfit2: number
  riskReward: number
  reasons: string[]
  orderBlocks: OrderBlock[]
  fvgs: FairValueGap[]
  liquidityZones: LiquidityZone[]
  structureBreaks: StructureBreak[]
  marketStructure: 'BULLISH' | 'BEARISH' | 'RANGING'
  killZone: string | null
}

// ============================================
// كشف Order Blocks — آخر شمعة معاكسة قبل حركة قوية
// ============================================
export function detectOrderBlocks(candles: OHLCV[], lookback: number = 50): OrderBlock[] {
  const obs: OrderBlock[] = []
  if (candles.length < 10) return obs

  const recent = candles.slice(-lookback)
  const avgBody = recent.reduce((s, c) => s + Math.abs(c.close - c.open), 0) / recent.length

  for (let i = 2; i < recent.length - 2; i++) {
    const prev = recent[i - 1]
    const curr = recent[i]
    const next = recent[i + 1]
    const next2 = i + 2 < recent.length ? recent[i + 2] : null

    const currBody = Math.abs(curr.close - curr.open)
    const nextBody = Math.abs(next.close - next.open)

    // Bullish OB: شمعة هابطة ← ثم شمعتين صاعدتين قويتين
    if (curr.close < curr.open && next.close > next.open && nextBody > avgBody * 1.5) {
      const confirmUp = next2 ? next2.close > next2.open : true
      if (confirmUp) {
        const strength = Math.min(100, Math.round((nextBody / avgBody) * 30))
        obs.push({
          type: 'bullish',
          top: Math.max(curr.open, curr.close),
          bottom: Math.min(curr.open, curr.close),
          time: curr.time,
          strength,
          mitigated: false,
          touches: 0,
        })
      }
    }

    // Bearish OB: شمعة صاعدة ← ثم شمعتين هابطتين قويتين
    if (curr.close > curr.open && next.close < next.open && nextBody > avgBody * 1.5) {
      const confirmDown = next2 ? next2.close < next2.open : true
      if (confirmDown) {
        const strength = Math.min(100, Math.round((nextBody / avgBody) * 30))
        obs.push({
          type: 'bearish',
          top: Math.max(curr.open, curr.close),
          bottom: Math.min(curr.open, curr.close),
          time: curr.time,
          strength,
          mitigated: false,
          touches: 0,
        })
      }
    }
  }

  // تحقق هل الـ OB تم اختراقه (mitigated)
  const lastPrice = candles[candles.length - 1].close
  for (const ob of obs) {
    if (ob.type === 'bullish' && lastPrice < ob.bottom) ob.mitigated = true
    if (ob.type === 'bearish' && lastPrice > ob.top) ob.mitigated = true

    // عدد مرات لمس المنطقة
    let touches = 0
    for (const c of candles) {
      if (c.time <= ob.time) continue
      if (c.low <= ob.top && c.high >= ob.bottom) touches++
    }
    ob.touches = touches
    if (touches >= 3) ob.mitigated = true // بعد 3 لمسات يفقد قوته
  }

  // رجّع فقط الـ OBs الغير مخترقة والأقوى
  return obs
    .filter(ob => !ob.mitigated)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 10)
}

// ============================================
// كشف Fair Value Gaps — 3 شموع: الشمعة الوسطى تترك فجوة
// ============================================
export function detectFVGs(candles: OHLCV[], lookback: number = 50): FairValueGap[] {
  const fvgs: FairValueGap[] = []
  if (candles.length < 5) return fvgs

  const recent = candles.slice(-lookback)

  for (let i = 1; i < recent.length - 1; i++) {
    const c1 = recent[i - 1]
    const c2 = recent[i]
    const c3 = recent[i + 1]

    // Bullish FVG: قاع الشمعة الثالثة أعلى من قمة الأولى
    if (c3.low > c1.high) {
      fvgs.push({
        type: 'bullish',
        top: c3.low,
        bottom: c1.high,
        time: c2.time,
        filled: false,
        fillPercent: 0,
      })
    }

    // Bearish FVG: قمة الشمعة الثالثة أقل من قاع الأولى
    if (c3.high < c1.low) {
      fvgs.push({
        type: 'bearish',
        top: c1.low,
        bottom: c3.high,
        time: c2.time,
        filled: false,
        fillPercent: 0,
      })
    }
  }

  // تحقق من نسبة ملء الفجوة
  const lastCandles = candles.slice(-20)
  for (const fvg of fvgs) {
    const gapSize = fvg.top - fvg.bottom
    if (gapSize <= 0) { fvg.filled = true; continue }

    for (const c of lastCandles) {
      if (c.time <= fvg.time) continue
      if (fvg.type === 'bullish') {
        // السعر نزل لمنطقة الفجوة
        if (c.low <= fvg.top) {
          const fillDepth = Math.max(0, fvg.top - c.low)
          fvg.fillPercent = Math.min(100, Math.round((fillDepth / gapSize) * 100))
          if (c.low <= fvg.bottom) fvg.filled = true
        }
      } else {
        // السعر طلع لمنطقة الفجوة
        if (c.high >= fvg.bottom) {
          const fillDepth = Math.max(0, c.high - fvg.bottom)
          fvg.fillPercent = Math.min(100, Math.round((fillDepth / gapSize) * 100))
          if (c.high >= fvg.top) fvg.filled = true
        }
      }
    }
  }

  return fvgs
    .filter(f => !f.filled)
    .sort((a, b) => b.time - a.time)
    .slice(0, 8)
}

// ============================================
// كشف مناطق السيولة — قمم/قيعان متساوية
// ============================================
export function detectLiquidity(candles: OHLCV[], lookback: number = 80): LiquidityZone[] {
  const zones: LiquidityZone[] = []
  if (candles.length < 20) return zones

  const recent = candles.slice(-lookback)
  const tolerance = (recent[recent.length - 1].high - recent[recent.length - 1].low) * 0.002 // 0.2%

  // كشف القمم المتساوية (Equal Highs) = Buy Side Liquidity
  const swingHighs: { level: number; time: number }[] = []
  for (let i = 2; i < recent.length - 2; i++) {
    if (recent[i].high >= recent[i - 1].high &&
        recent[i].high >= recent[i - 2].high &&
        recent[i].high >= recent[i + 1].high &&
        recent[i].high >= recent[i + 2].high) {
      swingHighs.push({ level: recent[i].high, time: recent[i].time })
    }
  }

  // تجميع القمم المتقاربة
  const groupedHighs: { level: number; count: number; time: number }[] = []
  for (const sh of swingHighs) {
    const existing = groupedHighs.find(g => Math.abs(g.level - sh.level) <= tolerance * 20)
    if (existing) {
      existing.count++
      existing.level = (existing.level + sh.level) / 2
    } else {
      groupedHighs.push({ level: sh.level, count: 1, time: sh.time })
    }
  }

  for (const gh of groupedHighs) {
    if (gh.count >= 2) {
      const lastPrice = candles[candles.length - 1].close
      zones.push({
        type: 'buy_side',
        level: gh.level,
        strength: gh.count,
        swept: lastPrice > gh.level,
        time: gh.time,
      })
    }
  }

  // كشف القيعان المتساوية (Equal Lows) = Sell Side Liquidity
  const swingLows: { level: number; time: number }[] = []
  for (let i = 2; i < recent.length - 2; i++) {
    if (recent[i].low <= recent[i - 1].low &&
        recent[i].low <= recent[i - 2].low &&
        recent[i].low <= recent[i + 1].low &&
        recent[i].low <= recent[i + 2].low) {
      swingLows.push({ level: recent[i].low, time: recent[i].time })
    }
  }

  const groupedLows: { level: number; count: number; time: number }[] = []
  for (const sl of swingLows) {
    const existing = groupedLows.find(g => Math.abs(g.level - sl.level) <= tolerance * 20)
    if (existing) {
      existing.count++
      existing.level = (existing.level + sl.level) / 2
    } else {
      groupedLows.push({ level: sl.level, count: 1, time: sl.time })
    }
  }

  for (const gl of groupedLows) {
    if (gl.count >= 2) {
      const lastPrice = candles[candles.length - 1].close
      zones.push({
        type: 'sell_side',
        level: gl.level,
        strength: gl.count,
        swept: lastPrice < gl.level,
        time: gl.time,
      })
    }
  }

  return zones.filter(z => !z.swept).sort((a, b) => b.strength - a.strength).slice(0, 8)
}

// ============================================
// كشف BOS / CHoCH — كسر الهيكل وتغيّر الطابع
// ============================================
export function detectStructure(candles: OHLCV[], lookback: number = 60): {
  breaks: StructureBreak[]
  trend: 'BULLISH' | 'BEARISH' | 'RANGING'
} {
  const breaks: StructureBreak[] = []
  if (candles.length < 15) return { breaks, trend: 'RANGING' }

  const recent = candles.slice(-lookback)

  // تحديد Swing Highs و Swing Lows
  const swings: { type: 'HH' | 'HL' | 'LH' | 'LL'; level: number; time: number; idx: number }[] = []

  let lastSwingHigh = -Infinity
  let lastSwingLow = Infinity

  for (let i = 3; i < recent.length - 3; i++) {
    const isSwingHigh = recent[i].high >= recent[i - 1].high &&
                        recent[i].high >= recent[i - 2].high &&
                        recent[i].high >= recent[i + 1].high &&
                        recent[i].high >= recent[i + 2].high

    const isSwingLow = recent[i].low <= recent[i - 1].low &&
                       recent[i].low <= recent[i - 2].low &&
                       recent[i].low <= recent[i + 1].low &&
                       recent[i].low <= recent[i + 2].low

    if (isSwingHigh) {
      const type = recent[i].high > lastSwingHigh ? 'HH' : 'LH'
      swings.push({ type, level: recent[i].high, time: recent[i].time, idx: i })
      lastSwingHigh = recent[i].high
    }

    if (isSwingLow) {
      const type = recent[i].low < lastSwingLow ? 'LL' : 'HL'
      swings.push({ type, level: recent[i].low, time: recent[i].time, idx: i })
      lastSwingLow = recent[i].low
    }
  }

  // كشف BOS و CHoCH
  let prevTrend: 'up' | 'down' | null = null
  for (let i = 1; i < swings.length; i++) {
    const curr = swings[i]
    const prev = swings[i - 1]

    // BOS صاعد: HH بعد HL
    if (curr.type === 'HH' && prev.type === 'HL') {
      if (prevTrend === 'up') {
        breaks.push({ type: 'BOS', direction: 'bullish', level: curr.level, time: curr.time })
      } else {
        breaks.push({ type: 'CHoCH', direction: 'bullish', level: curr.level, time: curr.time })
      }
      prevTrend = 'up'
    }

    // BOS هابط: LL بعد LH
    if (curr.type === 'LL' && prev.type === 'LH') {
      if (prevTrend === 'down') {
        breaks.push({ type: 'BOS', direction: 'bearish', level: curr.level, time: curr.time })
      } else {
        breaks.push({ type: 'CHoCH', direction: 'bearish', level: curr.level, time: curr.time })
      }
      prevTrend = 'down'
    }
  }

  // تحديد الاتجاه العام
  const recentSwings = swings.slice(-6)
  const hhCount = recentSwings.filter(s => s.type === 'HH' || s.type === 'HL').length
  const llCount = recentSwings.filter(s => s.type === 'LL' || s.type === 'LH').length

  let trend: 'BULLISH' | 'BEARISH' | 'RANGING' = 'RANGING'
  if (hhCount >= 4) trend = 'BULLISH'
  else if (llCount >= 4) trend = 'BEARISH'

  return { breaks: breaks.slice(-5), trend }
}

// ============================================
// Kill Zones — أوقات التداول المثالية
// ============================================
export function getKillZone(nowUTC?: Date): string | null {
  const now = nowUTC || new Date()
  const hour = now.getUTCHours()
  const minute = now.getUTCMinutes()
  const totalMin = hour * 60 + minute

  // Asian Kill Zone: 00:00 - 04:00 UTC
  if (totalMin >= 0 && totalMin < 240) return 'آسيا 🌏'
  // London Kill Zone: 07:00 - 10:00 UTC
  if (totalMin >= 420 && totalMin < 600) return 'لندن 🇬🇧'
  // NY Kill Zone: 13:00 - 16:00 UTC
  if (totalMin >= 780 && totalMin < 960) return 'نيويورك 🇺🇸'
  // London Close: 15:00 - 16:00 UTC
  if (totalMin >= 900 && totalMin < 960) return 'إغلاق لندن 🔔'

  return null
}

// ============================================
// التحليل الرئيسي — يجمع كل شي ويعطي إشارة
// ============================================
export function analyzeICT(
  candles: OHLCV[],
  htfCandles: OHLCV[] | null = null
): ICTSignal {
  const defaultSignal: ICTSignal = {
    action: 'WAIT',
    confidence: 0,
    entry: 0,
    stopLoss: 0,
    takeProfit1: 0,
    takeProfit2: 0,
    riskReward: 0,
    reasons: [],
    orderBlocks: [],
    fvgs: [],
    liquidityZones: [],
    structureBreaks: [],
    marketStructure: 'RANGING',
    killZone: null,
  }

  if (candles.length < 30) return defaultSignal

  // 1. كشف المكونات
  const orderBlocks = detectOrderBlocks(candles)
  const fvgs = detectFVGs(candles)
  const liquidityZones = detectLiquidity(candles)
  const { breaks: structureBreaks, trend } = detectStructure(candles)
  const killZone = getKillZone()

  // HTF Structure (الفريم الأعلى)
  let htfTrend: 'BULLISH' | 'BEARISH' | 'RANGING' = 'RANGING'
  if (htfCandles && htfCandles.length >= 30) {
    htfTrend = detectStructure(htfCandles).trend
  }

  const lastCandle = candles[candles.length - 1]
  const price = lastCandle.close

  // ATR لحساب المسافات
  let atrSum = 0
  const atrLen = Math.min(14, candles.length - 1)
  for (let i = candles.length - atrLen; i < candles.length; i++) {
    atrSum += candles[i].high - candles[i].low
  }
  const atr = atrSum / atrLen

  let action: 'BUY' | 'SELL' | 'WAIT' = 'WAIT'
  let confidence = 0
  const reasons: string[] = []

  // ===== تحليل الشراء =====
  let buyScore = 0

  // السعر عند Bullish Order Block
  const nearBullOB = orderBlocks.find(ob =>
    ob.type === 'bullish' && price >= ob.bottom - atr * 0.3 && price <= ob.top + atr * 0.3
  )
  if (nearBullOB) {
    buyScore += 25
    reasons.push(`📦 عند Order Block شرائي (${nearBullOB.strength}%)`)
  }

  // السعر عند Bullish FVG غير مملوء
  const nearBullFVG = fvgs.find(f =>
    f.type === 'bullish' && price >= f.bottom - atr * 0.2 && price <= f.top + atr * 0.2
  )
  if (nearBullFVG) {
    buyScore += 20
    reasons.push(`📊 عند Fair Value Gap صاعد (ملء ${nearBullFVG.fillPercent}%)`)
  }

  // BOS/CHoCH صاعد حديث
  const recentBullBreak = structureBreaks.find(b =>
    b.direction === 'bullish' && b.time >= candles[candles.length - 10]?.time
  )
  if (recentBullBreak) {
    buyScore += recentBullBreak.type === 'CHoCH' ? 20 : 15
    reasons.push(`🔄 ${recentBullBreak.type} صاعد — تأكيد الاتجاه`)
  }

  // الاتجاه العام صاعد
  if (trend === 'BULLISH') {
    buyScore += 15
    reasons.push('📈 هيكل السوق صاعد')
  }

  // HTF صاعد
  if (htfTrend === 'BULLISH') {
    buyScore += 10
    reasons.push('📈 الفريم الأعلى صاعد')
  }

  // سيولة تحت السعر تم جمعها (Sell Side Swept)
  const sweptSellLiq = liquidityZones.find(z =>
    z.type === 'sell_side' && z.swept && Math.abs(z.level - price) < atr * 2
  )
  if (sweptSellLiq) {
    buyScore += 15
    reasons.push('💧 تم جمع سيولة البيع — انعكاس محتمل')
  }

  // Kill Zone
  if (killZone) {
    buyScore += 5
    reasons.push(`⏰ ${killZone}`)
  }

  // ===== تحليل البيع =====
  let sellScore = 0
  const sellReasons: string[] = []

  const nearBearOB = orderBlocks.find(ob =>
    ob.type === 'bearish' && price >= ob.bottom - atr * 0.3 && price <= ob.top + atr * 0.3
  )
  if (nearBearOB) {
    sellScore += 25
    sellReasons.push(`📦 عند Order Block بيعي (${nearBearOB.strength}%)`)
  }

  const nearBearFVG = fvgs.find(f =>
    f.type === 'bearish' && price >= f.bottom - atr * 0.2 && price <= f.top + atr * 0.2
  )
  if (nearBearFVG) {
    sellScore += 20
    sellReasons.push(`📊 عند Fair Value Gap هابط (ملء ${nearBearFVG.fillPercent}%)`)
  }

  const recentBearBreak = structureBreaks.find(b =>
    b.direction === 'bearish' && b.time >= candles[candles.length - 10]?.time
  )
  if (recentBearBreak) {
    sellScore += recentBearBreak.type === 'CHoCH' ? 20 : 15
    sellReasons.push(`🔄 ${recentBearBreak.type} هابط — تأكيد الانعكاس`)
  }

  if (trend === 'BEARISH') {
    sellScore += 15
    sellReasons.push('📉 هيكل السوق هابط')
  }

  if (htfTrend === 'BEARISH') {
    sellScore += 10
    sellReasons.push('📉 الفريم الأعلى هابط')
  }

  const sweptBuyLiq = liquidityZones.find(z =>
    z.type === 'buy_side' && z.swept && Math.abs(z.level - price) < atr * 2
  )
  if (sweptBuyLiq) {
    sellScore += 15
    sellReasons.push('💧 تم جمع سيولة الشراء — انعكاس محتمل')
  }

  if (killZone) {
    sellScore += 5
    sellReasons.push(`⏰ ${killZone}`)
  }

  // ===== تحديد الإشارة النهائية =====
  let entry = price
  let stopLoss = 0
  let takeProfit1 = 0
  let takeProfit2 = 0

  if (buyScore > sellScore && buyScore >= 40) {
    action = 'BUY'
    confidence = Math.min(95, buyScore)

    // الستوب تحت الـ Order Block أو تحت آخر قاع
    if (nearBullOB) {
      stopLoss = nearBullOB.bottom - atr * 0.5
    } else {
      stopLoss = price - atr * 1.5
    }

    const risk = price - stopLoss
    takeProfit1 = price + risk * 2   // 1:2 RR
    takeProfit2 = price + risk * 3   // 1:3 RR

    // لو فيه سيولة فوق، الهدف يكون عندها
    const buySideLiq = liquidityZones.find(z => z.type === 'buy_side' && z.level > price)
    if (buySideLiq && buySideLiq.level < takeProfit2) {
      takeProfit1 = buySideLiq.level
    }

  } else if (sellScore > buyScore && sellScore >= 40) {
    action = 'SELL'
    confidence = Math.min(95, sellScore)
    reasons.length = 0
    reasons.push(...sellReasons)

    if (nearBearOB) {
      stopLoss = nearBearOB.top + atr * 0.5
    } else {
      stopLoss = price + atr * 1.5
    }

    const risk = stopLoss - price
    takeProfit1 = price - risk * 2
    takeProfit2 = price - risk * 3

    const sellSideLiq = liquidityZones.find(z => z.type === 'sell_side' && z.level < price)
    if (sellSideLiq && sellSideLiq.level > takeProfit2) {
      takeProfit1 = sellSideLiq.level
    }

  } else {
    confidence = Math.max(buyScore, sellScore)
    reasons.push('⏸️ لا توجد فرصة واضحة — انتظر')
  }

  const riskReward = stopLoss !== 0 && action !== 'WAIT'
    ? Math.abs((takeProfit1 - price) / (price - stopLoss))
    : 0

  return {
    action,
    confidence,
    entry,
    stopLoss,
    takeProfit1,
    takeProfit2,
    riskReward: Math.round(riskReward * 10) / 10,
    reasons,
    orderBlocks,
    fvgs,
    liquidityZones,
    structureBreaks,
    marketStructure: trend,
    killZone,
  }
}
