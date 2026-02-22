'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'

const TRADES_KEY = 'quickscalp_my_trades'
const HISTORY_KEY = 'quickscalp_trade_history'

interface ClosedTrade {
  id: string
  displaySymbol: string
  direction: 'BUY' | 'SELL'
  pnlPct: number
  result: 'WIN' | 'LOSS'
  closedAt: string
}

function getTradeHistory(): ClosedTrade[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function getActiveTradesCount(): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = localStorage.getItem(TRADES_KEY)
    return raw ? JSON.parse(raw).length : 0
  } catch { return 0 }
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, loading: authLoading, signOut } = useAuth()
  const [history, setHistory] = useState<ClosedTrade[]>([])
  const [activeTrades, setActiveTrades] = useState(0)
  const [showApiKey, setShowApiKey] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
      return
    }
    setHistory(getTradeHistory())
    setActiveTrades(getActiveTradesCount())
  }, [user, authLoading, router])

  const logout = async () => {
    await signOut()
    router.push('/')
  }

  if (authLoading || !user) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-16">
        <div className="card animate-pulse h-64" />
      </main>
    )
  }

  const wins = history.filter((t) => t.result === 'WIN').length
  const losses = history.filter((t) => t.result === 'LOSS').length
  const winRate = history.length > 0 ? (wins / history.length) * 100 : 0
  const totalPnl = history.reduce((sum, t) => sum + t.pnlPct, 0)
  const memberSince = new Date(user.created_at).toLocaleDateString('ar-EG', {
    year: 'numeric', month: 'long', day: 'numeric'
  })

  const planNames: Record<string, string> = { free: 'مجاني', pro: 'برو', vip: 'VIP' }
  const planColors: Record<string, string> = {
    free: 'bg-neutral-500/20 text-neutral-400',
    pro: 'bg-accent/20 text-accent',
    vip: 'bg-purple-500/20 text-purple-400',
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      {/* Profile Header */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-2xl font-bold text-accent">
              {user.name.charAt(0) || '?'}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{user.name || 'مستخدم'}</h1>
              <p className="text-sm text-neutral-500" dir="ltr">{user.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${planColors[user.plan] || planColors.free}`}>
                  {planNames[user.plan] || 'مجاني'}
                </span>
                <span className="text-[10px] text-neutral-600">عضو منذ {memberSince}</span>
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 bg-surface border border-white/10 rounded-xl text-sm text-neutral-400 hover:text-bearish hover:border-bearish/30 transition-all"
          >
            تسجيل الخروج
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="card text-center py-4">
          <div className="text-2xl font-bold text-accent">{activeTrades}</div>
          <div className="text-[10px] text-neutral-500">صفقات نشطة</div>
        </div>
        <div className="card text-center py-4">
          <div className="text-2xl font-bold">{history.length}</div>
          <div className="text-[10px] text-neutral-500">إجمالي الصفقات</div>
        </div>
        <div className="card text-center py-4">
          <div className={`text-2xl font-bold ${winRate >= 50 ? 'text-bullish' : 'text-bearish'}`}>
            {winRate.toFixed(0)}%
          </div>
          <div className="text-[10px] text-neutral-500">نسبة النجاح</div>
        </div>
        <div className="card text-center py-4">
          <div className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-bullish' : 'text-bearish'}`}>
            {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(3)}%
          </div>
          <div className="text-[10px] text-neutral-500">إجمالي الربح</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <Link href="/quickscalp" className="card hover:border-accent/30 transition-all group">
          <div className="text-2xl mb-2">⚡</div>
          <h3 className="font-bold mb-1 group-hover:text-accent transition-all">السكالبينج السريع</h3>
          <p className="text-xs text-neutral-500">إشارات لحظية للتداول السريع</p>
        </Link>
        <Link href="/signals" className="card hover:border-accent/30 transition-all group">
          <div className="text-2xl mb-2">📊</div>
          <h3 className="font-bold mb-1 group-hover:text-accent transition-all">جدول الإشارات</h3>
          <p className="text-xs text-neutral-500">جميع الإشارات في مكان واحد</p>
        </Link>
        <Link href="/qabas" className="card hover:border-accent/30 transition-all group">
          <div className="text-2xl mb-2">🔥</div>
          <h3 className="font-bold mb-1 group-hover:text-accent transition-all">مؤشر القبس</h3>
          <p className="text-xs text-neutral-500">تحليل فني شامل</p>
        </Link>
      </div>

      {/* Win/Loss Bar */}
      {history.length > 0 && (
        <div className="card mb-6">
          <h3 className="font-bold mb-3">سجل الأداء</h3>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm text-bullish font-bold">{wins} ربح</span>
            <div className="flex-1 h-3 bg-surface rounded-full overflow-hidden flex">
              <div className="h-full bg-bullish rounded-r-full" style={{ width: `${winRate}%` }} />
              <div className="h-full bg-bearish rounded-l-full" style={{ width: `${100 - winRate}%` }} />
            </div>
            <span className="text-sm text-bearish font-bold">{losses} خسارة</span>
          </div>

          {/* Recent Trades */}
          <div className="space-y-1.5 mt-4">
            <div className="text-xs text-neutral-500 mb-2">آخر الصفقات</div>
            {history.slice(0, 10).map((t) => (
              <div
                key={t.id}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${
                  t.result === 'WIN' ? 'bg-bullish/[0.05]' : 'bg-bearish/[0.05]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{t.direction === 'BUY' ? '🟢' : '🔴'}</span>
                  <span className="font-bold">{t.displaySymbol}</span>
                  <span className="text-neutral-600">{t.closedAt}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-bold font-mono ${t.result === 'WIN' ? 'text-bullish' : 'text-bearish'}`}>
                    {t.pnlPct >= 0 ? '+' : ''}{t.pnlPct.toFixed(3)}%
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    t.result === 'WIN' ? 'bg-bullish/20 text-bullish' : 'bg-bearish/20 text-bearish'
                  }`}>
                    {t.result === 'WIN' ? 'ربح' : 'خسارة'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* API Key for VIP */}
      {user.plan === 'vip' && user.api_key && (
        <div className="card mb-6 border-purple-500/20 bg-gradient-to-r from-purple-500/[0.03] to-amber-500/[0.03]">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🔑</span>
            <h3 className="font-bold">API Key — للربط مع MT5 / EA</h3>
          </div>
          <div className="flex items-center gap-2 bg-black/30 rounded-lg px-4 py-3 mb-3">
            <code className="flex-1 text-sm font-mono text-amber-400 break-all" dir="ltr">
              {showApiKey ? user.api_key : '•'.repeat(40)}
            </code>
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              className="px-2 py-1 rounded text-xs bg-white/5 hover:bg-white/10 transition-all shrink-0"
            >
              {showApiKey ? '🙈 إخفاء' : '👁️ عرض'}
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(user.api_key || '')
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
              className="px-2 py-1 rounded text-xs bg-accent/10 text-accent hover:bg-accent/20 transition-all shrink-0"
            >
              {copied ? '✅ تم النسخ' : '📋 نسخ'}
            </button>
          </div>
          <p className="text-xs text-neutral-500">
            استخدم هذا المفتاح في Expert Advisor على MT5. لا تشاركه مع أحد.
          </p>
        </div>
      )}

      {/* Plan Upgrade */}
      {user.plan === 'free' && (
        <div className="card border-accent/20 bg-gradient-to-r from-accent/[0.03] to-purple-500/[0.03]">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-lg mb-1">ترقية إلى Pro</h3>
              <p className="text-sm text-neutral-400">احصل على إشارات لحظية + تنبيهات + تتبع صفقات كامل</p>
            </div>
            <Link
              href="/#pricing"
              className="px-6 py-3 bg-accent hover:bg-accent/80 text-white font-bold rounded-xl transition-all shadow-lg shadow-accent/20 text-sm whitespace-nowrap"
            >
              ترقية الآن
            </Link>
          </div>
        </div>
      )}
    </main>
  )
}
