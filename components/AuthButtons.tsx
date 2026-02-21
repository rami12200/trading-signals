'use client'

import Link from 'next/link'
import { useAuth } from './AuthProvider'

export function AuthButtons() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-16 h-8 bg-white/5 rounded-lg animate-pulse" />
      </div>
    )
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/profile"
          className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-neutral-300 hover:text-white hover:bg-white/[0.05] transition-all"
        >
          <div className="w-6 h-6 rounded-lg bg-accent/20 flex items-center justify-center text-xs font-bold text-accent">
            {user.name?.charAt(0) || '?'}
          </div>
          <span>{user.name || 'حسابي'}</span>
        </Link>
        <Link
          href="/profile"
          className="md:hidden p-2 rounded-lg hover:bg-white/[0.05] transition-all"
        >
          <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center text-xs font-bold text-accent">
            {user.name?.charAt(0) || '?'}
          </div>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/login"
        className="hidden md:inline-block px-3 py-2 rounded-lg text-sm text-neutral-300 hover:text-white hover:bg-white/[0.05] transition-all"
      >
        دخول
      </Link>
      <Link
        href="/register"
        className="btn-primary text-sm !px-4 !py-2"
      >
        إنشاء حساب
      </Link>
    </div>
  )
}
