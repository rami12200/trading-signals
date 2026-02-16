'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

const BINANCE_WS = 'wss://stream.binance.com:9443/ws'

export interface LivePrice {
  symbol: string
  price: number
  timestamp: number
}

export function useBinanceWS(symbols: string[]) {
  const [prices, setPrices] = useState<Record<string, LivePrice>>({})
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connect = useCallback(() => {
    if (symbols.length === 0) return

    // Build combined stream URL
    // Binance mini ticker streams: symbol@miniTicker
    const streams = symbols.map((s) => `${s.toLowerCase()}@miniTicker`).join('/')
    const url = `wss://stream.binance.com:9443/stream?streams=${streams}`

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.data && msg.data.s && msg.data.c) {
            const symbol = msg.data.s as string
            const price = parseFloat(msg.data.c)
            setPrices((prev) => ({
              ...prev,
              [symbol]: {
                symbol,
                price,
                timestamp: Date.now(),
              },
            }))
          }
        } catch {
          // ignore parse errors
        }
      }

      ws.onclose = () => {
        setConnected(false)
        // Reconnect after 3 seconds
        reconnectTimer.current = setTimeout(() => {
          connect()
        }, 3000)
      }

      ws.onerror = () => {
        ws.close()
      }
    } catch {
      // Retry after 5 seconds
      reconnectTimer.current = setTimeout(() => {
        connect()
      }, 5000)
    }
  }, [symbols])

  useEffect(() => {
    connect()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current)
      }
    }
  }, [connect])

  return { prices, connected }
}
