import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import Button from '../components/Button'
import Container from '../components/Container'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../context/AuthContext'
import { getTenantSlug } from '../services/tenant'
import {
  createDistributor,
  deleteDistributor,
  listDistributors,
  updateDistributor,
  type Distributor,
} from '../services/distributorService'

export default function DistributorsPage() {
  const { token, user } = useAuth()
  const { tenantSlug } = useParams()
  const isLocalhost = window.location.hostname === 'localhost'
  const effectiveSlug = tenantSlug || (isLocalhost ? getTenantSlug() : null)
  const base = effectiveSlug ? `/${effectiveSlug}` : ''

  const canManage = user?.role === 'PharmacyAdmin' || Boolean(user?.moduleAccess?.purchases?.manage)
  const canView = user?.role === 'PharmacyAdmin' || Boolean(user?.moduleAccess?.purchases?.view)

  const [items, setItems] = useState<Distributor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')

  const [supplierName, setSupplierName] = useState('')
  const [dlNumber, setDlNumber] = useState('')
  const [address, setAddress] = useState('')

  const [editing, setEditing] = useState<Distributor | null>(null)
  const [editForm, setEditForm] = useState({ supplierName: '', dlNumber: '', address: '' })
  const [savingEdit, setSavingEdit] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await listDistributors(token)
      setItems(res.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load distributors')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!canView) return
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView])

  async function addDistributor(e: FormEvent) {
    e.preventDefault()
    if (!canManage) return
    setError(null)
    try {
      await createDistributor(token, { supplierName, dlNumber, address })
      setSupplierName('')
      setDlNumber('')
      setAddress('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create distributor')
    }
  }

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase()
    if (!q) return items
    return items.filter((d) => {
      const hay = `${d.supplierName} ${d.dlNumber || ''} ${d.address || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [items, searchText])

  function startEdit(d: Distributor) {
    const ok = window.confirm(`Edit distributor?\n\n${d.supplierName}`)
    if (!ok) return
    setEditing(d)
    setEditForm({
      supplierName: d.supplierName || '',
      dlNumber: d.dlNumber || '',
      address: d.address || '',
    })
  }

  async function saveEdit() {
    if (!editing) return
    if (!canManage) return
    const ok = window.confirm('Save changes?')
    if (!ok) return
    setError(null)
    setSavingEdit(true)
    try {
      await updateDistributor(token, editing._id, editForm)
      setEditing(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update distributor')
    } finally {
      setSavingEdit(false)
    }
  }

  async function removeDistributor(d: Distributor) {
    if (!canManage) return
    const ok = window.confirm(`Delete distributor?\n\n${d.supplierName}`)
    if (!ok) return
    setError(null)
    try {
      await deleteDistributor(token, d._id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete distributor')
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader />
      <main className="py-10">
        <Container>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Distributor Management</h1>
              <div className="mt-1 text-sm text-slate-400">Add, edit, and delete distributors.</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                className="rounded-full bg-transparent px-4 py-2 text-sm text-slate-300 ring-1 ring-inset ring-white/10 hover:bg-white/5"
                to={`${base}/purchases`}
              >
                Back to Purchase
              </Link>
            </div>
          </div>

          {!canView ? (
            <div className="mt-6 rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-100 ring-1 ring-inset ring-amber-400/20">
              Module access denied.
            </div>
          ) : null}

          {error ? (
            <div className="mt-6 rounded-2xl bg-rose-500/10 p-4 text-sm text-rose-200 ring-1 ring-inset ring-rose-400/20">
              {error}
            </div>
          ) : null}

          {canView ? (
            <div className="mt-6 grid gap-6">
              <form
                onSubmit={addDistributor}
                className="rounded-3xl bg-white/5 p-6 ring-1 ring-inset ring-white/10"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm font-semibold">Add Distributor</div>
                  {!canManage ? (
                    <div className="text-xs text-amber-200">Only PharmacyAdmin can manage distributors.</div>
                  ) : null}
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-slate-300">Distributor name</span>
                    <input
                      className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10"
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      required
                      disabled={!canManage}
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-slate-300">DL No</span>
                    <input
                      className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10"
                      value={dlNumber}
                      onChange={(e) => setDlNumber(e.target.value)}
                      required
                      disabled={!canManage}
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-slate-300">Address</span>
                    <input
                      className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      required
                      disabled={!canManage}
                    />
                  </label>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button type="submit" disabled={!canManage}>
                    Add Distributor
                  </Button>
                </div>
              </form>

              <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-inset ring-white/10">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="text-sm font-semibold">Distributors</div>
                  <input
                    className="h-10 w-full rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 md:w-80"
                    placeholder="Search distributor..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                  />
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="py-2 pr-3">Name</th>
                        <th className="py-2 pr-3">DL No</th>
                        <th className="py-2 pr-3">Address</th>
                        <th className="py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {loading ? (
                        <tr>
                          <td className="py-4 text-slate-400" colSpan={4}>
                            Loading...
                          </td>
                        </tr>
                      ) : filtered.length ? (
                        filtered.map((d) => (
                          <tr key={d._id} className="align-top">
                            <td className="py-3 pr-3 font-medium text-slate-100">{d.supplierName}</td>
                            <td className="py-3 pr-3 text-slate-200">{d.dlNumber || '-'}</td>
                            <td className="py-3 pr-3 text-slate-200">{d.address || '-'}</td>
                            <td className="py-3 text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="secondary"
                                  onClick={() => startEdit(d)}
                                  disabled={!canManage}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="danger"
                                  onClick={() => void removeDistributor(d)}
                                  disabled={!canManage}
                                >
                                  Delete
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="py-4 text-slate-400" colSpan={4}>
                            No distributors found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          {editing ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-lg rounded-3xl bg-slate-950 p-6 ring-1 ring-inset ring-white/10">
                <div className="text-lg font-semibold">Edit Distributor</div>
                <div className="mt-4 grid gap-3">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-slate-300">Distributor name</span>
                    <input
                      className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10"
                      value={editForm.supplierName}
                      onChange={(e) => setEditForm((f) => ({ ...f, supplierName: e.target.value }))}
                      required
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-slate-300">DL No</span>
                    <input
                      className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10"
                      value={editForm.dlNumber}
                      onChange={(e) => setEditForm((f) => ({ ...f, dlNumber: e.target.value }))}
                      required
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-slate-300">Address</span>
                    <input
                      className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10"
                      value={editForm.address}
                      onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                      required
                    />
                  </label>
                </div>

                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setEditing(null)} disabled={savingEdit}>
                    Cancel
                  </Button>
                  <Button onClick={() => void saveEdit()} disabled={!canManage || savingEdit}>
                    {savingEdit ? 'Saving…' : 'Save'}
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

