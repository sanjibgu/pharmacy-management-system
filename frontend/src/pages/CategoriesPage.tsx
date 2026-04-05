import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/Button'
import Container from '../components/Container'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../services/api'

type CategoryField = {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'boolean' | 'date'
  required?: boolean
  options?: string[]
  min?: number
  max?: number
}

type CategoryFieldDraft = {
  id: string
  key: string
  label: string
  type: CategoryField['type']
  required: boolean
  optionsRaw: string
  minRaw: string
  maxRaw: string
}

type Category = {
  _id: string
  name: string
  fields?: CategoryField[]
  looseSaleAllowed?: boolean
  isDeleted?: boolean
}

type Manufacturer = {
  _id: string
  name: string
}

function makeId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

function emptyFieldDraft(): CategoryFieldDraft {
  return { id: makeId(), key: '', label: '', type: 'text', required: false, optionsRaw: '', minRaw: '', maxRaw: '' }
}

function draftFromField(f: CategoryField): CategoryFieldDraft {
  return {
    id: makeId(),
    key: f.key || '',
    label: f.label || '',
    type: f.type || 'text',
    required: Boolean(f.required),
    optionsRaw: (f.options || []).join(', '),
    minRaw: typeof f.min === 'number' && Number.isFinite(f.min) ? String(f.min) : '',
    maxRaw: typeof f.max === 'number' && Number.isFinite(f.max) ? String(f.max) : '',
  }
}

function parseOptions(raw: string) {
  return (raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function draftsToPayload(drafts: CategoryFieldDraft[]): CategoryField[] {
  return (drafts || [])
    .map((d) => {
      const base: CategoryField = {
        key: (d.key || '').trim(),
        label: (d.label || '').trim(),
        type: d.type,
        required: Boolean(d.required),
      }

      if (d.type === 'select') base.options = parseOptions(d.optionsRaw)
      if (d.type === 'number') {
        const min = d.minRaw === '' ? undefined : Number(d.minRaw)
        const max = d.maxRaw === '' ? undefined : Number(d.maxRaw)
        if (Number.isFinite(min as number)) base.min = min
        if (Number.isFinite(max as number)) base.max = max
      }

      return base
    })
    .filter((f) => f.key && f.label)
}

export default function CategoriesPage() {
  const { token } = useAuth()
  const [items, setItems] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [fields, setFields] = useState<CategoryFieldDraft[]>([])
  const [looseSaleAllowed, setLooseSaleAllowed] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingFields, setEditingFields] = useState<CategoryFieldDraft[]>([])
  const [editingLooseSaleAllowed, setEditingLooseSaleAllowed] = useState(false)
  const [manufacturersByCategory, setManufacturersByCategory] = useState<Record<string, Manufacturer[]>>({})
  const [addingManufacturerName, setAddingManufacturerName] = useState<Record<string, string>>({})
  const [manufacturerBusy, setManufacturerBusy] = useState<Record<string, boolean>>({})

  async function loadManufacturers(categoryId: string) {
    if (!token) return
    try {
      const res = await apiFetch<{ items: Manufacturer[] }>(`/api/categories/${categoryId}/manufacturers`, {
        token,
        tenant: false,
      })
      setManufacturersByCategory((p) => ({ ...p, [categoryId]: res.items || [] }))
    } catch {
      setManufacturersByCategory((p) => ({ ...p, [categoryId]: [] }))
    }
  }

  async function addManufacturer(categoryId: string) {
    if (!token) return
    const name = (addingManufacturerName[categoryId] || '').trim()
    if (!name) return
    setManufacturerBusy((p) => ({ ...p, [categoryId]: true }))
    try {
      await apiFetch(`/api/categories/${categoryId}/manufacturers`, {
        method: 'POST',
        token,
        tenant: false,
        body: { name },
      })
      setAddingManufacturerName((p) => ({ ...p, [categoryId]: '' }))
      await loadManufacturers(categoryId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add manufacturer')
    } finally {
      setManufacturerBusy((p) => ({ ...p, [categoryId]: false }))
    }
  }

  async function removeManufacturer(categoryId: string, manufacturerId: string) {
    if (!token) return
    if (!window.confirm('Remove this manufacturer from the category?')) return
    setManufacturerBusy((p) => ({ ...p, [categoryId]: true }))
    try {
      await apiFetch(`/api/categories/${categoryId}/manufacturers/${manufacturerId}`, {
        method: 'DELETE',
        token,
        tenant: false,
      })
      await loadManufacturers(categoryId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove manufacturer')
    } finally {
      setManufacturerBusy((p) => ({ ...p, [categoryId]: false }))
    }
  }

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch<{ items: Category[] }>('/api/categories?includeDeleted=1', {
        token,
        tenant: false,
      })
      setItems(res.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const active = useMemo(() => items.filter((c) => !c.isDeleted), [items])
  const deleted = useMemo(() => items.filter((c) => c.isDeleted), [items])

  async function create(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    setError(null)
    setSaving(true)
    try {
      await apiFetch('/api/categories', {
        method: 'POST',
        token,
        tenant: false,
        body: { name, fields: draftsToPayload(fields), looseSaleAllowed },
      })
      setName('')
      setFields([])
      setLooseSaleAllowed(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create category')
    } finally {
      setSaving(false)
    }
  }

  async function saveEdit(id: string) {
    if (!token) return
    setError(null)
    setSaving(true)
    try {
      await apiFetch(`/api/categories/${id}`, {
        method: 'PATCH',
        token,
        tenant: false,
        body: { name: editingName, fields: draftsToPayload(editingFields), looseSaleAllowed: editingLooseSaleAllowed },
      })
      setEditingId(null)
      setEditingName('')
      setEditingFields([])
      setEditingLooseSaleAllowed(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update category')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    if (!token) return
    if (!window.confirm('Delete this category?')) return
    setError(null)
    setSaving(true)
    try {
      await apiFetch(`/api/categories/${id}`, { method: 'DELETE', token, tenant: false })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader />
      <main className="py-4">
        <Container>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Category Master</h1>
              <p className="mt-1 text-sm text-slate-400">SuperAdmin only. Used in Item Management dropdown.</p>
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

          <form onSubmit={create} className="mt-6 rounded-3xl bg-white/5 p-6 ring-1 ring-inset ring-white/10">
            <div className="text-sm font-semibold">Add category</div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="grid flex-1 gap-1.5">
                <span className="text-xs font-medium text-slate-300">
                  Name <span className="text-rose-400">*</span>
                </span>
                <input
                  className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tablet, Diaper, Cosmetic..."
                  required
                />
              </label>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Create'}
              </Button>
            </div>

            <div className="mt-5 rounded-2xl bg-slate-950/40 p-4 ring-1 ring-inset ring-white/10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Custom fields (optional)</div>
                  <div className="mt-0.5 text-xs text-slate-400">Example: Diaper → size (dropdown), packOf (number)</div>
                </div>
                <div className="flex items-end gap-2">
                  <label className="grid gap-1">
                    <span className="text-[11px] font-medium text-slate-400">Loose sale</span>
                    <select
                      className="h-10 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                      value={looseSaleAllowed ? 'allow' : 'deny'}
                      onChange={(e) => setLooseSaleAllowed(e.target.value === 'allow')}
                    >
                      <option value="deny">Not allow</option>
                      <option value="allow">Allow</option>
                    </select>
                  </label>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => setFields((p) => [...p, emptyFieldDraft()])}
                    disabled={saving}
                  >
                    Add field
                  </Button>
                </div>
              </div>

              {fields.length ? (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="py-2 pr-3">Key</th>
                        <th className="py-2 pr-3">Label</th>
                        <th className="py-2 pr-3">Type</th>
                        <th className="py-2 pr-3">Required</th>
                        <th className="py-2 pr-3">Options (comma)</th>
                        <th className="py-2 pr-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {fields.map((f) => (
                        <tr key={f.id}>
                          <td className="py-2 pr-3">
                            <input
                              className="h-10 w-full rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                              value={f.key}
                              onChange={(e) =>
                                setFields((p) => p.map((x) => (x.id === f.id ? { ...x, key: e.target.value } : x)))
                              }
                              placeholder="size"
                            />
                          </td>
                          <td className="py-2 pr-3">
                            <input
                              className="h-10 w-full rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                              value={f.label}
                              onChange={(e) =>
                                setFields((p) => p.map((x) => (x.id === f.id ? { ...x, label: e.target.value } : x)))
                              }
                              placeholder="Size"
                            />
                          </td>
                          <td className="py-2 pr-3">
                            <select
                              className="h-10 w-full rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                              value={f.type}
                              onChange={(e) =>
                                setFields((p) =>
                                  p.map((x) =>
                                    x.id === f.id
                                      ? { ...x, type: e.target.value as CategoryFieldDraft['type'] }
                                      : x,
                                  ),
                                )
                              }
                            >
                              <option value="text">Text</option>
                              <option value="number">Number</option>
                              <option value="select">Dropdown</option>
                              <option value="boolean">Yes/No</option>
                              <option value="date">Date</option>
                            </select>
                          </td>
                          <td className="py-2 pr-3">
                            <label className="flex h-10 items-center gap-2 rounded-xl bg-slate-950/40 px-3 ring-1 ring-inset ring-white/10">
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-sky-400"
                                checked={Boolean(f.required)}
                                onChange={(e) =>
                                  setFields((p) =>
                                    p.map((x) =>
                                      x.id === f.id ? { ...x, required: e.target.checked } : x,
                                    ),
                                  )
                                }
                              />
                              <span className="text-xs text-slate-200">{f.required ? 'Yes' : 'No'}</span>
                            </label>
                          </td>
                          <td className="py-2 pr-3">
                            {f.type === 'select' ? (
                              <input
                                className="h-10 w-full rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                                value={f.optionsRaw}
                                onChange={(e) =>
                                  setFields((p) =>
                                    p.map((x) =>
                                      x.id === f.id ? { ...x, optionsRaw: e.target.value } : x,
                                    ),
                                  )
                                }
                                placeholder="S, M, L, XL"
                              />
                            ) : f.type === 'number' ? (
                              <div className="flex gap-2">
                                <input
                                  className="h-10 w-full rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                                  value={f.minRaw}
                                  onChange={(e) =>
                                    setFields((p) =>
                                      p.map((x) => (x.id === f.id ? { ...x, minRaw: e.target.value } : x)),
                                    )
                                  }
                                  placeholder="Min"
                                />
                                <input
                                  className="h-10 w-full rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                                  value={f.maxRaw}
                                  onChange={(e) =>
                                    setFields((p) =>
                                      p.map((x) => (x.id === f.id ? { ...x, maxRaw: e.target.value } : x)),
                                    )
                                  }
                                  placeholder="Max"
                                />
                              </div>
                            ) : (
                              <div className="h-10 w-full rounded-xl bg-slate-950/40 px-3 text-xs text-slate-500 ring-1 ring-inset ring-white/10 flex items-center">
                                -
                              </div>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-right">
                            <Button
                              variant="secondary"
                              type="button"
                              onClick={() => setFields((p) => p.filter((x) => x.id !== f.id))}
                              disabled={saving}
                            >
                              Remove
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-400">No custom fields.</div>
              )}
            </div>
          </form>

          <div className="mt-6 rounded-3xl bg-white/5 p-6 ring-1 ring-inset ring-white/10">
            <div className="text-sm font-semibold">Active categories</div>
            {loading ? (
              <div className="mt-4 text-sm text-slate-400">Loading...</div>
            ) : active.length === 0 ? (
              <div className="mt-4 text-sm text-slate-400">No categories.</div>
            ) : (
              <div className="mt-4 space-y-3">
                {active.map((c) => (
                  <div
                    key={c._id}
                    className="flex flex-col gap-2 rounded-2xl bg-slate-950/40 p-4 ring-1 ring-inset ring-white/10 sm:flex-row sm:items-start sm:justify-between"
                  >
                    {editingId === c._id ? (
                      <div className="w-full">
                        <input
                          className="h-10 w-full max-w-md rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          required
                        />

                        <div className="mt-3 rounded-2xl bg-black/20 p-3 ring-1 ring-inset ring-white/10">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs font-semibold text-slate-300">Custom fields</div>
                              <div className="flex items-end gap-2">
                                <label className="grid gap-1">
                                  <span className="text-[11px] font-medium text-slate-400">Loose sale</span>
                                  <select
                                    className="h-10 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                                    value={editingLooseSaleAllowed ? 'allow' : 'deny'}
                                    onChange={(e) => setEditingLooseSaleAllowed(e.target.value === 'allow')}
                                  >
                                    <option value="deny">Not allow</option>
                                    <option value="allow">Allow</option>
                                  </select>
                                </label>
                                <Button
                                  variant="secondary"
                                  type="button"
                                  onClick={() => setEditingFields((p) => [...p, emptyFieldDraft()])}
                                  disabled={saving}
                                >
                                  Add field
                                </Button>
                              </div>
                            </div>

                            {editingFields.length ? (
                              <div className="mt-3 grid gap-2 min-w-0 overflow-x-auto">
                                {editingFields.map((f) => (
                                  <div
                                    key={f.id}
                                    className="grid gap-2 rounded-xl bg-slate-950/40 p-3 ring-1 ring-inset ring-white/10 md:grid-cols-[1fr_1fr_140px_120px_1fr_auto] md:items-center min-w-0"
                                  >
                                    <input
                                      className="h-10 w-full min-w-0 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                                      value={f.key}
                                      onChange={(e) =>
                                        setEditingFields((p) =>
                                          p.map((x) => (x.id === f.id ? { ...x, key: e.target.value } : x)),
                                        )
                                      }
                                      placeholder="key"
                                    />
                                    <input
                                      className="h-10 w-full min-w-0 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                                      value={f.label}
                                      onChange={(e) =>
                                        setEditingFields((p) =>
                                          p.map((x) => (x.id === f.id ? { ...x, label: e.target.value } : x)),
                                        )
                                      }
                                      placeholder="Label"
                                    />
                                    <select
                                      className="h-10 w-full min-w-0 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                                      value={f.type}
                                      onChange={(e) =>
                                        setEditingFields((p) =>
                                          p.map((x) =>
                                            x.id === f.id
                                              ? { ...x, type: e.target.value as CategoryFieldDraft['type'] }
                                              : x,
                                          ),
                                        )
                                      }
                                    >
                                      <option value="text">Text</option>
                                      <option value="number">Number</option>
                                      <option value="select">Dropdown</option>
                                      <option value="boolean">Yes/No</option>
                                      <option value="date">Date</option>
                                    </select>
                                    <label className="flex h-10 items-center gap-2 rounded-xl bg-slate-950/40 px-3 ring-1 ring-inset ring-white/10">
                                      <input
                                        type="checkbox"
                                        className="h-4 w-4 accent-sky-400"
                                        checked={Boolean(f.required)}
                                        onChange={(e) =>
                                          setEditingFields((p) =>
                                            p.map((x) =>
                                              x.id === f.id ? { ...x, required: e.target.checked } : x,
                                            ),
                                          )
                                        }
                                      />
                                      <span className="text-xs text-slate-200">Req</span>
                                    </label>
                                    {f.type === 'select' ? (
                                      <input
                                        className="h-10 w-full min-w-0 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                                        value={f.optionsRaw}
                                        onChange={(e) =>
                                          setEditingFields((p) =>
                                            p.map((x) =>
                                              x.id === f.id ? { ...x, optionsRaw: e.target.value } : x,
                                            ),
                                          )
                                        }
                                        placeholder="Options"
                                      />
                                    ) : f.type === 'number' ? (
                                      <div className="flex min-w-0 gap-2">
                                        <input
                                          className="h-10 w-full min-w-0 flex-1 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                                          value={f.minRaw}
                                          onChange={(e) =>
                                            setEditingFields((p) =>
                                              p.map((x) => (x.id === f.id ? { ...x, minRaw: e.target.value } : x)),
                                            )
                                          }
                                          placeholder="Min"
                                        />
                                        <input
                                          className="h-10 w-full min-w-0 flex-1 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                                          value={f.maxRaw}
                                          onChange={(e) =>
                                            setEditingFields((p) =>
                                              p.map((x) => (x.id === f.id ? { ...x, maxRaw: e.target.value } : x)),
                                            )
                                          }
                                          placeholder="Max"
                                        />
                                      </div>
                                    ) : (
                                      <div className="h-10 rounded-xl bg-slate-950/40 px-3 text-xs text-slate-500 ring-1 ring-inset ring-white/10 flex items-center">
                                        -
                                      </div>
                                    )}
                                    <Button
                                      variant="secondary"
                                      type="button"
                                      onClick={() => setEditingFields((p) => p.filter((x) => x.id !== f.id))}
                                      disabled={saving}
                                    >
                                      Remove
                                    </Button>
                                  </div>
                                ))}
                              </div>
                          ) : (
                            <div className="mt-2 text-sm text-slate-400">No custom fields.</div>
                          )}
                        </div>

                        <div className="mt-3 rounded-2xl bg-black/20 p-3 ring-1 ring-inset ring-white/10">
                          <div className="flex flex-wrap items-end justify-between gap-2">
                            <div>
                              <div className="text-xs font-semibold text-slate-300">Manufacturers</div>
                              <div className="mt-0.5 text-[11px] text-slate-400">One manufacturer can belong to multiple categories.</div>
                            </div>
                            <div className="flex gap-2">
                              <input
                                className="h-10 w-full min-w-0 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10 sm:w-64"
                                placeholder="Add manufacturer name"
                                value={addingManufacturerName[c._id] || ''}
                                onChange={(e) => setAddingManufacturerName((p) => ({ ...p, [c._id]: e.target.value }))}
                                disabled={Boolean(manufacturerBusy[c._id]) || saving}
                              />
                              <Button
                                type="button"
                                onClick={() => void addManufacturer(c._id)}
                                disabled={Boolean(manufacturerBusy[c._id]) || saving || !(addingManufacturerName[c._id] || '').trim()}
                              >
                                Add
                              </Button>
                            </div>
                          </div>

                          {(manufacturersByCategory[c._id] || []).length ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {(manufacturersByCategory[c._id] || []).map((m) => (
                                <div
                                  key={m._id}
                                  className="flex items-center gap-2 rounded-xl bg-slate-950/40 px-3 py-2 text-sm ring-1 ring-inset ring-white/10"
                                >
                                  <span className="text-slate-200">{m.name}</span>
                                  <button
                                    type="button"
                                    className="rounded-lg bg-rose-500/10 px-2 py-1 text-xs text-rose-200 ring-1 ring-inset ring-rose-400/20 hover:bg-rose-500/15"
                                    onClick={() => void removeManufacturer(c._id, m._id)}
                                    disabled={Boolean(manufacturerBusy[c._id]) || saving}
                                  >
                                    Delete
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-2 text-sm text-slate-400">No manufacturers.</div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-sm font-medium">{c.name}</div>
                        {c.fields && c.fields.length ? (
                          <div className="mt-1 text-xs text-slate-400">Fields: {c.fields.map((f) => f.label).join(', ')}</div>
                        ) : (
                          <div className="mt-1 text-xs text-slate-500">No custom fields</div>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2">
                      {editingId === c._id ? (
                        <>
                          <Button
                            variant="secondary"
                            type="button"
                            onClick={() => {
                              setEditingId(null)
                              setEditingName('')
                              setEditingFields([])
                              setEditingLooseSaleAllowed(false)
                            }}
                            disabled={saving}
                          >
                            Cancel
                          </Button>
                          <Button type="button" onClick={() => void saveEdit(c._id)} disabled={saving}>
                            Save
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="secondary"
                            type="button"
                            onClick={() => {
                              setEditingId(c._id)
                              setEditingName(c.name)
                              setEditingFields((c.fields || []).map((f) => draftFromField(f)))
                              setEditingLooseSaleAllowed(Boolean(c.looseSaleAllowed))
                              void loadManufacturers(c._id)
                            }}
                            disabled={saving}
                          >
                            Edit
                          </Button>
                          <Button variant="secondary" type="button" onClick={() => void remove(c._id)} disabled={saving}>
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {deleted.length > 0 ? (
            <div className="mt-6 rounded-3xl bg-white/5 p-6 ring-1 ring-inset ring-white/10">
              <div className="text-sm font-semibold">Deleted</div>
              <div className="mt-4 grid gap-2 text-sm text-slate-400">
                {deleted.map((c) => (
                  <div key={c._id}>{c.name}</div>
                ))}
              </div>
            </div>
          ) : null}
        </Container>
      </main>
    </div>
  )
}
