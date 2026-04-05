import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import Button from '../components/Button'
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
  isActive?: boolean
  source?: 'local' | 'global'
  customFields?: Record<string, unknown>
}

type CategoryField = {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'boolean' | 'date'
  required?: boolean
  options?: string[]
  min?: number
  max?: number
}

type Category = {
  _id: string
  name: string
  fields?: CategoryField[]
  looseSaleAllowed?: boolean
}

type ManufacturerOption = {
  _id: string
  name: string
  categoryIds?: string[]
}

type GlobalItem = {
  _id: string
  medicineName: string
  manufacturer: string
  category: string
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
  const [filterCategory, setFilterCategory] = useState('')
  const [filterManufacturer, setFilterManufacturer] = useState('')
  const [sortKey, setSortKey] = useState<
    | 'medicineName'
    | 'manufacturer'
    | 'category'
    | 'rackLocation'
    | 'hsnCode'
    | 'gstPercent'
    | 'allowLooseSale'
    | 'isActive'
  >('medicineName')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [categories, setCategories] = useState<Category[]>([])
  const [manufacturerOptions, setManufacturerOptions] = useState<ManufacturerOption[]>([])
  const [globalMatches, setGlobalMatches] = useState<GlobalItem[]>([])
  const [checkingGlobal, setCheckingGlobal] = useState(false)
  const [enablingGlobal, setEnablingGlobal] = useState(false)

  const [medicineName, setMedicineName] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [category, setCategory] = useState('')
  const [rackLocation, setRackLocation] = useState('')
  const [hsnCode, setHsnCode] = useState('')
  const [gstPercent, setGstPercent] = useState(0)
  const [allowLooseSale, setAllowLooseSale] = useState(false)
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({})

  const [showManufacturerModal, setShowManufacturerModal] = useState(false)
  const [manufacturerModalMode, setManufacturerModalMode] = useState<'add' | 'edit'>('add')
  const [newManufacturerName, setNewManufacturerName] = useState('')
  const [newManufacturerCategoryIds, setNewManufacturerCategoryIds] = useState<string[]>([])
  const [savingManufacturer, setSavingManufacturer] = useState(false)
  const [manufacturerModalError, setManufacturerModalError] = useState<string | null>(null)

  const [editing, setEditing] = useState<Medicine | null>(null)
  const [editForm, setEditForm] = useState({
    medicineName: '',
    manufacturer: '',
    dosageForm: '',
    category: '',
    rackLocation: '',
    hsnCode: '',
    gstPercent: 0,
    allowLooseSale: false,
  })
  const [savingEdit, setSavingEdit] = useState(false)
  const [editCustomFields, setEditCustomFields] = useState<Record<string, unknown>>({})

  const selectedCategory = useMemo(() => categories.find((c) => c.name === category), [categories, category])
  const selectedEditCategory = useMemo(
    () => categories.find((c) => c.name === (editForm.dosageForm || editForm.category)),
    [categories, editForm.category, editForm.dosageForm],
  )

  async function loadManufacturersForCategory(categoryId?: string) {
    if (!token) return
    try {
      const q = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : ''
      const res = await apiFetch<{ items: ManufacturerOption[] }>(`/api/manufacturers${q}`, { token })
      setManufacturerOptions(res.items || [])
    } catch {
      setManufacturerOptions([])
    }
  }

  async function checkGlobal() {
    const q = medicineName.trim()
    if (!token) return
    if (!selectedCategory?._id) {
      setGlobalMatches([])
      return
    }
    if (q.length < 2) {
      setGlobalMatches([])
      return
    }

    setCheckingGlobal(true)
    try {
      const qs = new URLSearchParams({
        q,
        category: category,
        ...(manufacturer ? { manufacturer } : {}),
      }).toString()
      const res = await apiFetch<{ items: GlobalItem[] }>(`/api/global/items/suggest?${qs}`, { token })
      setGlobalMatches(res.items || [])
    } catch {
      setGlobalMatches([])
    } finally {
      setCheckingGlobal(false)
    }
  }

  async function enableGlobalItem(globalItemId: string) {
    if (!token) return
    setEnablingGlobal(true)
    setError(null)
    try {
      await apiFetch(`/api/global/items/${globalItemId}/enable`, { method: 'POST', token })
      setMedicineName('')
      setManufacturer('')
      setCategory('')
      setRackLocation('')
      setHsnCode('')
      setGstPercent(0)
      setAllowLooseSale(false)
      setCustomFields({})
      setGlobalMatches([])
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable global item')
    } finally {
      setEnablingGlobal(false)
    }
  }

  function dateInputValue(v: unknown) {
    if (!v) return ''
    const d = v instanceof Date ? v : new Date(String(v))
    if (Number.isNaN(d.getTime())) return ''
    return d.toISOString().slice(0, 10)
  }

  function renderCustomFieldInput(
    field: CategoryField,
    value: unknown,
    onChange: (v: unknown) => void,
    idPrefix: string,
  ) {
    const baseClass =
      'h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400'

    if (field.type === 'select') {
      return (
        <select
          id={`${idPrefix}_${field.key}`}
          className={baseClass}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          required={Boolean(field.required)}
        >
          <option value="">Select</option>
          {(field.options || []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )
    }

    if (field.type === 'boolean') {
      return (
        <label className="flex h-11 items-center gap-3 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10">
          <input
            id={`${idPrefix}_${field.key}`}
            type="checkbox"
            className="h-4 w-4 accent-sky-400"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="text-slate-200">Yes</span>
        </label>
      )
    }

    if (field.type === 'number') {
      return (
        <input
          id={`${idPrefix}_${field.key}`}
          className={baseClass}
          type="number"
          value={value === undefined || value === null ? '' : String(value)}
          min={typeof field.min === 'number' ? field.min : undefined}
          max={typeof field.max === 'number' ? field.max : undefined}
          onChange={(e) => onChange(e.target.value)}
          required={Boolean(field.required)}
        />
      )
    }

    if (field.type === 'date') {
      return (
        <input
          id={`${idPrefix}_${field.key}`}
          className={baseClass}
          type="date"
          value={dateInputValue(value)}
          onChange={(e) => onChange(e.target.value)}
          required={Boolean(field.required)}
        />
      )
    }

    return (
      <input
        id={`${idPrefix}_${field.key}`}
        className={baseClass}
        value={typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value)}
        required={Boolean(field.required)}
      />
    )
  }

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch<{ items: Medicine[] }>('/api/medicines?includeInactive=1', { token })
      setItems(res.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load items')
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

  useEffect(() => {
    // load manufacturers for selected category (tenant-scoped)
    void loadManufacturersForCategory(selectedCategory?._id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory?._id, token])

  async function addMedicine(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const looseAllowed = Boolean(selectedCategory?.looseSaleAllowed)
      await apiFetch('/api/medicines', {
        method: 'POST',
        token,
        body: {
          medicineName,
          manufacturer,
          dosageForm: '',
          category,
          rackLocation,
          hsnCode,
          gstPercent,
          allowLooseSale: looseAllowed ? allowLooseSale : false,
          customFields,
        },
      })
      setMedicineName('')
      setManufacturer('')
      setCategory('')
      setRackLocation('')
      setHsnCode('')
      setGstPercent(0)
      setAllowLooseSale(false)
      setCustomFields({})
      setManufacturerOptions([])
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create item')
    }
  }

  async function getUsage(id: string) {
    return apiFetch<{ purchaseItems: number; stockBatches: number }>(`/api/medicines/${id}/usage`, {
      token,
    })
  }

  const categoryFilterOptions = useMemo(() => {
    const names = new Set<string>()
    for (const c of categories) names.add(c.name)
    for (const i of items) if (i.category) names.add(i.category)
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [categories, items])

  const manufacturerFilterOptions = useMemo(() => {
    const names = new Set<string>()
    for (const i of items) if (i.manufacturer) names.add(i.manufacturer)
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [items])

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase()
    const list = items.filter((m) => {
      if (filterCategory && String(m.category || '') !== filterCategory) return false
      if (filterManufacturer && String(m.manufacturer || '') !== filterManufacturer) return false

      const hay =
        `${m.medicineName} ${m.manufacturer || ''} ${m.category || ''} ${m.rackLocation || ''} ${m.hsnCode || ''}`.toLowerCase()
      if (!q) return true
      return hay.includes(q)
    })

    const dir = sortDir === 'asc' ? 1 : -1
    const getStr = (v: unknown) => String(v ?? '').toLowerCase()
    const getNum = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0)
    const getBool = (v: unknown) => (v ? 1 : 0)

    return list.slice().sort((a, b) => {
      switch (sortKey) {
        case 'medicineName':
          return dir * getStr(a.medicineName).localeCompare(getStr(b.medicineName))
        case 'manufacturer':
          return dir * getStr(a.manufacturer).localeCompare(getStr(b.manufacturer))
        case 'category':
          return dir * getStr(a.category).localeCompare(getStr(b.category))
        case 'rackLocation':
          return dir * getStr(a.rackLocation).localeCompare(getStr(b.rackLocation))
        case 'hsnCode':
          return dir * getStr(a.hsnCode).localeCompare(getStr(b.hsnCode))
        case 'gstPercent':
          return dir * (getNum(a.gstPercent) - getNum(b.gstPercent))
        case 'allowLooseSale':
          return dir * (getBool(a.allowLooseSale) - getBool(b.allowLooseSale))
        case 'isActive':
          return dir * (getBool(a.isActive !== false) - getBool(b.isActive !== false))
        default:
          return 0
      }
    })
  }, [items, searchText, filterCategory, filterManufacturer, sortKey, sortDir])

  function toggleSort(nextKey: typeof sortKey) {
    setSortKey((cur) => {
      if (cur !== nextKey) {
        setSortDir('asc')
        return nextKey
      }
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return cur
    })
  }

  function sortIndicator(key: typeof sortKey) {
    if (sortKey !== key) return ''
    return sortDir === 'asc' ? ' ▲' : ' ▼'
  }

  function startEdit(m: Medicine) {
    if (m.source === 'global') {
      alert('This is a Global item. You can only Activate/Deactivate it for your pharmacy.')
      return
    }
    const ok = window.confirm(`Edit item?\n\n${m.medicineName}`)
    if (!ok) return
    setEditing(m)
    setEditCustomFields(m.customFields || {})
    void loadManufacturersForCategory(
      categories.find((c) => c.name === (m.dosageForm || m.category || ''))?._id,
    )
    setEditForm({
      medicineName: m.medicineName || '',
      manufacturer: m.manufacturer || '',
      dosageForm: m.dosageForm || m.category || '',
      category: m.dosageForm || m.category || '',
      rackLocation: m.rackLocation || '',
      hsnCode: m.hsnCode || '',
      gstPercent: Number(m.gstPercent || 0),
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
          'This item is already used in purchases.\n\nOK = Update existing purchase items (HSN/GST) also\nCancel = Apply changes only for new purchases',
        )
      }

      const ok = window.confirm('Save changes to this item?')
      if (!ok) return

      const looseAllowed = Boolean(selectedEditCategory?.looseSaleAllowed)
      await apiFetch(`/api/medicines/${editing._id}?cascade=${cascade ? '1' : '0'}`, {
        method: 'PATCH',
        token,
        body: {
          ...editForm,
          dosageForm: editForm.dosageForm,
          category: editForm.dosageForm,
          allowLooseSale: looseAllowed ? editForm.allowLooseSale : false,
          customFields: editCustomFields,
        },
      })

      setEditing(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item')
    } finally {
      setSavingEdit(false)
    }
  }

  async function deleteMedicine(m: Medicine) {
    if (m.source === 'global') {
      alert('Global item cannot be deleted from pharmacy. You can deactivate it instead.')
      return
    }
    setError(null)
    try {
      const usage = await getUsage(m._id)
      const ok =
        usage.purchaseItems > 0 || usage.stockBatches > 0
          ? window.confirm(
              `You have already added this item in purchase/stock.\nPurchase items: ${usage.purchaseItems}\nStock batches: ${usage.stockBatches}\n\nDo you still want to delete?`,
            )
          : window.confirm(`Delete item?\n\n${m.medicineName}`)
      if (!ok) return
      await apiFetch(`/api/medicines/${m._id}`, { method: 'DELETE', token })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item')
    }
  }

  async function toggleActive(m: Medicine) {
    if (!canManage) return
    const next = m.isActive === false
    const ok = window.confirm(`${next ? 'Activate' : 'Deactivate'} item?\n\n${m.medicineName}`)
    if (!ok) return
    setError(null)
    try {
      const path = m.source === 'global' ? `/api/medicines/global/${m._id}` : `/api/medicines/${m._id}`
      await apiFetch(path, {
        method: 'PATCH',
        token,
        body: { isActive: next },
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item status')
    }
  }

  function openManufacturerModal(mode: 'add' | 'edit') {
    setManufacturerModalMode(mode)
    const categoryId = mode === 'edit' ? selectedEditCategory?._id : selectedCategory?._id
    const preset = categoryId ? [categoryId] : []
    setNewManufacturerName('')
    setNewManufacturerCategoryIds(preset)
    setManufacturerModalError(null)
    setShowManufacturerModal(true)
  }

  async function createManufacturerFromModal(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    if (!canManage) return
    setManufacturerModalError(null)
    setSavingManufacturer(true)
    try {
      await apiFetch('/api/manufacturers', {
        method: 'POST',
        token,
        body: { name: newManufacturerName, categoryIds: newManufacturerCategoryIds },
      })
      const createdName = newManufacturerName.trim()
      const categoryId = manufacturerModalMode === 'edit' ? selectedEditCategory?._id : selectedCategory?._id
      await loadManufacturersForCategory(categoryId)
      if (manufacturerModalMode === 'edit') setEditForm((f) => ({ ...f, manufacturer: createdName }))
      else setManufacturer(createdName)
      setShowManufacturerModal(false)
    } catch (err) {
      setManufacturerModalError(err instanceof Error ? err.message : 'Failed to create manufacturer')
    } finally {
      setSavingManufacturer(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader />
      <main className="py-4">
        <div className="mx-auto w-full px-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Item Management</h1>
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
              <div className="text-sm font-semibold">Add item</div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-slate-300">
                    Category <span className="text-rose-400">*</span>
                  </span>
                  <select
                    className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                    value={category}
                    onChange={(e) => {
                      const next = e.target.value
                      setCategory(next)
                      setManufacturer('')
                      setCustomFields({})
                      const cat = categories.find((c) => c.name === next)
                      if (!cat?.looseSaleAllowed) setAllowLooseSale(false)
                    }}
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
                  <span className="text-xs font-medium text-slate-300">
                    Item name <span className="text-rose-400">*</span>
                  </span>
                  <input
                    className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                    value={medicineName}
                    onChange={(e) => setMedicineName(e.target.value)}
                    onBlur={() => void checkGlobal()}
                    required
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-slate-300">
                    Manufacturer <span className="text-rose-400">*</span>{' '}
                    <button type="button" className="text-sky-300 hover:text-sky-200" onClick={() => openManufacturerModal('add')}>
                      + Add
                    </button>
                  </span>
                  <select
                    className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                    required
                    disabled={!selectedCategory?._id}
                  >
                    <option value="">{selectedCategory?._id ? 'Select manufacturer' : 'Select category first'}</option>
                    {manufacturerOptions.map((m) => (
                      <option key={m._id} value={m.name}>
                        {m.name}
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

                {selectedCategory?._id ? (
                  <div className="md:col-span-3">
                    {checkingGlobal ? (
                      <div className="text-xs text-slate-400">Checking global list...</div>
                    ) : globalMatches.length ? (
                      <div className="rounded-2xl bg-slate-950/40 p-4 ring-1 ring-inset ring-white/10">
                        <div className="text-xs font-semibold text-slate-200">Already available in Global list</div>
                        <div className="mt-2 grid gap-2">
                          {globalMatches.slice(0, 5).map((g) => (
                            <div
                              key={g._id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-black/20 px-3 py-2 ring-1 ring-inset ring-white/10"
                            >
                              <div className="text-sm text-slate-200">
                                {g.medicineName}{' '}
                                <span className="text-xs text-slate-400">• {g.manufacturer}</span>
                              </div>
                              <Button
                                type="button"
                                onClick={() => void enableGlobalItem(g._id)}
                                disabled={enablingGlobal}
                              >
                                {enablingGlobal ? 'Enabling...' : 'Enable in my pharmacy'}
                              </Button>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 text-xs text-slate-400">Enable global item to avoid duplicates.</div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {selectedCategory?.looseSaleAllowed ? (
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
                ) : null}

                {selectedCategory?.fields?.length ? (
                  <>
                    <div className="md:col-span-3 mt-2 text-xs font-semibold text-slate-300">Category fields</div>
                    {selectedCategory.fields.map((f) => (
                      <label key={f.key} className="grid gap-1.5">
                        <span className="text-xs font-medium text-slate-300">
                          {f.label} {f.required ? <span className="text-rose-400">*</span> : null}
                        </span>
                        {renderCustomFieldInput(
                          f,
                          customFields[f.key],
                          (v) => setCustomFields((p) => ({ ...p, [f.key]: v })),
                          'add_cf',
                        )}
                      </label>
                    ))}
                  </>
                ) : null}
              </div>
              <div className="mt-4 flex justify-end">
                <Button type="submit">Create</Button>
              </div>
            </form>
          ) : null}

          <div className="mt-6 rounded-3xl bg-white/5 p-6 ring-1 ring-inset ring-white/10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm font-semibold">List</div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
                <input
                  className="h-10 w-full rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 sm:w-80"
                  placeholder="Search items..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
                <select
                  className="h-10 w-full rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10 sm:w-52"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  <option value="">All categories</option>
                  {categoryFilterOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select
                  className="h-10 w-full rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10 sm:w-60"
                  value={filterManufacturer}
                  onChange={(e) => setFilterManufacturer(e.target.value)}
                >
                  <option value="">All manufacturers</option>
                  {manufacturerFilterOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {loading ? (
              <div className="mt-4 text-sm text-slate-400">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="mt-4 text-sm text-slate-400">No items yet.</div>
            ) : (
              <>
                <div className="mt-4 space-y-3 md:hidden">
                  {filtered.map((m) => (
                    <div
                      key={m._id}
                      className={`rounded-2xl bg-slate-950/40 p-4 ring-1 ring-inset ring-white/10 ${m.isActive === false ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-100">{m.medicineName}</div>
                          <div className="mt-0.5 truncate text-xs text-slate-400">
                            {(m.manufacturer || '-') + (m.category ? ` - ${m.category}` : '')}
                          </div>
                        </div>
                        <div className="text-right text-xs text-slate-400">
                          Active <span className="text-slate-100">{m.isActive === false ? 'No' : 'Yes'}</span>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-black/20 p-2 ring-1 ring-inset ring-white/10">
                          <div className="text-slate-500">Rack</div>
                          <div className="mt-0.5 truncate text-slate-200">{m.rackLocation || '-'}</div>
                        </div>
                        <div className="rounded-xl bg-black/20 p-2 ring-1 ring-inset ring-white/10">
                          <div className="text-slate-500">GST%</div>
                          <div className="mt-0.5 tabular-nums text-slate-200">{m.gstPercent ?? 0}</div>
                        </div>
                        <div className="rounded-xl bg-black/20 p-2 ring-1 ring-inset ring-white/10">
                          <div className="text-slate-500">HSN</div>
                          <div className="mt-0.5 truncate text-slate-200">{m.hsnCode || '-'}</div>
                        </div>
                        <div className="rounded-xl bg-black/20 p-2 ring-1 ring-inset ring-white/10">
                          <div className="text-slate-500">Loose</div>
                          <div className="mt-0.5 text-slate-200">{m.allowLooseSale ? 'Yes' : 'No'}</div>
                        </div>
                      </div>

                      {canManage ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-xl bg-sky-500/10 px-3 py-2 text-xs text-sky-200 ring-1 ring-inset ring-sky-400/20 hover:bg-sky-500/15"
                            onClick={() => void toggleActive(m)}
                          >
                            {m.isActive === false ? 'Activate' : 'Deactivate'}
                          </button>
                          {m.source !== 'global' ? (
                            <>
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
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="mt-4 hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="py-2 pr-4">
                        <button type="button" className="hover:text-slate-200" onClick={() => toggleSort('medicineName')}>
                          Name{sortIndicator('medicineName')}
                        </button>
                      </th>
                      <th className="py-2 pr-4">
                        <button type="button" className="hover:text-slate-200" onClick={() => toggleSort('manufacturer')}>
                          Manufacturer{sortIndicator('manufacturer')}
                        </button>
                      </th>
                      <th className="py-2 pr-4">
                        <button type="button" className="hover:text-slate-200" onClick={() => toggleSort('category')}>
                          Category{sortIndicator('category')}
                        </button>
                      </th>
                      <th className="py-2 pr-4">
                        <button type="button" className="hover:text-slate-200" onClick={() => toggleSort('rackLocation')}>
                          Rack{sortIndicator('rackLocation')}
                        </button>
                      </th>
                      <th className="py-2 pr-4">
                        <button type="button" className="hover:text-slate-200" onClick={() => toggleSort('hsnCode')}>
                          HSN{sortIndicator('hsnCode')}
                        </button>
                      </th>
                      <th className="py-2 pr-4">
                        <button type="button" className="hover:text-slate-200" onClick={() => toggleSort('gstPercent')}>
                          GST%{sortIndicator('gstPercent')}
                        </button>
                      </th>
                      <th className="py-2 pr-4">
                        <button type="button" className="hover:text-slate-200" onClick={() => toggleSort('allowLooseSale')}>
                          Loose{sortIndicator('allowLooseSale')}
                        </button>
                      </th>
                      <th className="py-2 pr-4">
                        <button type="button" className="hover:text-slate-200" onClick={() => toggleSort('isActive')}>
                          Active{sortIndicator('isActive')}
                        </button>
                      </th>
                      {canManage ? <th className="py-2 pr-4">Actions</th> : null}
                    </tr>
                  </thead>
                  <tbody className="text-slate-200">
                    {filtered.map((m) => (
                      <tr
                        key={m._id}
                        className={`border-t border-white/10 ${m.isActive === false ? 'opacity-60' : ''}`}
                      >
                        <td className="py-3 pr-4">{m.medicineName}</td>
                        <td className="py-3 pr-4">{m.manufacturer || '-'}</td>
                        <td className="py-3 pr-4">{m.category || '-'}</td>
                        <td className="py-3 pr-4">{m.rackLocation || '-'}</td>
                        <td className="py-3 pr-4">{m.hsnCode || '-'}</td>
                        <td className="py-3 pr-4">{m.gstPercent ?? 0}</td>
                        <td className="py-3 pr-4">{m.allowLooseSale ? 'Yes' : 'No'}</td>
                        <td className="py-3 pr-4">{m.isActive === false ? 'No' : 'Yes'}</td>
                        {canManage ? (
                          <td className="py-3 pr-4">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className="rounded-xl bg-sky-500/10 px-3 py-2 text-xs text-sky-200 ring-1 ring-inset ring-sky-400/20 hover:bg-sky-500/15"
                                onClick={() => void toggleActive(m)}
                              >
                                {m.isActive === false ? 'Activate' : 'Deactivate'}
                              </button>
                              {m.source !== 'global' ? (
                                <>
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
                                </>
                              ) : null}
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

          {editing ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-xl rounded-3xl bg-slate-950 p-6 ring-1 ring-inset ring-white/10">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm font-semibold">Edit item</div>
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
                      Category <span className="text-rose-400">*</span>
                    </span>
                    <select
                      className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10"
                      value={editForm.dosageForm}
                      onChange={(e) => {
                        const next = e.target.value
                        setEditForm((f) => ({ ...f, dosageForm: next, category: next, allowLooseSale: false, manufacturer: '' }))
                        setEditCustomFields({})
                        void loadManufacturersForCategory(categories.find((c) => c.name === next)?._id)
                      }}
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
                    <span className="text-xs font-medium text-slate-300">
                      Item name <span className="text-rose-400">*</span>
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
                      Manufacturer <span className="text-rose-400">*</span>{' '}
                      <button type="button" className="text-sky-300 hover:text-sky-200" onClick={() => openManufacturerModal('edit')}>
                        + Add
                      </button>
                    </span>
                    <select
                      className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10"
                      value={editForm.manufacturer}
                      onChange={(e) => setEditForm((f) => ({ ...f, manufacturer: e.target.value }))}
                      required
                      disabled={!selectedEditCategory?._id}
                    >
                      <option value="">{selectedEditCategory?._id ? 'Select manufacturer' : 'Select category first'}</option>
                      {manufacturerOptions.map((m) => (
                        <option key={m._id} value={m.name}>
                          {m.name}
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
                  {selectedEditCategory?.looseSaleAllowed ? (
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
                  ) : null}

                  {selectedEditCategory?.fields?.length ? (
                    <>
                      <div className="md:col-span-3 mt-2 text-xs font-semibold text-slate-300">Category fields</div>
                      {selectedEditCategory.fields.map((f) => (
                        <label key={f.key} className="grid gap-1.5">
                          <span className="text-xs font-medium text-slate-300">
                            {f.label} {f.required ? <span className="text-rose-400">*</span> : null}
                          </span>
                          {renderCustomFieldInput(
                            f,
                            editCustomFields[f.key],
                            (v) => setEditCustomFields((p) => ({ ...p, [f.key]: v })),
                            'edit_cf',
                          )}
                        </label>
                      ))}
                    </>
                  ) : null}
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

          {showManufacturerModal ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setShowManufacturerModal(false)
              }}
            >
              <div className="w-full max-w-xl rounded-3xl bg-slate-950 p-4 ring-1 ring-inset ring-white/10">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm font-semibold">Add Manufacturer</div>
                  <button
                    type="button"
                    className="text-sm text-slate-300 hover:text-slate-100"
                    onClick={() => setShowManufacturerModal(false)}
                  >
                    Close
                  </button>
                </div>

                {manufacturerModalError ? (
                  <div className="mt-3 rounded-2xl bg-rose-500/10 p-3 text-sm text-rose-200 ring-1 ring-inset ring-rose-400/20">
                    {manufacturerModalError}
                  </div>
                ) : null}

                <form onSubmit={createManufacturerFromModal} className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-slate-300">
                      Manufacturer name <span className="text-rose-400">*</span>
                    </span>
                    <input
                      className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                      value={newManufacturerName}
                      onChange={(e) => setNewManufacturerName(e.target.value)}
                      required
                    />
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-slate-300">Categories (multi-select)</span>
                    <select
                      className="h-32 rounded-xl bg-slate-950/40 px-4 py-2 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                      multiple
                      value={newManufacturerCategoryIds}
                      onChange={(e) => {
                        const vals = Array.from(e.target.selectedOptions).map((o) => o.value)
                        setNewManufacturerCategoryIds(vals)
                      }}
                      required
                    >
                      {categories.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="md:col-span-2 flex justify-end gap-2">
                    <Button variant="secondary" type="button" onClick={() => setShowManufacturerModal(false)} disabled={savingManufacturer}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={savingManufacturer}>
                      {savingManufacturer ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  )
}
