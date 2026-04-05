import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Button from '../components/Button'
import Container from '../components/Container'
import SiteFooter from '../components/SiteFooter'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../services/api'
import { getTenantSlug, setDevTenantSlug } from '../services/tenant'

export default function LoginPage() {
  const nav = useNavigate()
  const { tenantSlug: tenantSlugParam } = useParams()
  const { setAuth } = useAuth()
  const isLocalhost = window.location.hostname === 'localhost'
  const [tenantSlug, setTenantSlug] = useState(() => tenantSlugParam || getTenantSlug() || '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (isLocalhost && tenantSlug.trim()) setDevTenantSlug(tenantSlug)

      const res = await apiFetch<{
        accessToken: string
        user: {
          id: string
          name: string
          email: string
          role: 'PharmacyAdmin' | 'Staff'
          pharmacyId: string
          moduleAccess?: Record<string, { view?: boolean; manage?: boolean }>
        }
      }>('/api/auth/login', { method: 'POST', body: { email, password } })

      setAuth({
        token: res.accessToken,
        user: { ...res.user, pharmacyId: res.user.pharmacyId },
      })
      const slug = getTenantSlug()
      if (isLocalhost && slug) nav(`/${slug}/dashboard`)
      else nav('/dashboard')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed'
      setError(msg)
      if (/Pharmacy is deactivated/i.test(msg)) {
        alert(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader />
      <main className="py-12">
        <Container>
          <div className="mx-auto max-w-lg rounded-3xl bg-white/5 p-6 ring-1 ring-inset ring-white/10 md:p-8">
            <h1 className="text-2xl font-semibold tracking-tight">Tenant login</h1>
            <p className="mt-2 text-sm text-slate-400">
              Sign in to your pharmacy portal. In production, the tenant slug is
              detected from the subdomain.
            </p>

            <form onSubmit={onSubmit} className="mt-8 grid gap-4">
              {isLocalhost && !tenantSlugParam ? (
                <label className="grid gap-1.5">
                  <span className="text-sm font-medium text-slate-200">
                    Tenant slug (localhost only)
                  </span>
                  <input
                    className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 placeholder:text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                    value={tenantSlug}
                    onChange={(e) => setTenantSlug(e.target.value)}
                    placeholder="abcpharmacy"
                  />
                </label>
              ) : null}

              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-slate-200">Email</span>
                <input
                  className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 placeholder:text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-slate-200">Password</span>
                <input
                  className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 placeholder:text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  required
                />
              </label>

              {error ? <div className="text-sm text-rose-300">{error}</div> : null}

              <div className="mt-2 flex items-center justify-between gap-4">
                <Link className="text-sm text-slate-300 hover:text-slate-100" to="/pharmacy/register">
                  New pharmacy registration
                </Link>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </Button>
              </div>
            </form>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </div>
  )
}
