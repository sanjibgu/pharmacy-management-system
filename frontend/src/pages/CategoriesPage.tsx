import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/Button'
import Container from '../components/Container'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../services/api'

type Category = {
  _id: string
  name: string
  isDeleted?: boolean
}

export default function CategoriesPage() {
  const { token } = useAuth()
  const [items, setItems] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [saving, setSaving] = useState(false)

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
      await apiFetch('/api/categories', { method: 'POST', token, tenant: false, body: { name } })
      setName('')
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
        body: { name: editingName },
      })
      setEditingId(null)
      setEditingName('')
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
      <main className="py-12">
        <Container>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Category Master</h1>
              <p className="mt-1 text-sm text-slate-400">SuperAdmin only. Used as Medicine category dropdown.</p>
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
                  placeholder="Tablet, Capsule, Syrup..."
                  required
                />
              </label>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Create'}
              </Button>
            </div>
          </form>

          <div className="mt-6 rounded-3xl bg-white/5 p-6 ring-1 ring-inset ring-white/10">
            <div className="text-sm font-semibold">Active categories</div>
            {loading ? (
              <div className="mt-4 text-sm text-slate-400">Loading…</div>
            ) : active.length === 0 ? (
              <div className="mt-4 text-sm text-slate-400">No categories.</div>
            ) : (
              <div className="mt-4 space-y-3">
                {active.map((c) => (
                  <div
                    key={c._id}
                    className="flex flex-col gap-2 rounded-2xl bg-slate-950/40 p-4 ring-1 ring-inset ring-white/10 sm:flex-row sm:items-center sm:justify-between"
                  >
                    {editingId === c._id ? (
                      <input
                        className="h-10 w-full max-w-md rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        required
                      />
                    ) : (
                      <div className="text-sm font-medium">{c.name}</div>
                    )}

                    <div className="flex gap-2">
                      {editingId === c._id ? (
                        <>
                          <Button variant="secondary" type="button" onClick={() => setEditingId(null)} disabled={saving}>
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

