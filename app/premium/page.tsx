'use client'

import Link from 'next/link'
import { ProtectedPage } from '@/components/ProtectedPage'

function StepCard({ num, title, description, children }: { num: string; title: string; description: string; children?: React.ReactNode }) {
  return (
    <div className="card group">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-lg font-bold text-accent shrink-0 group-hover:scale-110 transition-transform">
          {num}
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-lg mb-1">{title}</h3>
          <p className="text-sm text-neutral-400">{description}</p>
          {children}
        </div>
      </div>
    </div>
  )
}

export default function PremiumPage() {
  return (
    <ProtectedPage requiredPlan="vip" pageName="premium" featureName="باقة بريميوم + ربط MT5">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm mb-6">
            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
            باقة بريميوم
          </div>
          <h1 className="text-3xl md:text-5xl font-bold mb-4">
            🔥 <span className="text-gradient">مؤشر القبس</span> — بريميوم
          </h1>
          <p className="text-neutral-400 text-lg max-w-2xl mx-auto">
            ربط تلقائي مع MetaTrader 5 — نفذ صفقاتك من الموقع مباشرة إلى المنصة
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
          <div className="card text-center">
            <div className="text-3xl mb-3">⚡</div>
            <h3 className="font-bold mb-2">تنفيذ فوري</h3>
            <p className="text-sm text-neutral-400">اضغط "شراء" في الموقع، والـ EA ينفذها فوراً في MT5</p>
          </div>
          <div className="card text-center">
            <div className="text-3xl mb-3">🎯</div>
            <h3 className="font-bold mb-2">دقة عالية</h3>
            <p className="text-sm text-neutral-400">نقل دقيق لسعر الدخول والهدف والوقف</p>
          </div>
          <div className="card text-center">
            <div className="text-3xl mb-3">🔄</div>
            <h3 className="font-bold mb-2">تحديث مستمر</h3>
            <p className="text-sm text-neutral-400">الـ EA يراقب الأوامر الجديدة كل ثانية</p>
          </div>
        </div>

        {/* API Keys Explanation */}
        <div className="card mb-8 border-amber-500/20 bg-gradient-to-r from-amber-500/[0.03] to-purple-500/[0.03]">
          <h3 className="font-bold text-lg mb-4">🔑 شرح مفاتيح الربط (API Keys)</h3>
          <div className="space-y-4 text-sm">
            <div className="flex items-start gap-3 bg-black/20 p-3 rounded-lg border border-white/5">
              <div className="w-2 h-2 bg-amber-400 rounded-full mt-1.5 flex-shrink-0"></div>
              <div>
                <span className="font-bold text-amber-400 block text-base mb-1">1. USER_API_KEY (مهم جداً)</span>
                <p className="text-neutral-300">هذا هو "مفتاحك الشخصي". تجده في صفحة <strong>Profile</strong>.</p>
                <p className="text-xs text-neutral-500 mt-1">⚠️ يجب عليك نسخه ولصقه في إعدادات الـ EA.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 bg-black/20 p-3 rounded-lg border border-white/5">
              <div className="w-2 h-2 bg-purple-400 rounded-full mt-1.5 flex-shrink-0"></div>
              <div>
                <span className="font-bold text-purple-400 block text-base mb-1">2. EA_API_KEY (تلقائي)</span>
                <p className="text-neutral-300">هذا المفتاح مدمج داخل الملف ولا تحتاج لتغييره.</p>
                <p className="text-xs text-neutral-500 mt-1">✅ اتركه كما هو إلا إذا طلب منك الدعم الفني تغييره.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Setup Guide */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold mb-8 text-center">📋 خطوات الربط خطوة بخطوة</h2>

          <div className="space-y-6">
            {/* Step 1 */}
            <StepCard
              num="1"
              title="حمّل ملف الـ EA"
              description="حمّل أحدث نسخة من ملف AlQabas.mq5"
            >
              <a
                href="/api/download/ea"
                className="btn-primary text-sm !px-6 !py-2 inline-block mt-3 hover:scale-105 transition-transform"
                download="AlQabas.mq5"
              >
                ⬇️ تحميل الملف (تحديث جديد)
              </a>
            </StepCard>

            {/* Step 2 */}
            <StepCard
              num="2"
              title="تثبيت الملف في MT5"
              description="ضع الملف في المجلد الصحيح"
            >
              <div className="bg-black/40 rounded-lg p-3 mt-3 font-mono text-xs text-neutral-300 overflow-x-auto">
                <p className="mb-2">1. افتح منصة MT5</p>
                <p className="mb-2">2. اضغط <kbd className="bg-white/10 px-2 py-0.5 rounded">F4</kbd> لفتح المحرر (MetaEditor)</p>
                <p className="mb-2">3. في المحرر: File → Open Data Folder</p>
                <p className="mb-2">4. اذهب إلى: MQL5 → Experts</p>
                <p className="text-accent">5. الصق الملف الذي حملته هنا</p>
              </div>
            </StepCard>

            {/* Step 3 */}
            <StepCard
              num="3"
              title="Compile (تجهيز الملف)"
              description="خطوة مهمة لتشغيل الملف"
            >
              <div className="bg-black/40 rounded-lg p-3 mt-3 text-sm text-neutral-300 space-y-2">
                <p>1. في MetaEditor، افتح ملف <strong>AlQabas.mq5</strong></p>
                <p>2. اضغط زر <strong>Compile</strong> في الأعلى (أو F7)</p>
                <p>3. تأكد في الأسفل أنه مكتوب: <span className="text-green-400">0 errors</span></p>
              </div>
            </StepCard>

            {/* Step 4 */}
            <StepCard
              num="4"
              title="السماح بالاتصال (WebRequest)"
              description="لكي يستقبل الـ EA الإشارات من الموقع"
            >
              <div className="bg-black/40 rounded-lg p-3 mt-3 text-sm text-neutral-300 space-y-2">
                <p>1. ارجع لمنصة MT5</p>
                <p>2. Tools → Options → Expert Advisors</p>
                <p>3. ضع صح ✅ على <strong>Allow WebRequest for listed URL</strong></p>
                <p>4. أضف الرابط التالي (بدقة):</p>
                <code className="block bg-black/50 p-2 rounded text-accent font-mono mt-1 select-all">
                  https://qabas.pro
                </code>
              </div>
            </StepCard>

            {/* Step 5 */}
            <StepCard
              num="5"
              title="تشغيل الـ EA وإدخال المفاتيح"
              description="الخطوة الأخيرة!"
            >
              <div className="bg-black/40 rounded-lg p-3 mt-3 text-sm text-neutral-300 space-y-2 mb-4">
                <p>1. من قائمة Navigator (يسار الشاشة)، اسحب <strong>AlQabas</strong> إلى أي شارت (مثلاً BTCUSD)</p>
                <p>2. في نافذة الإعدادات (Inputs)، أدخل البيانات التالية:</p>
              </div>
              
              <div className="overflow-x-auto border border-white/10 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-white/5">
                    <tr className="border-b border-white/10">
                      <th className="text-right py-3 px-4 text-neutral-400">الخانة (Variable)</th>
                      <th className="text-right py-3 px-4 text-neutral-400">القيمة (Value)</th>
                      <th className="text-right py-3 px-4 text-neutral-400">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="text-neutral-300 divide-y divide-white/5">
                    <tr>
                      <td className="py-3 px-4 font-mono text-accent">USER_API_KEY</td>
                      <td className="py-3 px-4 font-mono">[الصق مفتاحك هنا]</td>
                      <td className="py-3 px-4 text-xs text-neutral-500">انسخه من صفحة البروفايل</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-mono">EA_API_KEY</td>
                      <td className="py-3 px-4 font-mono text-neutral-500">ts_ea_...</td>
                      <td className="py-3 px-4 text-xs text-neutral-500">لا تغيره</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-mono">Lot Size</td>
                      <td className="py-3 px-4 font-mono">0.01</td>
                      <td className="py-3 px-4 text-xs text-neutral-500">أو حسب رغبتك</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </StepCard>

            {/* Step 6 */}
            <StepCard
              num="6"
              title="كيف تتأكد أنه يعمل؟"
              description="علامات النجاح"
            >
              <div className="bg-black/40 rounded-lg p-3 mt-3 text-sm text-neutral-300 space-y-2">
                <p>✅ <strong>وجه مبتسم 😊</strong> في أعلى يمين الشارت.</p>
                <p>✅ زر <strong>Algo Trading</strong> في الأعلى باللون الأخضر ▶️.</p>
                <p>✅ في تبويب <strong>Experts</strong> بالأسفل، ترى رسالة: <span className="text-green-400 font-mono">TradeSignals Pro EA initialized</span></p>
              </div>
            </StepCard>
          </div>
        </div>

        {/* Important Notes */}
        <div className="card border-amber-500/20 bg-amber-500/5 mb-12">
          <h3 className="font-bold text-amber-400 mb-4">⚠️ كيف تنفذ الصفقات؟</h3>
          <ul className="space-y-3 text-sm text-neutral-300">
            <li className="flex gap-2">
              <span>1️⃣</span>
              <span>اذهب لصفحة <strong>"السكالبينج السريع"</strong> في الموقع.</span>
            </li>
            <li className="flex gap-2">
              <span>2️⃣</span>
              <span>انتظر ظهور إشارة قوية.</span>
            </li>
            <li className="flex gap-2">
              <span>3️⃣</span>
              <span>اضغط زر <strong>"شراء"</strong> أو <strong>"بيع"</strong> في الموقع.</span>
            </li>
            <li className="flex gap-2">
              <span>🚀</span>
              <span>سيقوم الـ EA فوراً بفتح الصفقة في منصة MT5 الخاصة بك بنفس التفاصيل!</span>
            </li>
          </ul>
        </div>

        {/* CTA */}
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">جاهز للانطلاق؟</h2>
          <div className="flex gap-4 justify-center">
            <Link href="/profile" className="btn-primary text-base px-8 py-3">
              احصل على مفتاحك (Profile)
            </Link>
            <Link href="/quickscalp" className="btn-secondary text-base px-8 py-3">
              ابدأ التداول الآن
            </Link>
          </div>
        </div>
      </div>
    </ProtectedPage>
  )
}
