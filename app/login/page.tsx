'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const USERS_KEY = 'tradesignals_users'
const SESSION_KEY = 'tradesignals_session'

interface User {
  id: string
  name: string
  email: string
  password: string
  plan: 'free' | 'pro' | 'enterprise'
  createdAt: string
}

function getUsers(): User[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(USERS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function setSession(user: User) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    id: user.id,
    name: user.name,
    email: user.email,
    plan: user.plan,
    createdAt: user.createdAt,
  }))
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim()) return setError('الرجاء إدخال البريد الإلكتروني')
    if (!password) return setError('الرجاء إدخال كلمة السر')

    setLoading(true)

    const users = getUsers()
    const user = users.find((u) => u.email === email.toLowerCase().trim() && u.password === password)

    if (!user) {
      setLoading(false)
      return setError('البريد الإلكتروني أو كلمة السر غير صحيحة')
    }

    setSession(user)

    setTimeout(() => {
      router.push('/profile')
    }, 500)
  }

  return (
    <main className="max-w-md mx-auto px-4 py-16">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">تسجيل الدخول</h1>
        <p className="text-neutral-500 text-sm">مرحباً بعودتك</p>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-neutral-300">البريد الإلكتروني</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ahmed@example.com"
              dir="ltr"
              className="w-full px-4 py-3 bg-background border border-white/10 rounded-xl text-white placeholder:text-neutral-600 focus:outline-none focus:border-accent/50 transition-all text-left"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 text-neutral-300">كلمة السر</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="كلمة السر"
              dir="ltr"
              className="w-full px-4 py-3 bg-background border border-white/10 rounded-xl text-white placeholder:text-neutral-600 focus:outline-none focus:border-accent/50 transition-all text-left"
            />
          </div>

          {error && (
            <div className="text-sm text-bearish bg-bearish/10 border border-bearish/20 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-accent hover:bg-accent/80 text-white font-bold rounded-xl transition-all shadow-lg shadow-accent/20 disabled:opacity-50"
          >
            {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-neutral-500">
          ما عندك حساب؟{' '}
          <Link href="/register" className="text-accent hover:underline font-medium">
            إنشاء حساب جديد
          </Link>
        </div>
      </div>
    </main>
  )
}
