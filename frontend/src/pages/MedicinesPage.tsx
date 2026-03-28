import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import Button from '../components/Button'
import Container from '../components/Container'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../services/api'
import { getTenantSlug } from '../services/tenant'

type Medicine = {
  _id: string
  medicineName: string
  manufacturer: string
  dosageForm: string
  category: string
  rackLocation: string
  hsnCode: string
  gstPercent: number
  unitsPerStrip: number
  allowLooseSale: boolean
}

type Category = {
  _id: string
  name: string
}

export default function MedicinesPage() {
  const { token, user } = useAuth()
  const { tenantSlug } = useParams()
  const isLocalhost = window.location.hostname === 'localhost'
  const effectiveSlug = tenantSlug || (isLocalhost ? getTenantSlug() : null)
  const base = effectiveSlug ? `/${effectiveSlug}` : ''
  const canManage = user?.role === 'PharmacyAdmin' || Boolean(user?.moduleAccess?.medicines?.manage)

  const [items, setItems] = useState<Medicine[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [categories, setCategories] = useState<Category[]>([])

  const [medicineName, setMedicineName] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [category, setCategory] = useState('')
  const [rackLocation, setRackLocation] = useState('')
  const [hsnCode, setHsnCode] = useState('')
  const [gstPercent, setGstPercent] = useState(0)
  const [unitsPerStrip, setUnitsPerStrip] = useState(10)
  const [allowLooseSale, setAllowLooseSale] = useState(false)

  const [editing, setEditing] = useState<Medicine | null>(null)
  const [editForm, setEditForm] = useState({
    medicineName: '',
    manufacturer: '',
    dosageForm: '',
    category: '',
    rackLocation: '',
    hsnCode: '',
    gstPercent: 0,
    unitsPerStrip: 10,
    allowLooseSale: false,
  })
  const [savingEdit, setSavingEdit] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch<{ items: Medicine[] }>('/api/medicines', { token })
      setItems(res.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load medicines')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    void (async () => {
      try {
        const res = await apiFetch<{ items: Category[] }>('/api/categories', { token })
        setCategories(res.items || [])
      } catch {
        setCategories([])
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function addMedicine(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await apiFetch('/api/medicines', {
        method: 'POST',
        token,
        body: {
          medicineName,
          manufacturer,
          dosageForm: category,
          category,
          rackLocation,
          hsnCode,
          gstPercent,
          unitsPerStrip,
          allowLooseSale,
        },
      })
      setMedicineName('')
      setManufacturer('')
      setCategory('')
      setRackLocation('')
      setHsnCode('')
      setGstPercent(0)
      setUnitsPerStrip(10)
      setAllowLooseSale(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create medicine')
    }
  }

  async function getUsage(id: string) {
    return apiFetch<{ purchaseItems: number; stockBatches: number }>(`/api/medicines/${id}/usage`, {
      token,
    })
  }

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase()
    if (!q) return items
    return items.filter((m) => {
      const hay =
        `${m.medicineName} ${m.manufacturer || ''} ${m.category || ''} ${m.rackLocation || ''} ${m.hsnCode || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [items, searchText])

  function startEdit(m: Medicine) {
    const ok = window.confirm(`Edit medicine?\n\n${m.medicineName}`)
    if (!ok) return
    setEditing(m)
    setEditForm({
      medicineName: m.medicineName || '',
      manufacturer: m.manufacturer || '',
      dosageForm: m.dosageForm || m.category || '',
      category: m.dosageForm || m.category || '',
      rackLocation: m.rackLocation || '',
      hsnCode: m.hsnCode || '',
      gstPercent: Number(m.gstPercent || 0),
      unitsPerStrip: Number(m.unitsPerStrip || 10),
      allowLooseSale: Boolean(m.allowLooseSale),
    })
  }

  async function saveEdit() {
    if (!editing) return
    setError(null)
    setSavingEdit(true)
    try {
      const usage = await getUsage(editing._id)
      let cascade = false
      if (usage.purchaseItems > 0) {
        cascade = window.confirm(
          'This medicine is already used in purchases.\n\nOK = Update existing purchase items (HSN/GST) also\nCancel = Apply changes only for new purchases',
        )
      }

      const ok = window.confirm('Save changes to this medicine?')
      if (!ok) return

      await apiFetch(`/api/medicines/${editing._id}?cascade=${cascade ? '1' : '0'}`, {
        method: 'PATCH',
        token,
        body: {
          ...editForm,
          dosageForm: editForm.dosageForm,
          category: editForm.dosageForm,
        },
      })

      setEditing(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update medicine')
    } finally {
      setSavingEdit(false)
    }
  }

  async function deleteMedicine(m: Medicine) {
    setError(null)
    try {
      const usage = await getUsage(m._id)
      const ok =
        usage.purchaseItems > 0 || usage.stockBatches > 0
          ? window.confirm(
              `You have already added this medicine in purchase/stock.\nPurchase items: ${usage.purchaseItems}\nStock batches: ${usage.stockBatches}\n\nDo you still want to delete?`,
            )
          : window.confirm(`Delete medicine?\n\n${m.medicineName}`)
      if (!ok) return
      await apiFetch(`/api/medicines/${m._id}`, { method: 'DELETE', token })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete medicine')
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader />
      <main className="py-12">
        <Container>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Medicines</h1>
              <p className="mt-1 text-sm text-slate-400">
                Tenant-scoped data (pharmacyId enforced). Role: {user?.role}
              </p>
            </div>
            <Link className="text-sm text-slate-300 hover:text-slate-100" to={`${base}/dashboard`}>
              Back to dashboard
            </Link>
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl bg-rose-500/10 p-4 text-sm text-rose-200 ring-1 ring-inset ring-rose-400/20">
              {error}
            </div>
          ) : null}

          {canManage ? (
            <form
              onSubmit={addMedicine}
              className="mt-6 rounded-3xl bg-white/5 p-6 ring-1 ring-inset ring-white/10"
            >
              <div className="text-sm font-semibold">Add medicine</div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-slate-300">
                    Medicine name <span className="text-rose-400">*</span>
                  </span>
                  <input
                    className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                    value={medicineName}
                    onChange={(e) => setMedicineName(e.target.value)}
                    required
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-slate-300">
                    Manufacturer <span className="text-rose-400">*</span>
                  </span>
                  <input
                    className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                    required
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-slate-300">
                    Category <span className="text-rose-400">*</span>
                  </span>
                  <select
                    className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    required
                  >
                    <option value="">Select category</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-slate-300">Rack location</span>
                  <input
                    className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                    value={rackLocation}
                    onChange={(e) => setRackLocation(e.target.value)}
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-slate-300">
                    HSN code <span className="text-rose-400">*</span>
                  </span>
                  <input
                    className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                    value={hsnCode}
                    onChange={(e) => setHsnCode(e.target.value)}
                    required
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-slate-300">
                    GST % <span className="text-rose-400">*</span>
                  </span>
                  <input
                    className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                    type="number"
                    min={0}
                    value={gstPercent}
                    onChange={(e) => setGstPercent(Number(e.target.value))}
                    required
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-slate-300">
                    Units per strip <span className="text-rose-400">*</span>
                  </span>
                  <input
                    className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                    type="number"
                    min={1}
                    value={unitsPerStrip}
                    onChange={(e) => setUnitsPerStrip(Number(e.target.value))}
                    required
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-slate-300">Loose sale</span>
                  <label className="flex h-11 items-center gap-3 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-sky-400"
                      checked={allowLooseSale}
                      onChange={(e) => setAllowLooseSale(e.target.checked)}
                    />
                    <span className="text-slate-200">Allow</span>
                  </label>
                </label>
              </div>
              <div className="mt-4 flex justify-end">
                <Button type="submit">Create</Button>
              </div>
            </form>
          ) : null}

          <div className="mt-6 rounded-3xl bg-white/5 p-6 ring-1 ring-inset ring-white/10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm font-semibold">List</div>
              <input
                className="h-10 w-full rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 sm:w-80"
                placeholder="Search medicines..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
            {loading ? (
              <div className="mt-4 text-sm text-slate-400">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="mt-4 text-sm text-slate-400">No medicines yet.</div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Manufacturer</th>
                      <th className="py-2 pr-4">Category</th>
                      <th className="py-2 pr-4">Rack</th>
                      <th className="py-2 pr-4">HSN</th>
                      <th className="py-2 pr-4">GST%</th>
                      <th className="py-2 pr-4">Units/Strip</th>
                      <th className="py-2 pr-4">Loose</th>
                      {canManage ? <th className="py-2 pr-4">Actions</th> : null}
                    </tr>
                  </thead>
                  <tbody className="text-slate-200">
                    {filtered.map((m) => (
                      <tr key={m._id} className="border-t border-white/10">
                        <td className="py-3 pr-4">{m.medicineName}</td>
                        <td className="py-3 pr-4">{m.manufacturer || '-'}</td>
                        <td className="py-3 pr-4">{m.category || '-'}</td>
                        <td className="py-3 pr-4">{m.rackLocation || '-'}</td>
                        <td className="py-3 pr-4">{m.hsnCode || '-'}</td>
                        <td className="py-3 pr-4">{m.gstPercent ?? 0}</td>
                        <td className="py-3 pr-4">{m.unitsPerStrip ?? 10}</td>
                        <td className="py-3 pr-4">{m.allowLooseSale ? 'Yes' : 'No'}</td>
                        {canManage ? (
                          <td className="py-3 pr-4">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className="rounded-xl bg-white/5 px-3 py-2 text-xs ring-1 ring-inset ring-white/10 hover:bg-white/10"
                                onClick={() => startEdit(m)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-200 ring-1 ring-inset ring-rose-400/20 hover:bg-rose-500/15"
                                onClick={() => void deleteMedicine(m)}
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
            )}
          </div>

          {editing ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-xl rounded-3xl bg-slate-950 p-6 ring-1 ring-inset ring-white/10">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm font-semibold">Edit medicine</div>
                  <button
                    type="button"
                    className="text-sm text-slate-300 hover:text-slate-100"
                    onClick={() => setEditing(null)}
                  >
                    Close
                  </button>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-slate-300">
                      Medicine name <span className="text-rose-400">*</span>
                    </span>
                    <input
                      className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10"
                      value={editForm.medicineName}
                      onChange={(e) => setEditForm((f) => ({ ...f, medicineName: e.target.value }))}
                      required
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-slate-300">
                      Manufacturer <span className="text-rose-400">*</span>
                    </span>
                    <input
                      className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10"
                      value={editForm.manufacturer}
                      onChange={(e) => setEditForm((f) => ({ ...f, manufacturer: e.target.value }))}
                      required
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-slate-300">
                      Category <span className="text-rose-400">*</span>
                    </span>
                    <select
                      className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10"
                      value={editForm.dosageForm}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, dosageForm: e.target.value, category: e.target.value }))
                      }
                      required
                    >
                      <option value="">Select category</option>
                      {categories.map((c) => (
                        <option key={c._id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-slate-300">Rack location</span>
                    <input
                      className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10"
                      value={editForm.rackLocation}
                      onChange={(e) => setEditForm((f) => ({ ...f, rackLocation: e.target.value }))}
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-slate-300">
                      HSN code <span className="text-rose-400">*</span>
                    </span>
                    <input
                      className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10"
                      value={editForm.hsnCode}
                      onChange={(e) => setEditForm((f) => ({ ...f, hsnCode: e.target.value }))}
                      required
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-slate-300">
                      GST % <span className="text-rose-400">*</span>
                    </span>
                    <input
                      className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10"
                      type="number"
                      min={0}
                      value={editForm.gstPercent}
                      onChange={(e) => setEditForm((f) => ({ ...f, gstPercent: Number(e.target.value) }))}
                      required
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-slate-300">
                      Units per strip <span className="text-rose-400">*</span>
                    </span>
                    <input
                      className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10"
                      type="number"
                      min={1}
                      value={editForm.unitsPerStrip}
                      onChange={(e) => setEditForm((f) => ({ ...f, unitsPerStrip: Number(e.target.value) }))}
                      required
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-slate-300">Loose sale</span>
                    <label className="flex h-11 items-center gap-3 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-sky-400"
                        checked={editForm.allowLooseSale}
                        onChange={(e) => setEditForm((f) => ({ ...f, allowLooseSale: e.target.checked }))}
                      />
                      <span className="text-slate-200">Allow</span>
                    </label>
                  </label>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                  <Button onClick={() => void saveEdit()} disabled={savingEdit}>
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
