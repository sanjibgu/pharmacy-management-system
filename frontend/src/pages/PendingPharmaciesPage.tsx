import { useEffect, useState } from 'react'
import Button from '../components/Button'
import Container from '../components/Container'
import SiteFooter from '../components/SiteFooter'
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
  createdAt: string
}

export default function PendingPharmaciesPage() {
  const { token, logout } = useAuth()
  const [items, setItems] = useState<Pharmacy[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [adminName, setAdminName] = useState('Pharmacy Admin')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch<{ items: Pharmacy[] }>('/api/superadmin/pharmacies/pending', { token, tenant: false })
      setItems(res.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function approve(id: string) {
    setError(null)
    try {
      const res = await apiFetch<{ slug: string }>(`/api/superadmin/pharmacies/${id}/approve`, {
        method: 'PATCH',
        token,
        tenant: false,
        body: { adminName, adminEmail, adminPassword },
      })
      await load()
      alert(`Approved.\nSlug: ${res.slug}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed')
    }
  }

  async function reject(id: string) {
    setError(null)
    try {
      await apiFetch(`/api/superadmin/pharmacies/${id}/reject`, {
        method: 'PATCH',
        token,
        tenant: false,
        body: { reason: 'Rejected by Super Admin' },
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject failed')
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader />
      <main className="py-12">
        <Container>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Pending pharmacies</h1>
              <p className="mt-1 text-sm text-slate-400">Approve to generate slug + portal URL and create the initial PharmacyAdmin.</p>
            </div>
            <Button variant="secondary" onClick={logout}>
              Logout
            </Button>
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl bg-rose-500/10 p-4 text-sm text-rose-200 ring-1 ring-inset ring-rose-400/20">
              {error}
            </div>
          ) : null}

          <div className="mt-6 rounded-3xl bg-white/5 p-6 ring-1 ring-inset ring-white/10">
            <div className="text-sm font-semibold">Admin user to create on approval</div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <input
                className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                placeholder="Admin name"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
              />
              <input
                className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                placeholder="Admin email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                type="email"
              />
              <input
                className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                placeholder="Temp password (min 8 chars)"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                type="password"
              />
            </div>
          </div>

          <div className="mt-6 rounded-3xl bg-white/5 p-6 ring-1 ring-inset ring-white/10">
            <div className="text-sm font-semibold">Requests</div>
            {loading ? (
              <div className="mt-4 text-sm text-slate-400">Loading…</div>
            ) : items.length === 0 ? (
              <div className="mt-4 text-sm text-slate-400">No pending pharmacies.</div>
            ) : (
              <div className="mt-4 space-y-4">
                {items.map((p) => (
                  <div key={p._id} className="rounded-2xl bg-slate-950/40 p-5 ring-1 ring-inset ring-white/10">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="text-sm font-semibold">{p.pharmacyName}</div>
                        <div className="mt-1 text-sm text-slate-400">
                          Owner: {p.ownerName} • {p.email}
                        </div>
                        <div className="mt-1 text-sm text-slate-500">{p.address}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => approve(p._id)}>Approve</Button>
                        <Button variant="secondary" onClick={() => reject(p._id)}>
                          Reject
                        </Button>
                      </div>
                    </div>
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
