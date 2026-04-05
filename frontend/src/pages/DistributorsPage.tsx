import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import Button from '../components/Button'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../context/AuthContext'
import { getTenantSlug } from '../services/tenant'
import {
  createDistributor,
  deleteDistributor,
  listDistributorsAll,
  setDistributorActive,
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
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')
  const [sortKey, setSortKey] = useState<'supplierName' | 'dlNumber' | 'address' | 'isActive'>('supplierName')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

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
      const res = await listDistributorsAll(token)
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
    const list = items.filter((d) => {
      if (filterActive === 'active' && d.isActive === false) return false
      if (filterActive === 'inactive' && d.isActive !== false) return false
      if (!q) return true
      const hay = `${d.supplierName} ${d.dlNumber || ''} ${d.address || ''}`.toLowerCase()
      return hay.includes(q)
    })

    const dir = sortDir === 'asc' ? 1 : -1
    const getStr = (v: unknown) => String(v ?? '').toLowerCase()

    return list.slice().sort((a, b) => {
      switch (sortKey) {
        case 'supplierName':
          return dir * getStr(a.supplierName).localeCompare(getStr(b.supplierName))
        case 'dlNumber':
          return dir * getStr(a.dlNumber).localeCompare(getStr(b.dlNumber))
        case 'address':
          return dir * getStr(a.address).localeCompare(getStr(b.address))
        case 'isActive': {
          const av = a.isActive === false ? 0 : 1
          const bv = b.isActive === false ? 0 : 1
          return dir * (av - bv)
        }
        default:
          return 0
      }
    })
  }, [items, searchText, filterActive, sortKey, sortDir])

  function toggleSort(next: typeof sortKey) {
    setSortKey((cur) => {
      if (cur !== next) {
        setSortDir('asc')
        return next
      }
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return cur
    })
  }

  function sortIndicator(key: typeof sortKey) {
    if (sortKey !== key) return ''
    return sortDir === 'asc' ? ' ▲' : ' ▼'
  }

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

  async function toggleActive(d: Distributor) {
    if (!canManage) return
    const next = d.isActive === false
    const ok = window.confirm(`${next ? 'Activate' : 'Deactivate'} distributor?\n\n${d.supplierName}`)
    if (!ok) return
    setError(null)
    try {
      await setDistributorActive(token, d._id, next)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update distributor status')
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader />
      <main className="py-4">
        <div className="mx-auto w-full px-4 sm:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Distributor Management</h1>
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
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-slate-300">Distributor name</span>
                    <input
                      className="h-10 md:h-11 rounded-xl bg-slate-950/40 px-3 md:px-4 text-sm ring-1 ring-inset ring-white/10"
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      required
                      disabled={!canManage}
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-slate-300">DL No</span>
                    <input
                      className="h-10 md:h-11 rounded-xl bg-slate-950/40 px-3 md:px-4 text-sm ring-1 ring-inset ring-white/10"
                      value={dlNumber}
                      onChange={(e) => setDlNumber(e.target.value)}
                      required
                      disabled={!canManage}
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-slate-300">Address</span>
                    <input
                      className="h-10 md:h-11 rounded-xl bg-slate-950/40 px-3 md:px-4 text-sm ring-1 ring-inset ring-white/10"
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

              <div className="rounded-3xl bg-white/5 p-4 ring-1 ring-inset ring-white/10">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm font-semibold">List</div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
                    <input
                      className="h-10 w-full rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 sm:w-80"
                      placeholder="Search distributor..."
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                    />
                    <select
                      className="h-10 w-full rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10 sm:w-40"
                      value={filterActive}
                      onChange={(e) => setFilterActive(e.target.value as typeof filterActive)}
                    >
                      <option value="all">All</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                {loading ? (
                  <div className="mt-4 text-sm text-slate-400">Loading...</div>
                ) : filtered.length === 0 ? (
                  <div className="mt-4 text-sm text-slate-400">No distributors found.</div>
                ) : (
                  <>
                    <div className="mt-4 space-y-3 lg:hidden">
                      {filtered.map((d) => (
                        <div
                          key={d._id}
                          className={`rounded-2xl bg-slate-950/40 p-4 ring-1 ring-inset ring-white/10 ${d.isActive === false ? 'opacity-60' : ''}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-slate-100">{d.supplierName}</div>
                              <div className="mt-0.5 truncate text-xs text-slate-400">{d.dlNumber ? `DL ${d.dlNumber}` : 'DL -'}</div>
                              <div className="mt-0.5 truncate text-xs text-slate-400">{d.address || '-'}</div>
                            </div>
                            <div className="text-right text-xs text-slate-400">
                              Active <span className="text-slate-100">{d.isActive === false ? 'No' : 'Yes'}</span>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              className={
                                d.isActive === false
                                  ? 'rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200 ring-1 ring-inset ring-emerald-400/20 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60'
                                  : 'rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-200 ring-1 ring-inset ring-rose-400/20 hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-60'
                              }
                              onClick={() => void toggleActive(d)}
                              disabled={!canManage}
                              title="Activate/Deactivate"
                            >
                              {d.isActive === false ? 'Activate' : 'Deactivate'}
                            </button>
                            <button
                              type="button"
                              className="rounded-xl bg-white/5 px-3 py-2 text-xs ring-1 ring-inset ring-white/10 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={() => startEdit(d)}
                              disabled={!canManage}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-200 ring-1 ring-inset ring-rose-400/20 hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={() => void removeDistributor(d)}
                              disabled={!canManage}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 hidden overflow-x-auto lg:block">
                      <table className="w-full text-left text-sm">
                        <thead className="text-xs uppercase tracking-wide text-slate-400">
                          <tr>
                            <th className="py-2 pr-4">
                              <button
                                type="button"
                                className="hover:text-slate-200"
                                onClick={() => toggleSort('supplierName')}
                              >
                                Name{sortIndicator('supplierName')}
                              </button>
                            </th>
                            <th className="py-2 pr-4">
                              <button
                                type="button"
                                className="hover:text-slate-200"
                                onClick={() => toggleSort('dlNumber')}
                              >
                                DL No{sortIndicator('dlNumber')}
                              </button>
                            </th>
                            <th className="py-2 pr-4">
                              <button
                                type="button"
                                className="hover:text-slate-200"
                                onClick={() => toggleSort('address')}
                              >
                                Address{sortIndicator('address')}
                              </button>
                            </th>
                            <th className="py-2 pr-4">
                              <button
                                type="button"
                                className="hover:text-slate-200"
                                onClick={() => toggleSort('isActive')}
                              >
                                Active{sortIndicator('isActive')}
                              </button>
                            </th>
                            {canManage ? <th className="py-2 pr-4 text-right">Actions</th> : null}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                          {filtered.map((d) => (
                            <tr key={d._id} className={`align-top ${d.isActive === false ? 'opacity-60' : ''}`}>
                              <td className="py-3 pr-4 font-medium text-slate-100">{d.supplierName}</td>
                              <td className="py-3 pr-4 text-slate-200">{d.dlNumber || '-'}</td>
                              <td className="py-3 pr-4 text-slate-200">{d.address || '-'}</td>
                              <td className="py-3 pr-4 text-slate-200">{d.isActive === false ? 'No' : 'Yes'}</td>
                              {canManage ? (
                                <td className="py-3 pr-4 text-right">
                                  <div className="flex flex-wrap justify-end gap-2">
                                    <button
                                      type="button"
                                      className={
                                        d.isActive === false
                                          ? 'rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200 ring-1 ring-inset ring-emerald-400/20 hover:bg-emerald-500/15'
                                          : 'rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-200 ring-1 ring-inset ring-rose-400/20 hover:bg-rose-500/15'
                                      }
                                      onClick={() => void toggleActive(d)}
                                      title="Activate/Deactivate"
                                    >
                                      {d.isActive === false ? 'Activate' : 'Deactivate'}
                                    </button>
                                    <button
                                      type="button"
                                      className="rounded-xl bg-white/5 px-3 py-2 text-xs ring-1 ring-inset ring-white/10 hover:bg-white/10"
                                      onClick={() => startEdit(d)}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-200 ring-1 ring-inset ring-rose-400/20 hover:bg-rose-500/15"
                                      onClick={() => void removeDistributor(d)}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              ) : null}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
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
        </div>
      </main>
    </div>
  )
}
