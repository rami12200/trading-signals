'use client'

import { supabase } from './supabase'

export type UserPlan = 'free' | 'pro' | 'vip'

export interface PlanPermissions {
  pages: string[]
  max_pairs: number
  refresh_seconds: number
  alerts: boolean
  ea_access: boolean
  api_access: boolean
}

export interface UserProfile {
  id: string
  email: string
  name: string
  plan: UserPlan
  api_key: string | null
  auto_trade: boolean
  auto_trade_min_confidence: number
  auto_trade_timeframe: string
  created_at: string
}

// Sign up with email/password
export async function signUp(email: string, password: string, name: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, plan: 'free' },
    },
  })
  if (error) throw error

  // Create profile in profiles table
  if (data.user) {
    await supabase.from('profiles').upsert({
      id: data.user.id,
      email,
      name,
      plan: 'free',
    })
  }

  return data
}

// Sign in with email/password
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return data
}

// Sign out
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

// Get current session
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// Get current user profile (with plan info)
export async function getUserProfile(): Promise<UserProfile | null> {
  const session = await getSession()
  if (!session?.user) return null

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()

  if (!data) {
    // Fallback: create profile if missing
    const profile: UserProfile = {
      id: session.user.id,
      email: session.user.email || '',
      name: session.user.user_metadata?.name || '',
      plan: 'free' as UserPlan,
      api_key: null,
      auto_trade: false,
      auto_trade_min_confidence: 65,
      auto_trade_timeframe: '15m',
      created_at: new Date().toISOString(),
    }
    await supabase.from('profiles').upsert(profile)
    return profile
  }

  return data as UserProfile
}

// Check if user has access to a feature (legacy level-based)
export function hasAccess(plan: UserPlan, requiredPlan: UserPlan): boolean {
  const planLevel: Record<UserPlan, number> = { free: 0, pro: 1, vip: 2 }
  return planLevel[plan] >= planLevel[requiredPlan]
}

// Get plan permissions from database
export async function getPlanPermissions(planSlug: UserPlan): Promise<PlanPermissions> {
  const defaults: PlanPermissions = {
    pages: ['markets', 'quickscalp'],
    max_pairs: 3,
    refresh_seconds: 60,
    alerts: false,
    ea_access: false,
    api_access: false,
  }

  try {
    const { data } = await supabase
      .from('plans')
      .select('permissions')
      .eq('slug', planSlug)
      .single()
    if (data?.permissions) return { ...defaults, ...data.permissions }
  } catch {}
  return defaults
}

// Check if user has access to a specific page
export async function hasPageAccess(plan: UserPlan, page: string): Promise<boolean> {
  const perms = await getPlanPermissions(plan)
  return perms.pages.includes(page)
}

// Listen to auth state changes
export function onAuthStateChange(callback: (session: any) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
}
