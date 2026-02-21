'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Plan {
  id: string
  name: string
  slug: string
  price: number
  currency: string
  interval: string
  paddle_price_id: string | null
  features: string[]
  is_active: boolean
  sort_order: number
}

interface User {
  id: string
  email: string
  name: string
  plan: string
  is_admin: boolean
  created_at: string
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<'plans' | 'users'>('plans')
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
      <div className="flex gap-2 mb-6">
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
      </div>

      {loading ? (
        <div className="text-center py-20 text-neutral-400">جاري التحميل...</div>
      ) : tab === 'plans' ? (
        <PlansTab
          plans={plans}
          editingPlan={editingPlan}
          setEditingPlan={setEditingPlan}
          savePlan={savePlan}
          deletePlan={deletePlan}
        />
      ) : (
        <UsersTab
          users={users}
          plans={plans}
          editingUser={editingUser}
          setEditingUser={setEditingUser}
          updateUserPlan={updateUserPlan}
          toggleAdmin={toggleAdmin}
        />
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
        <label className="text-sm text-neutral-400 mb-1 block">المميزات (سطر لكل ميزة)</label>
        <textarea
          value={featuresText}
          onChange={(e) => setFeaturesText(e.target.value)}
          rows={5}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
          placeholder="إشارات لحظية فورية&#10;جميع العملات (10+)&#10;تنبيهات صوتية"
        />
      </div>
      <div className="flex gap-2 mt-4">
        <button
          onClick={() => {
            const features = featuresText.split('\n').map((f) => f.trim()).filter(Boolean)
            onSave({ ...form, features })
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
  users, plans, editingUser, setEditingUser, updateUserPlan, toggleAdmin,
}: {
  users: User[]
  plans: Plan[]
  editingUser: User | null
  setEditingUser: (u: User | null) => void
  updateUserPlan: (id: string, plan: string) => void
  toggleAdmin: (id: string, isAdmin: boolean) => void
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
