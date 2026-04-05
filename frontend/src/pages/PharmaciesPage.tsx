import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/Button'
import Container from '../components/Container'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../services/api'

type Pharmacy = {
  _id: string
  pharmacyName: string
  ownerName: string
  email: string
  phone: string
  address: string
  status: 'pending' | 'approved' | 'rejected'
  slug?: string
  isActive?: boolean
  deactivationRemark?: string
  isDeleted?: boolean
  createdAt: string
}

export default function PharmaciesPage() {
  const { token } = useAuth()
  const [items, setItems] = useState<Pharmacy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [editing, setEditing] = useState<Pharmacy | null>(null)
  const [editForm, setEditForm] = useState({
    pharmacyName: '',
    ownerName: '',
    email: '',
    phone: '',
    address: '',
  })

  async function load() {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({
        ...(q.trim() ? { q: q.trim() } : {}),
        ...(includeDeleted ? { includeDeleted: '1' } : {}),
      }).toString()
      const res = await apiFetch<{ items: Pharmacy[] }>(`/api/superadmin/pharmacies${qs ? `?${qs}` : ''}`, {
        token,
        tenant: false,
      })
      setItems(res.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pharmacies')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeDeleted])

  const rows = useMemo(() => items, [items])

  function startEdit(p: Pharmacy) {
    setEditing(p)
    setEditForm({
      pharmacyName: p.pharmacyName || '',
      ownerName: p.ownerName || '',
      email: p.email || '',
      phone: p.phone || '',
      address: p.address || '',
    })
  }

  async function saveEdit() {
    if (!token || !editing) return
    setError(null)
    setBusyId(editing._id)
    try {
      if (!window.confirm('Save changes to this pharmacy?')) return
      await apiFetch(`/api/superadmin/pharmacies/${editing._id}`, {
        method: 'PATCH',
        token,
        tenant: false,
        body: {
          pharmacyName: editForm.pharmacyName,
          ownerName: editForm.ownerName,
          email: editForm.email,
          phone: editForm.phone,
          address: editForm.address,
        },
      })
      setEditing(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update pharmacy')
    } finally {
      setBusyId(null)
    }
  }

  async function toggleActive(p: Pharmacy) {
    if (!token) return
    if (p.status !== 'approved') {
      alert('Only approved pharmacies can be activated/deactivated.')
      return
    }
    const next = !(p.isActive !== false)
    let remark = ''
    if (!next) {
      remark = window.prompt('Deactivation remark (shown to users at login):', p.deactivationRemark || '') || ''
      if (remark.trim().length < 2) {
        alert('Remark is required to deactivate.')
        return
      }
    }
    setBusyId(p._id)
    setError(null)
    try {
      await apiFetch(`/api/superadmin/pharmacies/${p._id}/active`, {
        method: 'PATCH',
        token,
        tenant: false,
        body: { isActive: next, remark },
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setBusyId(null)
    }
  }

  async function resetPassword(p: Pharmacy) {
    if (!token) return
    if (!window.confirm(`Reset PharmacyAdmin password for ${p.pharmacyName}?`)) return
    const newPassword = window.prompt('Enter new password (min 8 chars):', '') || ''
    if (newPassword.trim().length < 8) {
      alert('Password must be at least 8 characters.')
      return
    }
    setBusyId(p._id)
    setError(null)
    try {
      await apiFetch(`/api/superadmin/pharmacies/${p._id}/reset-password`, {
        method: 'POST',
        token,
        tenant: false,
        body: { newPassword },
      })
      alert('Password updated.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password')
    } finally {
      setBusyId(null)
    }
  }

  async function remove(p: Pharmacy) {
    if (!token) return
    if (!window.confirm(`Delete pharmacy?\n\n${p.pharmacyName}\n\nThis will disable tenant access.`)) return
    setBusyId(p._id)
    setError(null)
    try {
      await apiFetch(`/api/superadmin/pharmacies/${p._id}`, { method: 'DELETE', token, tenant: false })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete pharmacy')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader />
      <main className="py-4">
        <Container>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Pharmacies</h1>
              <p className="mt-1 text-sm text-slate-400">SuperAdmin: edit, delete, reset password, activate/deactivate.</p>
            </div>
            <Link className="text-sm text-slate-300 hover:text-slate-100" to="/superadmin/pending">
              Back
            </Link>
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl bg-rose-500/10 p-4 text-sm text-rose-200 ring-1 ring-inset ring-rose-400/20">
              {error}
            </div>
          ) : null}

          <div className="mt-6 rounded-3xl bg-white/5 p-6 ring-1 ring-inset ring-white/10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm font-semibold">List</div>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  className="h-10 w-full rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 sm:w-80"
                  placeholder="Search..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void load()
                  }}
                />
                <Button variant="secondary" onClick={() => void load()}>
                  Search
                </Button>
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={includeDeleted}
                    onChange={(e) => setIncludeDeleted(e.target.checked)}
                    className="h-4 w-4 accent-sky-400"
                  />
                  Include deleted
                </label>
              </div>
            </div>

            {loading ? (
              <div className="mt-4 text-sm text-slate-400">Loading...</div>
            ) : rows.length === 0 ? (
              <div className="mt-4 text-sm text-slate-400">No pharmacies.</div>
            ) : (
              <>
                <div className="mt-4 space-y-3 md:hidden">
                  {rows.map((p) => (
                    <div key={p._id} className="rounded-2xl bg-slate-950/40 p-4 ring-1 ring-inset ring-white/10">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-100">{p.pharmacyName}</div>
                          <div className="mt-0.5 truncate text-xs text-slate-400">{p.ownerName}</div>
                          {p.isActive === false && p.deactivationRemark ? (
                            <div className="mt-1 text-xs text-rose-200">Remark: {p.deactivationRemark}</div>
                          ) : null}
                        </div>
                        <div className="text-right text-xs text-slate-400">
                          <div>
                            Status <span className="text-slate-100">{p.status}</span>
                          </div>
                          <div className="mt-0.5">
                            Active <span className="text-slate-100">{p.isActive === false ? 'No' : 'Yes'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-black/20 p-2 ring-1 ring-inset ring-white/10">
                          <div className="text-slate-500">Slug</div>
                          <div className="mt-0.5 truncate text-slate-200">{p.slug || '-'}</div>
                        </div>
                        <div className="rounded-xl bg-black/20 p-2 ring-1 ring-inset ring-white/10">
                          <div className="text-slate-500">Phone</div>
                          <div className="mt-0.5 truncate text-slate-200">{p.phone || '-'}</div>
                        </div>
                        <div className="rounded-xl bg-black/20 p-2 ring-1 ring-inset ring-white/10 col-span-2">
                          <div className="text-slate-500">Email</div>
                          <div className="mt-0.5 truncate text-slate-200">{p.email || '-'}</div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={() => startEdit(p)} disabled={busyId === p._id}>
                          Edit
                        </Button>
                        <Button variant="secondary" onClick={() => void toggleActive(p)} disabled={busyId === p._id}>
                          {p.isActive === false ? 'Activate' : 'Deactivate'}
                        </Button>
                        <Button variant="secondary" onClick={() => void resetPassword(p)} disabled={busyId === p._id}>
                          Reset Password
                        </Button>
                        <Button onClick={() => void remove(p)} disabled={busyId === p._id}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 hidden overflow-x-auto md:block">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="py-2 pr-4">Pharmacy</th>
                      <th className="py-2 pr-4">Slug</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Active</th>
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2 pr-4">Phone</th>
                      <th className="py-2 pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-200">
                    {rows.map((p) => (
                      <tr key={p._id} className="border-t border-white/10 align-top">
                        <td className="py-3 pr-4">
                          <div className="font-medium">{p.pharmacyName}</div>
                          <div className="text-xs text-slate-400">{p.ownerName}</div>
                          {p.isActive === false && p.deactivationRemark ? (
                            <div className="mt-1 text-xs text-rose-200">Remark: {p.deactivationRemark}</div>
                          ) : null}
                        </td>
                        <td className="py-3 pr-4">{p.slug || '-'}</td>
                        <td className="py-3 pr-4">{p.status}</td>
                        <td className="py-3 pr-4">{p.isActive === false ? 'No' : 'Yes'}</td>
                        <td className="py-3 pr-4">{p.email}</td>
                        <td className="py-3 pr-4">{p.phone}</td>
                        <td className="py-3 pr-4">
                          <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" onClick={() => startEdit(p)} disabled={busyId === p._id}>
                              Edit
                            </Button>
                            <Button variant="secondary" onClick={() => void toggleActive(p)} disabled={busyId === p._id}>
                              {p.isActive === false ? 'Activate' : 'Deactivate'}
                            </Button>
                            <Button variant="secondary" onClick={() => void resetPassword(p)} disabled={busyId === p._id}>
                              Reset Password
                            </Button>
                            <Button onClick={() => void remove(p)} disabled={busyId === p._id}>
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </>
            )}
          </div>

          {editing ? (
            <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
              <div className="w-full max-w-3xl rounded-3xl bg-slate-950 p-6 ring-1 ring-inset ring-white/10">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">Edit pharmacy</div>
                  <button type="button" className="text-sm text-slate-300 hover:text-slate-100" onClick={() => setEditing(null)}>
                    Close
                  </button>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-slate-300">Pharmacy name</span>
                    <input className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10" value={editForm.pharmacyName} onChange={(e) => setEditForm((f) => ({ ...f, pharmacyName: e.target.value }))} />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-slate-300">Owner name</span>
                    <input className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10" value={editForm.ownerName} onChange={(e) => setEditForm((f) => ({ ...f, ownerName: e.target.value }))} />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-slate-300">Email</span>
                    <input className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10" type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-slate-300">Phone</span>
                    <input className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
                  </label>
                  <label className="grid gap-1.5 md:col-span-2">
                    <span className="text-xs font-medium text-slate-300">Address</span>
                    <input className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10" value={editForm.address} onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))} />
                  </label>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setEditing(null)} disabled={busyId === editing._id}>
                    Cancel
                  </Button>
                  <Button onClick={() => void saveEdit()} disabled={busyId === editing._id}>
                    Save
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </Container>
      </main>
    </div>
  )
}
