'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Plan {
  id: string
  name: string
  slug: string
  price: number
  currency: string
  interval: string
  features: string[]
}

export function HomePricing() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/plans')
      .then((r) => r.json())
      .then((data) => {
        if (data.plans) setPlans(data.plans)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const ctaLabel = (slug: string) => {
    if (slug === 'free') return 'ابدأ مجاناً'
    if (slug === 'pro') return 'ابدأ تجربة مجانية'
    return 'تواصل معنا'
  }

  const periodLabel = (interval: string) => {
    if (interval === 'month') return '/شهر'
    if (interval === 'year') return '/سنة'
    return ''
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card animate-pulse h-80" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
      {plans.map((plan) => {
        const popular = plan.slug === 'pro'
        return (
          <div
            key={plan.id}
            className={`card relative ${popular ? 'border-accent/40 bg-accent/[0.03] scale-105' : 'border-white/[0.06]'}`}
          >
            {popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-accent text-white text-xs font-bold rounded-full">
                الأكثر شعبية
              </div>
            )}
            <div className="text-center mb-6">
              <h3 className="font-bold text-lg mb-2">{plan.name}</h3>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-gradient">
                  {plan.price === 0 ? 'مجاني' : `${plan.currency === 'SAR' ? '﷼' : '$'}${plan.price}`}
                </span>
                {plan.price > 0 && (
                  <span className="text-sm text-neutral-500">{periodLabel(plan.interval)}</span>
                )}
              </div>
            </div>
            <div className="space-y-3 mb-8">
              {plan.features.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-accent text-xs">✓</span>
                  <span className="text-neutral-300">{f}</span>
                </div>
              ))}
            </div>
            <Link
              href="/register"
              className={`block text-center py-3 rounded-xl font-bold text-sm transition-all ${
                popular
                  ? 'bg-accent hover:bg-accent/80 text-white shadow-lg shadow-accent/20'
                  : 'bg-surface border border-white/10 hover:bg-surface-light text-white'
              }`}
            >
              {ctaLabel(plan.slug)}
            </Link>
          </div>
        )
      })}
    </div>
  )
}
