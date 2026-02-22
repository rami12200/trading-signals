import Link from 'next/link'
import { HomePricing } from '@/components/HomePricing'

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-purple-500/5 to-background" />

        <div className="relative max-w-7xl mx-auto px-4 py-28 md:py-40">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-sm mb-8">
              <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
              مؤشر ذكي مدعوم بالذكاء الاصطناعي
            </div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
              <span className="text-gradient">توصيات ذكية</span>
              <br />
              <span className="text-white/90">بقوة الذكاء الاصطناعي</span>
            </h1>

            <p className="text-lg md:text-xl text-neutral-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              مؤشر ذكي يحلل السوق لحظياً باستخدام خوارزميات الذكاء الاصطناعي و 7+ استراتيجيات تداول متقدمة — يقرأ المؤشرات الفنية ويعطيك إشارة شراء أو بيع فورية بدقة عالية
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register" className="btn-primary text-base px-10 py-4 shadow-lg shadow-accent/20">
                ابدأ مجاناً
              </Link>
              <Link href="/quickscalp" className="btn-secondary text-base px-10 py-4">
                جرب بدون حساب
              </Link>
            </div>

            <div className="mt-10 flex items-center justify-center gap-6 text-sm text-neutral-500">
              <span className="flex items-center gap-1.5"><span className="text-bullish">✓</span> بدون بطاقة ائتمان</span>
              <span className="flex items-center gap-1.5"><span className="text-bullish">✓</span> تجربة مجانية 7 أيام</span>
              <span className="flex items-center gap-1.5"><span className="text-bullish">✓</span> إلغاء في أي وقت</span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-surface/50 border-y border-white/[0.06] py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <StatItem value="2,500+" label="متداول نشط" />
            <StatItem value="7+" label="مؤشرات ذكية" />
            <StatItem value="AI" label="ذكاء اصطناعي" />
            <StatItem value="24/7" label="تحليل مستمر" />
          </div>
        </div>
      </section>

      {/* AI Engine Section */}
      <section className="max-w-7xl mx-auto px-4 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold mb-4">
              🧠 محرك الذكاء الاصطناعي
            </div>
            <h2 className="text-3xl font-bold mb-4">مؤشر ذكي يفكر بدلاً عنك</h2>
            <p className="text-neutral-400 leading-relaxed mb-6">
              محرك الذكاء الاصطناعي يحلل بيانات السوق لحظياً — يقرأ 7+ مؤشرات فنية في نفس الوقت، يقارن الأنماط، يحدد نقاط الدخول والخروج، ويحسب وقف الخسارة والهدف تلقائياً من مستويات الدعم والمقاومة الحقيقية.
            </p>
            <div className="space-y-3">
              <AIFeature text="يجمع بين EMA, RSI, MACD, Bollinger, ATR في قرار واحد ذكي" />
              <AIFeature text="يكتشف أنماط الانعكاس وكسر الهيكل السعري (Smart Money)" />
              <AIFeature text="يقيّم قوة الإشارة بناءً على الفوليوم والزخم" />
              <AIFeature text="يحدد SL/TP ذكي من مستويات الدعم والمقاومة الفعلية" />
              <AIFeature text="ينبهك فوراً بصوت + إشعار لما تطلع فرصة تداول" />
            </div>
          </div>
          <div className="card border-accent/20 bg-gradient-to-br from-accent/[0.03] to-purple-500/[0.03]">
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">🤖</div>
              <h3 className="font-bold text-lg text-gradient">كيف يعمل المؤشر الذكي</h3>
            </div>
            <div className="space-y-4">
              <AIStep num="1" title="جمع البيانات" desc="يسحب أسعار وشموع لحظية من Binance عبر WebSocket" />
              <AIStep num="2" title="تحليل المؤشرات" desc="يحسب EMA 9/21, RSI 14, MACD, ATR, Bollinger Bands, Volume" />
              <AIStep num="3" title="تقييم الاستراتيجية" desc="يطبق استراتيجيات التقاطع + الزخم + Smart Money + الانعكاس" />
              <AIStep num="4" title="إصدار الإشارة" desc="يصدر إشارة BUY/SELL مع SL/TP ذكي ودرجة ثقة" />
            </div>
          </div>
        </div>
      </section>

      {/* Strategies Section */}
      <section className="bg-surface/30 border-y border-white/[0.06] py-20">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold mb-3 text-center">استراتيجيات تداول متقدمة</h2>
          <p className="text-neutral-500 text-center mb-14 max-w-2xl mx-auto">المؤشر الذكي يدمج عدة استراتيجيات احترافية في نظام واحد — كل استراتيجية مبنية على مؤشرات فنية حقيقية</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StrategyCard
              icon="📈"
              name="EMA Crossover"
              desc="تقاطع المتوسطات المتحركة EMA 9/21 لتحديد اتجاه السوق"
              indicators={['EMA 9', 'EMA 21']}
            />
            <StrategyCard
              icon="⚡"
              name="Momentum"
              desc="قياس زخم السعر باستخدام RSI و MACD لتأكيد قوة الإشارة"
              indicators={['RSI 14', 'MACD', 'Histogram']}
            />
            <StrategyCard
              icon="🦈"
              name="Smart Money"
              desc="كشف حركات الحيتان وكسر الهيكل السعري (Break of Structure)"
              indicators={['BoS', 'Volume Spike']}
            />
            <StrategyCard
              icon="🔄"
              name="Reversal Detection"
              desc="اكتشاف نقاط الانعكاس المبكرة قبل تغير الاتجاه"
              indicators={['Bollinger', 'ATR', 'S/R']}
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold mb-3 text-center">ابدأ في 3 خطوات</h2>
        <p className="text-neutral-500 text-center mb-14 max-w-xl mx-auto">المؤشر الذكي يشتغل فوراً — ما تحتاج خبرة سابقة</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <StepCard step="1" title="سجّل حسابك" desc="أنشئ حساب مجاني في أقل من دقيقة — الاسم والإيميل وكلمة السر فقط" />
          <StepCard step="2" title="اختر استراتيجيتك" desc="سكالبينج سريع، مضاربة يومية، أو تحليل أسبوعي — المؤشر الذكي يتكيف مع كل واحدة" />
          <StepCard step="3" title="تداول بثقة" desc="المؤشر الذكي يحلل ويعطيك إشارة فورية مع وقف خسارة وهدف محسوب بالذكاء الاصطناعي" />
        </div>
      </section>

      {/* Features */}
      <section className="bg-surface/20 py-20">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold mb-3 text-center">لماذا مؤشرنا الذكي مختلف؟</h2>
          <p className="text-neutral-500 text-center mb-14">ليس مجرد مؤشرات — نظام ذكاء اصطناعي يفهم السوق</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <FeatureCard icon="🤖" title="ذكاء اصطناعي متقدم" desc="خوارزميات AI تحلل 7+ مؤشرات في نفس اللحظة وتصدر قرار تداول واحد ذكي" />
            <FeatureCard icon="📊" title="تحليل متعدد المؤشرات" desc="EMA, RSI, MACD, ATR, Bollinger, Volume, S/R — كلها تشتغل مع بعض مش كل واحد لحاله" />
            <FeatureCard icon="🔔" title="تنبيهات ذكية فورية" desc="صوت + إشعارات المتصفح — المؤشر ينبهك فوراً لما يكتشف فرصة تداول" />
            <FeatureCard icon="🎯" title="SL/TP بالذكاء الاصطناعي" desc="وقف الخسارة والهدف محسوبين من الدعم والمقاومة الحقيقية — مش أرقام عشوائية" />
            <FeatureCard icon="💪" title="تقييم قوة الإشارة" desc="المؤشر يقيّم كل إشارة: قوية / عادية / ضعيفة — بناءً على الفوليوم والزخم" />
            <FeatureCard icon="⚡" title="بيانات لحظية" desc="اتصال مباشر بـ Binance عبر WebSocket — الأسعار والإشارات تتحدث فورياً" />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-7xl mx-auto px-4 py-20" id="pricing">
        <h2 className="text-3xl font-bold mb-3 text-center">خطط الاشتراك</h2>
        <p className="text-neutral-500 text-center mb-14">اختر الخطة المناسبة لك</p>

        <HomePricing />
      </section>

      {/* Testimonials */}
      <section className="bg-surface/20 py-20">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold mb-3 text-center">ماذا يقول عملاؤنا</h2>
          <p className="text-neutral-500 text-center mb-14">آراء حقيقية من متداولين يستخدمون المنصة</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <TestimonialCard
              name="أحمد الشمري"
              role="متداول كريبتو"
              text="المنصة غيرت طريقة تداولي بالكامل. الإشارات دقيقة والتنبيهات الفورية وفرت علي وقت كثير."
              rating={5}
            />
            <TestimonialCard
              name="سارة العتيبي"
              role="مستثمرة"
              text="أفضل شي إن الوقف والهدف محسوبين تلقائياً. ما أحتاج أحسب شي — بس أتبع الإشارة."
              rating={5}
            />
            <TestimonialCard
              name="محمد القحطاني"
              role="متداول يومي"
              text="جربت منصات كثيرة بس هذي أول منصة تعطيني إشارات مبنية على مؤشرات حقيقية مش كلام فاضي."
              rating={4}
            />
          </div>
        </div>
      </section>

      {/* Partners */}
      <section className="max-w-7xl mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold mb-3 text-center">شركاؤنا</h2>
        <p className="text-neutral-500 text-center mb-14">نعمل مع أفضل المنصات العالمية</p>

        <div className="flex flex-wrap justify-center items-center gap-10 md:gap-16">
          <PartnerLogo name="Binance" />
          <PartnerLogo name="Exness" />
          <PartnerLogo name="TradingView" />
          <PartnerLogo name="MetaTrader" />
          <PartnerLogo name="CoinGecko" />
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden py-24">
        <div className="absolute inset-0 bg-gradient-to-r from-accent/10 via-purple-500/10 to-accent/10" />
        <div className="relative max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">جاهز تبدأ التداول الذكي؟</h2>
          <p className="text-neutral-400 mb-8 text-lg">انضم لأكثر من 2,500 متداول يستخدمون مؤشر القبس</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="btn-primary text-base px-10 py-4 shadow-lg shadow-accent/20">
              أنشئ حسابك مجاناً
            </Link>
            <Link href="/login" className="btn-secondary text-base px-10 py-4">
              تسجيل الدخول
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-3xl font-bold text-gradient mb-1">{value}</div>
      <div className="text-sm text-neutral-400">{label}</div>
    </div>
  )
}

function StepCard({ step, title, desc }: { step: string; title: string; desc: string }) {
  return (
    <div className="text-center group">
      <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-2xl font-bold text-accent mx-auto mb-4 group-hover:scale-110 transition-transform">
        {step}
      </div>
      <h3 className="font-bold text-lg mb-2">{title}</h3>
      <p className="text-sm text-neutral-400 leading-relaxed">{desc}</p>
    </div>
  )
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="card-glow group">
      <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">{icon}</div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-neutral-400 leading-relaxed">{desc}</p>
    </div>
  )
}


function TestimonialCard({ name, role, text, rating }: { name: string; role: string; text: string; rating: number }) {
  return (
    <div className="card">
      <div className="flex gap-0.5 mb-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className={`text-sm ${i < rating ? 'text-yellow-400' : 'text-neutral-700'}`}>★</span>
        ))}
      </div>
      <p className="text-sm text-neutral-300 leading-relaxed mb-4">&ldquo;{text}&rdquo;</p>
      <div>
        <div className="font-semibold text-sm">{name}</div>
        <div className="text-xs text-neutral-500">{role}</div>
      </div>
    </div>
  )
}

function PartnerLogo({ name }: { name: string }) {
  return (
    <div className="px-6 py-3 bg-surface/50 border border-white/[0.06] rounded-xl text-neutral-400 font-bold text-lg hover:text-white hover:border-accent/20 transition-all">
      {name}
    </div>
  )
}

function AIFeature({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-accent mt-0.5 text-sm">✦</span>
      <span className="text-sm text-neutral-300 leading-relaxed">{text}</span>
    </div>
  )
}

function AIStep({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-xs font-bold text-accent shrink-0">
        {num}
      </div>
      <div>
        <div className="font-semibold text-sm mb-0.5">{title}</div>
        <div className="text-xs text-neutral-500 leading-relaxed">{desc}</div>
      </div>
    </div>
  )
}

function StrategyCard({ icon, name, desc, indicators }: { icon: string; name: string; desc: string; indicators: string[] }) {
  return (
    <div className="card group hover:border-accent/20 transition-all">
      <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">{icon}</div>
      <h3 className="font-bold text-sm mb-1">{name}</h3>
      <p className="text-xs text-neutral-500 leading-relaxed mb-3">{desc}</p>
      <div className="flex flex-wrap gap-1">
        {indicators.map((ind, i) => (
          <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-mono">
            {ind}
          </span>
        ))}
      </div>
    </div>
  )
}
