import Link from 'next/link'
import { PricingPlan } from '@/lib/types'

const plans: PricingPlan[] = [
  {
    name: 'مجاني',
    nameEn: 'Free',
    price: 0,
    period: 'مجاني للأبد',
    description: 'ابدأ بتجربة المنصة',
    features: [
      'إشارات أساسية (3 عملات)',
      'تحديث كل دقيقة',
      'مؤشر RSI و EMA',
      'حالة الأسواق',
    ],
    notIncluded: [
      'المؤشر المتقدم KFOO',
      'Smart Money (BoS)',
      'تنبيهات فورية',
      'دعم أولوية',
    ],
    cta: 'ابدأ مجاناً',
    popular: false,
  },
  {
    name: 'برو',
    nameEn: 'Pro',
    price: 29,
    period: 'شهرياً',
    description: 'للمتداول الجاد',
    features: [
      'كل إشارات 6 عملات',
      'تحديث كل 15 ثانية',
      'كل المؤشرات الفنية',
      'المؤشر المتقدم KFOO',
      'Smart Money (BoS)',
      'حاسبة الصفقات',
    ],
    notIncluded: [
      'تنبيهات فورية',
      'دعم أولوية',
    ],
    cta: 'اشترك الآن',
    popular: true,
  },
  {
    name: 'VIP',
    nameEn: 'VIP',
    price: 79,
    period: 'شهرياً',
    description: 'كل شيء + دعم مباشر',
    features: [
      'كل مميزات برو',
      'تنبيهات فورية (Telegram)',
      'دعم أولوية 24/7',
      'تحليل يومي مخصص',
      'جلسة استشارية شهرية',
      'وصول مبكر للمميزات الجديدة',
    ],
    notIncluded: [],
    cta: 'اشترك VIP',
    popular: false,
  },
]

export default function PricingPage() {
  return (
    <main className="max-w-5xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-3">خطط الاشتراك</h1>
        <p className="text-neutral-400">اختر الخطة المناسبة لأسلوب تداولك</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.nameEn}
            className={`card relative ${
              plan.popular
                ? 'border-accent/40 shadow-lg shadow-accent/10 scale-[1.02]'
                : ''
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 right-4 px-3 py-1 bg-accent text-white text-xs rounded-full font-semibold">
                الأكثر شعبية
              </div>
            )}

            <div className="mb-6">
              <h3 className="text-lg font-bold">{plan.name}</h3>
              <p className="text-xs text-neutral-500">{plan.description}</p>
            </div>

            <div className="mb-6">
              <span className="text-4xl font-bold">
                {plan.price === 0 ? 'مجاني' : `$${plan.price}`}
              </span>
              {plan.price > 0 && (
                <span className="text-sm text-neutral-500 mr-1">/{plan.period}</span>
              )}
            </div>

            <div className="space-y-2.5 mb-8">
              {plan.features.map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm">
                  <span className="text-bullish text-xs">✓</span>
                  <span>{f}</span>
                </div>
              ))}
              {plan.notIncluded.map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm text-neutral-600">
                  <span className="text-xs">✗</span>
                  <span className="line-through">{f}</span>
                </div>
              ))}
            </div>

            <button
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                plan.popular
                  ? 'btn-primary'
                  : 'btn-secondary'
              }`}
            >
              {plan.cta}
            </button>
          </div>
        ))}
      </div>

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
          <span className="text-accent">support@tradesignals.pro</span>
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
