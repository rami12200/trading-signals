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
  is_active: boolean
  sort_order: number
}

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/plans')
      .then((r) => r.json())
      .then((data) => {
        if (data.plans) setPlans(data.plans)
      })
      .finally(() => setLoading(false))
  }, [])

  const intervalLabel = (interval: string) => {
    if (interval === 'month') return 'شهرياً'
    if (interval === 'year') return 'سنوياً'
    return 'مدى الحياة'
  }

  const ctaLabel = (slug: string) => {
    if (slug === 'free') return 'ابدأ مجاناً'
    if (slug === 'vip') return 'اشترك VIP'
    return 'اشترك الآن'
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-3">خطط الاشتراك</h1>
        <p className="text-neutral-400">اختر الخطة المناسبة لأسلوب تداولك</p>
      </div>

      {loading ? (
        <div className="text-center py-20 text-neutral-400">جاري التحميل...</div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`card relative ${
              plan.slug === 'pro'
                ? 'border-accent/40 shadow-lg shadow-accent/10 scale-[1.02]'
                : ''
            }`}
          >
            {plan.slug === 'pro' && (
              <div className="absolute -top-3 right-4 px-3 py-1 bg-accent text-white text-xs rounded-full font-semibold">
                الأكثر شعبية
              </div>
            )}

            <div className="mb-6">
              <h3 className="text-lg font-bold">{plan.name}</h3>
              <p className="text-xs text-neutral-500">{plan.slug.toUpperCase()}</p>
            </div>

            <div className="mb-6">
              <span className="text-4xl font-bold">
                {plan.price === 0 ? 'مجاني' : `${plan.currency === 'SAR' ? '﷼' : '$'}${plan.price}`}
              </span>
              {plan.price > 0 && (
                <span className="text-sm text-neutral-500 mr-1">/{intervalLabel(plan.interval)}</span>
              )}
            </div>

            <div className="space-y-2.5 mb-8">
              {plan.features.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-bullish text-xs">✓</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>

            <Link
              href={plan.slug === 'free' ? '/register' : '/register'}
              className={`block text-center w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                plan.slug === 'pro'
                  ? 'btn-primary'
                  : 'btn-secondary'
              }`}
            >
              {ctaLabel(plan.slug)}
            </Link>
          </div>
        ))}
      </div>
      )}

      {/* FAQ */}
      <div className="mt-20">
        <h2 className="text-xl font-bold mb-6 text-center">أسئلة شائعة</h2>
        <div className="space-y-4 max-w-2xl mx-auto">
          <FAQ
            q="هل التوصيات مضمونة الربح؟"
            a="لا. التداول ينطوي على مخاطر. نقدم تحليل فني حقيقي لمساعدتك في اتخاذ قرارات مدروسة، لكن لا نضمن أي نتائج."
          />
          <FAQ
            q="كيف يتم حساب المؤشرات؟"
            a="نستخدم حسابات رياضية صحيحة: RSI بطريقة Wilder، MACD كامل مع Signal Line و Histogram، EMA، ATR، وكشف الدعم والمقاومة بالحجم."
          />
          <FAQ
            q="من أين تأتي البيانات؟"
            a="جميع البيانات حية من Binance API — أسعار وشموع حقيقية محدثة كل 15-30 ثانية."
          />
          <FAQ
            q="هل يمكنني إلغاء الاشتراك؟"
            a="نعم، يمكنك إلغاء اشتراكك في أي وقت. لن يتم تجديده تلقائياً بعد الإلغاء."
          />
        </div>
      </div>

      {/* Contact */}
      <div className="mt-16 text-center">
        <p className="text-neutral-400 text-sm">
          لديك سؤال؟ تواصل معنا على{' '}
          <span className="text-accent">support@qabas.pro</span>
        </p>
      </div>
    </main>
  )
}

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <details className="card group cursor-pointer">
      <summary className="list-none font-semibold text-sm flex justify-between items-center">
        {q}
        <span className="text-neutral-500 group-open:rotate-45 transition-transform text-lg">+</span>
      </summary>
      <p className="text-sm text-neutral-400 mt-3 leading-relaxed">{a}</p>
    </details>
  )
}
