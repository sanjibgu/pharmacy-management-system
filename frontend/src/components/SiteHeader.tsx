import Container from './Container'
import Button from './Button'
import LinkButton from './LinkButton'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getTenantSlug } from '../services/tenant'

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-sky-400 to-indigo-400 text-slate-950">
        <span className="text-sm font-black tracking-tight">PS</span>
      </div>
      <div className="leading-tight">
        <div className="text-sm font-semibold">Pharmacy SAS</div>
        <div className="text-xs text-slate-400">Portal</div>
      </div>
    </div>
  )
}

export default function SiteHeader() {
  const { user, token, logout } = useAuth()
  const { tenantSlug } = useParams()

  const isTenantUser = Boolean(token) && user?.role !== 'SuperAdmin'
  const isSuperAdmin = Boolean(token) && user?.role === 'SuperAdmin'
  const canView = (moduleKey: string) =>
    user?.role === 'PharmacyAdmin' || Boolean(user?.moduleAccess?.[moduleKey]?.view)
  const isLocalhost = window.location.hostname === 'localhost'
  const effectiveSlug = tenantSlug || (isLocalhost ? getTenantSlug() : null)
  const base = effectiveSlug ? `/${effectiveSlug}` : ''

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/70 backdrop-blur">
      <Container>
        <div className="flex h-16 items-center justify-between">
          <Link
            to={isTenantUser && base ? `${base}/dashboard` : '/'}
            className="focus-visible:outline focus-visible:outline-2"
          >
            <Logo />
          </Link>

          {isTenantUser ? (
            <nav
              aria-label="Modules"
              className="hidden items-center gap-6 text-sm text-slate-300 md:flex"
            >
              <Link className="hover:text-slate-100" to={`${base}/dashboard`}>
                Dashboard
              </Link>
              {canView('medicines') ? (
                <>
                  <Link className="hover:text-slate-100" to={`${base}/medicines`}>
                    Medicine Management
                  </Link>
                  <Link className="hover:text-slate-100" to={`${base}/stocks`}>
                    Stocks
                  </Link>
                </>
              ) : null}
              {canView('purchases') ? (
                <>
                  <Link className="hover:text-slate-100" to={`${base}/purchases`}>
                    Purchase Module
                  </Link>
                  <Link className="hover:text-slate-100" to={`${base}/purchases/view`}>
                    Purchase Views
                  </Link>
                  <Link className="hover:text-slate-100" to={`${base}/distributors`}>
                    Distributor Management
                  </Link>
                </>
              ) : null}
              {canView('sales') ? (
                <Link className="hover:text-slate-100" to={`${base}/sales`}>
                  Sales Module
                </Link>
              ) : null}
              {canView('expenses') ? (
                <Link className="hover:text-slate-100" to={`${base}/expenses`}>
                  Expenses Module
                </Link>
              ) : null}
              {canView('users') ? (
                <Link className="hover:text-slate-100" to={`${base}/users`}>
                  Users
                </Link>
              ) : null}
            </nav>
          ) : isSuperAdmin ? (
            <nav aria-label="SuperAdmin" className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
              <Link className="hover:text-slate-100" to="/superadmin/pending">
                Pending Pharmacies
              </Link>
              <Link className="hover:text-slate-100" to="/superadmin/categories">
                Categories
              </Link>
            </nav>
          ) : (
            <nav
              aria-label="Primary"
              className="hidden items-center gap-7 text-sm text-slate-300 md:flex"
            >
              <a className="hover:text-slate-100" href="#solutions">
                Solutions
              </a>
              <a className="hover:text-slate-100" href="#platform">
                Platform
              </a>
              <a className="hover:text-slate-100" href="#insights">
                Insights
              </a>
              <a className="hover:text-slate-100" href="#about">
                About
              </a>
            </nav>
          )}

          <div className="flex items-center gap-3">
            {isTenantUser || isSuperAdmin ? (
              <>
                <div className="hidden text-xs text-slate-400 md:block">
                  {user?.email}
                </div>
                <Button variant="secondary" onClick={logout}>
                  Logout
                </Button>
              </>
            ) : (
              <>
                <LinkButton
                  to="/pharmacy/register"
                  variant="secondary"
                  className="hidden md:inline-flex"
                >
                  New pharmacy registration
                </LinkButton>
                <a
                  href="#contact"
                  className="hidden text-sm text-slate-300 hover:text-slate-100 md:inline"
                >
                  Contact
                </a>
                <LinkButton
                  to="/login"
                  variant="secondary"
                  className="hidden md:inline-flex"
                >
                  Sign in
                </LinkButton>
                <Button>Request a demo</Button>
              </>
            )}
          </div>
        </div>
      </Container>
    </header>
  )
}
