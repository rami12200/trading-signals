'use client'

import Link from 'next/link'
import { ProtectedPage } from '@/components/ProtectedPage'

export default function PremiumPage() {
  return (
    <ProtectedPage requiredPlan="vip" featureName="باقة بريميوم + ربط MT5">
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
          ربط تلقائي مع MetaTrader 5 — الإشارات تتنفذ تلقائياً بدون تدخل منك
        </p>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
        <div className="card text-center">
          <div className="text-3xl mb-3">🤖</div>
          <h3 className="font-bold mb-2">تنفيذ تلقائي</h3>
          <p className="text-sm text-neutral-400">الـ EA ينفذ الصفقات تلقائياً على MT5 بدون تدخل</p>
        </div>
        <div className="card text-center">
          <div className="text-3xl mb-3">📈</div>
          <h3 className="font-bold mb-2">Trailing Stop</h3>
          <p className="text-sm text-neutral-400">وقف خسارة متحرك يحمي أرباحك تلقائياً</p>
        </div>
        <div className="card text-center">
          <div className="text-3xl mb-3">🔒</div>
          <h3 className="font-bold mb-2">فلتر ترند مزدوج</h3>
          <p className="text-sm text-neutral-400">يمنع الصفقات ضد الترند العام (15 دقيقة + 1 ساعة)</p>
        </div>
      </div>

      {/* Setup Guide */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold mb-8 text-center">📋 طريقة ربط MT5 بمؤشر القبس</h2>

        <div className="space-y-6">
          {/* Step 1 */}
          <StepCard
            num="1"
            title="حمّل ملف الـ EA"
            description="حمّل ملف TradeSignalsPro.mq5 من الرابط أدناه"
          >
            <a
              href="https://github.com/rami12200/trading-signals/raw/main/ea/TradeSignalsPro.mq5"
              className="btn-primary text-sm !px-6 !py-2 inline-block mt-3"
              target="_blank"
            >
              ⬇️ تحميل TradeSignalsPro.mq5
            </a>
          </StepCard>

          {/* Step 2 */}
          <StepCard
            num="2"
            title="انسخ الملف لمجلد MT5"
            description="انسخ الملف إلى مجلد الخبراء في MetaTrader 5"
          >
            <div className="bg-black/40 rounded-lg p-3 mt-3 font-mono text-xs text-neutral-300 overflow-x-auto">
              <p className="text-neutral-500 mb-1"># المسار:</p>
              <p>C:\Users\[اسمك]\AppData\Roaming\MetaQuotes\Terminal\[ID]\MQL5\Experts\</p>
            </div>
            <p className="text-xs text-neutral-500 mt-2">
              💡 أسهل طريقة: افتح MetaEditor (F4) → File → Open Data Folder → MQL5 → Experts → الصق الملف هنا
            </p>
          </StepCard>

          {/* Step 3 */}
          <StepCard
            num="3"
            title="Compile الملف"
            description="افتح الملف في MetaEditor وسوّ Compile"
          >
            <div className="bg-black/40 rounded-lg p-3 mt-3 text-sm text-neutral-300 space-y-1">
              <p>1. افتح MetaEditor (اضغط <kbd className="bg-white/10 px-2 py-0.5 rounded text-xs">F4</kbd> من MT5)</p>
              <p>2. افتح ملف TradeSignalsPro.mq5</p>
              <p>3. اضغط <kbd className="bg-white/10 px-2 py-0.5 rounded text-xs">F7</kbd> أو Compile</p>
              <p>4. تأكد إن ما فيه أخطاء (0 errors)</p>
            </div>
          </StepCard>

          {/* Step 4 */}
          <StepCard
            num="4"
            title="فعّل WebRequest"
            description="لازم تسمح للـ EA يتصل بالإنترنت"
          >
            <div className="bg-black/40 rounded-lg p-3 mt-3 text-sm text-neutral-300 space-y-1">
              <p>1. في MT5: <strong>Tools → Options → Expert Advisors</strong></p>
              <p>2. فعّل ✅ <strong>Allow WebRequest for listed URL</strong></p>
              <p>3. أضف هذا الرابط:</p>
              <p className="font-mono text-accent text-xs bg-accent/10 rounded px-2 py-1 mt-1 inline-block">
                https://trading-signals-livid.vercel.app
              </p>
            </div>
          </StepCard>

          {/* Step 5 */}
          <StepCard
            num="5"
            title="شغّل الـ EA على الشارت"
            description="اسحب الـ EA على شارت BTCUSD وأدخل الإعدادات"
          >
            <div className="bg-black/40 rounded-lg p-3 mt-3 text-sm text-neutral-300 space-y-1">
              <p>1. من Navigator → Expert Advisors → <strong>TradeSignalsPro</strong></p>
              <p>2. اسحبه على شارت <strong>BTCUSD H1</strong></p>
              <p>3. في تاب <strong>Inputs</strong>:</p>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-right py-2 px-3 text-neutral-400">الإعداد</th>
                    <th className="text-right py-2 px-3 text-neutral-400">القيمة</th>
                    <th className="text-right py-2 px-3 text-neutral-400">الوصف</th>
                  </tr>
                </thead>
                <tbody className="text-neutral-300">
                  <tr className="border-b border-white/5">
                    <td className="py-2 px-3 font-mono text-xs">API Key</td>
                    <td className="py-2 px-3 font-mono text-xs text-accent">[مفتاحك الخاص]</td>
                    <td className="py-2 px-3 text-xs text-neutral-500">تحصل عليه بعد الاشتراك</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 px-3 font-mono text-xs">Lot size</td>
                    <td className="py-2 px-3 font-mono text-xs">0.01 - 0.1</td>
                    <td className="py-2 px-3 text-xs text-neutral-500">حجم الصفقة (ابدأ صغير)</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 px-3 font-mono text-xs">Max open trades</td>
                    <td className="py-2 px-3 font-mono text-xs">5</td>
                    <td className="py-2 px-3 text-xs text-neutral-500">أقصى عدد صفقات مفتوحة</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 px-3 font-mono text-xs">Use Trailing Stop</td>
                    <td className="py-2 px-3 font-mono text-xs">true</td>
                    <td className="py-2 px-3 text-xs text-neutral-500">وقف خسارة متحرك</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono text-xs">Symbol suffix</td>
                    <td className="py-2 px-3 font-mono text-xs">حسب البروكر</td>
                    <td className="py-2 px-3 text-xs text-neutral-500">مثل: m أو .raw أو فارغ</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </StepCard>

          {/* Step 6 */}
          <StepCard
            num="6"
            title="تأكد إن الـ EA شغّال"
            description="لازم تشوف وجه مبتسم أعلى يمين الشارت"
          >
            <div className="bg-black/40 rounded-lg p-3 mt-3 text-sm text-neutral-300 space-y-1">
              <p>✅ وجه مبتسم 😊 = الـ EA شغّال</p>
              <p>❌ وجه حزين ☹️ = فيه مشكلة (تحقق من الإعدادات)</p>
              <p className="mt-2">📋 تاب <strong>Experts</strong> في الأسفل يعرض لك سجل العمليات</p>
            </div>
          </StepCard>
        </div>
      </div>

      {/* Important Notes */}
      <div className="card border-amber-500/20 bg-amber-500/5 mb-12">
        <h3 className="font-bold text-amber-400 mb-4">⚠️ ملاحظات مهمة</h3>
        <ul className="space-y-2 text-sm text-neutral-300">
          <li>• ابدأ بحساب <strong>ديمو</strong> أول قبل الحساب الحقيقي</li>
          <li>• استخدم لوت <strong>0.01 - 0.1</strong> في البداية</li>
          <li>• <strong>لا تقفل الصفقات يدوياً</strong> — خل الـ Trailing Stop والـ TP يشتغلون</li>
          <li>• تأكد إن MT5 شغّال <strong>24/7</strong> (أو استخدم VPS)</li>
          <li>• الـ EA يتداول <strong>BTC و ETH</strong> تلقائياً</li>
        </ul>
      </div>

      {/* CTA */}
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">جاهز تبدأ؟</h2>
        <p className="text-neutral-400 mb-6">اشترك في باقة بريميوم واحصل على مفتاح API الخاص بك</p>
        <div className="flex gap-4 justify-center">
          <Link href="/pricing" className="btn-primary text-base px-8 py-3">
            اشترك الآن
          </Link>
          <Link href="/quickscalp" className="btn-secondary text-base px-8 py-3">
            جرب الإشارات أولاً
          </Link>
        </div>
      </div>
    </div>
    </ProtectedPage>
  )
}

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
