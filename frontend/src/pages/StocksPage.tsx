import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Button from '../components/Button'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../services/api'
import { getTenantSlug } from '../services/tenant'

type MedicineRef = {
  _id: string
  medicineName: string
  manufacturer: string
  category: string
  dosageForm: string
  unitsPerStrip: number
  allowLooseSale: boolean
  defaultRackLocation: string
  hsnCode: string
  gstPercent: number
}

type StockRow = {
  _id: string
  medicineId: string
  medicine: MedicineRef | null
  batchNumber: string
  expiryDate: string
  quantity: number
  freeQuantity: number
  rackLocation: string
  mrp: number
  purchaseRate: number
  finalPurchaseRate: number
  saleRate: number
  tradeRate: number
  updatedAt: string
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

function isExpired(expiryIso: string) {
  const d = new Date(expiryIso)
  if (Number.isNaN(d.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return d < today
}

function isNearExpiry(expiryIso: string, days = 30) {
  const d = new Date(expiryIso)
  if (Number.isNaN(d.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const limit = new Date(today)
  limit.setDate(limit.getDate() + days)
  d.setHours(0, 0, 0, 0)
  return d >= today && d <= limit
}

export default function StocksPage() {
  const { token, user } = useAuth()
  const { tenantSlug } = useParams()
  const isLocalhost = window.location.hostname === 'localhost'
  const effectiveSlug = tenantSlug || (isLocalhost ? getTenantSlug() : null)
  const base = effectiveSlug ? `/${effectiveSlug}` : ''

  const canView = user?.role === 'PharmacyAdmin' || Boolean(user?.moduleAccess?.medicines?.view)

  const [items, setItems] = useState<StockRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [hideZero, setHideZero] = useState(true)
  const [sortKey, setSortKey] = useState<'updated' | 'expiry' | 'qty' | 'name'>('updated')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch<{ items: StockRow[] }>('/api/stocks', { token })
      setItems(res.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stocks')
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
    const list = items.filter((s) => {
      const total = Number(s.quantity || 0) + Number(s.freeQuantity || 0)
      if (hideZero && total <= 0) return false
      if (!q) return true
      const name = s.medicine?.medicineName || ''
      const manu = s.medicine?.manufacturer || ''
      const rack = s.rackLocation || s.medicine?.defaultRackLocation || ''
      const hay = `${name} ${manu} ${s.batchNumber} ${rack}`.toLowerCase()
      return hay.includes(q)
    })

    const sorted = [...list]
    sorted.sort((a, b) => {
      if (sortKey === 'expiry') return +new Date(a.expiryDate) - +new Date(b.expiryDate)
      if (sortKey === 'qty') {
        const aq = Number(a.quantity || 0) + Number(a.freeQuantity || 0)
        const bq = Number(b.quantity || 0) + Number(b.freeQuantity || 0)
        return bq - aq
      }
      if (sortKey === 'name') {
        const an = a.medicine?.medicineName || ''
        const bn = b.medicine?.medicineName || ''
        return an.localeCompare(bn)
      }
      return +new Date(b.updatedAt) - +new Date(a.updatedAt)
    })
    return sorted
  }, [items, searchText, hideZero, sortKey])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader />
      <main className="py-10">
        <div className="mx-auto w-full px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Stocks</h1>
              <div className="mt-1 text-sm text-slate-400">Batch-wise stock view with expiry alerts.</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                className="rounded-full bg-transparent px-4 py-2 text-sm text-slate-300 ring-1 ring-inset ring-white/10 hover:bg-white/5"
                to={`${base}/dashboard`}
              >
                Back
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
                    placeholder="Search medicine / batch / rack..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                  />
                  <select
                    className="h-10 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
                  >
                    <option value="updated">Recently updated</option>
                    <option value="expiry">Expiry date</option>
                    <option value="qty">Quantity</option>
                    <option value="name">Medicine name</option>
                  </select>
                  <label className="flex h-10 items-center gap-2 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-sky-400"
                      checked={hideZero}
                      onChange={(e) => setHideZero(e.target.checked)}
                    />
                    <span className="text-slate-200">Hide zero</span>
                  </label>
                </div>
                <Button variant="secondary" onClick={() => void load()} disabled={loading}>
                  Refresh
                </Button>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[1200px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="py-2 pr-3">Product</th>
                      <th className="py-2 pr-3">Batch</th>
                      <th className="py-2 pr-3">Rack</th>
                      <th className="py-2 pr-3">Exp</th>
                      <th className="py-2 pr-3 text-right">Qty</th>
                      <th className="py-2 pr-3 text-right">Free</th>
                      <th className="py-2 pr-3 text-right">Total</th>
                      <th className="py-2 pr-3 text-right">MRP</th>
                      <th className="py-2 pr-3 text-right">P.R</th>
                      <th className="py-2 pr-3 text-right">Final P.R</th>
                      <th className="py-2 pr-3 text-right">S.R</th>
                      <th className="py-2 text-right">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {loading ? (
                      <tr>
                        <td className="py-4 text-slate-400" colSpan={12}>
                          Loading...
                        </td>
                      </tr>
                    ) : filtered.length ? (
                      filtered.map((s) => {
                        const total = Number(s.quantity || 0) + Number(s.freeQuantity || 0)
                        const rack = s.rackLocation || s.medicine?.defaultRackLocation || ''
                        const expired = isExpired(s.expiryDate)
                        const near = !expired && isNearExpiry(s.expiryDate, 30)
                        const expClass = expired
                          ? 'text-rose-300'
                          : near
                            ? 'text-amber-200'
                            : 'text-slate-200'
                        const rowClass = expired
                          ? 'bg-rose-500/5'
                          : near
                            ? 'bg-amber-500/5'
                            : ''

                        return (
                          <tr key={s._id} className={rowClass}>
                            <td className="py-3 pr-3">
                              <div className="font-medium text-slate-100">{s.medicine?.medicineName || '-'}</div>
                              <div className="text-xs text-slate-400">
                                {s.medicine?.manufacturer || ''}{' '}
                                {s.medicine?.category ? `• ${s.medicine.category}` : ''}
                              </div>
                            </td>
                            <td className="py-3 pr-3 text-slate-200">{s.batchNumber}</td>
                            <td className="py-3 pr-3 text-slate-200">{rack || '-'}</td>
                            <td className={`py-3 pr-3 ${expClass}`}>{fmtDate(s.expiryDate)}</td>
                            <td className="py-3 pr-3 text-right tabular-nums text-slate-200">{s.quantity}</td>
                            <td className="py-3 pr-3 text-right tabular-nums text-slate-200">{s.freeQuantity}</td>
                            <td className="py-3 pr-3 text-right tabular-nums text-slate-200">{total}</td>
                            <td className="py-3 pr-3 text-right tabular-nums text-slate-200">
                              {Number(s.mrp || 0).toFixed(2)}
                            </td>
                            <td className="py-3 pr-3 text-right tabular-nums text-slate-200">
                              {Number(s.purchaseRate || 0).toFixed(2)}
                            </td>
                            <td className="py-3 pr-3 text-right tabular-nums text-slate-200">
                              {Number(s.finalPurchaseRate || 0).toFixed(2)}
                            </td>
                            <td className="py-3 pr-3 text-right tabular-nums text-slate-200">
                              {Number(s.saleRate || 0).toFixed(2)}
                            </td>
                            <td className="py-3 text-right text-xs tabular-nums text-slate-400">
                              {fmtDate(s.updatedAt)}
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td className="py-4 text-slate-400" colSpan={12}>
                          No stock found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  )
}
