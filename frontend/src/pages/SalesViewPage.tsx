import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Button from '../components/Button'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../services/api'
import { getTenantSlug } from '../services/tenant'

type Sale = {
  _id: string
  saleDate: string
  paymentType: 'Cash' | 'Credit' | 'UPI'
  totalAmount: number
  discountAmount: number
  billDiscountPercent?: number
  netAmount: number
  paidAmount: number
  balanceAmount: number
  patientName?: string
  phone?: string
  doctorName?: string
  remarks?: string
  createdAt: string
}

type SaleItem = {
  _id: string
  medicineId: string
  medicine?: {
    _id: string
    medicineName: string
    manufacturer?: string
    category?: string
  } | null
  batchNumber: string
  expiryDate: string
  unitType: 'pack' | 'unit'
  quantity: number
  mrp: number
  saleRate: number
  amount: number
}

function fmtDate(d: string | undefined) {
  if (!d) return '-'
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return '-'
  const dd = String(dt.getDate()).padStart(2, '0')
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const yy = String(dt.getFullYear())
  return `${dd}/${mm}/${yy}`
}

export default function SalesViewPage() {
  const { token, user } = useAuth()
  const { tenantSlug } = useParams()
  const isLocalhost = window.location.hostname === 'localhost'
  const effectiveSlug = tenantSlug || (isLocalhost ? getTenantSlug() : null)
  const base = effectiveSlug ? `/${effectiveSlug}` : ''

  const canView = user?.role === 'PharmacyAdmin' || Boolean(user?.moduleAccess?.sales?.view)
  const canManage = user?.role === 'PharmacyAdmin' || Boolean(user?.moduleAccess?.sales?.manage)

  const [items, setItems] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [sortKey, setSortKey] = useState<'new' | 'old' | 'date' | 'net'>('new')

  const [viewing, setViewing] = useState<{ sale: Sale; lines: SaleItem[] } | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch<{ items: Sale[] }>(`/api/sales?limit=200`, { token })
      setItems(res.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sales')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!canView) return
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView])

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase()
    const list = !q
      ? items
      : items.filter((s) => {
          const hay = `${fmtDate(s.saleDate)} ${s.paymentType} ${Number(s.netAmount || 0).toFixed(2)} ${s.patientName || ''} ${s.doctorName || ''} ${s.phone || ''}`.toLowerCase()
          return hay.includes(q)
        })

    const sorted = [...list]
    sorted.sort((a, b) => {
      if (sortKey === 'date') return +new Date(b.saleDate) - +new Date(a.saleDate)
      if (sortKey === 'net') return Number(b.netAmount || 0) - Number(a.netAmount || 0)
      if (sortKey === 'old') return +new Date(a.createdAt) - +new Date(b.createdAt)
      return +new Date(b.createdAt) - +new Date(a.createdAt)
    })
    return sorted
  }, [items, searchText, sortKey])

  async function openView(s: Sale) {
    setError(null)
    try {
      const res = await apiFetch<{ sale: Sale; items: SaleItem[] }>(`/api/sales/${s._id}`, { token })
      setViewing({ sale: res.sale, lines: res.items || [] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sale details')
    }
  }

  async function removeSale(s: Sale) {
    if (!canManage) return
    const ok = window.confirm(
      `Delete sale?\n\n${fmtDate(s.saleDate)} • Net ${Number(s.netAmount || 0).toFixed(2)}\nThis will restore stock.`,
    )
    if (!ok) return
    setError(null)
    try {
      await apiFetch(`/api/sales/${s._id}`, { method: 'DELETE', token })
      setItems((prev) => prev.filter((x) => x._id !== s._id))
      if (viewing?.sale._id === s._id) setViewing(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete sale')
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader />
      <main className="py-4">
        <div className="mx-auto w-full px-4 sm:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Sales Views</h1>
              <div className="mt-1 text-sm text-slate-400">Search, view, edit, or delete sales.</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                className="rounded-full bg-transparent px-4 py-2 text-sm text-slate-300 ring-1 ring-inset ring-white/10 hover:bg-white/5"
                to={`${base}/sales`}
              >
                Back to Entry
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
                <div className="flex flex-1 flex-wrap items-center gap-3">
                  <input
                    className="h-10 w-full rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 md:w-80"
                    placeholder="Search date / patient / doctor / phone / type..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                  />
                  <select
                    className="h-10 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
                  >
                    <option value="new">Newest</option>
                    <option value="old">Oldest</option>
                    <option value="date">Sale date</option>
                    <option value="net">Net amount</option>
                  </select>
                </div>
                <Button variant="secondary" onClick={() => void load()} disabled={loading}>
                  Refresh
                </Button>
              </div>

              <div className="mt-4 md:hidden space-y-3">
                {loading ? (
                  <div className="rounded-2xl bg-slate-950/40 p-4 text-sm text-slate-400 ring-1 ring-inset ring-white/10">
                    Loading...
                  </div>
                ) : filtered.length ? (
                  filtered.map((s) => (
                    <div key={s._id} className="rounded-2xl bg-slate-950/40 p-4 ring-1 ring-inset ring-white/10">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-100">{fmtDate(s.saleDate)}</div>
                          <div className="mt-0.5 text-xs text-slate-400">
                            {s.patientName || '-'} | {s.doctorName || '-'} | {s.paymentType}
                          </div>
                          {s.phone ? <div className="mt-0.5 text-xs text-slate-500">{s.phone}</div> : null}
                        </div>
                        <div className="text-right text-xs text-slate-400">
                          Net <span className="tabular-nums text-slate-100">{Number(s.netAmount || 0).toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded-xl bg-black/20 p-2 ring-1 ring-inset ring-white/10">
                          <div className="text-slate-500">Paid</div>
                          <div className="mt-0.5 tabular-nums text-slate-200">{Number(s.paidAmount || 0).toFixed(2)}</div>
                        </div>
                        <div className="rounded-xl bg-black/20 p-2 ring-1 ring-inset ring-white/10">
                          <div className="text-slate-500">Balance</div>
                          <div className="mt-0.5 tabular-nums text-slate-200">{Number(s.balanceAmount || 0).toFixed(2)}</div>
                        </div>
                        <div className="rounded-xl bg-black/20 p-2 ring-1 ring-inset ring-white/10">
                          <div className="text-slate-500">Type</div>
                          <div className="mt-0.5 text-slate-200">{s.paymentType}</div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={() => void openView(s)}>
                          View
                        </Button>
                        <Link
                          className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm ring-1 ring-inset ${
                            canManage
                              ? 'bg-transparent text-slate-200 ring-white/10 hover:bg-white/5'
                              : 'cursor-not-allowed bg-white/5 text-slate-500 ring-white/10'
                          }`}
                          to={`${base}/sales/${s._id}/edit`}
                          onClick={(e) => {
                            if (!canManage) e.preventDefault()
                          }}
                        >
                          Edit
                        </Link>
                        <Button variant="danger" onClick={() => void removeSale(s)} disabled={!canManage}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl bg-slate-950/40 p-4 text-sm text-slate-400 ring-1 ring-inset ring-white/10">
                    No sales found.
                  </div>
                )}
              </div>

              <div className="mt-4 hidden md:block overflow-x-auto">
                <table className="w-full min-w-[1100px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Patient</th>
                      <th className="py-2 pr-3">Doctor</th>
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3 text-right">Net</th>
                      <th className="py-2 pr-3 text-right">Paid</th>
                      <th className="py-2 pr-3 text-right">Balance</th>
                      <th className="py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {loading ? (
                      <tr>
                        <td className="py-4 text-slate-400" colSpan={8}>
                          Loading...
                        </td>
                      </tr>
                    ) : filtered.length ? (
                      filtered.map((s) => (
                        <tr key={s._id}>
                          <td className="py-3 pr-3 text-slate-200">{fmtDate(s.saleDate)}</td>
                          <td className="py-3 pr-3 text-slate-200">{s.patientName || '-'}</td>
                          <td className="py-3 pr-3 text-slate-200">{s.doctorName || '-'}</td>
                          <td className="py-3 pr-3 text-slate-200">{s.paymentType}</td>
                          <td className="py-3 pr-3 text-right tabular-nums text-slate-200">
                            {Number(s.netAmount || 0).toFixed(2)}
                          </td>
                          <td className="py-3 pr-3 text-right tabular-nums text-slate-200">
                            {Number(s.paidAmount || 0).toFixed(2)}
                          </td>
                          <td className="py-3 pr-3 text-right tabular-nums text-slate-200">
                            {Number(s.balanceAmount || 0).toFixed(2)}
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="secondary" onClick={() => void openView(s)}>
                                View
                              </Button>
                              <Link
                                className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm ring-1 ring-inset ${
                                  canManage
                                    ? 'bg-transparent text-slate-200 ring-white/10 hover:bg-white/5'
                                    : 'cursor-not-allowed bg-white/5 text-slate-500 ring-white/10'
                                }`}
                                to={`${base}/sales/${s._id}/edit`}
                                onClick={(e) => {
                                  if (!canManage) e.preventDefault()
                                }}
                              >
                                Edit
                              </Link>
                              <Button variant="danger" onClick={() => void removeSale(s)} disabled={!canManage}>
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="py-4 text-slate-400" colSpan={8}>
                          No sales found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {viewing ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-5xl rounded-3xl bg-slate-950 p-6 ring-1 ring-inset ring-white/10">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-lg font-semibold">Sale {fmtDate(viewing.sale.saleDate)}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      Net {Number(viewing.sale.netAmount || 0).toFixed(2)} • {viewing.sale.paymentType}
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {canManage ? (
                      <Link
                        className="inline-flex h-10 items-center justify-center rounded-xl bg-transparent px-4 text-sm text-slate-200 ring-1 ring-inset ring-white/10 hover:bg-white/5"
                        to={`${base}/sales/${viewing.sale._id}/edit`}
                      >
                        Edit
                      </Link>
                    ) : null}
                    <Button variant="secondary" onClick={() => setViewing(null)}>
                      Close
                    </Button>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[980px] text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="py-2 pr-3">Medicine</th>
                        <th className="py-2 pr-3">Batch</th>
                        <th className="py-2 pr-3">Exp</th>
                        <th className="py-2 pr-3">Unit</th>
                        <th className="py-2 pr-3 text-right">Qty</th>
                        <th className="py-2 pr-3 text-right">S.R</th>
                        <th className="py-2 pr-3 text-right">Amt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {viewing.lines.map((l) => (
                        <tr key={l._id}>
                          <td className="py-2 pr-3 text-slate-200">
                            <div className="font-medium">{l.medicine?.medicineName || l.medicineId}</div>
                            {l.medicine?.manufacturer || l.medicine?.category ? (
                              <div className="text-xs text-slate-400">
                                {[l.medicine?.manufacturer || '', l.medicine?.category || ''].filter(Boolean).join(' • ')}
                              </div>
                            ) : null}
                          </td>
                          <td className="py-2 pr-3 text-slate-200">{l.batchNumber}</td>
                          <td className="py-2 pr-3 text-slate-200">{fmtDate(l.expiryDate)}</td>
                          <td className="py-2 pr-3 text-slate-200">{l.unitType}</td>
                          <td className="py-2 pr-3 text-right tabular-nums text-slate-200">{l.quantity}</td>
                          <td className="py-2 pr-3 text-right tabular-nums text-slate-200">
                            {Number(l.saleRate || 0).toFixed(2)}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums text-slate-200">
                            {Number(l.amount || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  )
}
