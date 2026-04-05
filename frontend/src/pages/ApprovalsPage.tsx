import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/Button'
import Container from '../components/Container'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../services/api'

type Approval = {
  _id: string
  entityType: 'item' | 'manufacturer'
  normalizedKey: string
  payload: any
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
}

export default function ApprovalsPage() {
  const { token } = useAuth()
  const [items, setItems] = useState<Approval[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [entityType, setEntityType] = useState<'item' | 'manufacturer'>('item')

  async function load() {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ status: 'pending', entityType }).toString()
      const res = await apiFetch<{ items: Approval[] }>(`/api/superadmin/approvals?${qs}`, {
        token,
        tenant: false,
      })
      setItems(res.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load approvals')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType])

  const rows = useMemo(() => items, [items])

  async function approve(id: string) {
    if (!token) return
    if (!window.confirm('Approve this request?')) return
    setBusyId(id)
    setError(null)
    try {
      await apiFetch(`/api/superadmin/approvals/${id}/approve`, { method: 'POST', token, tenant: false })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve')
    } finally {
      setBusyId(null)
    }
  }

  async function reject(id: string) {
    if (!token) return
    const note = window.prompt('Reject note (optional):', '') || ''
    if (!window.confirm('Reject this request?')) return
    setBusyId(id)
    setError(null)
    try {
      await apiFetch(`/api/superadmin/approvals/${id}/reject`, {
        method: 'POST',
        token,
        tenant: false,
        body: note.trim() ? { note } : {},
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject')
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
              <h1 className="text-2xl font-semibold tracking-tight">Approvals</h1>
              <p className="mt-1 text-sm text-slate-400">Approve global master records (SuperAdmin).</p>
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

          <div className="mt-6 flex gap-2">
            <Button variant={entityType === 'item' ? 'primary' : 'secondary'} onClick={() => setEntityType('item')}>
              Items
            </Button>
            <Button
              variant={entityType === 'manufacturer' ? 'primary' : 'secondary'}
              onClick={() => setEntityType('manufacturer')}
            >
              Manufacturers
            </Button>
          </div>

          <div className="mt-6 rounded-3xl bg-white/5 p-6 ring-1 ring-inset ring-white/10">
            {loading ? (
              <div className="text-sm text-slate-400">Loading...</div>
            ) : rows.length === 0 ? (
              <div className="text-sm text-slate-400">No pending approvals.</div>
            ) : (
              <div className="space-y-3">
                {rows.map((r) => (
                  <div
                    key={r._id}
                    className="flex flex-col gap-2 rounded-2xl bg-slate-950/40 p-4 ring-1 ring-inset ring-white/10 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="text-sm font-medium">
                        {entityType === 'item'
                          ? `${r.payload?.medicineName || '-'} • ${r.payload?.manufacturer || '-'} • ${r.payload?.category || '-'}`
                          : `${r.payload?.name || '-'}`}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">{r.normalizedKey}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" onClick={() => void approve(r._id)} disabled={busyId === r._id}>
                        Approve
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void reject(r._id)}
                        disabled={busyId === r._id}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Container>
      </main>
    </div>
  )
}
