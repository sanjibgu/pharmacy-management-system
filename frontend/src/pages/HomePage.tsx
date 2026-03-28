import Button from '../components/Button'
import Container from '../components/Container'
import LinkButton from '../components/LinkButton'
import SiteFooter from '../components/SiteFooter'
import SiteHeader from '../components/SiteHeader'

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-inset ring-white/10">
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-slate-400">{label}</div>
    </div>
  )
}

function Feature({
  title,
  desc,
}: {
  title: string
  desc: string
}) {
  return (
    <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-inset ring-white/10">
      <div className="text-sm font-semibold text-slate-100">{title}</div>
      <p className="mt-2 text-sm leading-6 text-slate-400">{desc}</p>
    </div>
  )
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader />

      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-[-220px] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-sky-500/20 blur-3xl" />
            <div className="absolute right-[-200px] top-[80px] h-[460px] w-[460px] rounded-full bg-indigo-500/15 blur-3xl" />
          </div>

          <Container>
            <div className="grid gap-10 py-16 md:grid-cols-12 md:items-center md:py-24">
              <div className="md:col-span-7">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300 ring-1 ring-inset ring-white/10">
                  <span className="size-1.5 rounded-full bg-sky-400" />
                  MERN starter • React + Tailwind
                </div>
                <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-5xl">
                  Build a better pharmacy experience with a modern portal
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
                  A clean, enterprise-style homepage inspired by leading
                  healthcare platforms — designed for eligibility, pricing,
                  prior auth workflows, and analytics-ready UI.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Button>Get started</Button>
                  <Button variant="secondary">View capabilities</Button>
                  <LinkButton to="/pharmacy/register" variant="secondary">
                    New pharmacy registration
                  </LinkButton>
                </div>

                <div className="mt-10 flex flex-wrap gap-2 text-xs text-slate-400">
                  {['RBAC-ready', 'API-first UI', 'Responsive', 'Accessible'].map(
                    (chip) => (
                      <span
                        key={chip}
                        className="rounded-full bg-white/5 px-3 py-1 ring-1 ring-inset ring-white/10"
                      >
                        {chip}
                      </span>
                    ),
                  )}
                </div>
              </div>

              <div className="md:col-span-5">
                <div className="rounded-3xl bg-gradient-to-b from-white/10 to-white/5 p-6 ring-1 ring-inset ring-white/10">
                  <div className="text-sm font-semibold">At-a-glance</div>
                  <p className="mt-2 text-sm text-slate-400">
                    Swap these placeholders with real metrics once your backend
                    is connected.
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <Stat value="99.9%" label="Uptime target" />
                    <Stat value="250ms" label="API p95 goal" />
                    <Stat value="SOC2" label="Compliance-ready path" />
                    <Stat value="MERN" label="Node + MongoDB" />
                  </div>

                  <div className="mt-6 rounded-2xl bg-slate-950/50 p-5 ring-1 ring-inset ring-white/10">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                      Typical modules
                    </div>
                    <ul className="mt-3 space-y-2 text-sm text-slate-400">
                      <li className="flex items-center gap-2">
                        <span className="size-1.5 rounded-full bg-sky-400" />
                        Member search + coverage
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="size-1.5 rounded-full bg-sky-400" />
                        Claims + pricing views
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="size-1.5 rounded-full bg-sky-400" />
                        Prior auth intake
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="size-1.5 rounded-full bg-sky-400" />
                        Operational analytics
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </Container>
        </section>

        <section id="solutions" className="border-t border-white/10 py-16">
          <Container>
            <div className="grid gap-10 md:grid-cols-12 md:items-end">
              <div className="md:col-span-6">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Solutions
                </div>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                  Designed for pharmacy workflows
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  A flexible UI foundation you can map to your products: member
                  support, care teams, client admins, and internal operations.
                </p>
              </div>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <Feature
                title="Member experience"
                desc="Search, coverage details, and clear next-steps that reduce friction."
              />
              <Feature
                title="Operations dashboards"
                desc="Queue-based workflows with filters, bulk actions, and audit-friendly layouts."
              />
              <Feature
                title="Client administration"
                desc="Configuration screens ready for roles, entitlements, and multi-tenant data."
              />
            </div>
          </Container>
        </section>

        <section id="platform" className="py-16">
          <Container>
            <div className="grid gap-10 md:grid-cols-12 md:items-center">
              <div className="md:col-span-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Platform
                </div>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                  API-first, analytics-ready UI
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  Build against Express endpoints, secure with JWT + RBAC, and
                  wire telemetry from day one. Keep screens consistent with a
                  small set of components.
                </p>
                <div className="mt-6 flex gap-3">
                  <Button variant="secondary">Explore components</Button>
                  <Button>See roadmap</Button>
                </div>
              </div>

              <div className="md:col-span-7">
                <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-inset ring-white/10">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl bg-slate-950/40 p-5 ring-1 ring-inset ring-white/10">
                      <div className="text-sm font-semibold">Security</div>
                      <p className="mt-2 text-sm text-slate-400">
                        Route guards, role-based navigation, and consistent
                        session handling.
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-950/40 p-5 ring-1 ring-inset ring-white/10">
                      <div className="text-sm font-semibold">Performance</div>
                      <p className="mt-2 text-sm text-slate-400">
                        Lean pages, predictable loading states, and scalable
                        layout primitives.
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-950/40 p-5 ring-1 ring-inset ring-white/10">
                      <div className="text-sm font-semibold">Observability</div>
                      <p className="mt-2 text-sm text-slate-400">
                        Add events for key actions to support analytics and
                        audits.
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-950/40 p-5 ring-1 ring-inset ring-white/10">
                      <div className="text-sm font-semibold">Extensibility</div>
                      <p className="mt-2 text-sm text-slate-400">
                        Compose new modules without rewriting the foundation.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Container>
        </section>

        <section id="insights" className="border-y border-white/10 py-16">
          <Container>
            <div className="grid gap-10 md:grid-cols-12">
              <div className="md:col-span-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Insights
                </div>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                  Make decisions with confidence
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  Build a data story around utilization, turnaround times, and
                  member satisfaction — all from a UI that’s ready for charts
                  and tables.
                </p>
              </div>
              <div className="md:col-span-7">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Stat value="24/7" label="Self-serve access" />
                  <Stat value="1+ yrs" label="Audit trail horizon" />
                  <Stat value="N" label="Tenants supported" />
                </div>
                <div className="mt-4 rounded-3xl bg-white/5 p-6 ring-1 ring-inset ring-white/10">
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <div className="text-sm font-semibold">
                        Reporting starter
                      </div>
                      <p className="mt-2 text-sm text-slate-400">
                        Add a charts library later (Recharts, ECharts, etc.).
                        This section is a layout placeholder.
                      </p>
                    </div>
                    <div className="hidden rounded-2xl bg-gradient-to-br from-sky-500/20 to-indigo-500/20 p-4 ring-1 ring-inset ring-white/10 sm:block">
                      <div className="h-14 w-20 rounded-lg bg-white/10" />
                      <div className="mt-3 h-3 w-16 rounded bg-white/10" />
                      <div className="mt-2 h-3 w-12 rounded bg-white/10" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Container>
        </section>

        <section id="about" className="py-16">
          <Container>
            <div className="grid gap-10 md:grid-cols-12 md:items-center">
              <div className="md:col-span-7">
                <h2 className="text-2xl font-semibold tracking-tight">
                  Enterprise look, startup speed
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  This homepage is intentionally “RxSense-style” in structure
                  (hero, capability blocks, proof points, CTA) without copying
                  their content or branding. Replace the copy with your product
                  specifics.
                </p>
              </div>
              <div className="md:col-span-5">
                <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-inset ring-white/10">
                  <div className="text-sm font-semibold">Next steps</div>
                  <ol className="mt-3 space-y-2 text-sm text-slate-400">
                    <li>1) Add React Router pages</li>
                    <li>2) Connect to Express APIs</li>
                    <li>3) Add auth + roles</li>
                    <li>4) Build dashboards + tables</li>
                  </ol>
                </div>
              </div>
            </div>
          </Container>
        </section>

        <section id="contact" className="pb-16">
          <Container>
            <div className="rounded-3xl bg-gradient-to-r from-sky-500/15 via-white/5 to-indigo-500/15 p-8 ring-1 ring-inset ring-white/10 md:p-10">
              <div className="grid gap-8 md:grid-cols-12 md:items-center">
                <div className="md:col-span-8">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Ready to connect the backend?
                  </h2>
                  <p className="mt-2 text-sm text-slate-300">
                    I can scaffold the Node/Express API (with mongoose), env
                    config, and a clean folder structure for MERN.
                  </p>
                </div>
                <div className="md:col-span-4 md:flex md:justify-end">
                  <Button className="w-full md:w-auto">Create backend</Button>
                </div>
              </div>
            </div>
          </Container>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
