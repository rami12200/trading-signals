'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signUp } from '@/lib/auth'

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!name.trim()) return setError('الرجاء إدخال الاسم')
    if (!email.trim()) return setError('الرجاء إدخال البريد الإلكتروني')
    if (!email.includes('@')) return setError('البريد الإلكتروني غير صحيح')
    if (password.length < 6) return setError('كلمة السر يجب أن تكون 6 أحرف على الأقل')
    if (password !== confirmPassword) return setError('كلمة السر غير متطابقة')

    setLoading(true)

    try {
      await signUp(email.toLowerCase().trim(), password, name.trim())
      setSuccess('تم إنشاء الحساب بنجاح! جاري التحويل...')
      setTimeout(() => router.push('/profile'), 1000)
    } catch (err: any) {
      const msg = err.message || 'حدث خطأ'
      if (msg.includes('already registered')) {
        setError('البريد الإلكتروني مسجل مسبقاً')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="max-w-md mx-auto px-4 py-16">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">إنشاء حساب جديد</h1>
        <p className="text-neutral-500 text-sm">انضم لأكثر من 2,500 متداول يستخدمون مؤشر القبس</p>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-neutral-300">الاسم الكامل</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="أحمد محمد"
              className="w-full px-4 py-3 bg-background border border-white/10 rounded-xl text-white placeholder:text-neutral-600 focus:outline-none focus:border-accent/50 transition-all"
            />
          </div>

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
              placeholder="6 أحرف على الأقل"
              dir="ltr"
              className="w-full px-4 py-3 bg-background border border-white/10 rounded-xl text-white placeholder:text-neutral-600 focus:outline-none focus:border-accent/50 transition-all text-left"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 text-neutral-300">تأكيد كلمة السر</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="أعد كتابة كلمة السر"
              dir="ltr"
              className="w-full px-4 py-3 bg-background border border-white/10 rounded-xl text-white placeholder:text-neutral-600 focus:outline-none focus:border-accent/50 transition-all text-left"
            />
          </div>

          {error && (
            <div className="text-sm text-bearish bg-bearish/10 border border-bearish/20 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {success && (
            <div className="text-sm text-bullish bg-bullish/10 border border-bullish/20 rounded-xl px-4 py-3">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-accent hover:bg-accent/80 text-white font-bold rounded-xl transition-all shadow-lg shadow-accent/20 disabled:opacity-50"
          >
            {loading ? 'جاري الإنشاء...' : 'إنشاء الحساب'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-neutral-500">
          عندك حساب؟{' '}
          <Link href="/login" className="text-accent hover:underline font-medium">
            تسجيل الدخول
          </Link>
        </div>
      </div>

      <div className="mt-6 text-center text-xs text-neutral-600">
        بإنشاء حسابك أنت توافق على{' '}
        <span className="text-neutral-400">شروط الاستخدام</span> و{' '}
        <span className="text-neutral-400">سياسة الخصوصية</span>
      </div>
    </main>
  )
}
