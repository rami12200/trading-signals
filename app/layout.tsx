import './globals.css'
import type { Metadata } from 'next'
import { Cairo } from 'next/font/google'
import Link from 'next/link'
import { AuthProvider } from '@/components/AuthProvider'
import { AuthButtons } from '@/components/AuthButtons'

const cairo = Cairo({ subsets: ['arabic', 'latin'], weight: ['400', '500', '600', '700'] })

export const metadata: Metadata = {
  title: 'مؤشر القبس 🔥 — توصيات التداول الذكية',
  description: 'مؤشر القبس — منصة توصيات تداول احترافية بتحليل فني حقيقي — Crypto و Forex',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className={cairo.className}>
        <AuthProvider>
          <div className="min-h-screen bg-background text-white">
          {/* Header */}
          <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-background/80 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto px-4 h-16 flex justify-between items-center">
              <Link
                href="/"
                className="text-xl font-bold text-gradient"
              >
                🔥 مؤشر القبس
              </Link>

              {/* Desktop Nav */}
              <nav className="hidden md:flex items-center gap-1">
                <NavLink href="/qabas">مؤشر القبس</NavLink>
                <NavLink href="/signals">الإشارات</NavLink>
                <NavLink href="/quickscalp">سكالبينج سريع</NavLink>
                <NavLink href="/ict">🎯 القناص</NavLink>
                <NavLink href="/bollinger">📊 البولنجر</NavLink>
                <NavLink href="/spx">📈 SPX</NavLink>
                <NavLink href="/smc">🏦 SMC</NavLink>
                <NavLink href="/quant">🧠 الكمي</NavLink>
                <NavLink href="/scalping">المضاربة</NavLink>
                <NavLink href="/daily">يومي</NavLink>
                <NavLink href="/weekly">أسبوعي</NavLink>
                <NavLink href="/markets">الأسواق</NavLink>
                <NavLink href="/premium">🔥 بريميوم</NavLink>
              </nav>

              <div className="flex items-center gap-2">
                <AuthButtons />
                {/* Mobile Menu Button */}
                <MobileMenu />
              </div>
            </div>
          </header>

          {/* Main */}
          <main>{children}</main>

          {/* Footer */}
          <footer className="border-t border-white/[0.06] bg-surface/20 mt-20">
            <div className="max-w-7xl mx-auto px-4 py-12">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div>
                  <h3 className="font-bold mb-3 text-gradient">🔥 مؤشر القبس</h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    مؤشر القبس — منصة توصيات تداول احترافية بتحليل فني حقيقي وبيانات مباشرة
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-3 text-sm">التوصيات</h4>
                  <div className="flex flex-col gap-2 text-sm text-neutral-400">
                    <Link href="/quickscalp" className="hover:text-white transition-colors">السكالبينج السريع</Link>
                    <Link href="/ict" className="hover:text-white transition-colors">🎯 القناص ICT</Link>
                    <Link href="/bollinger" className="hover:text-white transition-colors">📊 البولنجر باوند</Link>
                    <Link href="/spx" className="hover:text-white transition-colors">📈 S&P 500</Link>
                    <Link href="/smc" className="hover:text-white transition-colors">🏦 Smart Money</Link>
                    <Link href="/scalping" className="hover:text-white transition-colors">المضاربة اللحظية</Link>
                    <Link href="/daily" className="hover:text-white transition-colors">التوصيات اليومية</Link>
                    <Link href="/weekly" className="hover:text-white transition-colors">التحليل الأسبوعي</Link>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-3 text-sm">الأدوات</h4>
                  <div className="flex flex-col gap-2 text-sm text-neutral-400">
                    <Link href="/qabas" className="hover:text-white transition-colors">مؤشر القبس</Link>
                    <Link href="/signals" className="hover:text-white transition-colors">جدول الإشارات</Link>
                    <Link href="/markets" className="hover:text-white transition-colors">حالة الأسواق</Link>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-3 text-sm">قانوني</h4>
                  <div className="flex flex-col gap-2 text-sm text-neutral-400">
                    <Link href="/privacy" className="hover:text-white transition-colors">سياسة الخصوصية</Link>
                    <Link href="/terms" className="hover:text-white transition-colors">شروط الاستخدام</Link>
                    <p className="mt-2">support@qabas.pro</p>
                  </div>
                </div>
              </div>
              <div className="border-t border-white/[0.06] mt-8 pt-8 text-center text-xs text-neutral-500">
                © {new Date().getFullYear()} مؤشر القبس — جميع الحقوق محفوظة
              </div>
            </div>
          </footer>
        </div>
        </AuthProvider>
      </body>
    </html>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-2 rounded-lg text-sm text-neutral-300 hover:text-white hover:bg-white/[0.05] transition-all"
    >
      {children}
    </Link>
  )
}

function MobileMenu() {
  return (
    <div className="md:hidden">
      <details className="relative">
        <summary className="list-none cursor-pointer p-2 rounded-lg hover:bg-white/[0.05]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </summary>
        <div className="absolute left-0 top-full mt-2 w-56 bg-surface border border-white/[0.06] rounded-xl shadow-2xl p-2 z-50">
          <MobileNavLink href="/qabas">مؤشر القبس</MobileNavLink>
          <MobileNavLink href="/signals">الإشارات</MobileNavLink>
          <MobileNavLink href="/quickscalp">سكالبينج سريع</MobileNavLink>
          <MobileNavLink href="/ict">🎯 القناص</MobileNavLink>
          <MobileNavLink href="/bollinger">📊 البولنجر</MobileNavLink>
          <MobileNavLink href="/spx">📈 SPX</MobileNavLink>
          <MobileNavLink href="/smc">🏦 SMC</MobileNavLink>
          <MobileNavLink href="/quant">🧠 الكمي</MobileNavLink>
          <MobileNavLink href="/scalping">المضاربة</MobileNavLink>
          <MobileNavLink href="/daily">يومي</MobileNavLink>
          <MobileNavLink href="/weekly">أسبوعي</MobileNavLink>
          <MobileNavLink href="/markets">الأسواق</MobileNavLink>
          <MobileNavLink href="/premium">🔥 بريميوم</MobileNavLink>
          <div className="border-t border-white/[0.06] my-1" />
          <MobileNavLink href="/profile">حسابي</MobileNavLink>
          <MobileNavLink href="/login">تسجيل الدخول</MobileNavLink>
          <MobileNavLink href="/register">إنشاء حساب</MobileNavLink>
        </div>
      </details>
    </div>
  )
}

function MobileNavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block px-3 py-2 rounded-lg text-sm text-neutral-300 hover:text-white hover:bg-white/[0.05] transition-all"
    >
      {children}
    </Link>
  )
}
