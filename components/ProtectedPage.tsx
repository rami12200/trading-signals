'use client'

import { useAuth } from './AuthProvider'
import { hasAccess, getPlanPermissions, UserPlan, PlanPermissions } from '@/lib/auth'
import Link from 'next/link'
import { useEffect, useState } from 'react'

interface ProtectedPageProps {
  children: React.ReactNode
  requiredPlan?: UserPlan
  pageName?: string
  featureName?: string
}

export function ProtectedPage({ children, requiredPlan = 'free', pageName, featureName }: ProtectedPageProps) {
  const { user, loading } = useAuth()
  const [perms, setPerms] = useState<PlanPermissions | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (loading) return
    if (!user) { setChecking(false); return }

    // Timeout — don't block more than 3s
    const timeout = setTimeout(() => setChecking(false), 3000)

    getPlanPermissions(user.plan)
      .then((p) => setPerms(p))
      .catch(() => {})
      .finally(() => {
        clearTimeout(timeout)
        setChecking(false)
      })

    return () => clearTimeout(timeout)
  }, [user, loading])

  if (loading || checking) {
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

  // Check page-level permission from database
  const hasPagePerm = pageName && perms ? perms.pages.includes(pageName) : true
  const hasPlanLevel = hasAccess(user.plan, requiredPlan)

  if (!hasPlanLevel || !hasPagePerm) {
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
              ? `${featureName} غير متاحة في باقتك الحالية`
              : 'هذه الميزة غير متاحة في باقتك الحالية'}
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
