import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Button from '../components/Button'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../services/api'
import { getTenantSlug } from '../services/tenant'

type ProfitTotals = {
  bills: number
  grossAmount: number
  billDiscountAmount: number
  netAmount: number
  costAmount: number
  grossProfitAmount: number
  netProfitAmount: number
}

type ProfitDay = {
  date: string
  bills: number
  grossAmount: number
  billDiscountAmount: number
  netAmount: number
  costAmount: number
  netProfitAmount: number
}

type ProfitReport = {
  range: { preset: 'currentMonth' | 'custom'; from: string; to: string }
  totals: ProfitTotals
  byDay: ProfitDay[]
}

function fmtMoney(n: number | undefined) {
  const v = Number(n || 0)
  return Number.isFinite(v) ? v.toFixed(2) : '0.00'
}

function fmtDate(ymd: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''))
  if (!m) return ymd
  return `${m[3]}/${m[2]}/${m[1]}`
}

function todayYmdUtc() {
  const d = new Date()
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export default function ProfitReportPage() {
  const { token, user } = useAuth()
  const { tenantSlug } = useParams()
  const isLocalhost = window.location.hostname === 'localhost'
  const effectiveSlug = tenantSlug || (isLocalhost ? getTenantSlug() : null)
  const base = effectiveSlug ? `/${effectiveSlug}` : ''

  const canView = user?.role === 'PharmacyAdmin' || Boolean(user?.moduleAccess?.reports?.view)

  const [mode, setMode] = useState<'currentMonth' | 'custom'>('currentMonth')
  const [from, setFrom] = useState(todayYmdUtc())
  const [to, setTo] = useState(todayYmdUtc())

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<ProfitReport | null>(null)

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    if (mode === 'custom') {
      p.set('preset', 'custom')
      p.set('from', from)
      p.set('to', to)
    } else {
      p.set('preset', 'currentMonth')
    }
    return p.toString()
  }, [mode, from, to])

  async function load() {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch<ProfitReport>(`/api/reports/profit?${qs}`, { token })
      setReport(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!canView) return
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, mode])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader />
      <main className="py-4">
        <div className="mx-auto w-full px-4 sm:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Profit Report</h1>
              <div className="mt-1 text-sm text-slate-400">Current month or custom date range.</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                className="rounded-full bg-transparent px-4 py-2 text-sm text-slate-300 ring-1 ring-inset ring-white/10 hover:bg-white/5"
                to={`${base}/sales/view`}
              >
                Sales Views
              </Link>
            </div>
          </div>

          {!canView ? (
            <div className="mt-6 rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-100 ring-1 ring-inset ring-amber-400/20">
              Module access denied.
            </div>
          ) : null}

          {error ? (
            <div className="mt-6 rounded-2xl bg-rose-500/10 p-4 text-sm text-rose-200 ring-1 ring-inset ring-rose-400/20">
              {error}
            </div>
          ) : null}

          {canView ? (
            <div className="mt-6 rounded-3xl bg-white/5 p-6 ring-1 ring-inset ring-white/10">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('currentMonth')}
                    className={`h-10 rounded-xl px-4 text-sm ring-1 ring-inset ${
                      mode === 'currentMonth'
                        ? 'bg-white/10 text-slate-100 ring-white/20'
                        : 'bg-transparent text-slate-300 ring-white/10 hover:bg-white/5'
                    }`}
                  >
                    Current Month
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('custom')}
                    className={`h-10 rounded-xl px-4 text-sm ring-1 ring-inset ${
                      mode === 'custom'
                        ? 'bg-white/10 text-slate-100 ring-white/20'
                        : 'bg-transparent text-slate-300 ring-white/10 hover:bg-white/5'
                    }`}
                  >
                    Custom
                  </button>

                  {mode === 'custom' ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        className="h-10 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                        type="date"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                      />
                      <span className="text-sm text-slate-400">to</span>
                      <input
                        className="h-10 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                        type="date"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                      />
                      <Button type="button" variant="secondary" onClick={() => void load()} disabled={loading}>
                        Apply
                      </Button>
                    </div>
                  ) : null}
                </div>

                <Button type="button" variant="secondary" onClick={() => void load()} disabled={loading}>
                  {loading ? 'Loading...' : 'Refresh'}
                </Button>
              </div>

              {report ? (
                <>
                  <div className="mt-4 text-xs text-slate-400">
                    Range: {fmtDate(report.range.from)} → {fmtDate(report.range.to)}
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                    <div className="rounded-2xl bg-slate-950/40 p-4 ring-1 ring-inset ring-white/10">
                      <div className="text-xs text-slate-400">Bills</div>
                      <div className="mt-1 text-lg font-semibold tabular-nums">{report.totals.bills}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-950/40 p-4 ring-1 ring-inset ring-white/10">
                      <div className="text-xs text-slate-400">Gross</div>
                      <div className="mt-1 text-lg font-semibold tabular-nums">{fmtMoney(report.totals.grossAmount)}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-950/40 p-4 ring-1 ring-inset ring-white/10">
                      <div className="text-xs text-slate-400">Bill Discount</div>
                      <div className="mt-1 text-lg font-semibold tabular-nums">{fmtMoney(report.totals.billDiscountAmount)}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-950/40 p-4 ring-1 ring-inset ring-white/10">
                      <div className="text-xs text-slate-400">Net Sales</div>
                      <div className="mt-1 text-lg font-semibold tabular-nums">{fmtMoney(report.totals.netAmount)}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-950/40 p-4 ring-1 ring-inset ring-white/10">
                      <div className="text-xs text-slate-400">Cost</div>
                      <div className="mt-1 text-lg font-semibold tabular-nums">{fmtMoney(report.totals.costAmount)}</div>
                    </div>
                    <div className="rounded-2xl bg-emerald-500/10 p-4 ring-1 ring-inset ring-emerald-400/20">
                      <div className="text-xs text-emerald-100">Net Profit</div>
                      <div className="mt-1 text-lg font-semibold tabular-nums text-emerald-100">
                        {fmtMoney(report.totals.netProfitAmount)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 overflow-x-auto">
                    <table className="w-full min-w-[980px] text-left text-sm">
                      <thead className="text-xs uppercase tracking-wide text-slate-400">
                        <tr>
                          <th className="py-2 pr-3">Date</th>
                          <th className="py-2 pr-3 text-right">Bills</th>
                          <th className="py-2 pr-3 text-right">Gross</th>
                          <th className="py-2 pr-3 text-right">Discount</th>
                          <th className="py-2 pr-3 text-right">Net</th>
                          <th className="py-2 pr-3 text-right">Cost</th>
                          <th className="py-2 pr-3 text-right">Profit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {report.byDay.length ? (
                          report.byDay.map((d) => (
                            <tr key={d.date}>
                              <td className="py-3 pr-3 text-slate-200">{fmtDate(d.date)}</td>
                              <td className="py-3 pr-3 text-right tabular-nums text-slate-200">{d.bills}</td>
                              <td className="py-3 pr-3 text-right tabular-nums text-slate-200">
                                {fmtMoney(d.grossAmount)}
                              </td>
                              <td className="py-3 pr-3 text-right tabular-nums text-slate-200">
                                {fmtMoney(d.billDiscountAmount)}
                              </td>
                              <td className="py-3 pr-3 text-right tabular-nums text-slate-200">{fmtMoney(d.netAmount)}</td>
                              <td className="py-3 pr-3 text-right tabular-nums text-slate-200">{fmtMoney(d.costAmount)}</td>
                              <td className="py-3 pr-3 text-right tabular-nums text-emerald-200">
                                {fmtMoney(d.netProfitAmount)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="py-4 text-slate-400" colSpan={7}>
                              No sales in this range.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="mt-6 text-sm text-slate-400">{loading ? 'Loading...' : 'No data yet.'}</div>
              )}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  )
}
