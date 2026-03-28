import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/Button'
import Container from '../components/Container'
import SiteFooter from '../components/SiteFooter'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../services/api'

export default function SuperAdminLoginPage() {
  const nav = useNavigate()
  const { setAuth } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await apiFetch<{
        accessToken: string
        user: { id: string; name: string; email: string; role: 'SuperAdmin' }
      }>('/api/superadmin/auth/login', { method: 'POST', body: { email, password }, tenant: false })

      setAuth({
        token: res.accessToken,
        user: { ...res.user, pharmacyId: null },
      })
      nav('/superadmin/pending')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
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
            <h1 className="text-2xl font-semibold tracking-tight">Super Admin</h1>
            <p className="mt-2 text-sm text-slate-400">Approve or reject pharmacy registrations.</p>

            <form onSubmit={onSubmit} className="mt-8 grid gap-4">
              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-slate-200">Email</span>
                <input
                  className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-slate-200">Password</span>
                <input
                  className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  required
                />
              </label>

              {error ? <div className="text-sm text-rose-300">{error}</div> : null}

              <div className="mt-2 flex justify-end">
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
