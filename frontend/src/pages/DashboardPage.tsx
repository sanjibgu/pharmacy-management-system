import { Link, useParams } from 'react-router-dom'
import Container from '../components/Container'
import SiteFooter from '../components/SiteFooter'
import SiteHeader from '../components/SiteHeader'
import Button from '../components/Button'
import { useAuth } from '../context/AuthContext'
import { getTenantSlug } from '../services/tenant'

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const { tenantSlug } = useParams()
  const isLocalhost = window.location.hostname === 'localhost'
  const effectiveSlug = tenantSlug || (isLocalhost ? getTenantSlug() : null)
  const base = effectiveSlug ? `/${effectiveSlug}` : ''
  const canSeeUsers = Boolean(user?.moduleAccess?.users?.view) || user?.role === 'PharmacyAdmin'

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader />
      <main className="py-4">
        <Container>
          <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-inset ring-white/10 md:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
                <p className="mt-1 text-sm text-slate-400">
                  Signed in as <span className="text-slate-200">{user?.email}</span> ({user?.role})
                </p>
              </div>
              <Button variant="secondary" onClick={logout}>
                Logout
              </Button>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <Link
                to={`${base}/medicines`}
                className="rounded-2xl bg-slate-950/40 p-6 ring-1 ring-inset ring-white/10 hover:bg-white/5"
              >
                <div className="text-sm font-semibold">Medicine management</div>
                <div className="mt-2 text-sm text-slate-400">
                  Create and view tenant-scoped medicines.
                </div>
              </Link>
              <Link
                to={`${base}/purchases`}
                className="rounded-2xl bg-slate-950/40 p-6 ring-1 ring-inset ring-white/10 hover:bg-white/5"
              >
                <div className="text-sm font-semibold">Purchase module</div>
                <div className="mt-2 text-sm text-slate-400">
                  Create purchase invoices and update stock.
                </div>
              </Link>
              <div className="rounded-2xl bg-slate-950/40 p-6 ring-1 ring-inset ring-white/10">
                <div className="text-sm font-semibold">Sales module</div>
                <div className="mt-2 text-sm text-slate-500">Coming next</div>
              </div>
              <div className="rounded-2xl bg-slate-950/40 p-6 ring-1 ring-inset ring-white/10">
                <div className="text-sm font-semibold">Expenses module</div>
                <div className="mt-2 text-sm text-slate-500">Coming next</div>
              </div>
              {canSeeUsers ? (
                <Link
                  to={`${base}/users`}
                  className="rounded-2xl bg-slate-950/40 p-6 ring-1 ring-inset ring-white/10 hover:bg-white/5"
                >
                  <div className="text-sm font-semibold">User management</div>
                  <div className="mt-2 text-sm text-slate-400">
                    Create users and assign module access.
                  </div>
                </Link>
              ) : null}
            </div>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </div>
  )
}
