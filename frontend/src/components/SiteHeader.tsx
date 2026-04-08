import Button from './Button'
import LinkButton from './LinkButton'
import { Link, NavLink, useLocation, useParams } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M6 8l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function SiteHeader() {
  const { user, token, logout } = useAuth()
  const { tenantSlug } = useParams()
  const location = useLocation()
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const closeTimerRef = useRef<number | null>(null)

  const isTenantUser = Boolean(token) && user?.role !== 'SuperAdmin'
  const isSuperAdmin = Boolean(token) && user?.role === 'SuperAdmin'
  const canView = (moduleKey: string) =>
    user?.role === 'PharmacyAdmin' || Boolean(user?.moduleAccess?.[moduleKey]?.view)
  const isLocalhost = window.location.hostname === 'localhost'
  const effectiveSlug = tenantSlug || (isLocalhost ? getTenantSlug() : null)
  const base = effectiveSlug ? `/${effectiveSlug}` : ''

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    [
      'transition-colors hover:text-slate-100',
      isActive ? 'text-sky-200' : 'text-slate-300',
    ].join(' ')

  useEffect(() => {
    // Close dropdown when route changes
    setOpenDropdown(null)
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!mobileOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileOpen])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpenDropdown(null)
        setMobileOpen(false)
      }
    }
    function onMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (target.closest('[data-dropdown-root="true"]')) return
      setOpenDropdown(null)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('mousedown', onMouseDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('mousedown', onMouseDown)
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current)
    }
  }, [])

  function groupActive(prefixes: string[]) {
    const path = location.pathname || ''
    return prefixes.some((p) => path.startsWith(p))
  }

  function Dropdown({
    label,
    active,
    items,
  }: {
    label: string
    active?: boolean
    items: Array<{ to: string; text: string }>
  }) {
    const isOpen = openDropdown === label
    const isCoarsePointer =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches
    return (
      <div
        className="relative"
        data-dropdown-root="true"
        onMouseEnter={() => {
          if (isCoarsePointer) return
          if (closeTimerRef.current) {
            window.clearTimeout(closeTimerRef.current)
            closeTimerRef.current = null
          }
          setOpenDropdown(label)
        }}
        onMouseLeave={() => {
          if (isCoarsePointer) return
          if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current)
          closeTimerRef.current = window.setTimeout(() => {
            setOpenDropdown((cur) => (cur === label ? null : cur))
          }, 180)
        }}
      >
        <button
          type="button"
          className={[
            'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm ring-1 ring-inset transition-colors',
            active
              ? 'bg-white/10 text-sky-200 ring-white/15'
              : 'bg-transparent text-slate-300 ring-transparent hover:bg-white/5 hover:text-slate-100',
          ].join(' ')}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          onClick={() => setOpenDropdown((cur) => (cur === label ? null : label))}
        >
          {label}
          <ChevronDownIcon className="size-4 text-slate-500" />
        </button>
        <div
          className={[
            'absolute left-0 top-full z-50 mt-1 min-w-56 rounded-2xl bg-slate-950 p-1 ring-1 ring-inset ring-white/10 shadow-2xl',
            isOpen ? 'block' : 'hidden',
          ].join(' ')}
          role="menu"
        >
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              className={({ isActive }) =>
                [
                  'block rounded-xl px-3 py-2 text-sm transition-colors',
                  isActive ? 'bg-white/10 text-sky-200' : 'text-slate-200 hover:bg-white/5',
                ].join(' ')
              }
              end
              onClick={() => setOpenDropdown(null)}
            >
              {it.text}
            </NavLink>
          ))}
        </div>
      </div>
    )
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/70 backdrop-blur">
      <div className="mx-auto w-full px-4 sm:px-6">
        <div className="flex h-14 items-center justify-between">
          <Link
            to={isTenantUser && base ? `${base}/dashboard` : '/'}
            className="focus-visible:outline focus-visible:outline-2"
          >
            <Logo />
          </Link>

          {(isTenantUser || isSuperAdmin) ? (
            <button
              type="button"
              className="md:hidden rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-200 ring-1 ring-inset ring-white/10 hover:bg-white/10"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              Menu
            </button>
          ) : null}

          {isTenantUser ? (
            <nav aria-label="Modules" className="hidden items-center gap-2 md:flex">
              <NavLink
                className={({ isActive }) =>
                  [
                    'rounded-xl px-3 py-2 text-sm ring-1 ring-inset transition-colors',
                    isActive
                      ? 'bg-white/10 text-sky-200 ring-white/15'
                      : 'bg-transparent text-slate-300 ring-transparent hover:bg-white/5 hover:text-slate-100',
                  ].join(' ')
                }
                to={`${base}/dashboard`}
                end
              >
                Dashboard
              </NavLink>

              {(() => {
                const items: Array<{ to: string; text: string }> = []
                if (canView('medicines')) items.push({ to: `${base}/medicines`, text: 'Item Management' })
                if (canView('medicines')) items.push({ to: `${base}/manufacturers`, text: 'Manufacturer Management' })
                if (canView('purchases')) items.push({ to: `${base}/distributors`, text: 'Distributor Management' })
                if (canView('medicines')) items.push({ to: `${base}/stocks`, text: 'Stocks' })
                if (items.length === 0) return null

                return (
                  <Dropdown
                    label="Masters"
                    active={groupActive([`${base}/medicines`, `${base}/manufacturers`, `${base}/stocks`, `${base}/distributors`])}
                    items={items}
                  />
                )
              })()}

              {canView('purchases') ? (
                <Dropdown
                  label="Purchases"
                  active={groupActive([`${base}/purchases`])}
                  items={[
                    { to: `${base}/purchases`, text: 'Purchase Entry' },
                    { to: `${base}/purchases/view`, text: 'Purchase Views' },
                  ]}
                />
              ) : null}

              {canView('sales') ? (
                <Dropdown
                  label="Sales"
                  active={groupActive([`${base}/sales`])}
                  items={[
                    { to: `${base}/sales`, text: 'Sales Entry' },
                    { to: `${base}/sales/view`, text: 'Sales Views' },
                  ]}
                />
              ) : null}

              {canView('reports') ? (
                <Dropdown
                  label="Reports"
                  active={groupActive([`${base}/reports`])}
                  items={[
                    { to: `${base}/reports/profit`, text: 'Profit Report' },
                    { to: `${base}/reports/items-sold`, text: 'Items Sold Report' },
                  ]}
                />
              ) : null}

              {canView('users') ? (
                <NavLink
                  className={({ isActive }) =>
                    [
                      'rounded-xl px-3 py-2 text-sm ring-1 ring-inset transition-colors',
                      isActive
                        ? 'bg-white/10 text-sky-200 ring-white/15'
                        : 'bg-transparent text-slate-300 ring-transparent hover:bg-white/5 hover:text-slate-100',
                    ].join(' ')
                  }
                  to={`${base}/users`}
                  end
                >
                  Users
                </NavLink>
              ) : null}
            </nav>
          ) : isSuperAdmin ? (
            <nav aria-label="SuperAdmin" className="hidden items-center gap-2 md:flex">
              <NavLink className={navItemClass} to="/superadmin/pending" end>
                Pending
              </NavLink>
              <NavLink className={navItemClass} to="/superadmin/pharmacies" end>
                Pharmacies
              </NavLink>
              <NavLink className={navItemClass} to="/superadmin/approvals" end>
                Approvals
              </NavLink>
              <NavLink className={navItemClass} to="/superadmin/categories" end>
                Categories
              </NavLink>
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
                <LinkButton
                  to={isSuperAdmin ? '/superadmin/change-password' : `${base}/change-password`}
                  variant="secondary"
                  className="hidden md:inline-flex"
                >
                  Change password
                </LinkButton>
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
      </div>

      {mobileOpen && (isTenantUser || isSuperAdmin) && typeof document !== 'undefined'
        ? createPortal(
            (
        <div
          className="fixed inset-0 z-[2000] bg-black/60 md:hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileOpen(false)
          }}
          onTouchStart={(e) => {
            if (e.target === e.currentTarget) setMobileOpen(false)
          }}
        >
          <div
            className="absolute left-0 top-0 h-full w-[86vw] max-w-sm overflow-auto bg-slate-950 p-4 ring-1 ring-inset ring-white/10"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-100">Menu</div>
              <button
                type="button"
                className="rounded-lg bg-white/5 px-3 py-1.5 text-sm text-slate-200 ring-1 ring-inset ring-white/10 hover:bg-white/10"
                onClick={() => setMobileOpen(false)}
              >
                Close
              </button>
            </div>

            {isTenantUser ? (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">General</div>
                  <div className="mt-2 grid gap-1">
                    <NavLink
                      to={`${base}/dashboard`}
                      end
                      className={({ isActive }) =>
                        [
                          'block rounded-xl px-3 py-2 text-sm ring-1 ring-inset transition-colors',
                          isActive
                            ? 'bg-white/10 text-sky-200 ring-white/15'
                            : 'bg-transparent text-slate-200 ring-white/10 hover:bg-white/5',
                        ].join(' ')
                      }
                    >
                      Dashboard
                    </NavLink>
                  </div>
                </div>

                {(() => {
                  const links: Array<{ to: string; text: string }> = []
                  if (canView('medicines')) links.push({ to: `${base}/medicines`, text: 'Item Management' })
                  if (canView('medicines')) links.push({ to: `${base}/manufacturers`, text: 'Manufacturer Management' })
                  if (canView('purchases')) links.push({ to: `${base}/distributors`, text: 'Distributor Management' })
                  if (canView('medicines')) links.push({ to: `${base}/stocks`, text: 'Stocks' })
                  if (!links.length) return null

                  return (
                    <div>
                      <div className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Masters</div>
                      <div className="mt-2 grid gap-1">
                        {links.map((l) => (
                          <NavLink
                            key={l.to}
                            to={l.to}
                            end
                            className={({ isActive }) =>
                              [
                                'block rounded-xl px-3 py-2 text-sm ring-1 ring-inset transition-colors',
                                isActive
                                  ? 'bg-white/10 text-sky-200 ring-white/15'
                                  : 'bg-transparent text-slate-200 ring-white/10 hover:bg-white/5',
                              ].join(' ')
                            }
                          >
                            {l.text}
                          </NavLink>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {canView('purchases') ? (
                  <div>
                    <div className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Purchases</div>
                    <div className="mt-2 grid gap-1">
                      <NavLink
                        to={`${base}/purchases`}
                        end
                        className={({ isActive }) =>
                          [
                            'block rounded-xl px-3 py-2 text-sm ring-1 ring-inset transition-colors',
                            isActive
                              ? 'bg-white/10 text-sky-200 ring-white/15'
                              : 'bg-transparent text-slate-200 ring-white/10 hover:bg-white/5',
                          ].join(' ')
                        }
                      >
                        Purchase Entry
                      </NavLink>
                      <NavLink
                        to={`${base}/purchases/view`}
                        end
                        className={({ isActive }) =>
                          [
                            'block rounded-xl px-3 py-2 text-sm ring-1 ring-inset transition-colors',
                            isActive
                              ? 'bg-white/10 text-sky-200 ring-white/15'
                              : 'bg-transparent text-slate-200 ring-white/10 hover:bg-white/5',
                          ].join(' ')
                        }
                      >
                        Purchase Views
                      </NavLink>
                    </div>
                  </div>
                ) : null}

                {canView('sales') ? (
                  <div>
                    <div className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Sales</div>
                    <div className="mt-2 grid gap-1">
                      <NavLink
                        to={`${base}/sales`}
                        end
                        className={({ isActive }) =>
                          [
                            'block rounded-xl px-3 py-2 text-sm ring-1 ring-inset transition-colors',
                            isActive
                              ? 'bg-white/10 text-sky-200 ring-white/15'
                              : 'bg-transparent text-slate-200 ring-white/10 hover:bg-white/5',
                          ].join(' ')
                        }
                      >
                        Sales Entry
                      </NavLink>
                      <NavLink
                        to={`${base}/sales/view`}
                        end
                        className={({ isActive }) =>
                          [
                            'block rounded-xl px-3 py-2 text-sm ring-1 ring-inset transition-colors',
                            isActive
                              ? 'bg-white/10 text-sky-200 ring-white/15'
                              : 'bg-transparent text-slate-200 ring-white/10 hover:bg-white/5',
                          ].join(' ')
                        }
                      >
                        Sales Views
                      </NavLink>
                    </div>
                  </div>
                ) : null}

                {canView('reports') ? (
                  <div>
                    <div className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Reports</div>
                    <div className="mt-2 grid gap-1">
                      <NavLink
                        to={`${base}/reports/profit`}
                        end
                        className={({ isActive }) =>
                          [
                            'block rounded-xl px-3 py-2 text-sm ring-1 ring-inset transition-colors',
                            isActive
                              ? 'bg-white/10 text-sky-200 ring-white/15'
                              : 'bg-transparent text-slate-200 ring-white/10 hover:bg-white/5',
                          ].join(' ')
                        }
                      >
                        Profit Report
                      </NavLink>
                      <NavLink
                        to={`${base}/reports/items-sold`}
                        end
                        className={({ isActive }) =>
                          [
                            'block rounded-xl px-3 py-2 text-sm ring-1 ring-inset transition-colors',
                            isActive
                              ? 'bg-white/10 text-sky-200 ring-white/15'
                              : 'bg-transparent text-slate-200 ring-white/10 hover:bg-white/5',
                          ].join(' ')
                        }
                      >
                        Items Sold Report
                      </NavLink>
                    </div>
                  </div>
                ) : null}

                {canView('users') ? (
                  <div>
                    <div className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Users</div>
                    <div className="mt-2 grid gap-1">
                      <NavLink
                        to={`${base}/users`}
                        end
                        className={({ isActive }) =>
                          [
                            'block rounded-xl px-3 py-2 text-sm ring-1 ring-inset transition-colors',
                            isActive
                              ? 'bg-white/10 text-sky-200 ring-white/15'
                              : 'bg-transparent text-slate-200 ring-white/10 hover:bg-white/5',
                          ].join(' ')
                        }
                      >
                        Users
                      </NavLink>
                    </div>
                  </div>
                ) : null}

                <div className="pt-2">
                  <div className="px-2 text-xs text-slate-500">{user?.email}</div>
                  <div className="mt-2 grid gap-2">
                    <NavLink
                      to={`${base}/change-password`}
                      end
                      className={({ isActive }) =>
                        [
                          'block rounded-xl px-3 py-2 text-sm ring-1 ring-inset transition-colors',
                          isActive
                            ? 'bg-white/10 text-sky-200 ring-white/15'
                            : 'bg-transparent text-slate-200 ring-white/10 hover:bg-white/5',
                        ].join(' ')
                      }
                    >
                      Change password
                    </NavLink>
                    <Button variant="secondary" onClick={logout}>
                      Logout
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-1">
                <NavLink
                  className={({ isActive }) =>
                    [
                      'block rounded-xl px-3 py-2 text-sm ring-1 ring-inset transition-colors',
                      isActive
                        ? 'bg-white/10 text-sky-200 ring-white/15'
                        : 'bg-transparent text-slate-200 ring-white/10 hover:bg-white/5',
                    ].join(' ')
                  }
                  to="/superadmin/pending"
                  end
                >
                  Pending Pharmacies
                </NavLink>
                <NavLink
                  className={({ isActive }) =>
                    [
                      'block rounded-xl px-3 py-2 text-sm ring-1 ring-inset transition-colors',
                      isActive
                        ? 'bg-white/10 text-sky-200 ring-white/15'
                        : 'bg-transparent text-slate-200 ring-white/10 hover:bg-white/5',
                    ].join(' ')
                  }
                  to="/superadmin/pharmacies"
                  end
                >
                  Pharmacies
                </NavLink>
                <NavLink
                  className={({ isActive }) =>
                    [
                      'block rounded-xl px-3 py-2 text-sm ring-1 ring-inset transition-colors',
                      isActive
                        ? 'bg-white/10 text-sky-200 ring-white/15'
                        : 'bg-transparent text-slate-200 ring-white/10 hover:bg-white/5',
                    ].join(' ')
                  }
                  to="/superadmin/approvals"
                  end
                >
                  Approvals
                </NavLink>
                <NavLink
                  className={({ isActive }) =>
                    [
                      'block rounded-xl px-3 py-2 text-sm ring-1 ring-inset transition-colors',
                      isActive
                        ? 'bg-white/10 text-sky-200 ring-white/15'
                        : 'bg-transparent text-slate-200 ring-white/10 hover:bg-white/5',
                    ].join(' ')
                  }
                  to="/superadmin/categories"
                  end
                >
                  Categories
                </NavLink>
                <NavLink
                  className={({ isActive }) =>
                    [
                      'block rounded-xl px-3 py-2 text-sm ring-1 ring-inset transition-colors',
                      isActive
                        ? 'bg-white/10 text-sky-200 ring-white/15'
                        : 'bg-transparent text-slate-200 ring-white/10 hover:bg-white/5',
                    ].join(' ')
                  }
                  to="/superadmin/change-password"
                  end
                >
                  Change password
                </NavLink>

                <div className="pt-3">
                  <div className="px-2 text-xs text-slate-500">{user?.email}</div>
                  <div className="mt-2">
                    <Button variant="secondary" onClick={logout}>
                      Logout
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
            ),
            document.body,
          )
        : null}
    </header>
  )
}
