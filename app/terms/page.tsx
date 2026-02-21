'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function TermsPage() {
  const [lang, setLang] = useState<'ar' | 'en'>('ar')

  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
      {/* Language Toggle */}
      <div className="flex justify-center gap-2 mb-8">
        <button
          onClick={() => setLang('ar')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            lang === 'ar' ? 'bg-accent text-white' : 'bg-white/5 text-neutral-400 hover:text-white'
          }`}
        >
          العربية
        </button>
        <button
          onClick={() => setLang('en')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            lang === 'en' ? 'bg-accent text-white' : 'bg-white/5 text-neutral-400 hover:text-white'
          }`}
        >
          English
        </button>
      </div>

      {lang === 'ar' ? <ArabicTerms /> : <EnglishTerms />}

      <div className="mt-12 text-center text-sm text-neutral-500">
        <Link href="/privacy" className="text-accent hover:underline">
          {lang === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy'}
        </Link>
      </div>
    </main>
  )
}

function ArabicTerms() {
  return (
    <div dir="rtl" className="prose prose-invert max-w-none">
      <h1 className="text-3xl font-bold text-center mb-2">شروط الاستخدام</h1>
      <p className="text-center text-neutral-400 mb-8">آخر تحديث: {new Date().toLocaleDateString('ar-SA')}</p>

      <div className="space-y-8">
        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">1. القبول بالشروط</h2>
          <p className="text-neutral-300 leading-relaxed">
            باستخدامك لمنصة <strong>مؤشر القبس</strong> (&quot;المنصة&quot;)، فإنك توافق على الالتزام بهذه الشروط والأحكام. إذا كنت لا توافق على أي من هذه الشروط، يرجى عدم استخدام المنصة.
          </p>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">2. وصف الخدمة</h2>
          <p className="text-neutral-300 leading-relaxed mb-3">
            مؤشر القبس هي منصة توفر:
          </p>
          <ul className="list-disc list-inside text-neutral-300 space-y-2">
            <li>توصيات وإشارات تداول مبنية على التحليل الفني</li>
            <li>مؤشرات فنية وتحليل Smart Money</li>
            <li>بيانات أسعار حية من الأسواق المالية</li>
            <li>أدوات مساعدة للتداول (Expert Advisor لمنصة MT5)</li>
            <li>استراتيجيات تداول متنوعة (سكالبينج، يومي، أسبوعي)</li>
          </ul>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">3. إخلاء المسؤولية المالية</h2>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4">
            <p className="text-red-400 font-bold mb-2">⚠️ تحذير مهم</p>
            <p className="text-neutral-300 leading-relaxed">
              التداول في الأسواق المالية ينطوي على مخاطر عالية وقد يؤدي إلى خسارة رأس المال بالكامل. التوصيات والإشارات المقدمة عبر المنصة هي لأغراض تعليمية ومعلوماتية فقط ولا تشكل نصيحة مالية أو استثمارية.
            </p>
          </div>
          <ul className="list-disc list-inside text-neutral-300 space-y-2">
            <li>المنصة <strong>لا تضمن</strong> تحقيق أي أرباح</li>
            <li>جميع قرارات التداول هي مسؤولية المستخدم بالكامل</li>
            <li>الأداء السابق لا يضمن النتائج المستقبلية</li>
            <li>ننصح بعدم التداول بأموال لا تستطيع تحمل خسارتها</li>
            <li>ننصح باستشارة مستشار مالي مرخص قبل اتخاذ أي قرار استثماري</li>
          </ul>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">4. الحسابات والاشتراكات</h2>
          <h3 className="font-semibold text-white mb-2">4.1 إنشاء الحساب</h3>
          <ul className="list-disc list-inside text-neutral-300 space-y-1 mb-4">
            <li>يجب أن يكون عمرك 18 عاماً على الأقل</li>
            <li>يجب تقديم معلومات صحيحة ودقيقة</li>
            <li>أنت مسؤول عن الحفاظ على سرية كلمة المرور</li>
            <li>حساب واحد لكل مستخدم</li>
          </ul>
          <h3 className="font-semibold text-white mb-2">4.2 باقات الاشتراك</h3>
          <ul className="list-disc list-inside text-neutral-300 space-y-1 mb-4">
            <li><strong>مجاني:</strong> وصول محدود لبيانات الأسواق الأساسية</li>
            <li><strong>برو:</strong> وصول كامل لجميع الإشارات والتحليلات</li>
            <li><strong>VIP:</strong> كل مميزات برو + ربط MT5 + Expert Advisor</li>
          </ul>
          <h3 className="font-semibold text-white mb-2">4.3 الدفع والتجديد</h3>
          <ul className="list-disc list-inside text-neutral-300 space-y-1">
            <li>الاشتراكات المدفوعة تُجدد تلقائياً ما لم يتم إلغاؤها</li>
            <li>يمكنك إلغاء اشتراكك في أي وقت</li>
            <li>لا يوجد استرداد للمبالغ المدفوعة عن الفترة الحالية</li>
            <li>نحتفظ بحق تعديل الأسعار مع إشعار مسبق بـ 30 يوماً</li>
          </ul>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">5. الاستخدام المقبول</h2>
          <p className="text-neutral-300 leading-relaxed mb-3">يُحظر عليك:</p>
          <ul className="list-disc list-inside text-neutral-300 space-y-2">
            <li>مشاركة حسابك أو بيانات الدخول مع آخرين</li>
            <li>إعادة بيع أو توزيع محتوى المنصة</li>
            <li>استخدام المنصة لأغراض غير قانونية</li>
            <li>محاولة اختراق أو تعطيل المنصة</li>
            <li>استخدام بوتات أو أدوات آلية للوصول للمنصة (باستثناء EA المقدم منا)</li>
            <li>نسخ أو استنساخ خوارزميات التحليل الخاصة بنا</li>
          </ul>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">6. الملكية الفكرية</h2>
          <p className="text-neutral-300 leading-relaxed">
            جميع المحتويات والخوارزميات والتصاميم والعلامات التجارية في المنصة هي ملك لمؤشر القبس ومحمية بموجب قوانين الملكية الفكرية. لا يحق لك نسخ أو تعديل أو توزيع أي جزء من المنصة دون إذن كتابي مسبق.
          </p>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">7. Expert Advisor (EA)</h2>
          <ul className="list-disc list-inside text-neutral-300 space-y-2">
            <li>الـ EA متاح فقط لمشتركي باقة VIP</li>
            <li>يُستخدم على مسؤولية المستخدم بالكامل</li>
            <li>لا نتحمل مسؤولية أي خسائر ناتجة عن استخدام الـ EA</li>
            <li>يُحظر فك تشفير أو تعديل أو إعادة توزيع الـ EA</li>
            <li>الترخيص شخصي وغير قابل للنقل</li>
          </ul>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">8. حدود المسؤولية</h2>
          <p className="text-neutral-300 leading-relaxed">
            المنصة تُقدم &quot;كما هي&quot; دون أي ضمانات صريحة أو ضمنية. لا نتحمل المسؤولية عن أي أضرار مباشرة أو غير مباشرة ناتجة عن استخدام المنصة، بما في ذلك على سبيل المثال لا الحصر: الخسائر المالية، انقطاع الخدمة، أخطاء في البيانات، أو أي أضرار أخرى.
          </p>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">9. إنهاء الخدمة</h2>
          <p className="text-neutral-300 leading-relaxed">
            نحتفظ بحق تعليق أو إنهاء حسابك في أي وقت إذا انتهكت هذه الشروط، دون إشعار مسبق ودون تحمل أي مسؤولية تجاهك.
          </p>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">10. القانون الواجب التطبيق</h2>
          <p className="text-neutral-300 leading-relaxed">
            تخضع هذه الشروط وتُفسر وفقاً للقوانين المعمول بها. أي نزاع ينشأ عن هذه الشروط يُحل عن طريق التفاوض أولاً، ثم عن طريق التحكيم إذا لزم الأمر.
          </p>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">11. التعديلات</h2>
          <p className="text-neutral-300 leading-relaxed">
            نحتفظ بحق تعديل هذه الشروط في أي وقت. سنخطرك بالتغييرات الجوهرية عبر البريد الإلكتروني أو إشعار داخل المنصة. استمرارك في استخدام المنصة بعد التعديل يعني موافقتك على الشروط المحدثة.
          </p>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">12. تواصل معنا</h2>
          <p className="text-neutral-300 leading-relaxed">
            لأي استفسارات حول شروط الاستخدام، تواصل معنا عبر:
          </p>
          <p className="text-accent mt-2 font-medium">support@qabas.pro</p>
        </section>
      </div>
    </div>
  )
}

function EnglishTerms() {
  return (
    <div dir="ltr" className="prose prose-invert max-w-none">
      <h1 className="text-3xl font-bold text-center mb-2">Terms of Service</h1>
      <p className="text-center text-neutral-400 mb-8">Last updated: {new Date().toLocaleDateString('en-US')}</p>

      <div className="space-y-8">
        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">1. Acceptance of Terms</h2>
          <p className="text-neutral-300 leading-relaxed">
            By using <strong>Muasher Al-Qabas</strong> (مؤشر القبس) (&quot;Platform&quot;), you agree to be bound by these Terms of Service. If you do not agree to any of these terms, please do not use the Platform.
          </p>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">2. Service Description</h2>
          <p className="text-neutral-300 leading-relaxed mb-3">
            Muasher Al-Qabas is a platform that provides:
          </p>
          <ul className="list-disc list-inside text-neutral-300 space-y-2">
            <li>Trading signals and recommendations based on technical analysis</li>
            <li>Technical indicators and Smart Money analysis</li>
            <li>Live market price data</li>
            <li>Trading tools (Expert Advisor for MT5 platform)</li>
            <li>Various trading strategies (scalping, daily, weekly)</li>
          </ul>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">3. Financial Disclaimer</h2>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4">
            <p className="text-red-400 font-bold mb-2">⚠️ Important Warning</p>
            <p className="text-neutral-300 leading-relaxed">
              Trading in financial markets involves high risk and may result in the complete loss of capital. The signals and recommendations provided through the Platform are for educational and informational purposes only and do not constitute financial or investment advice.
            </p>
          </div>
          <ul className="list-disc list-inside text-neutral-300 space-y-2">
            <li>The Platform <strong>does not guarantee</strong> any profits</li>
            <li>All trading decisions are the sole responsibility of the user</li>
            <li>Past performance does not guarantee future results</li>
            <li>We advise against trading with money you cannot afford to lose</li>
            <li>We recommend consulting a licensed financial advisor before making any investment decision</li>
          </ul>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">4. Accounts and Subscriptions</h2>
          <h3 className="font-semibold text-white mb-2">4.1 Account Creation</h3>
          <ul className="list-disc list-inside text-neutral-300 space-y-1 mb-4">
            <li>You must be at least 18 years old</li>
            <li>You must provide accurate and truthful information</li>
            <li>You are responsible for maintaining password confidentiality</li>
            <li>One account per user</li>
          </ul>
          <h3 className="font-semibold text-white mb-2">4.2 Subscription Plans</h3>
          <ul className="list-disc list-inside text-neutral-300 space-y-1 mb-4">
            <li><strong>Free:</strong> Limited access to basic market data</li>
            <li><strong>Pro:</strong> Full access to all signals and analysis</li>
            <li><strong>VIP:</strong> All Pro features + MT5 integration + Expert Advisor</li>
          </ul>
          <h3 className="font-semibold text-white mb-2">4.3 Payment and Renewal</h3>
          <ul className="list-disc list-inside text-neutral-300 space-y-1">
            <li>Paid subscriptions auto-renew unless cancelled</li>
            <li>You may cancel your subscription at any time</li>
            <li>No refunds for the current billing period</li>
            <li>We reserve the right to modify prices with 30 days&apos; notice</li>
          </ul>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">5. Acceptable Use</h2>
          <p className="text-neutral-300 leading-relaxed mb-3">You are prohibited from:</p>
          <ul className="list-disc list-inside text-neutral-300 space-y-2">
            <li>Sharing your account or login credentials with others</li>
            <li>Reselling or redistributing Platform content</li>
            <li>Using the Platform for illegal purposes</li>
            <li>Attempting to hack or disrupt the Platform</li>
            <li>Using bots or automated tools to access the Platform (except our provided EA)</li>
            <li>Copying or reverse-engineering our proprietary analysis algorithms</li>
          </ul>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">6. Intellectual Property</h2>
          <p className="text-neutral-300 leading-relaxed">
            All content, algorithms, designs, and trademarks on the Platform are the property of Muasher Al-Qabas and are protected by intellectual property laws. You may not copy, modify, or distribute any part of the Platform without prior written permission.
          </p>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">7. Expert Advisor (EA)</h2>
          <ul className="list-disc list-inside text-neutral-300 space-y-2">
            <li>The EA is available exclusively to VIP subscribers</li>
            <li>Used entirely at the user&apos;s own risk</li>
            <li>We are not responsible for any losses resulting from EA usage</li>
            <li>Decompiling, modifying, or redistributing the EA is prohibited</li>
            <li>The license is personal and non-transferable</li>
          </ul>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">8. Limitation of Liability</h2>
          <p className="text-neutral-300 leading-relaxed">
            The Platform is provided &quot;as is&quot; without any express or implied warranties. We shall not be liable for any direct or indirect damages arising from the use of the Platform, including but not limited to: financial losses, service interruptions, data errors, or any other damages.
          </p>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">9. Termination</h2>
          <p className="text-neutral-300 leading-relaxed">
            We reserve the right to suspend or terminate your account at any time if you violate these Terms, without prior notice and without any liability to you.
          </p>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">10. Governing Law</h2>
          <p className="text-neutral-300 leading-relaxed">
            These Terms shall be governed by and construed in accordance with applicable laws. Any dispute arising from these Terms shall be resolved through negotiation first, then through arbitration if necessary.
          </p>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">11. Modifications</h2>
          <p className="text-neutral-300 leading-relaxed">
            We reserve the right to modify these Terms at any time. We will notify you of material changes via email or an in-platform notification. Your continued use of the Platform after modification constitutes acceptance of the updated Terms.
          </p>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">12. Contact Us</h2>
          <p className="text-neutral-300 leading-relaxed">
            For any inquiries about these Terms of Service, contact us at:
          </p>
          <p className="text-accent mt-2 font-medium">support@qabas.pro</p>
        </section>
      </div>
    </div>
  )
}
