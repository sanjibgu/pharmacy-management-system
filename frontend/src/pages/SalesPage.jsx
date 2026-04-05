import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Button from '../components/Button'
import MedicinePickerModal from '../components/MedicinePickerModal'
import SiteHeader from '../components/SiteHeader'
import SaleItemRow from '../components/SaleItemRow'
import { useAuth } from '../context/AuthContext'
import { createSale, getSaleBatches } from '../services/salesService'
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

export default function SalesPage() {
  const { token, user } = useAuth()
  const { tenantSlug } = useParams()
  const isLocalhost = window.location.hostname === 'localhost'
  const effectiveSlug = tenantSlug || (isLocalhost ? getTenantSlug() : null)
  const base = effectiveSlug ? `/${effectiveSlug}` : ''

  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const [header, setHeader] = useState({
    saleDate: isoToday(),
    paymentType: 'Cash',
    paidAmount: 0,
    paidTouched: false,
    billDiscountPercent: 0,
    patientName: '',
    phone: '',
    doctorName: '',
    remarks: '',
  })

  const [rows, setRows] = useState([emptyRow()])
  const [activeRow, setActiveRow] = useState(0)
  const active = rows[activeRow] || null
  const activeTotals = useMemo(() => (active ? lineTotals(active) : { amount: 0, profit: 0 }), [active])

  const [batchLoading, setBatchLoading] = useState(false)
  const [batches, setBatches] = useState([])
  const [pickerOpen, setPickerOpen] = useState(false)

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

      const last = prev[prev.length - 1]
      const lastBlank =
        last &&
        !last.medicineId &&
        !String(last.productName || '').trim() &&
        !String(last.batchNumber || '').trim()

      if (lastBlank) {
        const replaced = prev.map((r, i) => (i === prev.length - 1 ? toAdd[0] : r))
        const next = toAdd.length > 1 ? [...replaced, ...toAdd.slice(1)] : replaced
        setActiveRow(next.length - 1)
        return next
      }

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
      if (h.paidTouched) return h
      const nextPaid = Math.max(0, Number(summary.net || 0))
      if (Math.abs(Number(h.paidAmount || 0) - nextPaid) < 1e-9) return h
      return { ...h, paidAmount: nextPaid }
    })
  }, [summary.net])

  async function submit(e) {
    e.preventDefault()
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
      if (!hasAny) throw new Error('Add at least one sale row')

      const paid = Math.min(Math.max(0, Number(header.paidAmount || 0)), Math.max(0, Number(summary.net || 0)))

      await createSale(token, {
        header: {
          saleDate: new Date(header.saleDate),
          paymentType: header.paymentType,
          paidAmount: paid,
          billDiscountPercent: Number(header.billDiscountPercent || 0),
          patientName: header.patientName || '',
          phone: header.phone || '',
          doctorName: header.doctorName || '',
          remarks: header.remarks || '',
        },
        items,
      })

      setSuccess(true)
      setRows([emptyRow()])
      setActiveRow(0)
      setHeader({
        saleDate: isoToday(),
        paymentType: 'Cash',
        paidAmount: 0,
        paidTouched: false,
        billDiscountPercent: 0,
        patientName: '',
        phone: '',
        doctorName: '',
        remarks: '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save sale')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader />
      <main className="py-4">
        <div className="mx-auto w-full px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-[220px]">
              <div className="text-lg font-semibold tracking-tight">Sales Module</div>
            </div>
            <Link className="text-sm text-slate-300 hover:text-slate-100" to={`${base}/dashboard`}>
              Back
            </Link>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl bg-rose-500/10 p-4 text-sm text-rose-200 ring-1 ring-inset ring-rose-400/20">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="mt-4 rounded-2xl bg-emerald-500/10 p-4 text-sm text-emerald-200 ring-1 ring-inset ring-emerald-400/20">
              Sale saved. Stock updated.
            </div>
          ) : null}

          <form onSubmit={submit} className="mt-6 grid gap-6">
            <div className="rounded-3xl bg-white/5 p-5 ring-1 ring-inset ring-white/10">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm font-semibold">Sale Entry</div>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => setPickerOpen(true)}>
                    Add Medicine
                  </Button>
                  <Link
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-medium text-slate-100 ring-1 ring-inset ring-white/15 hover:bg-white/15"
                    to={`${base}/sales/view`}
                  >
                    Sales Views
                  </Link>
                </div>
              </div>

              <div className="mt-4 md:hidden">
                {active ? (
                  <div className="grid gap-3 rounded-2xl bg-slate-950/40 p-4 ring-1 ring-inset ring-white/10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-100">{active.productName || 'Select medicine'}</div>
                        <div className="mt-0.5 truncate text-xs text-slate-400">
                          {(active.batchNumber ? `Batch ${active.batchNumber}` : '') + (active.expiryLabel ? ` - Exp ${active.expiryLabel}` : '')}
                        </div>
                      </div>
                      <div className="text-right text-xs text-slate-400">
                        Amt <span className="tabular-nums text-slate-100">{Number(activeTotals.amount || 0).toFixed(2)}</span>
                      </div>
                    </div>

                    <label className="grid gap-1.5">
                      <span className="text-xs font-medium text-slate-300">Unit</span>
                      <select
                        className="h-10 w-full rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10 disabled:opacity-60"
                        value={active.unitType}
                        onChange={(e) => updateRow(activeRow, { unitType: e.target.value })}
                        disabled={!active.allowLooseSale}
                      >
                        <option value="pack">Pack</option>
                        <option value="unit">Unit</option>
                      </select>
                    </label>

                    <label className="grid gap-1.5">
                      <span className="text-xs font-medium text-slate-300">Disc%</span>
                      <input
                        className="h-10 w-full rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={Number(active.discountPercent || 0) === 0 ? '' : active.discountPercent}
                        onChange={(e) => updateRow(activeRow, { discountPercent: e.target.value === '' ? 0 : Number(e.target.value) })}
                      />
                    </label>

                    <label className="grid gap-1.5">
                      <span className="text-xs font-medium text-slate-300">S.R</span>
                      <input
                        className="h-10 w-full rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                        type="number"
                        min={0}
                        step="0.01"
                        value={Number(active.saleRate || 0) === 0 ? '' : active.saleRate}
                        onChange={(e) => updateRow(activeRow, { saleRate: e.target.value === '' ? 0 : Number(e.target.value) })}
                        required
                      />
                    </label>

                    <label className="grid gap-1.5">
                      <span className="text-xs font-medium text-slate-300">Qty</span>
                      <input
                        className="h-10 w-full rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                        type="number"
                        min={0}
                        step={active.unitType === 'unit' ? '1' : '0.01'}
                        value={Number(active.quantity || 0) === 0 ? '' : active.quantity}
                        onChange={(e) => updateRow(activeRow, { quantity: e.target.value === '' ? 0 : Number(e.target.value) })}
                        required
                      />
                    </label>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="danger"
                        type="button"
                        onClick={() => {
                          if (rows.length <= 1) {
                            setRows([emptyRow()])
                            setActiveRow(0)
                            return
                          }
                          removeRow(activeRow)
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 space-y-2">
                  {(rows || [])
                    .map((r, i) => ({ r, i }))
                    .filter(({ r }) => Boolean(r.medicineId) || Boolean(String(r.productName || '').trim()))
                    .map(({ r, i }) => (
                      <div
                        key={i}
                        className={`rounded-2xl bg-slate-950/40 p-3 ring-1 ring-inset ring-white/10 ${i === activeRow ? 'ring-sky-400/40' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-100">{r.productName || '-'}</div>
                            <div className="mt-0.5 truncate text-xs text-slate-400">
                              {(r.batchNumber ? `Batch ${r.batchNumber}` : '') + (r.expiryLabel ? ` - Exp ${r.expiryLabel}` : '')}
                            </div>
                          </div>
                          <div className="text-right text-xs text-slate-400">
                            Qty <span className="tabular-nums text-slate-100">{Number(r.quantity || 0)}</span>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button variant="secondary" type="button" onClick={() => setActiveRow(i)}>
                            Edit
                          </Button>
                          <Button variant="danger" type="button" onClick={() => removeRow(i)}>
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="mt-4 hidden h-[34vh] overflow-x-auto overflow-y-auto md:block">
                <table className="w-full min-w-[980px] table-fixed text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-950/80 uppercase tracking-wide text-slate-400 backdrop-blur">
                    <tr className="h-9">
                      <th className="py-0 pr-2 w-64 align-middle">Product</th>
                      <th className="py-0 pr-2 w-24 align-middle text-center">Batch</th>
                      <th className="py-0 pr-2 w-28 align-middle text-center">Exp</th>
                      <th className="py-0 pr-2 w-16 align-middle text-center">Unit</th>
                      <th className="py-0 pr-2 w-16 align-middle text-center">MRP</th>
                      <th className="py-0 pr-2 w-16 align-middle text-center">Disc%</th>
                      <th className="py-0 pr-2 w-16 align-middle text-center">S.R</th>
                      <th className="py-0 pr-2 w-16 align-middle text-center">Qty</th>
                      <th className="py-0 pr-2 w-20 align-middle text-center">Amt</th>
                      <th className="py-0 pr-2 w-10 align-middle"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <SaleItemRow
                        key={idx}
                        index={idx}
                        row={row}
                        onChange={updateRow}
                        onRemove={removeRow}
                        onActivate={setActiveRow}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-6">
              <div className="rounded-3xl bg-white/5 p-4 ring-1 ring-inset ring-white/10">
                <div className="text-sm font-semibold">Sale Details</div>
                <div className="mt-3 grid grid-cols-1 items-end gap-2 sm:grid-cols-12">
                  <label className="grid gap-1.5 col-span-12 sm:col-span-6 lg:col-span-3">
                    <span className="text-xs font-medium text-slate-300">Patient Name</span>
                    <input
                      className="h-10 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                      value={header.patientName}
                      onChange={(e) => setHeader((h) => ({ ...h, patientName: e.target.value }))}
                      placeholder="Optional"
                    />
                  </label>
                  <label className="grid gap-1.5 col-span-12 sm:col-span-6 lg:col-span-2">
                    <span className="text-xs font-medium text-slate-300">Phone</span>
                    <input
                      className="h-10 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                      value={header.phone}
                      onChange={(e) => setHeader((h) => ({ ...h, phone: e.target.value }))}
                      placeholder="Optional"
                    />
                  </label>
                  <label className="grid gap-1.5 col-span-12 sm:col-span-6 lg:col-span-4">
                    <span className="text-xs font-medium text-slate-300">Doctor Name</span>
                    <input
                      className="h-10 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                      value={header.doctorName}
                      onChange={(e) => setHeader((h) => ({ ...h, doctorName: e.target.value }))}
                      placeholder="Optional"
                    />
                  </label>
                  <label className="grid gap-1.5 col-span-12 sm:col-span-4 lg:col-span-2">
                    <span className="text-xs font-medium text-slate-300">Sale Date</span>
                    <input
                      className="h-10 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                      type="date"
                      value={header.saleDate}
                      onChange={(e) => setHeader((h) => ({ ...h, saleDate: e.target.value }))}
                      required
                    />
                  </label>
                  <label className="grid gap-1.5 col-span-12 sm:col-span-4 lg:col-span-2">
                    <span className="text-xs font-medium text-slate-300">Payment</span>
                    <select
                      className="h-10 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                      value={header.paymentType}
                      onChange={(e) => setHeader((h) => ({ ...h, paymentType: e.target.value }))}
                      required
                    >
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="Credit">Credit</option>
                    </select>
                  </label>
                  <label className="grid gap-1.5 col-span-12 lg:col-span-6">
                    <span className="text-xs font-medium text-slate-300">Remarks</span>
                    <input
                      className="h-10 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                      value={header.remarks}
                      onChange={(e) => setHeader((h) => ({ ...h, remarks: e.target.value }))}
                      placeholder="Optional"
                    />
                  </label>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-12">
                <div className="lg:col-span-4 rounded-3xl bg-white/5 p-4 ring-1 ring-inset ring-white/10">
                  <div className="text-sm font-semibold">Batch Info</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {batchLoading ? 'Loading…' : 'Select a row to view batches.'}
                  </div>

                  {!active?.medicineId ? (
                    <div className="mt-4 text-sm text-slate-500">No medicine selected.</div>
                  ) : batches.length === 0 ? (
                    <div className="mt-4 text-sm text-slate-500">No batches found.</div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {batches.map((b) => (
                        <button
                          key={b._id}
                          type="button"
                          className="w-full rounded-2xl bg-slate-950/40 p-3 text-left ring-1 ring-inset ring-white/10 hover:bg-white/5"
                          onClick={() => {
                            const mrpPack = Number(b.mrp || 0)
                            const unitsPerStrip = Math.max(1, Number(b.unitsPerStrip || 1))
                            const unitType = active.allowLooseSale ? 'unit' : 'pack'
                            const mrp = unitType === 'unit' ? mrpPack / unitsPerStrip : mrpPack
                            const saleRate =
                              unitType === 'unit' ? Number(b.saleRate || 0) / unitsPerStrip : Number(b.saleRate || 0)
                            updateRow(activeRow, {
                              batchNumber: b.batchNumber,
                              expiryDate: b.expiryDate,
                              expiryLabel: fmtExpiryLabel(b.expiryDate),
                              rackLocation: b.rackLocation || active.rackLocation || '',
                              unitsPerStrip,
                              allowLooseSale: Boolean(b.allowLooseSale),
                              unitType,
                              mrp,
                              saleRate,
                              finalPurchaseRate: Number(b.finalPurchaseRate || 0),
                              quantity: 1,
                            })
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold">{b.batchNumber}</div>
                            <div className="text-xs text-slate-400">{fmtExpiryLabel(b.expiryDate)}</div>
                          </div>
                          <div className="mt-2 text-[11px] text-slate-300">
                            Stock: {Number(b.availablePacks || 0).toFixed(2)} pack • {Math.floor(Number(b.availableUnits || 0))} unit
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-8 rounded-3xl bg-white/5 p-4 ring-1 ring-inset ring-white/10">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm font-semibold">Summary</div>
                    <div className="flex flex-wrap items-end gap-3 text-sm text-slate-300">
                      <div>
                        Subtotal: <span className="font-semibold text-slate-100">{summary.amount.toFixed(2)}</span>
                      </div>
                      <label className="flex items-end gap-2">
                        <span>Bill Disc%:</span>
                        <input
                          className="h-9 w-24 rounded-xl bg-slate-950/40 px-3 text-sm text-slate-100 ring-1 ring-inset ring-white/10"
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          value={Number(header.billDiscountPercent || 0) === 0 ? '' : header.billDiscountPercent}
                          onKeyDown={(e) => {
                            if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') e.preventDefault()
                          }}
                          onChange={(e) =>
                            setHeader((h) => ({
                              ...h,
                              billDiscountPercent: e.target.value === '' ? 0 : Number(e.target.value),
                            }))
                          }
                        />
                      </label>
                      <div>
                        Disc Amt: <span className="font-semibold text-slate-100">{summary.billDiscAmt.toFixed(2)}</span>
                      </div>
                      <div>
                        Net: <span className="font-semibold text-slate-100">{summary.net.toFixed(2)}</span>
                      </div>
                      <label className="flex items-end gap-2">
                        <span>Paid:</span>
                        <input
                          className="h-9 w-28 rounded-xl bg-slate-950/40 px-3 text-sm text-slate-100 ring-1 ring-inset ring-white/10"
                          type="number"
                          min={0}
                          step="0.01"
                          value={Number(header.paidAmount || 0) === 0 ? '' : header.paidAmount}
                          onKeyDown={(e) => {
                            if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') e.preventDefault()
                          }}
                          onChange={(e) =>
                            setHeader((h) => ({
                              ...h,
                              paidTouched: true,
                              paidAmount: e.target.value === '' ? 0 : Number(e.target.value),
                            }))
                          }
                        />
                      </label>
                      <div>
                        Balance:{' '}
                        <span className="font-semibold text-slate-100">
                          {(Math.max(0, summary.net - Math.min(Math.max(0, Number(header.paidAmount || 0)), summary.net))).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Button type="submit" disabled={saving}>
                      {saving ? 'Saving…' : 'Save Sale'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </main>

      <MedicinePickerModal
        open={pickerOpen}
        token={token}
        onClose={() => {
          setPickerOpen(false)
        }}
        onPickBatch={(medicine, batch, quantity) => addFromPicker(medicine, batch, quantity)}
      />
    </div>
  )
}
