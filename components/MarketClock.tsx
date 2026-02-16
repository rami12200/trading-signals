'use client'

import { useState, useEffect } from 'react'
import { MarketSession } from '@/lib/types'

const sessions: MarketSession[] = [
  { name: 'Sydney', region: 'أوقيانوسيا', city: 'سيدني', opens: 22, closes: 7 },
  { name: 'Tokyo', region: 'آسيا', city: 'طوكيو', opens: 0, closes: 9 },
  { name: 'London', region: 'أوروبا', city: 'لندن', opens: 8, closes: 17 },
  { name: 'New York', region: 'أمريكا', city: 'نيويورك', opens: 14, closes: 23 },
]

function isSessionOpen(session: MarketSession, hour: number): boolean {
  if (session.opens < session.closes) {
    return hour >= session.opens && hour < session.closes
  }
  return hour >= session.opens || hour < session.closes
}

export function MarketClock() {
  const [mounted, setMounted] = useState(false)
  const [time, setTime] = useState({ hours: 12, minutes: 0 })

  useEffect(() => {
    setMounted(true)
    const update = () => {
      const now = new Date()
      setTime({ hours: now.getUTCHours(), minutes: now.getUTCMinutes() })
    }
    update()
    const interval = setInterval(update, 30000)
    return () => clearInterval(interval)
  }, [])

  const openCount = sessions.filter((s) => isSessionOpen(s, time.hours)).length

  return (
    <div className="card-glow bg-gradient-to-br from-surface/90 to-background border-accent/10">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        {/* UTC Clock */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-accent/20 rounded-2xl blur-xl" />
            <div className="relative text-5xl font-bold text-accent font-mono tracking-wider px-4 py-2">
              {mounted
                ? `${String(time.hours).padStart(2, '0')}:${String(time.minutes).padStart(2, '0')}`
                : '12:00'}
            </div>
          </div>
          <div className="text-neutral-400">
            <div className="font-semibold text-white/80">UTC</div>
            <div className="text-sm">التوقيت العالمي</div>
          </div>
        </div>

        {/* Sessions */}
        <div className="flex gap-3 flex-wrap justify-center">
          {sessions.map((session) => {
            const isOpen = isSessionOpen(session, time.hours)
            return (
              <div
                key={session.name}
                className={`px-4 py-3 rounded-xl border transition-all duration-300 ${
                  isOpen
                    ? 'bg-bullish/10 border-bullish/30 shadow-lg shadow-bullish/5'
                    : 'bg-white/[0.02] border-white/[0.06] opacity-60'
                }`}
              >
                <div className="font-semibold text-sm">{session.city}</div>
                <div className="text-xs text-neutral-400">{session.region}</div>
                <div className="text-xs mt-1 font-medium">
                  {isOpen ? (
                    <span className="text-bullish">● مفتوح</span>
                  ) : (
                    <span className="text-neutral">○ مغلق</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Crypto + Stats */}
        <div className="flex flex-col items-center gap-2">
          <div className="px-4 py-3 rounded-xl bg-accent/10 border border-accent/20">
            <div className="font-semibold text-accent text-sm">Crypto</div>
            <div className="text-xs text-accent/70">24/7 مفتوح</div>
          </div>
          <div className="text-xs text-neutral-500">
            {openCount} أسواق مفتوحة
          </div>
        </div>
      </div>
    </div>
  )
}
