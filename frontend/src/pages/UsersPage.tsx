import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/Button'
import Container from '../components/Container'
import SiteFooter from '../components/SiteFooter'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../context/AuthContext'
import {
  createUser,
  listModules,
  listUsers,
  updateUserModuleAccess,
  type ModuleAccess,
  type ModuleDef,
} from '../services/userService'

function accessFor(modules: ModuleDef[], preset: 'none' | 'viewAll' = 'none'): ModuleAccess {
  const out: ModuleAccess = {}
  for (const m of modules) {
    out[m.key] = { view: preset === 'viewAll', manage: false }
  }
  return out
}

export default function UsersPage() {
  const { token, user } = useAuth()
  const [modules, setModules] = useState<ModuleDef[]>([])
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const canManageUsers = Boolean(user?.moduleAccess?.users?.manage) || user?.role === 'PharmacyAdmin'

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'Staff' | 'PharmacyAdmin'>('Staff')
  const [moduleAccess, setModuleAccess] = useState<ModuleAccess>({})

  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editingAccess, setEditingAccess] = useState<ModuleAccess>({})

  async function load() {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const [mods, users] = await Promise.all([listModules(), listUsers(token)])
      setModules(mods.items)
      setItems(users.items)
      setModuleAccess((prev) => (Object.keys(prev).length ? prev : accessFor(mods.items, 'none')))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const invoiceLikeGuard = useMemo(() => {
    if (user?.role === 'SuperAdmin') return false
    return true
  }, [user?.role])

  if (!invoiceLikeGuard) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <SiteHeader />
        <main className="py-4">
          <Container>
            <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-inset ring-white/10">
              <div className="text-sm text-slate-300">This page is for tenant users only.</div>
            </div>
          </Container>
        </main>
        <SiteFooter />
      </div>
    )
  }

  function setAccessValue(key: string, action: 'view' | 'manage', val: boolean) {
    setModuleAccess((prev) => {
      const next = { ...prev, [key]: { ...(prev[key] || { view: false, manage: false }), [action]: val } }
      if (action === 'manage' && val) next[key].view = true
      return next
    })
  }

  function setEditingAccessValue(key: string, action: 'view' | 'manage', val: boolean) {
    setEditingAccess((prev) => {
      const next = { ...prev, [key]: { ...(prev[key] || { view: false, manage: false }), [action]: val } }
      if (action === 'manage' && val) next[key].view = true
      return next
    })
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    setError(null)
    try {
      await createUser(token, { name, email, phone: phone || undefined, password, role, moduleAccess })
      setName('')
      setEmail('')
      setPhone('')
      setPassword('')
      setRole('Staff')
      await load()
      alert('User created')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
    }
  }

  async function onSaveAccess(userId: string) {
    if (!token) return
    setError(null)
    try {
      await updateUserModuleAccess(token, userId, editingAccess)
      setEditingUserId(null)
      setEditingAccess({})
      await load()
      alert('Module access updated')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update access')
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader />
      <main className="py-4">
        <Container>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
              <p className="mt-1 text-sm text-slate-400">Create users and assign module access for your pharmacy.</p>
            </div>
            <Link className="text-sm text-slate-300 hover:text-slate-100" to="/dashboard">
              Back to dashboard
            </Link>
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl bg-rose-500/10 p-4 text-sm text-rose-200 ring-1 ring-inset ring-rose-400/20">
              {error}
            </div>
          ) : null}

          {canManageUsers ? (
            <form onSubmit={onCreate} className="mt-6 rounded-3xl bg-white/5 p-6 ring-1 ring-inset ring-white/10">
              <div className="text-sm font-semibold">Create user</div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <input
                  className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                  placeholder="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <input
                  className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                />
                <input
                  className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                  placeholder="Phone (optional)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <input
                  className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                  placeholder="Temp password (min 8 chars)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  required
                />
                <select
                  className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                >
                  <option value="Staff">Staff</option>
                  <option value="PharmacyAdmin">PharmacyAdmin</option>
                </select>
                <div className="flex items-center justify-end md:justify-start">
                  <Button type="submit">Create</Button>
                </div>
              </div>

              <div className="mt-6 rounded-2xl bg-slate-950/40 p-5 ring-1 ring-inset ring-white/10">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm font-semibold">Module access</div>
                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" onClick={() => setModuleAccess(accessFor(modules, 'viewAll'))}>
                      View all
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setModuleAccess(accessFor(modules, 'none'))}>
                      Clear
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {modules.map((m) => (
                    <div key={m.key} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3 ring-1 ring-inset ring-white/10">
                      <div className="text-sm text-slate-200">{m.label}</div>
                      <div className="flex items-center gap-4 text-xs text-slate-300">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={Boolean(moduleAccess[m.key]?.view)}
                            onChange={(e) => setAccessValue(m.key, 'view', e.target.checked)}
                          />
                          View
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={Boolean(moduleAccess[m.key]?.manage)}
                            onChange={(e) => setAccessValue(m.key, 'manage', e.target.checked)}
                          />
                          Manage
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </form>
          ) : (
            <div className="mt-6 rounded-3xl bg-white/5 p-6 ring-1 ring-inset ring-white/10">
              <div className="text-sm text-slate-300">
                You don’t have permission to manage users. Ask your PharmacyAdmin to grant `users:manage`.
              </div>
            </div>
          )}

          <div className="mt-6 rounded-3xl bg-white/5 p-6 ring-1 ring-inset ring-white/10">
            <div className="text-sm font-semibold">User list</div>
            {loading ? (
              <div className="mt-4 text-sm text-slate-400">Loading…</div>
            ) : items.length === 0 ? (
              <div className="mt-4 text-sm text-slate-400">No users yet.</div>
            ) : (
              <div className="mt-4 space-y-3">
                {items.map((u) => (
                  <div key={u._id} className="rounded-2xl bg-slate-950/40 p-5 ring-1 ring-inset ring-white/10">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="text-sm font-semibold">{u.name}</div>
                        <div className="mt-1 text-sm text-slate-400">
                          {u.email} • {u.role}
                        </div>
                      </div>
                      {canManageUsers ? (
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setEditingUserId(u._id)
                              setEditingAccess(u.moduleAccess || {})
                            }}
                          >
                            Edit access
                          </Button>
                        </div>
                      ) : null}
                    </div>

                    {editingUserId === u._id ? (
                      <div className="mt-4 rounded-2xl bg-white/5 p-4 ring-1 ring-inset ring-white/10">
                        <div className="text-sm font-semibold">Module access</div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          {modules.map((m) => (
                            <div key={m.key} className="flex items-center justify-between rounded-xl bg-slate-950/40 px-4 py-3 ring-1 ring-inset ring-white/10">
                              <div className="text-sm text-slate-200">{m.label}</div>
                              <div className="flex items-center gap-4 text-xs text-slate-300">
                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(editingAccess[m.key]?.view)}
                                    onChange={(e) => setEditingAccessValue(m.key, 'view', e.target.checked)}
                                  />
                                  View
                                </label>
                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(editingAccess[m.key]?.manage)}
                                    onChange={(e) => setEditingAccessValue(m.key, 'manage', e.target.checked)}
                                  />
                                  Manage
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                          <Button variant="secondary" onClick={() => setEditingUserId(null)}>
                            Cancel
                          </Button>
                          <Button onClick={() => onSaveAccess(u._id)}>Save</Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Container>
      </main>
      <SiteFooter />
    </div>
  )
}
