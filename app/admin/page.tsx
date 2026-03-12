'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface PlanPermissions {
  pages: string[]
  max_pairs: number
  refresh_seconds: number
  alerts: boolean
  ea_access: boolean
  api_access: boolean
}

interface Plan {
  id: string
  name: string
  slug: string
  price: number
  currency: string
  interval: string
  paddle_price_id: string | null
  features: string[]
  permissions: PlanPermissions
  is_active: boolean
  sort_order: number
}

const ALL_PAGES = [
  { value: 'markets', label: 'حالة الأسواق' },
  { value: 'quickscalp', label: 'السكالبينج السريع' },
  { value: 'qabas', label: 'مؤشر القبس' },
  { value: 'signals', label: 'جدول الإشارات' },
  { value: 'scalping', label: 'المضاربة اللحظية' },
  { value: 'daily', label: 'التوصيات اليومية' },
  { value: 'weekly', label: 'التحليل الأسبوعي' },
  { value: 'premium', label: 'بريميوم + MT5' },
]

const DEFAULT_PERMISSIONS: PlanPermissions = {
  pages: [],
  max_pairs: 3,
  refresh_seconds: 60,
  alerts: false,
  ea_access: false,
  api_access: false,
}

interface User {
  id: string
  email: string
  name: string
  plan: string
  api_key: string | null
  is_admin: boolean
  created_at: string
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<'plans' | 'users' | 'report'>('plans')
  const [plans, setPlans] = useState<Plan[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [msg, setMsg] = useState('')

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || ''
  }, [])

  const checkAdmin = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
    if (data?.is_admin) {
      setIsAdmin(true)
    } else {
      router.push('/')
    }
  }, [user, router])

  const fetchPlans = useCallback(async () => {
    const token = await getToken()
    const res = await fetch('/api/admin/plans', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const json = await res.json()
    if (json.plans) setPlans(json.plans)
  }, [getToken])

  const fetchUsers = useCallback(async () => {
    const token = await getToken()
    const res = await fetch('/api/admin/users', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const json = await res.json()
    if (json.users) setUsers(json.users)
  }, [getToken])

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    checkAdmin()
  }, [user, authLoading, router, checkAdmin])

  useEffect(() => {
    if (!isAdmin) return
    setLoading(true)
    Promise.all([fetchPlans(), fetchUsers()]).finally(() => setLoading(false))
  }, [isAdmin, fetchPlans, fetchUsers])

  const savePlan = async (plan: Plan) => {
    const token = await getToken()
    const method = plan.id ? 'PUT' : 'POST'
    const res = await fetch('/api/admin/plans', {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(plan),
    })
    const json = await res.json()
    if (json.error) { setMsg('❌ ' + json.error); return }
    setMsg('✅ تم حفظ الباقة')
    setEditingPlan(null)
    fetchPlans()
  }

  const deletePlan = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الباقة؟')) return
    const token = await getToken()
    await fetch(`/api/admin/plans?id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    setMsg('✅ تم حذف الباقة')
    fetchPlans()
  }

  const updateUserPlan = async (userId: string, plan: string) => {
    const token = await getToken()
    const res = await fetch('/api/admin/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: userId, plan }),
    })
    const json = await res.json()
    if (json.error) { setMsg('❌ ' + json.error); return }
    setMsg('✅ تم تحديث باقة المستخدم')
    setEditingUser(null)
    fetchUsers()
  }

  const regenerateApiKey = async (userId: string) => {
    if (!confirm('هل تريد تجديد API Key؟ المفتاح القديم سيتوقف عن العمل.')) return
    const token = await getToken()
    const res = await fetch('/api/admin/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: userId, regenerate_api_key: true }),
    })
    const json = await res.json()
    if (json.error) { setMsg('❌ ' + json.error); return }
    setMsg('✅ تم تجديد API Key')
    fetchUsers()
  }

  const toggleAdmin = async (userId: string, isAdminNow: boolean) => {
    const token = await getToken()
    await fetch('/api/admin/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: userId, is_admin: !isAdminNow }),
    })
    setMsg(isAdminNow ? '✅ تم إزالة صلاحية الأدمن' : '✅ تم إضافة صلاحية الأدمن')
    fetchUsers()
  }

  if (authLoading || !isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-neutral-400">جاري التحميل...</div>
      </div>
    )
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">⚙️ لوحة التحكم</h1>
          <p className="text-sm text-neutral-500">إدارة الباقات والمستخدمين</p>
        </div>
      </div>

      {msg && (
        <div className="card mb-4 text-sm text-center" onClick={() => setMsg('')}>
          {msg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setTab('plans')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'plans' ? 'bg-accent text-white' : 'bg-white/5 text-neutral-400 hover:text-white'
          }`}
        >
          📦 الباقات ({plans.length})
        </button>
        <button
          onClick={() => setTab('users')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'users' ? 'bg-accent text-white' : 'bg-white/5 text-neutral-400 hover:text-white'
          }`}
        >
          👥 المستخدمين ({users.length})
        </button>
        <button
          onClick={() => setTab('report')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'report' ? 'bg-accent text-white' : 'bg-white/5 text-neutral-400 hover:text-white'
          }`}
        >
          📊 تقرير الأداء
        </button>
      </div>

      {loading && tab !== 'report' ? (
        <div className="text-center py-20 text-neutral-400">جاري التحميل...</div>
      ) : tab === 'plans' ? (
        <PlansTab
          plans={plans}
          editingPlan={editingPlan}
          setEditingPlan={setEditingPlan}
          savePlan={savePlan}
          deletePlan={deletePlan}
        />
      ) : tab === 'users' ? (
        <UsersTab
          users={users}
          plans={plans}
          editingUser={editingUser}
          setEditingUser={setEditingUser}
          updateUserPlan={updateUserPlan}
          toggleAdmin={toggleAdmin}
          regenerateApiKey={regenerateApiKey}
        />
      ) : (
        <ReportTab getToken={getToken} />
      )}
    </main>
  )
}

function PlansTab({
  plans, editingPlan, setEditingPlan, savePlan, deletePlan,
}: {
  plans: Plan[]
  editingPlan: Plan | null
  setEditingPlan: (p: Plan | null) => void
  savePlan: (p: Plan) => void
  deletePlan: (id: string) => void
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-bold text-lg">الباقات</h2>
        <button
          onClick={() =>
            setEditingPlan({
              id: '',
              name: '',
              slug: 'pro',
              price: 0,
              currency: 'USD',
              interval: 'month',
              paddle_price_id: '',
              features: [],
              permissions: { ...DEFAULT_PERMISSIONS },
              is_active: true,
              sort_order: plans.length,
            })
          }
          className="btn-primary text-sm !px-4 !py-2"
        >
          + إضافة باقة
        </button>
      </div>

      {editingPlan && (
        <PlanForm
          plan={editingPlan}
          onSave={savePlan}
          onCancel={() => setEditingPlan(null)}
        />
      )}

      <div className="grid gap-4">
        {plans.map((plan) => (
          <div key={plan.id} className={`card flex flex-col md:flex-row md:items-center justify-between gap-4 ${!plan.is_active ? 'opacity-50' : ''}`}>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-lg">{plan.name}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent">{plan.slug}</span>
                {!plan.is_active && <span className="text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-400">معطّل</span>}
              </div>
              <div className="text-2xl font-bold text-gradient mb-2">
                ${plan.price}<span className="text-sm text-neutral-500 font-normal">/{plan.interval === 'month' ? 'شهر' : plan.interval === 'year' ? 'سنة' : 'مدى الحياة'}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {plan.features.map((f, i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded bg-white/5 text-neutral-300">{f}</span>
                ))}
              </div>
              {plan.paddle_price_id && (
                <div className="text-xs text-neutral-500 mt-2">Paddle: {plan.paddle_price_id}</div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditingPlan({ ...plan })}
                className="px-3 py-2 rounded-lg text-sm bg-white/5 hover:bg-white/10 transition-all"
              >
                ✏️ تعديل
              </button>
              {plan.slug !== 'free' && (
                <button
                  onClick={() => deletePlan(plan.id)}
                  className="px-3 py-2 rounded-lg text-sm bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                >
                  🗑️ حذف
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PlanForm({
  plan, onSave, onCancel,
}: {
  plan: Plan
  onSave: (p: Plan) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState(plan)
  const [featuresText, setFeaturesText] = useState(plan.features.join('\n'))
  const [perms, setPerms] = useState<PlanPermissions>(plan.permissions || { ...DEFAULT_PERMISSIONS })

  return (
    <div className="card mb-6 border-accent/20">
      <h3 className="font-bold mb-4">{plan.id ? '✏️ تعديل الباقة' : '➕ باقة جديدة'}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-neutral-400 mb-1 block">اسم الباقة</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
            placeholder="Pro"
          />
        </div>
        <div>
          <label className="text-sm text-neutral-400 mb-1 block">الرمز (slug)</label>
          <select
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
          >
            <option value="free">free</option>
            <option value="pro">pro</option>
            <option value="vip">vip</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-neutral-400 mb-1 block">السعر</label>
          <input
            type="number"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm text-neutral-400 mb-1 block">العملة</label>
          <select
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
          >
            <option value="USD">USD</option>
            <option value="SAR">SAR</option>
            <option value="AED">AED</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-neutral-400 mb-1 block">الدورة</label>
          <select
            value={form.interval}
            onChange={(e) => setForm({ ...form, interval: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
          >
            <option value="month">شهري</option>
            <option value="year">سنوي</option>
            <option value="lifetime">مدى الحياة</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-neutral-400 mb-1 block">Paddle Price ID</label>
          <input
            value={form.paddle_price_id || ''}
            onChange={(e) => setForm({ ...form, paddle_price_id: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
            placeholder="pri_01..."
          />
        </div>
        <div>
          <label className="text-sm text-neutral-400 mb-1 block">الترتيب</label>
          <input
            type="number"
            value={form.sort_order}
            onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-neutral-400">مفعّلة</label>
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            className="w-4 h-4"
          />
        </div>
      </div>
      <div className="mt-4">
        <label className="text-sm text-neutral-400 mb-1 block">المميزات (سطر لكل ميزة) — نصوص تظهر في صفحة الأسعار</label>
        <textarea
          value={featuresText}
          onChange={(e) => setFeaturesText(e.target.value)}
          rows={4}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
          placeholder="إشارات لحظية فورية&#10;جميع العملات (10+)&#10;تنبيهات صوتية"
        />
      </div>

      {/* Permissions Editor */}
      <div className="mt-6 border-t border-white/10 pt-4">
        <h4 className="font-bold text-sm mb-3">🔐 الصلاحيات الفعلية</h4>
        
        <div className="mb-4">
          <label className="text-sm text-neutral-400 mb-2 block">الصفحات المتاحة</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {ALL_PAGES.map((page) => (
              <label key={page.value} className="flex items-center gap-2 text-sm bg-white/5 rounded-lg px-3 py-2 cursor-pointer hover:bg-white/10 transition-all">
                <input
                  type="checkbox"
                  checked={perms.pages.includes(page.value)}
                  onChange={(e) => {
                    const newPages = e.target.checked
                      ? [...perms.pages, page.value]
                      : perms.pages.filter((p: string) => p !== page.value)
                    setPerms({ ...perms, pages: newPages })
                  }}
                  className="w-4 h-4"
                />
                {page.label}
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-sm text-neutral-400 mb-1 block">عدد العملات</label>
            <input
              type="number"
              value={perms.max_pairs}
              onChange={(e) => setPerms({ ...perms, max_pairs: parseInt(e.target.value) || 3 })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm text-neutral-400 mb-1 block">سرعة التحديث (ثواني)</label>
            <input
              type="number"
              value={perms.refresh_seconds}
              onChange={(e) => setPerms({ ...perms, refresh_seconds: parseInt(e.target.value) || 60 })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={perms.alerts}
              onChange={(e) => setPerms({ ...perms, alerts: e.target.checked })}
              className="w-4 h-4"
            />
            تنبيهات فورية
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={perms.ea_access}
              onChange={(e) => setPerms({ ...perms, ea_access: e.target.checked })}
              className="w-4 h-4"
            />
            ربط MT5 / EA
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={perms.api_access}
              onChange={(e) => setPerms({ ...perms, api_access: e.target.checked })}
              className="w-4 h-4"
            />
            API خاص
          </label>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={() => {
            const features = featuresText.split('\n').map((f) => f.trim()).filter(Boolean)
            onSave({ ...form, features, permissions: perms })
          }}
          className="btn-primary text-sm !px-6 !py-2"
        >
          💾 حفظ
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm bg-white/5 hover:bg-white/10 transition-all"
        >
          إلغاء
        </button>
      </div>
    </div>
  )
}

function UsersTab({
  users, plans, editingUser, setEditingUser, updateUserPlan, toggleAdmin, regenerateApiKey,
}: {
  users: User[]
  plans: Plan[]
  editingUser: User | null
  setEditingUser: (u: User | null) => void
  updateUserPlan: (id: string, plan: string) => void
  toggleAdmin: (id: string, isAdmin: boolean) => void
  regenerateApiKey: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const filtered = users.filter(
    (u) => u.email.includes(search) || u.name.includes(search)
  )

  const planBadge = (plan: string) => {
    if (plan === 'vip') return 'bg-amber-500/10 text-amber-400'
    if (plan === 'pro') return 'bg-accent/10 text-accent'
    return 'bg-white/5 text-neutral-400'
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-bold text-lg">المستخدمين</h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو الإيميل..."
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm w-64"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-neutral-400">
              <th className="text-right p-3">المستخدم</th>
              <th className="text-right p-3">الإيميل</th>
              <th className="text-right p-3">الباقة</th>
              <th className="text-right p-3">API Key</th>
              <th className="text-right p-3">الصلاحية</th>
              <th className="text-right p-3">تاريخ التسجيل</th>
              <th className="text-right p-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="p-3 font-medium">{u.name || '—'}</td>
                <td className="p-3 text-neutral-400 font-mono text-xs">{u.email}</td>
                <td className="p-3">
                  {editingUser?.id === u.id ? (
                    <select
                      value={editingUser.plan}
                      onChange={(e) => setEditingUser({ ...editingUser, plan: e.target.value })}
                      className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs"
                    >
                      {plans.map((p) => (
                        <option key={p.slug} value={p.slug}>{p.name}</option>
                      ))}
                    </select>
                  ) : (
                    <span className={`text-xs px-2 py-1 rounded font-bold ${planBadge(u.plan)}`}>
                      {u.plan.toUpperCase()}
                    </span>
                  )}
                </td>
                <td className="p-3">
                  {u.api_key ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2 py-1 rounded" dir="ltr">
                        {u.api_key.slice(0, 12)}...
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(u.api_key!)
                          alert('تم نسخ API Key!')
                        }}
                        className="px-1.5 py-1 rounded text-[10px] bg-white/5 hover:bg-white/10 transition-all"
                        title="نسخ"
                      >
                        📋
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-neutral-600">—</span>
                  )}
                </td>
                <td className="p-3">
                  {u.is_admin && <span className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-400 font-bold">Admin</span>}
                </td>
                <td className="p-3 text-neutral-500 text-xs">
                  {new Date(u.created_at).toLocaleDateString('ar-SA')}
                </td>
                <td className="p-3">
                  <div className="flex gap-1">
                    {editingUser?.id === u.id ? (
                      <>
                        <button
                          onClick={() => updateUserPlan(u.id, editingUser.plan)}
                          className="px-2 py-1 rounded text-xs bg-accent/10 text-accent hover:bg-accent/20"
                        >
                          ✅ حفظ
                        </button>
                        <button
                          onClick={() => setEditingUser(null)}
                          className="px-2 py-1 rounded text-xs bg-white/5 hover:bg-white/10"
                        >
                          إلغاء
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setEditingUser({ ...u })}
                          className="px-2 py-1 rounded text-xs bg-white/5 hover:bg-white/10"
                        >
                          ✏️ الباقة
                        </button>
                        <button
                          onClick={() => toggleAdmin(u.id, u.is_admin)}
                          className={`px-2 py-1 rounded text-xs ${
                            u.is_admin ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-accent/10 text-accent hover:bg-accent/20'
                          }`}
                        >
                          {u.is_admin ? '🔓 إزالة أدمن' : '🔒 أدمن'}
                        </button>
                        {u.plan === 'vip' && (
                          <button
                            onClick={() => regenerateApiKey(u.id)}
                            className="px-2 py-1 rounded text-xs bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                          >
                            🔑 {u.api_key ? 'تجديد Key' : 'توليد Key'}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Report Tab ──────────────────────────────────────────────────────────────

interface ReportSignal {
  id: string
  signal_id: string
  pair: string
  interval: string
  direction: 'BUY' | 'SELL'
  entry: number
  stop_loss: number
  take_profit: number
  probability: number
  strength_label: string
  regime: string
  risk_reward: string
  result: 'WIN' | 'LOSS' | 'PENDING' | 'EXPIRED'
  exit_price: number | null
  exit_time: string | null
  created_at: string
  layers: any[]
}

interface ReportSummary {
  total: number
  wins: number
  losses: number
  pending: number
  expired: number
  winRate: number
  profitFactor: number
  avgRR: number
  maxConsecLosses: number
  avgProbability: number
  days: number
  pair: string
}

function ReportTab({ getToken }: { getToken: () => Promise<string> }) {
  const [summary, setSummary] = useState<ReportSummary | null>(null)
  const [signals, setSignals] = useState<ReportSignal[]>([])
  const [reportLoading, setReportLoading] = useState(false)
  const [filterPair, setFilterPair] = useState<string>('ALL')
  const [filterDays, setFilterDays] = useState<number>(7)
  const [copied, setCopied] = useState(false)

  const fetchReport = useCallback(async () => {
    setReportLoading(true)
    try {
      const token = await getToken()
      const pairParam = filterPair !== 'ALL' ? `&pair=${filterPair}` : ''
      const res = await fetch(`/api/admin/report?days=${filterDays}${pairParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (json.success) {
        setSummary(json.summary)
        setSignals(json.signals)
      }
    } catch (err) {
      console.error('Report fetch error:', err)
    }
    setReportLoading(false)
  }, [getToken, filterPair, filterDays])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const copyReport = () => {
    if (!summary) return
    const lines: string[] = []
    lines.push('=== Quant Engine Performance Report ===')
    lines.push(`Period: ${summary.days} days | Pair: ${summary.pair}`)
    lines.push(`Total Signals: ${summary.total}`)
    lines.push(`Wins: ${summary.wins} | Losses: ${summary.losses} | Pending: ${summary.pending} | Expired: ${summary.expired}`)
    lines.push(`Win Rate: ${summary.winRate}%`)
    lines.push(`Profit Factor: ${summary.profitFactor}`)
    lines.push(`Avg R:R: ${summary.avgRR}`)
    lines.push(`Max Consecutive Losses: ${summary.maxConsecLosses}`)
    lines.push(`Avg Probability: ${summary.avgProbability}%`)
    lines.push('')
    lines.push('=== Signal Details ===')
    lines.push('Pair | Dir | Entry | SL | TP | Prob | Regime | R:R | Result | Exit | Time')
    lines.push('-'.repeat(100))
    for (const s of signals) {
      const exit = s.exit_price != null ? s.exit_price.toFixed(2) : '-'
      const time = s.created_at ? new Date(s.created_at).toLocaleString('en-GB', { hour12: false }) : '-'
      lines.push(
        `${s.pair} | ${s.direction} | ${s.entry} | ${s.stop_loss} | ${s.take_profit} | ${s.probability}% | ${s.regime} | ${s.risk_reward} | ${s.result} | ${exit} | ${time}`
      )
    }
    navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (reportLoading) {
    return <div className="text-center py-20 text-neutral-400">جاري تحميل التقرير...</div>
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <select
          value={filterPair}
          onChange={e => setFilterPair(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm outline-none"
        >
          <option value="ALL">كل العملات</option>
          <option value="BTCUSDT">BTC/USDT</option>
          <option value="ETHUSDT">ETH/USDT</option>
        </select>
        <select
          value={filterDays}
          onChange={e => setFilterDays(parseInt(e.target.value))}
          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm outline-none"
        >
          <option value={1}>يوم واحد</option>
          <option value={3}>3 أيام</option>
          <option value={7}>أسبوع</option>
          <option value={14}>أسبوعين</option>
          <option value={30}>شهر</option>
        </select>
        <button
          onClick={fetchReport}
          className="px-4 py-2 rounded-lg bg-accent/20 text-accent text-sm font-medium hover:bg-accent/30 transition-all"
        >
          تحديث
        </button>
        <button
          onClick={copyReport}
          className="px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/30 transition-all"
        >
          {copied ? '✅ تم النسخ' : '📋 نسخ التقرير'}
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <p className="text-xs text-neutral-500">إجمالي الإشارات</p>
            <p className="text-2xl font-bold text-white mt-1">{summary.total}</p>
          </div>
          <div className="p-4 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20">
            <p className="text-xs text-emerald-400/70">Win Rate</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{summary.winRate}%</p>
            <p className="text-xs text-neutral-500 mt-1">{summary.wins}W / {summary.losses}L</p>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <p className="text-xs text-neutral-500">Profit Factor</p>
            <p className={`text-2xl font-bold mt-1 ${summary.profitFactor >= 1.0 ? 'text-emerald-400' : 'text-red-400'}`}>{summary.profitFactor}</p>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <p className="text-xs text-neutral-500">Avg R:R</p>
            <p className="text-2xl font-bold text-white mt-1">{summary.avgRR}</p>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <p className="text-xs text-neutral-500">Pending</p>
            <p className="text-2xl font-bold text-yellow-400 mt-1">{summary.pending}</p>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <p className="text-xs text-neutral-500">Expired</p>
            <p className="text-2xl font-bold text-neutral-400 mt-1">{summary.expired}</p>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <p className="text-xs text-neutral-500">Max خسائر متتالية</p>
            <p className="text-2xl font-bold text-red-400 mt-1">{summary.maxConsecLosses}</p>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <p className="text-xs text-neutral-500">متوسط الاحتمالية</p>
            <p className="text-2xl font-bold text-white mt-1">{summary.avgProbability}%</p>
          </div>
        </div>
      )}

      {/* Signals Table */}
      <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/[0.03]">
              <th className="px-3 py-3 text-right text-xs text-neutral-400 font-medium">الوقت</th>
              <th className="px-3 py-3 text-right text-xs text-neutral-400 font-medium">الزوج</th>
              <th className="px-3 py-3 text-right text-xs text-neutral-400 font-medium">النوع</th>
              <th className="px-3 py-3 text-right text-xs text-neutral-400 font-medium">الدخول</th>
              <th className="px-3 py-3 text-right text-xs text-neutral-400 font-medium">SL</th>
              <th className="px-3 py-3 text-right text-xs text-neutral-400 font-medium">TP</th>
              <th className="px-3 py-3 text-right text-xs text-neutral-400 font-medium">%</th>
              <th className="px-3 py-3 text-right text-xs text-neutral-400 font-medium">Regime</th>
              <th className="px-3 py-3 text-right text-xs text-neutral-400 font-medium">R:R</th>
              <th className="px-3 py-3 text-right text-xs text-neutral-400 font-medium">الخروج</th>
              <th className="px-3 py-3 text-right text-xs text-neutral-400 font-medium">النتيجة</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((s) => (
              <tr key={s.id} className={`border-t border-white/[0.04] ${
                s.result === 'WIN' ? 'bg-emerald-500/[0.03]' :
                s.result === 'LOSS' ? 'bg-red-500/[0.03]' : ''
              }`}>
                <td className="px-3 py-2 text-xs text-neutral-400 font-mono">
                  {new Date(s.created_at).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
                </td>
                <td className="px-3 py-2 text-xs text-white font-medium">{s.pair.replace('USDT', '')}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    s.direction === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {s.direction === 'BUY' ? 'شراء' : 'بيع'}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-white font-mono">{Number(s.entry).toFixed(2)}</td>
                <td className="px-3 py-2 text-xs text-red-400 font-mono">{Number(s.stop_loss).toFixed(2)}</td>
                <td className="px-3 py-2 text-xs text-emerald-400 font-mono">{Number(s.take_profit).toFixed(2)}</td>
                <td className="px-3 py-2 text-xs text-white font-bold">{s.probability}%</td>
                <td className="px-3 py-2 text-xs text-neutral-400">{s.regime}</td>
                <td className="px-3 py-2 text-xs text-white font-mono">{s.risk_reward}</td>
                <td className="px-3 py-2 text-xs text-neutral-300 font-mono">
                  {s.exit_price != null ? Number(s.exit_price).toFixed(2) : '-'}
                </td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    s.result === 'WIN' ? 'bg-emerald-500/20 text-emerald-400' :
                    s.result === 'LOSS' ? 'bg-red-500/20 text-red-400' :
                    s.result === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-neutral-500/20 text-neutral-400'
                  }`}>
                    {s.result === 'WIN' ? 'ربح' : s.result === 'LOSS' ? 'خسارة' : s.result === 'PENDING' ? 'مفتوحة' : 'منتهية'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {signals.length === 0 && (
          <div className="text-center py-10 text-neutral-500 text-sm">لا توجد إشارات في هذه الفترة</div>
        )}
      </div>
    </div>
  )
}
