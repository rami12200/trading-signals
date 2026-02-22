'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { UserPlan, UserProfile } from '@/lib/auth'

interface AuthContextType {
  user: UserProfile | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    return data as UserProfile | null
  }

  const refreshProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const profile = await fetchProfile(session.user.id)
      setUser(profile)
    }
  }

  useEffect(() => {
    let mounted = true

    // Timeout fallback — never stay loading more than 5s
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false)
    }, 5000)

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return
      if (session?.user) {
        try {
          const profile = await fetchProfile(session.user.id)
          if (mounted) setUser(profile)
        } catch {}
      }
      if (mounted) setLoading(false)
    }).catch(() => {
      if (mounted) setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return
        if (session?.user) {
          try {
            const profile = await fetchProfile(session.user.id)
            if (mounted) setUser(profile)
          } catch {}
        } else {
          setUser(null)
        }
        setLoading(false)
      }
    )

    return () => {
      mounted = false
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut: handleSignOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}
