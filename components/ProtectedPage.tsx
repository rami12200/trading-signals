'use client'

import { useAuth } from './AuthProvider'
import { hasAccess, UserPlan } from '@/lib/auth'
import Link from 'next/link'

interface ProtectedPageProps {
  children: React.ReactNode
  requiredPlan?: UserPlan
  featureName?: string
}

export function ProtectedPage({ children, requiredPlan = 'free', featureName }: ProtectedPageProps) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400 text-sm">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  // Not logged in
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold mb-2">سجّل دخولك أولاً</h2>
          <p className="text-neutral-400 mb-6 text-sm">
            {featureName
              ? `تحتاج تسجيل دخول للوصول لـ ${featureName}`
              : 'هذه الصفحة تتطلب تسجيل الدخول'}
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/login" className="btn-primary text-sm !px-6 !py-2.5">
              تسجيل الدخول
            </Link>
            <Link href="/register" className="btn-secondary text-sm !px-6 !py-2.5">
              إنشاء حساب
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Logged in but wrong plan
  if (!hasAccess(user.plan, requiredPlan)) {
    const planNames: Record<UserPlan, string> = {
      free: 'مجاني',
      pro: 'برو',
      vip: 'VIP',
    }

    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-5xl mb-4">⭐</div>
          <h2 className="text-2xl font-bold mb-2">ترقية مطلوبة</h2>
          <p className="text-neutral-400 mb-2 text-sm">
            {featureName
              ? `${featureName} متاحة فقط لمشتركي باقة ${planNames[requiredPlan]} وأعلى`
              : `هذه الميزة تتطلب باقة ${planNames[requiredPlan]} وأعلى`}
          </p>
          <p className="text-neutral-500 mb-6 text-xs">
            باقتك الحالية: <span className="text-accent font-bold">{planNames[user.plan]}</span>
          </p>
          <Link href="/pricing" className="btn-primary text-sm !px-8 !py-2.5">
            ترقية الباقة
          </Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
