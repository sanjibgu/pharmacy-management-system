import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Button from '../components/Button'
import MedicinePickerModal from '../components/MedicinePickerModal'
import SiteHeader from '../components/SiteHeader'
import SaleItemRow from '../components/SaleItemRow'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../services/api'
import { getSaleBatches } from '../services/salesService'
import { getTenantSlug } from '../services/tenant'

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

function fmtExpiryLabel(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = String(d.getFullYear())
  return `${dd}/${mm}/${yyyy}`
}

function round2(n) {
  const v = Number(n || 0)
  if (!Number.isFinite(v)) return 0
  return Number(v.toFixed(2))
}

function emptyRow() {
  return {
    productName: '',
    medicineId: '',
    batchNumber: '',
    rackLocation: '',
    expiryDate: null,
    expiryLabel: '',
    unitType: 'pack',
    allowLooseSale: false,
    unitsPerStrip: 1,
    mrp: 0,
    saleRate: 0,
    discountPercent: 0,
    finalPurchaseRate: 0,
    quantity: 0,
  }
}

function lineTotals(r) {
  const qty = Math.max(0, Number(r.quantity || 0))
  const saleRate = Math.max(0, Number(r.saleRate || 0))
  const unitsPerStrip = Math.max(1, Number(r.unitsPerStrip || 1))
  const finalPurchaseRatePack = Math.max(0, Number(r.finalPurchaseRate || 0))
  const costPerUnit = r.unitType === 'unit' ? finalPurchaseRatePack / unitsPerStrip : finalPurchaseRatePack
  const amount = saleRate * qty
  const cost = costPerUnit * qty
  const profit = amount - cost
  return { amount, profit }
}

export default function SalesEditPage() {
  const { token, user } = useAuth()
  const { tenantSlug, id } = useParams()
  const navigate = useNavigate()

  const isLocalhost = window.location.hostname === 'localhost'
  const effectiveSlug = tenantSlug || (isLocalhost ? getTenantSlug() : null)
  const base = effectiveSlug ? `/${effectiveSlug}` : ''

  const canManage = user?.role === 'PharmacyAdmin' || Boolean(user?.moduleAccess?.sales?.manage)

  const saleId = id || ''

  const [loadingSale, setLoadingSale] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [originalPaid, setOriginalPaid] = useState(0)

  const [header, setHeader] = useState({
    saleDate: isoToday(),
    paymentType: 'Cash',
    paidAmount: 0,
    paidTouched: true,
    billDiscountPercent: 0,
    patientName: '',
    phone: '',
    doctorName: '',
    remarks: '',
  })

  const [rows, setRows] = useState([emptyRow()])
  const [activeRow, setActiveRow] = useState(0)
  const active = rows[activeRow] || null

  const [batchLoading, setBatchLoading] = useState(false)
  const [batches, setBatches] = useState([])
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    let mounted = true
    async function loadSale() {
      if (!token || !saleId) return
      setLoadingSale(true)
      setError(null)
      try {
        const res = await apiFetch(`/api/sales/${saleId}`, { token })
        if (!mounted) return
        const sale = res.sale || {}
        const items = Array.isArray(res.items) ? res.items : []

        setOriginalPaid(Number(sale.paidAmount || 0))
        setHeader((h) => ({
          ...h,
          saleDate: sale.saleDate ? String(sale.saleDate).slice(0, 10) : isoToday(),
          paymentType: sale.paymentType || 'Cash',
          paidAmount: Number(sale.paidAmount || 0),
          paidTouched: true,
          billDiscountPercent: Number(sale.billDiscountPercent || 0),
          patientName: sale.patientName || '',
          phone: sale.phone || '',
          doctorName: sale.doctorName || '',
          remarks: sale.remarks || '',
        }))

        const mapped = items.map((it) => {
          const med = it.medicine || null
          return {
            ...emptyRow(),
            productName: med?.medicineName || '',
            medicineId: String(it.medicineId || ''),
            batchNumber: it.batchNumber || '',
            rackLocation: med?.rackLocation || '',
            expiryDate: it.expiryDate || null,
            expiryLabel: fmtExpiryLabel(it.expiryDate),
            unitType: it.unitType || 'pack',
            allowLooseSale: Boolean(med?.allowLooseSale) || it.unitType === 'unit',
            unitsPerStrip: Math.max(1, Number(it.unitsPerStrip || med?.unitsPerStrip || 1)),
            mrp: Number(it.mrp || 0),
            saleRate: Number(it.saleRate || 0),
            discountPercent: Number(it.discountPercent || 0),
            finalPurchaseRate: Number(it.finalPurchaseRate || 0),
            quantity: Number(it.quantity || 0),
          }
        })

        setRows(mapped.length ? mapped : [emptyRow()])
        setActiveRow(0)
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Failed to load sale')
      } finally {
        if (mounted) setLoadingSale(false)
      }
    }

    void loadSale()
    return () => {
      mounted = false
    }
  }, [saleId, token])

  function updateRow(index, patch) {
    setSuccess(false)
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r
        const next = { ...r, ...patch }
        const mrp = Math.max(0, Number(next.mrp || 0))

        if (Object.prototype.hasOwnProperty.call(patch, 'discountPercent')) {
          const disc = Math.min(100, Math.max(0, Number(next.discountPercent || 0)))
          next.discountPercent = round2(disc)
          next.saleRate = round2(
            mrp > 0 ? Math.max(0, mrp - (mrp * Number(next.discountPercent)) / 100) : Math.max(0, Number(next.saleRate || 0)),
          )
        } else if (Object.prototype.hasOwnProperty.call(patch, 'saleRate')) {
          const sr = Math.max(0, Number(next.saleRate || 0))
          next.saleRate = round2(sr)
          next.discountPercent = round2(mrp > 0 ? Math.min(100, Math.max(0, ((mrp - Number(next.saleRate)) / mrp) * 100)) : 0)
        }

        return next
      }),
    )
  }

  function addFromPicker(medicine, batch, qty) {
    setRows((prev) => {
      const mrpPack = Number(batch.mrp || 0)
      const unitsPerStrip = Math.max(1, Number(batch.unitsPerStrip || medicine.unitsPerStrip || 1))
      const allowLooseSale = Boolean(batch.allowLooseSale ?? medicine.allowLooseSale)
      const saleRatePack = Number(batch.saleRate || 0)

      const packQty = Math.max(0, Math.floor(Number(qty?.packQty || 0)))
      const unitQty = Math.max(0, Math.floor(Number(qty?.unitQty || 0)))
      const anyQty = allowLooseSale ? packQty > 0 || unitQty > 0 : packQty > 0
      if (!anyQty) return prev

      const overrideSaleRatePack =
        qty && typeof qty.saleRatePack === 'number' ? Math.max(0, Number(qty.saleRatePack || 0)) : null
      const effectiveSaleRatePack = overrideSaleRatePack === null ? saleRatePack : overrideSaleRatePack
      const effectiveDisc =
        qty && typeof qty.discountPercent === 'number'
          ? round2(Math.min(100, Math.max(0, Number(qty.discountPercent || 0))))
          : mrpPack > 0
            ? round2(Math.min(100, Math.max(0, ((mrpPack - effectiveSaleRatePack) / mrpPack) * 100)))
            : 0

      function makeRow(unitType, quantity) {
        const mrp = unitType === 'unit' ? mrpPack / unitsPerStrip : mrpPack
        const saleRate = unitType === 'unit' ? effectiveSaleRatePack / unitsPerStrip : effectiveSaleRatePack
        return {
          ...emptyRow(),
          medicineId: medicine._id,
          productName: medicine.medicineName,
          batchNumber: batch.batchNumber,
          expiryDate: batch.expiryDate,
          expiryLabel: fmtExpiryLabel(batch.expiryDate),
          rackLocation: batch.rackLocation || medicine.rackLocation || '',
          unitsPerStrip,
          allowLooseSale,
          unitType,
          mrp: round2(mrp),
          saleRate: round2(saleRate),
          discountPercent: effectiveDisc,
          finalPurchaseRate: Number(batch.finalPurchaseRate || 0),
          quantity: Math.max(1, Math.floor(Number(quantity || 1))),
        }
      }

      const toAdd = []
      if (allowLooseSale) {
        if (packQty > 0) toAdd.push(makeRow('pack', packQty))
        if (unitQty > 0) toAdd.push(makeRow('unit', unitQty))
      } else if (packQty > 0) {
        toAdd.push(makeRow('pack', packQty))
      }

      if (toAdd.length === 0) return prev
      const next = [...prev, ...toAdd]
      setActiveRow(next.length - 1)
      return next
    })
  }

  function removeRow(index) {
    if (rows.length <= 1) return
    setRows((prev) => prev.filter((_, i) => i !== index))
    setActiveRow((cur) => {
      if (cur === index) return Math.max(0, index - 1)
      if (cur > index) return cur - 1
      return cur
    })
  }

  useEffect(() => {
    let mounted = true
    async function loadBatches() {
      if (!token || !active?.medicineId) {
        setBatches([])
        return
      }
      setBatchLoading(true)
      try {
        const res = await getSaleBatches(token, active.medicineId)
        if (!mounted) return
        setBatches(res.items || [])
      } catch {
        if (!mounted) return
        setBatches([])
      } finally {
        if (mounted) setBatchLoading(false)
      }
    }
    void loadBatches()
    return () => {
      mounted = false
    }
  }, [token, active?.medicineId])

  const summary = useMemo(() => {
    const valid = rows.filter((r) => r.medicineId || String(r.productName || '').trim())
    const totals = valid.reduce(
      (acc, r) => {
        const t = lineTotals(r)
        acc.items += 1
        acc.amount += t.amount
        acc.profit += t.profit
        return acc
      },
      { items: 0, amount: 0, profit: 0 },
    )
    const billDiscPct = Math.min(100, Math.max(0, Number(header.billDiscountPercent || 0)))
    const billDiscAmt = (totals.amount * billDiscPct) / 100
    const net = Math.max(0, totals.amount - billDiscAmt)
    return { ...totals, billDiscPct, billDiscAmt, net }
  }, [rows, header.billDiscountPercent])

  useEffect(() => {
    setHeader((h) => {
      const net = Math.max(0, Number(summary.net || 0))
      const paid = Math.max(0, Number(h.paidAmount || 0))
      if (paid <= net + 1e-9) return h
      return { ...h, paidAmount: net }
    })
  }, [summary.net])

  async function submit(e) {
    e.preventDefault()
    if (!canManage) return
    setError(null)
    setSaving(true)
    setSuccess(false)
    try {
      const items = []
      let hasAny = false
      for (let idx = 0; idx < rows.length; idx += 1) {
        const r = rows[idx]
        const hasData = String(r.productName || '').trim() || String(r.batchNumber || '').trim()
        if (!hasData) continue
        hasAny = true
        if (!r.medicineId) throw new Error(`Row ${idx + 1}: select medicine from suggestions`)
        if (!r.batchNumber) throw new Error(`Row ${idx + 1}: select batch`)
        if (!r.expiryDate) throw new Error(`Row ${idx + 1}: expiry missing`)
        if (Number(r.quantity || 0) <= 0) throw new Error(`Row ${idx + 1}: enter quantity`)
        items.push({
          medicineId: r.medicineId,
          batchNumber: r.batchNumber,
          expiryDate: new Date(r.expiryDate),
          unitType: r.unitType,
          quantity: Number(r.quantity || 0),
          saleRate: Number(r.saleRate || 0),
        })
      }
      if (!hasAny) throw new Error('Add at least one medicine row')

      await apiFetch(`/api/sales/${saleId}/items`, {
        method: 'PUT',
        token,
        body: {
          header: {
            saleDate: header.saleDate ? new Date(header.saleDate) : undefined,
            paymentType: header.paymentType,
            paidAmount: Number(header.paidAmount || 0),
            billDiscountPercent: Number(header.billDiscountPercent || 0),
            patientName: header.patientName,
            phone: header.phone,
            doctorName: header.doctorName,
            remarks: header.remarks,
          },
          items,
        },
      })

      setSuccess(true)
      navigate(`${base}/sales/view`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update sale')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader />
      <main className="py-4">
        <div className="mx-auto w-full px-4 sm:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Edit Sale</h1>
              <div className="mt-1 text-sm text-slate-400">Edit medicines, quantities, discount, and paid amount.</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                className="rounded-full bg-transparent px-4 py-2 text-sm text-slate-300 ring-1 ring-inset ring-white/10 hover:bg-white/5"
                to={`${base}/sales/view`}
              >
                Back to Sales Views
              </Link>
              <Link
                className="rounded-full bg-transparent px-4 py-2 text-sm text-slate-300 ring-1 ring-inset ring-white/10 hover:bg-white/5"
                to={`${base}/sales`}
              >
                Back to Entry
              </Link>
            </div>
          </div>

          {!canManage ? (
            <div className="mt-6 rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-100 ring-1 ring-inset ring-amber-400/20">
              Module access denied.
            </div>
          ) : null}

          {error ? (
            <div className="mt-6 rounded-2xl bg-rose-500/10 p-4 text-sm text-rose-200 ring-1 ring-inset ring-rose-400/20">
              {error}
            </div>
          ) : null}

          {loadingSale ? (
            <div className="mt-6 rounded-3xl bg-white/5 p-6 text-sm text-slate-300 ring-1 ring-inset ring-white/10">
              Loading sale...
            </div>
          ) : null}

          {!loadingSale && canManage ? (
            <form onSubmit={submit} className="mt-6 grid gap-4">
              <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                <div className="rounded-3xl bg-white/5 p-5 ring-1 ring-inset ring-white/10">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-100">Sale Entry</div>
                      <div className="mt-1 text-xs text-slate-400">
                        Quantity and discount can be edited. Product/batch/exp are locked.
                      </div>
                    </div>
                    <Button type="button" variant="secondary" onClick={() => setPickerOpen(true)}>
                      Add medicine
                    </Button>
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[980px] text-left text-sm">
                      <thead className="text-xs uppercase tracking-wide text-slate-400">
                        <tr>
                          <th className="py-2 pr-2">Product</th>
                          <th className="py-2 pr-2 text-center">Batch</th>
                          <th className="py-2 pr-2 text-center">Exp</th>
                          <th className="py-2 pr-2">Unit</th>
                          <th className="py-2 pr-2 text-right">MRP</th>
                          <th className="py-2 pr-2 text-right">Disc%</th>
                          <th className="py-2 pr-2 text-right">S.R</th>
                          <th className="py-2 pr-2 text-right">Qty</th>
                          <th className="py-2 pr-2 text-right">Amt</th>
                          <th className="py-2 pr-2 text-right" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {rows.map((r, idx) => (
                          <SaleItemRow
                            key={`${r.medicineId || 'x'}-${r.batchNumber || 'x'}-${r.unitType}-${idx}`}
                            index={idx}
                            row={r}
                            onChange={updateRow}
                            onRemove={removeRow}
                            onActivate={(i) => setActiveRow(i)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-3xl bg-white/5 p-5 ring-1 ring-inset ring-white/10">
                    <div className="text-sm font-semibold text-slate-100">Sale Details</div>
                    <div className="mt-4 grid gap-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">Items</span>
                        <span className="tabular-nums text-slate-100">{summary.items}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">Gross</span>
                        <span className="tabular-nums text-slate-100">{summary.amount.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">Bill Discount</span>
                        <span className="tabular-nums text-slate-100">{summary.billDiscAmt.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-white/10 pt-2">
                        <span className="font-medium text-slate-100">Net</span>
                        <span className="font-semibold tabular-nums text-slate-100">{summary.net.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">Paid</span>
                        <span className="tabular-nums text-slate-100">{Number(header.paidAmount || 0).toFixed(2)}</span>
                      </div>
                      {Number(header.paidAmount || 0) + 1e-9 < Number(originalPaid || 0) ? (
                        <div className="flex items-center justify-between">
                          <span className="text-amber-200">Return</span>
                          <span className="tabular-nums text-amber-100">
                            {Math.max(0, Number(originalPaid || 0) - Number(header.paidAmount || 0)).toFixed(2)}
                          </span>
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">Balance</span>
                        <span className="tabular-nums text-slate-100">
                          {Math.max(0, summary.net - Number(header.paidAmount || 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl bg-white/5 p-5 ring-1 ring-inset ring-white/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-100">Batch Info</div>
                        <div className="mt-0.5 text-xs text-slate-400">For active row</div>
                      </div>
                    </div>
                    <div className="mt-4">
                      {batchLoading ? (
                        <div className="text-sm text-slate-400">Loading...</div>
                      ) : active?.medicineId ? (
                        <div className="grid gap-2">
                          {(batches || []).slice(0, 8).map((b) => (
                            <div key={b._id} className="rounded-xl bg-slate-950/40 px-3 py-2 ring-1 ring-inset ring-white/10">
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                <div className="font-semibold text-slate-100">{b.batchNumber}</div>
                                <div className="text-slate-300">Exp: {fmtExpiryLabel(b.expiryDate)}</div>
                              </div>
                              <div className="mt-1 text-[11px] text-slate-300">
                                Stock: {Number(b.availablePacks || 0).toFixed(2)} pack • MRP: {Number(b.mrp || 0).toFixed(2)}
                              </div>
                            </div>
                          ))}
                          {!batches?.length ? <div className="text-sm text-slate-400">No batches</div> : null}
                        </div>
                      ) : (
                        <div className="text-sm text-slate-400">Select a row to see batch info.</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Button type="submit" disabled={saving}>
                      {saving ? 'Saving...' : 'Save changes'}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl bg-white/5 p-5 ring-1 ring-inset ring-white/10">
                <div className="text-sm font-semibold text-slate-100">Sale Header</div>
                <div className="mt-0.5 text-xs text-slate-400">Billing and patient details</div>

                <div className="mt-4 grid gap-3 md:grid-cols-6">
                  <label className="grid gap-1 md:col-span-1">
                    <span className="text-[11px] font-medium text-slate-300">Date</span>
                    <input
                      className="h-10 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                      type="date"
                      value={header.saleDate}
                      onChange={(e) => setHeader((h) => ({ ...h, saleDate: e.target.value }))}
                      required
                    />
                  </label>

                  <label className="grid gap-1 md:col-span-1">
                    <span className="text-[11px] font-medium text-slate-300">Payment</span>
                    <select
                      className="h-10 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                      value={header.paymentType}
                      onChange={(e) => setHeader((h) => ({ ...h, paymentType: e.target.value }))}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Credit">Credit</option>
                      <option value="UPI">UPI</option>
                    </select>
                  </label>

                  <label className="grid gap-1 md:col-span-1">
                    <span className="text-[11px] font-medium text-slate-300">Bill Disc%</span>
                    <input
                      className="h-10 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={Number(header.billDiscountPercent || 0) === 0 ? '' : header.billDiscountPercent}
                      onChange={(e) =>
                        setHeader((h) => ({
                          ...h,
                          billDiscountPercent: e.target.value === '' ? 0 : Number(e.target.value),
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') e.preventDefault()
                      }}
                    />
                  </label>

                  <label className="grid gap-1 md:col-span-1">
                    <span className="text-[11px] font-medium text-slate-300">Paid</span>
                    <input
                      className="h-10 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                      type="number"
                      min={0}
                      step="0.01"
                      value={Number(header.paidAmount || 0) === 0 ? '' : header.paidAmount}
                      onChange={(e) =>
                        setHeader((h) => ({
                          ...h,
                          paidTouched: true,
                          paidAmount: e.target.value === '' ? 0 : Number(e.target.value),
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') e.preventDefault()
                      }}
                    />
                  </label>

                  {Number(header.paidAmount || 0) + 1e-9 < Number(originalPaid || 0) ? (
                    <label className="grid gap-1 md:col-span-2">
                      <span className="text-[11px] font-medium text-amber-200">Return amount</span>
                      <input
                        className="h-10 rounded-xl bg-slate-950/40 px-3 text-sm text-amber-100 ring-1 ring-inset ring-amber-400/30"
                        value={Math.max(0, Number(originalPaid || 0) - Number(header.paidAmount || 0)).toFixed(2)}
                        readOnly
                      />
                    </label>
                  ) : (
                    <div className="md:col-span-2" />
                  )}

                  <label className="grid gap-1 md:col-span-2">
                    <span className="text-[11px] font-medium text-slate-300">Patient</span>
                    <input
                      className="h-10 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                      value={header.patientName}
                      onChange={(e) => setHeader((h) => ({ ...h, patientName: e.target.value }))}
                    />
                  </label>

                  <label className="grid gap-1 md:col-span-2">
                    <span className="text-[11px] font-medium text-slate-300">Doctor</span>
                    <input
                      className="h-10 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                      value={header.doctorName}
                      onChange={(e) => setHeader((h) => ({ ...h, doctorName: e.target.value }))}
                    />
                  </label>

                  <label className="grid gap-1 md:col-span-2">
                    <span className="text-[11px] font-medium text-slate-300">Phone</span>
                    <input
                      className="h-10 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                      value={header.phone}
                      onChange={(e) => setHeader((h) => ({ ...h, phone: e.target.value }))}
                    />
                  </label>

                  <label className="grid gap-1 md:col-span-6">
                    <span className="text-[11px] font-medium text-slate-300">Remarks</span>
                    <input
                      className="h-10 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                      value={header.remarks}
                      onChange={(e) => setHeader((h) => ({ ...h, remarks: e.target.value }))}
                    />
                  </label>
                </div>
              </div>

              {success ? (
                <div className="rounded-2xl bg-emerald-500/10 p-4 text-sm text-emerald-100 ring-1 ring-inset ring-emerald-400/20">
                  Updated.
                </div>
              ) : null}
            </form>
          ) : null}
        </div>
      </main>

      <MedicinePickerModal
        open={pickerOpen}
        token={token}
        onClose={() => setPickerOpen(false)}
        onPickBatch={(medicine, batch, qty) => {
          addFromPicker(medicine, batch, qty)
          setPickerOpen(false)
        }}
      />
    </div>
  )
}
