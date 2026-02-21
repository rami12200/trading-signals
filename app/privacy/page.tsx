'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function PrivacyPage() {
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

      {lang === 'ar' ? <ArabicPrivacy /> : <EnglishPrivacy />}

      <div className="mt-12 text-center text-sm text-neutral-500">
        <Link href="/terms" className="text-accent hover:underline">
          {lang === 'ar' ? 'شروط الاستخدام' : 'Terms of Service'}
        </Link>
      </div>
    </main>
  )
}

function ArabicPrivacy() {
  return (
    <div dir="rtl" className="prose prose-invert max-w-none">
      <h1 className="text-3xl font-bold text-center mb-2">سياسة الخصوصية</h1>
      <p className="text-center text-neutral-400 mb-8">آخر تحديث: {new Date().toLocaleDateString('ar-SA')}</p>

      <div className="space-y-8">
        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">1. مقدمة</h2>
          <p className="text-neutral-300 leading-relaxed">
            مرحباً بك في <strong>مؤشر القبس</strong> (&quot;المنصة&quot;، &quot;نحن&quot;، &quot;لنا&quot;). نحن نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية. توضح سياسة الخصوصية هذه كيفية جمع واستخدام وحماية معلوماتك عند استخدام منصتنا لتوصيات التداول والتحليل الفني.
          </p>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">2. المعلومات التي نجمعها</h2>
          <h3 className="font-semibold text-white mb-2">2.1 معلومات التسجيل</h3>
          <ul className="list-disc list-inside text-neutral-300 space-y-1 mb-4">
            <li>الاسم الكامل</li>
            <li>البريد الإلكتروني</li>
            <li>كلمة المرور (مشفّرة)</li>
          </ul>
          <h3 className="font-semibold text-white mb-2">2.2 معلومات الاستخدام</h3>
          <ul className="list-disc list-inside text-neutral-300 space-y-1 mb-4">
            <li>نوع الاشتراك (مجاني، برو، VIP)</li>
            <li>سجل التصفح داخل المنصة</li>
            <li>الإشارات والتوصيات التي تم عرضها</li>
            <li>إعدادات التداول المفضلة</li>
          </ul>
          <h3 className="font-semibold text-white mb-2">2.3 معلومات تقنية</h3>
          <ul className="list-disc list-inside text-neutral-300 space-y-1">
            <li>عنوان IP</li>
            <li>نوع المتصفح والجهاز</li>
            <li>ملفات تعريف الارتباط (Cookies)</li>
          </ul>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">3. كيف نستخدم معلوماتك</h2>
          <ul className="list-disc list-inside text-neutral-300 space-y-2">
            <li>تقديم خدمات التوصيات والتحليل الفني</li>
            <li>إدارة حسابك واشتراكك</li>
            <li>معالجة المدفوعات وإدارة الفواتير</li>
            <li>تحسين أداء المنصة وتجربة المستخدم</li>
            <li>إرسال إشعارات مهمة متعلقة بحسابك</li>
            <li>التواصل معك بخصوص التحديثات والعروض (بموافقتك)</li>
            <li>الامتثال للمتطلبات القانونية والتنظيمية</li>
          </ul>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">4. حماية البيانات</h2>
          <p className="text-neutral-300 leading-relaxed mb-3">
            نتخذ إجراءات أمنية صارمة لحماية بياناتك:
          </p>
          <ul className="list-disc list-inside text-neutral-300 space-y-2">
            <li>تشفير البيانات أثناء النقل باستخدام SSL/TLS</li>
            <li>تشفير كلمات المرور باستخدام خوارزميات متقدمة</li>
            <li>استخدام Supabase كمزود خدمة قاعدة بيانات آمن</li>
            <li>سياسات أمان على مستوى الصفوف (Row Level Security)</li>
            <li>مراجعة أمنية دورية للمنصة</li>
          </ul>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">5. مشاركة البيانات</h2>
          <p className="text-neutral-300 leading-relaxed mb-3">
            <strong>لا نبيع بياناتك الشخصية لأي طرف ثالث.</strong> قد نشارك معلوماتك فقط في الحالات التالية:
          </p>
          <ul className="list-disc list-inside text-neutral-300 space-y-2">
            <li><strong>مزودو خدمات الدفع:</strong> لمعالجة اشتراكاتك بشكل آمن</li>
            <li><strong>مزودو الاستضافة:</strong> لتشغيل المنصة (Vercel، Supabase)</li>
            <li><strong>المتطلبات القانونية:</strong> عند وجود أمر قضائي أو التزام قانوني</li>
          </ul>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">6. ملفات تعريف الارتباط (Cookies)</h2>
          <p className="text-neutral-300 leading-relaxed">
            نستخدم ملفات تعريف الارتباط لتحسين تجربتك، بما في ذلك الحفاظ على جلسة تسجيل الدخول وتذكر تفضيلاتك. يمكنك التحكم في إعدادات ملفات تعريف الارتباط من خلال متصفحك.
          </p>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">7. حقوقك</h2>
          <ul className="list-disc list-inside text-neutral-300 space-y-2">
            <li><strong>الوصول:</strong> يحق لك طلب نسخة من بياناتك الشخصية</li>
            <li><strong>التصحيح:</strong> يحق لك تصحيح أي بيانات غير دقيقة</li>
            <li><strong>الحذف:</strong> يحق لك طلب حذف حسابك وبياناتك</li>
            <li><strong>الاعتراض:</strong> يحق لك الاعتراض على معالجة بياناتك لأغراض تسويقية</li>
            <li><strong>النقل:</strong> يحق لك طلب نقل بياناتك بصيغة قابلة للقراءة</li>
          </ul>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">8. الاحتفاظ بالبيانات</h2>
          <p className="text-neutral-300 leading-relaxed">
            نحتفظ ببياناتك طالما حسابك نشط أو حسب الحاجة لتقديم الخدمات. عند حذف حسابك، سيتم حذف بياناتك الشخصية خلال 30 يوماً، باستثناء البيانات المطلوبة قانونياً.
          </p>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">9. حماية القاصرين</h2>
          <p className="text-neutral-300 leading-relaxed">
            منصتنا غير موجهة للأشخاص دون 18 عاماً. لا نجمع عمداً بيانات من القاصرين. إذا علمنا بجمع بيانات من قاصر، سنحذفها فوراً.
          </p>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">10. التعديلات</h2>
          <p className="text-neutral-300 leading-relaxed">
            قد نحدّث سياسة الخصوصية هذه من وقت لآخر. سنخطرك بأي تغييرات جوهرية عبر البريد الإلكتروني أو إشعار داخل المنصة.
          </p>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">11. تواصل معنا</h2>
          <p className="text-neutral-300 leading-relaxed">
            لأي استفسارات حول سياسة الخصوصية أو بياناتك الشخصية، تواصل معنا عبر:
          </p>
          <p className="text-accent mt-2 font-medium">support@qabas.pro</p>
        </section>
      </div>
    </div>
  )
}

function EnglishPrivacy() {
  return (
    <div dir="ltr" className="prose prose-invert max-w-none">
      <h1 className="text-3xl font-bold text-center mb-2">Privacy Policy</h1>
      <p className="text-center text-neutral-400 mb-8">Last updated: {new Date().toLocaleDateString('en-US')}</p>

      <div className="space-y-8">
        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">1. Introduction</h2>
          <p className="text-neutral-300 leading-relaxed">
            Welcome to <strong>Muasher Al-Qabas</strong> (مؤشر القبس) (&quot;Platform&quot;, &quot;we&quot;, &quot;us&quot;, &quot;our&quot;). We respect your privacy and are committed to protecting your personal data. This Privacy Policy explains how we collect, use, and protect your information when you use our trading signals and technical analysis platform.
          </p>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">2. Information We Collect</h2>
          <h3 className="font-semibold text-white mb-2">2.1 Registration Information</h3>
          <ul className="list-disc list-inside text-neutral-300 space-y-1 mb-4">
            <li>Full name</li>
            <li>Email address</li>
            <li>Password (encrypted)</li>
          </ul>
          <h3 className="font-semibold text-white mb-2">2.2 Usage Information</h3>
          <ul className="list-disc list-inside text-neutral-300 space-y-1 mb-4">
            <li>Subscription type (Free, Pro, VIP)</li>
            <li>Browsing history within the platform</li>
            <li>Signals and recommendations viewed</li>
            <li>Preferred trading settings</li>
          </ul>
          <h3 className="font-semibold text-white mb-2">2.3 Technical Information</h3>
          <ul className="list-disc list-inside text-neutral-300 space-y-1">
            <li>IP address</li>
            <li>Browser and device type</li>
            <li>Cookies</li>
          </ul>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">3. How We Use Your Information</h2>
          <ul className="list-disc list-inside text-neutral-300 space-y-2">
            <li>Provide trading signals and technical analysis services</li>
            <li>Manage your account and subscription</li>
            <li>Process payments and manage billing</li>
            <li>Improve platform performance and user experience</li>
            <li>Send important notifications related to your account</li>
            <li>Communicate updates and offers (with your consent)</li>
            <li>Comply with legal and regulatory requirements</li>
          </ul>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">4. Data Protection</h2>
          <p className="text-neutral-300 leading-relaxed mb-3">
            We implement strict security measures to protect your data:
          </p>
          <ul className="list-disc list-inside text-neutral-300 space-y-2">
            <li>Data encryption in transit using SSL/TLS</li>
            <li>Password encryption using advanced algorithms</li>
            <li>Supabase as a secure database service provider</li>
            <li>Row Level Security (RLS) policies</li>
            <li>Regular security audits of the platform</li>
          </ul>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">5. Data Sharing</h2>
          <p className="text-neutral-300 leading-relaxed mb-3">
            <strong>We do not sell your personal data to any third party.</strong> We may share your information only in the following cases:
          </p>
          <ul className="list-disc list-inside text-neutral-300 space-y-2">
            <li><strong>Payment providers:</strong> To securely process your subscriptions</li>
            <li><strong>Hosting providers:</strong> To operate the platform (Vercel, Supabase)</li>
            <li><strong>Legal requirements:</strong> When required by court order or legal obligation</li>
          </ul>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">6. Cookies</h2>
          <p className="text-neutral-300 leading-relaxed">
            We use cookies to enhance your experience, including maintaining your login session and remembering your preferences. You can control cookie settings through your browser.
          </p>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">7. Your Rights</h2>
          <ul className="list-disc list-inside text-neutral-300 space-y-2">
            <li><strong>Access:</strong> You have the right to request a copy of your personal data</li>
            <li><strong>Rectification:</strong> You have the right to correct any inaccurate data</li>
            <li><strong>Erasure:</strong> You have the right to request deletion of your account and data</li>
            <li><strong>Objection:</strong> You have the right to object to processing for marketing purposes</li>
            <li><strong>Portability:</strong> You have the right to request your data in a readable format</li>
          </ul>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">8. Data Retention</h2>
          <p className="text-neutral-300 leading-relaxed">
            We retain your data as long as your account is active or as needed to provide services. Upon account deletion, your personal data will be deleted within 30 days, except for data required by law.
          </p>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">9. Children&apos;s Privacy</h2>
          <p className="text-neutral-300 leading-relaxed">
            Our platform is not intended for individuals under 18 years of age. We do not knowingly collect data from minors. If we become aware of data collected from a minor, we will delete it immediately.
          </p>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">10. Changes</h2>
          <p className="text-neutral-300 leading-relaxed">
            We may update this Privacy Policy from time to time. We will notify you of any material changes via email or an in-platform notification.
          </p>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold text-accent mb-3">11. Contact Us</h2>
          <p className="text-neutral-300 leading-relaxed">
            For any inquiries about this Privacy Policy or your personal data, contact us at:
          </p>
          <p className="text-accent mt-2 font-medium">support@qabas.pro</p>
        </section>
      </div>
    </div>
  )
}
