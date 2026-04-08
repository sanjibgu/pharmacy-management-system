import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import Button from '../components/Button'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../services/api'
import { getTenantSlug } from '../services/tenant'
import { clearDraft, loadDraft, makeDraftKey, saveDraft } from '../services/draftStorage'

type Category = {
  _id: string
  name: string
}

type Manufacturer = {
  _id: string
  name: string
  categoryIds?: string[]
  isActive?: boolean
  source?: 'local' | 'global'
}

type GlobalManufacturer = {
  _id: string
  name: string
  categoryIds?: string[]
}

export default function ManufacturersPage() {
  const { token, user } = useAuth()
  const { tenantSlug } = useParams()
  const isLocalhost = window.location.hostname === 'localhost'
  const effectiveSlug = tenantSlug || (isLocalhost ? getTenantSlug() : null)
  const base = effectiveSlug ? `/${effectiveSlug}` : ''

  const canManage = user?.role === 'PharmacyAdmin' || Boolean(user?.moduleAccess?.medicines?.manage)

  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<Manufacturer[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [filterCategoryId, setFilterCategoryId] = useState('')
  const [filterSource, setFilterSource] = useState<'all' | 'local' | 'global'>('all')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')
  const [sortKey, setSortKey] = useState<'name' | 'categories' | 'isActive'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [pageSize, setPageSize] = useState<5 | 10 | 20>(10)
  const [page, setPage] = useState(1)

  const [name, setName] = useState('')
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [globalMatches, setGlobalMatches] = useState<GlobalManufacturer[]>([])
  const [checkingGlobal, setCheckingGlobal] = useState(false)
  const [enablingGlobal, setEnablingGlobal] = useState(false)

  const [editing, setEditing] = useState<Manufacturer | null>(null)
  const [editName, setEditName] = useState('')
  const [editCategoryIds, setEditCategoryIds] = useState<string[]>([])

  const draftKey = useMemo(
    () => makeDraftKey({ kind: 'manufacturerDraft', tenantSlug: effectiveSlug || getTenantSlug(), userId: user?.id }),
    [effectiveSlug, user?.id],
  )
  const [draftRestored, setDraftRestored] = useState(false)

  function isDraftEmpty(d: any) {
    if (!d) return true
    if (String(d.name || '').trim()) return false
    const ids = Array.isArray(d.categoryIds) ? d.categoryIds : []
    return ids.length === 0
  }

  useEffect(() => {
    if (!draftKey) return
    const draft = loadDraft<any>(draftKey)
    if (!draft || isDraftEmpty(draft)) return
    const currentEmpty = isDraftEmpty({ name, categoryIds })
    if (!currentEmpty) return
    setName(String(draft.name || ''))
    setCategoryIds(Array.isArray(draft.categoryIds) ? draft.categoryIds : [])
    setDraftRestored(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey])

  useEffect(() => {
    if (!draftKey) return
    if (!token || !user?.id) return
    if (!canManage) return

    const t = window.setTimeout(() => {
      const payload = { v: 1, updatedAt: Date.now(), name, categoryIds }
      if (isDraftEmpty(payload)) clearDraft(draftKey)
      else saveDraft(draftKey, payload)
    }, 800)
    return () => window.clearTimeout(t)
  }, [draftKey, token, user?.id, canManage, name, categoryIds])

  const categoriesById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of categories) m.set(c._id, c.name)
    return m
  }, [categories])

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const [cats, mans] = await Promise.all([
        apiFetch<{ items: Category[] }>('/api/categories', { token }),
        apiFetch<{ items: Manufacturer[] }>('/api/manufacturers?includeInactive=1', { token }),
      ])
      setCategories(cats.items || [])
      setItems(mans.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load manufacturers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const categoryOptions = useMemo(() => categories.slice().sort((a, b) => a.name.localeCompare(b.name)), [categories])

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase()

    const list = items.filter((m) => {
      if (filterSource !== 'all' && m.source !== filterSource) return false
      if (filterActive === 'active' && m.isActive === false) return false
      if (filterActive === 'inactive' && m.isActive !== false) return false
      if (filterCategoryId && !(m.categoryIds || []).includes(filterCategoryId)) return false

      if (!q) return true
      const cats = (m.categoryIds || []).map((id) => categoriesById.get(id) || '').join(' ')
      return `${m.name} ${cats}`.toLowerCase().includes(q)
    })

    const dir = sortDir === 'asc' ? 1 : -1
    const getStr = (v: unknown) => String(v ?? '').toLowerCase()
    const catStr = (m: Manufacturer) =>
      (m.categoryIds || []).map((id) => categoriesById.get(id) || id).join(', ')

    return list.slice().sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return dir * getStr(a.name).localeCompare(getStr(b.name))
        case 'categories':
          return dir * getStr(catStr(a)).localeCompare(getStr(catStr(b)))
        case 'isActive': {
          const av = a.isActive === false ? 0 : 1
          const bv = b.isActive === false ? 0 : 1
          return dir * (av - bv)
        }
        default:
          return 0
      }
    })
  }, [items, searchText, categoriesById, filterCategoryId, filterSource, filterActive, sortKey, sortDir])

  useEffect(() => {
    setPage(1)
  }, [searchText, filterCategoryId, filterSource, filterActive, sortKey, sortDir])

  const paged = useMemo(() => {
    const total = filtered.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const safePage = Math.min(page, totalPages)
    const start = (safePage - 1) * pageSize
    return {
      total,
      totalPages,
      page: safePage,
      start,
      end: Math.min(total, start + pageSize),
      items: filtered.slice(start, start + pageSize),
    }
  }, [filtered, pageSize, page])

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

  async function create(e: FormEvent) {
    e.preventDefault()
    if (!canManage) return
    if (!categoryIds.length) {
      setError('Select at least one category')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await apiFetch('/api/manufacturers', {
        method: 'POST',
        token,
        body: { name, categoryIds },
      })
      setName('')
      setCategoryIds([])
      clearDraft(draftKey)
      setDraftRestored(false)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create manufacturer')
    } finally {
      setSaving(false)
    }
  }

  async function checkGlobal() {
    const q = name.trim()
    if (!token) return
    if (q.length < 2) {
      setGlobalMatches([])
      return
    }
    setCheckingGlobal(true)
    try {
      const qs = new URLSearchParams({ q }).toString()
      const res = await apiFetch<{ items: GlobalManufacturer[] }>(`/api/global/manufacturers/suggest?${qs}`, {
        token,
      })
      setGlobalMatches(res.items || [])
    } catch {
      setGlobalMatches([])
    } finally {
      setCheckingGlobal(false)
    }
  }

  async function enableGlobalManufacturer(globalManufacturerId: string) {
    if (!token) return
    setError(null)
    setEnablingGlobal(true)
    try {
      await apiFetch(`/api/global/manufacturers/${globalManufacturerId}/enable`, { method: 'POST', token })
      setName('')
      setCategoryIds([])
      setGlobalMatches([])
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable global manufacturer')
    } finally {
      setEnablingGlobal(false)
    }
  }

  function startEdit(m: Manufacturer) {
    if (!canManage) return
    if (m.source === 'global') {
      alert('This is a Global manufacturer. You can only Activate/Deactivate it for your pharmacy.')
      return
    }
    if (!window.confirm(`Edit manufacturer?\n\n${m.name}`)) return
    setEditing(m)
    setEditName(m.name || '')
    setEditCategoryIds((m.categoryIds || []) as string[])
  }

  async function saveEdit() {
    if (!editing) return
    setError(null)
    setSaving(true)
    try {
      if (!editCategoryIds.length) {
        setError('Select at least one category')
        return
      }
      if (!window.confirm('Save changes?')) return
      await apiFetch(`/api/manufacturers/${editing._id}`, {
        method: 'PATCH',
        token,
        body: { name: editName, categoryIds: editCategoryIds },
      })
      setEditing(null)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update manufacturer')
    } finally {
      setSaving(false)
    }
  }

  async function remove(m: Manufacturer) {
    if (!canManage) return
    if (m.source === 'global') {
      alert('Global manufacturer cannot be deleted from pharmacy. You can deactivate it instead.')
      return
    }
    if (!window.confirm(`Delete manufacturer?\n\n${m.name}`)) return
    setError(null)
    setSaving(true)
    try {
      await apiFetch(`/api/manufacturers/${m._id}`, { method: 'DELETE', token })
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete manufacturer')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(m: Manufacturer) {
    if (!canManage) return
    const next = m.isActive === false
    const ok = window.confirm(`${next ? 'Activate' : 'Deactivate'} manufacturer?\n\n${m.name}`)
    if (!ok) return
    setError(null)
    setSaving(true)
    try {
      const path =
        m.source === 'global' ? `/api/manufacturers/global/${m._id}` : `/api/manufacturers/${m._id}`

      const res = await apiFetch<{ item: Manufacturer }>(path, {
        method: 'PATCH',
        token,
        body: { isActive: next },
      })
      const updated = res?.item
      if (updated?._id) {
        setItems((prev) => prev.map((x) => (x._id === updated._id ? { ...x, ...updated } : x)))
      } else {
        await loadAll()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update manufacturer status')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader />
      <main className="py-4">
        <div className="mx-auto w-full px-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Manufacturer Management</h1>
            </div>
            <Link className="text-sm text-slate-300 hover:text-slate-100" to={`${base}/dashboard`}>
              Back to dashboard
            </Link>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl bg-rose-500/10 p-3 text-sm text-rose-200 ring-1 ring-inset ring-rose-400/20">
              {error}
            </div>
          ) : null}

          {draftRestored ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-sky-500/10 p-3 text-sm text-sky-200 ring-1 ring-inset ring-sky-400/20">
              <div>Draft restored (auto-saved).</div>
              <button
                type="button"
                className="rounded-xl bg-white/5 px-3 py-2 text-xs ring-1 ring-inset ring-white/10 hover:bg-white/10"
                onClick={() => {
                  clearDraft(draftKey)
                  setDraftRestored(false)
                  setName('')
                  setCategoryIds([])
                }}
              >
                Discard
              </button>
            </div>
          ) : null}

          {canManage ? (
            <form onSubmit={create} className="mt-4 rounded-3xl bg-white/5 p-4 ring-1 ring-inset ring-white/10">
              <div className="text-sm font-semibold">Add manufacturer</div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-slate-300">
                    Manufacturer name <span className="text-rose-400">*</span>
                  </span>
                  <input
                    className="h-10 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => void checkGlobal()}
                    required
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-slate-300">Categories (multi-select)</span>
                  <select
                    className="h-40 rounded-xl bg-slate-950/40 px-3 py-2 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                    multiple
                    value={categoryIds}
                    onChange={(e) => {
                      const vals = Array.from(e.target.selectedOptions).map((o) => o.value)
                      setCategoryIds(vals)
                    }}
                  >
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const ok = window.confirm('Reset the form and clear any auto-saved draft?')
                    if (!ok) return
                    clearDraft(draftKey)
                    setDraftRestored(false)
                    setName('')
                    setCategoryIds([])
                  }}
                  disabled={saving}
                >
                  Reset
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Create'}
                </Button>
              </div>

              {checkingGlobal ? (
                <div className="mt-3 text-xs text-slate-400">Checking global list...</div>
              ) : globalMatches.length ? (
                <div className="mt-3 rounded-2xl bg-slate-950/40 p-3 ring-1 ring-inset ring-white/10">
                  <div className="text-xs font-semibold text-slate-200">Already available in Global list</div>
                  <div className="mt-2 grid gap-2">
                    {globalMatches.slice(0, 5).map((g) => (
                      <div
                        key={g._id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-black/20 px-3 py-2 ring-1 ring-inset ring-white/10"
                      >
                        <div className="text-sm text-slate-200">{g.name}</div>
                        <Button
                          type="button"
                          onClick={() => void enableGlobalManufacturer(g._id)}
                          disabled={enablingGlobal}
                        >
                          {enablingGlobal ? 'Enabling...' : 'Enable in my pharmacy'}
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-slate-400">Enable global manufacturer to avoid duplicates.</div>
                </div>
              ) : null}
            </form>
          ) : null}

          <div className="mt-4 rounded-3xl bg-white/5 p-4 ring-1 ring-inset ring-white/10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm font-semibold">List</div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
                <input
                  className="h-10 w-full rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 sm:w-80"
                  placeholder="Search manufacturers..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
                <select
                  className="h-10 w-full rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10 sm:w-52"
                  value={filterCategoryId}
                  onChange={(e) => setFilterCategoryId(e.target.value)}
                >
                  <option value="">All categories</option>
                  {categoryOptions.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  className="h-10 w-full rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10 sm:w-36"
                  value={filterSource}
                  onChange={(e) => setFilterSource(e.target.value as typeof filterSource)}
                >
                  <option value="all">All</option>
                  <option value="local">Local</option>
                  <option value="global">Global</option>
                </select>
                <select
                  className="h-10 w-full rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10 sm:w-36"
                  value={filterActive}
                  onChange={(e) => setFilterActive(e.target.value as typeof filterActive)}
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <label className="flex items-center justify-between gap-2 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10 sm:h-10 sm:w-40">
                  <span className="text-xs text-slate-400">Show</span>
                  <select
                    className="h-9 bg-transparent text-sm text-slate-200 outline-none"
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value) as 5 | 10 | 20)}
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                  </select>
                </label>
              </div>
            </div>
            {loading ? (
              <div className="mt-4 text-sm text-slate-400">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="mt-4 text-sm text-slate-400">No manufacturers yet.</div>
            ) : (
              <>
                <div className="mt-4 space-y-3 md:hidden">
                  {paged.items.map((m) => (
                    <div
                      key={m._id}
                      className={`rounded-2xl bg-slate-950/40 p-4 ring-1 ring-inset ring-white/10 ${m.isActive === false ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-100">{m.name}</div>
                          <div className="mt-0.5 text-xs text-slate-400">
                            {(m.categoryIds || []).length
                              ? (m.categoryIds || []).map((id) => categoriesById.get(id) || id).join(', ')
                              : '-'}
                          </div>
                        </div>
                        <div className="text-right text-xs text-slate-400">
                          Active <span className="text-slate-100">{m.isActive === false ? 'No' : 'Yes'}</span>
                        </div>
                      </div>

                      {canManage ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={
                              m.isActive === false
                                ? 'rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200 ring-1 ring-inset ring-emerald-400/20 hover:bg-emerald-500/15'
                                : 'rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-200 ring-1 ring-inset ring-rose-400/20 hover:bg-rose-500/15'
                            }
                            onClick={() => void toggleActive(m)}
                            disabled={saving}
                            title="Activate/Deactivate"
                          >
                            {m.isActive === false ? 'Activate' : 'Deactivate'}
                          </button>
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
                            onClick={() => void remove(m)}
                          >
                            Delete
                          </button>
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
                        <button type="button" className="hover:text-slate-200" onClick={() => toggleSort('name')}>
                          Name{sortIndicator('name')}
                        </button>
                      </th>
                      <th className="py-2 pr-4">
                        <button type="button" className="hover:text-slate-200" onClick={() => toggleSort('categories')}>
                          Categories{sortIndicator('categories')}
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
                  {paged.items.map((m) => (
                      <tr
                        key={m._id}
                        className={`border-t border-white/10 ${m.isActive === false ? 'opacity-60' : ''}`}
                      >
                        <td className="py-3 pr-4">{m.name}</td>
                        <td className="py-3 pr-4">
                          {(m.categoryIds || []).length
                            ? (m.categoryIds || []).map((id) => categoriesById.get(id) || id).join(', ')
                            : '-'}
                        </td>
                        <td className="py-3 pr-4">
                          {m.isActive === false ? 'No' : 'Yes'}
                        </td>
                        {canManage ? (
                          <td className="py-3 pr-4">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className={
                                  m.isActive === false
                                    ? 'rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200 ring-1 ring-inset ring-emerald-400/20 hover:bg-emerald-500/15'
                                    : 'rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-200 ring-1 ring-inset ring-rose-400/20 hover:bg-rose-500/15'
                                }
                                onClick={() => void toggleActive(m)}
                                disabled={saving}
                                title="Activate/Deactivate"
                              >
                                {m.isActive === false ? 'Activate' : 'Deactivate'}
                              </button>
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
                                onClick={() => void remove(m)}
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

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <div>
                    Showing <span className="text-slate-200">{paged.total ? paged.start + 1 : 0}</span>â€“
                    <span className="text-slate-200">{paged.end}</span> of{' '}
                    <span className="text-slate-200">{paged.total}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={paged.page <= 1 || saving}
                    >
                      Prev
                    </Button>
                    <div>
                      Page <span className="text-slate-200">{paged.page}</span> /{' '}
                      <span className="text-slate-200">{paged.totalPages}</span>
                    </div>
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => setPage((p) => Math.min(paged.totalPages, p + 1))}
                      disabled={paged.page >= paged.totalPages || saving}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>

          {editing ? (
            <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
              <div className="w-full max-w-2xl rounded-3xl bg-slate-950 p-4 ring-1 ring-inset ring-white/10">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">Edit manufacturer</div>
                  <button type="button" className="text-sm text-slate-300 hover:text-slate-100" onClick={() => setEditing(null)}>
                    Close
                  </button>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-xs font-medium text-slate-300">
                      Manufacturer name <span className="text-rose-400">*</span>
                    </span>
                    <input
                      className="h-10 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs font-medium text-slate-300">Categories (multi-select)</span>
                    <select
                      className="h-40 rounded-xl bg-slate-950/40 px-3 py-2 text-sm ring-1 ring-inset ring-white/10"
                      multiple
                      value={editCategoryIds}
                      onChange={(e) => setEditCategoryIds(Array.from(e.target.selectedOptions).map((o) => o.value))}
                    >
                      {categories.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button onClick={() => void saveEdit()} disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
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
