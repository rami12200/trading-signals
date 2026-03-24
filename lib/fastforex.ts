// ============================================
// FastForex API — Real-time Forex & Metals
// Premium plan: 1M requests/month, 1s updates
// Supports batch requests (fetch-multi)
// ============================================

const FASTFOREX_BASE = 'https://api.fastforex.io'

export interface FastForexPrice {
  symbol: string
  price: number
  timestamp: number
}

/**
 * Fetch a single currency rate.
 * Example: fetchOne('XAU', 'USD') → gold price in USD
 */
export async function fetchOne(from: string, to: string): Promise<FastForexPrice | null> {
  const apiKey = process.env.FASTFOREX_API_KEY
  if (!apiKey) {
    console.error('[FastForex] FASTFOREX_API_KEY not set')
    return null
  }

  try {
    const url = `${FASTFOREX_BASE}/fetch-one?from=${from}&to=${to}&api_key=${apiKey}`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })

    if (!res.ok) {
      console.error(`[FastForex] HTTP ${res.status} for ${from}/${to}`)
      return null
    }

    const data = await res.json()
    if (data.error) {
      console.error(`[FastForex] API error:`, data.error)
      return null
    }

    const price = data.result?.[to]
    if (!price) return null

    return {
      symbol: `${from}/${to}`,
      price: parseFloat(price),
      timestamp: Date.now(),
    }
  } catch (e) {
    console.error(`[FastForex] Error fetching ${from}/${to}:`, e)
    return null
  }
}

/**
 * Fetch multiple currencies in a single request.
 * Example: fetchMulti('USD', ['XAU', 'EUR', 'GBP']) → 1 API call = 3 prices
 */
export async function fetchMulti(
  from: string,
  to: string[]
): Promise<FastForexPrice[]> {
  const apiKey = process.env.FASTFOREX_API_KEY
  if (!apiKey) {
    console.error('[FastForex] FASTFOREX_API_KEY not set')
    return []
  }

  try {
    const toParam = to.join(',')
    const url = `${FASTFOREX_BASE}/fetch-multi?from=${from}&to=${toParam}&api_key=${apiKey}`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })

    if (!res.ok) {
      console.error(`[FastForex] HTTP ${res.status} for multi fetch`)
      return []
    }

    const data = await res.json()
    if (data.error) {
      console.error(`[FastForex] API error:`, data.error)
      return []
    }

    const results: FastForexPrice[] = []
    if (data.results) {
      for (const [currency, rate] of Object.entries(data.results)) {
        results.push({
          symbol: `${from}/${currency}`,
          price: parseFloat(rate as string),
          timestamp: Date.now(),
        })
      }
    }

    return results
  } catch (e) {
    console.error(`[FastForex] Error in multi fetch:`, e)
    return []
  }
}

/**
 * Fetch all available rates from a base currency.
 */
export async function fetchAll(from: string): Promise<FastForexPrice[]> {
  const apiKey = process.env.FASTFOREX_API_KEY
  if (!apiKey) return []

  try {
    const url = `${FASTFOREX_BASE}/fetch-all?from=${from}&api_key=${apiKey}`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })

    if (!res.ok) return []

    const data = await res.json()
    const results: FastForexPrice[] = []

    if (data.results) {
      for (const [currency, rate] of Object.entries(data.results)) {
        results.push({
          symbol: `${from}/${currency}`,
          price: parseFloat(rate as string),
          timestamp: Date.now(),
        })
      }
    }

    return results
  } catch {
    return []
  }
}

/**
 * Check if FastForex API key is configured and working.
 */
export async function checkStatus(): Promise<{ active: boolean; message: string }> {
  const apiKey = process.env.FASTFOREX_API_KEY
  if (!apiKey) {
    return { active: false, message: 'FASTFOREX_API_KEY not configured' }
  }

  try {
    const result = await fetchOne('USD', 'EUR')
    if (result && result.price > 0) {
      return { active: true, message: `API active — EUR/USD: ${result.price}` }
    }
    return { active: false, message: 'API returned no data' }
  } catch {
    return { active: false, message: 'API connection failed' }
  }
}
