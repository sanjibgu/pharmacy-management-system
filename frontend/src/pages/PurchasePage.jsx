import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Button from '../components/Button'
import SiteFooter from '../components/SiteFooter'
import SiteHeader from '../components/SiteHeader'
import PurchaseItemRow from '../components/PurchaseItemRow'
import { useAuth } from '../context/AuthContext'
import {
  createPurchase,
  createSupplier,
  getBatches,
  listSuppliers,
  searchMedicines,
} from '../services/purchaseService'
import { getTenantSlug } from '../services/tenant'

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

function emptyRow() {
  return {
    productName: '',
    medicineId: '',
    batchNumber: '',
    rackLocation: '',
    expiry: '',
    hsnCode: '',
    mrp: 0,
    saleRate: 0,
    quantity: 0,
    freeQuantity: 0,
    discountPercent: 0,
    gstPercent: 0,
  }
}

function parseExpiryToDate(expiry) {
  const value = String(expiry || '').trim()
  if (!value) return null

  // dd/mm/yyyy or d/m/yyyy or dd-mm-yyyy
  const dmy = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/)
  if (dmy) {
    const dd = Number(dmy[1])
    const mm = Number(dmy[2])
    const yyyy = Number(dmy[3])
    if (mm < 1 || mm > 12) return null
    if (dd < 1 || dd > 31) return null
    const d = new Date(yyyy, mm - 1, dd)
    if (Number.isNaN(d.getTime())) return null
    return d
  }

  // HTML month input (YYYY-MM)
  const ym = value.match(/^(\d{4})-(\d{2})$/)
  if (ym) {
    const yy = Number(ym[1])
    const mm = Number(ym[2])
    if (mm < 1 || mm > 12) return null
    // end-of-month to represent expiry for that month
    return new Date(yy, mm, 0)
  }

  // Full date (YYYY-MM-DD) -> take month/year
  const ymd = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (ymd) {
    const yy = Number(ymd[1])
    const mm = Number(ymd[2])
    const dd = Number(ymd[3])
    if (mm < 1 || mm > 12) return null
    return new Date(yy, mm - 1, dd)
  }

  // Slash format (MM/YY or MM/YYYY)
  const slash = value.match(/^(\d{1,2})\s*\/\s*(\d{2,4})$/)
  if (!slash) return null
  const mm = Number(slash[1])
  let yy = Number(slash[2])
  if (yy < 100) yy += 2000
  if (mm < 1 || mm > 12) return null
  return new Date(yy, mm, 0)
}

function fmtExpiryLabel(dateStr) {
  const d = new Date(dateStr)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = String(d.getFullYear())
  return `${dd}/${mm}/${yyyy}`
}

function fmtExpiryValue(dateStr) {
  const d = new Date(dateStr)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = String(d.getFullYear())
  return `${dd}/${mm}/${yyyy}`
}

function lineTotals(r) {
  const qty = Number(r.quantity || 0)
  const mrp = Number(r.mrp || 0)
  const schemeQty = Number(r.freeQuantity || 0)
  const discPct = Math.min(100, Math.max(0, Number(r.discountPercent || 0)))
  const gstPct = Math.max(0, Number(r.gstPercent || 0))

  const discountPerUnit = (mrp * discPct) / 100
  const tradeRate = Math.max(0, mrp - discountPerUnit)
  const gstPerUnit = (tradeRate * gstPct) / 100
  const purchaseRate = tradeRate + gstPerUnit

  const discountAmount = discountPerUnit * qty
  const taxableAmount = tradeRate * qty
  const gstAmount = gstPerUnit * qty
  const netAmount = purchaseRate * qty

  const totalUnits = qty + schemeQty
  const finalPurchaseRate = totalUnits > 0 ? netAmount / totalUnits : 0

  return {
    mrpTotal: mrp * qty,
    tradeRate,
    purchaseRate,
    finalPurchaseRate,
    discountAmount,
    taxableAmount,
    gstAmount,
    netAmount,
  }
}

export default function PurchasePage() {
  const { token, user } = useAuth()
  const { tenantSlug } = useParams()
  const isLocalhost = window.location.hostname === 'localhost'
  const effectiveSlug = tenantSlug || (isLocalhost ? getTenantSlug() : null)
  const base = effectiveSlug ? `/${effectiveSlug}` : ''
  const [tab, setTab] = useState('purchase') // purchase | distributor
  const [suppliers, setSuppliers] = useState([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [savingDistributor, setSavingDistributor] = useState(false)

  const [header, setHeader] = useState({
    supplierId: '',
    invoiceNumber: '',
    invoiceDate: isoToday(),
    purchaseDate: isoToday(),
    purchaseType: 'Cash',
    paidAmount: 0,
    dueDate: '',
    remarks: '',
  })

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s._id === header.supplierId) || null,
    [suppliers, header.supplierId],
  )

  const canManageSuppliers = user?.role === 'PharmacyAdmin'

  const [distributor, setDistributor] = useState({
    supplierName: '',
    dlNumber: '',
    address: '',
  })

  const [rows, setRows] = useState([emptyRow()])
  const [activeRow, setActiveRow] = useState(0)
  const active = rows[activeRow] || null

  const [batchLoading, setBatchLoading] = useState(false)
  const [batches, setBatches] = useState([])

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoadingSuppliers(true)
      try {
        const res = await listSuppliers(token)
        if (!mounted) return
        setSuppliers(res.items || [])
      } catch (e) {
        if (!mounted) return
        setError(e instanceof Error ? e.message : 'Failed to load suppliers')
      } finally {
        if (mounted) setLoadingSuppliers(false)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [token])

  async function reloadSuppliersAndSelect(idToSelect) {
    const res = await listSuppliers(token)
    setSuppliers(res.items || [])
    if (idToSelect) setHeader((h) => ({ ...h, supplierId: idToSelect }))
  }

  async function onCreateDistributor(e) {
    e.preventDefault()
    if (!token) return
    setError(null)
    setSuccess(false)
    setSavingDistributor(true)
    try {
      const res = await createSupplier(token, {
        supplierName: distributor.supplierName,
        dlNumber: distributor.dlNumber,
        address: distributor.address,
      })
      await reloadSuppliersAndSelect(res?.item?._id)
      setDistributor({ supplierName: '', dlNumber: '', address: '' })
      setTab('purchase')
      alert('Distributor added')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add distributor')
    } finally {
      setSavingDistributor(false)
    }
  }

  const search = useCallback(
    async (q) => {
      const res = await searchMedicines(token, q)
      return res.items || []
    },
    [token],
  )

  useEffect(() => {
    let mounted = true
    async function loadBatches() {
      if (!active?.medicineId) {
        setBatches([])
        return
      }
      setBatchLoading(true)
      try {
        const res = await getBatches(token, active.medicineId)
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
    // Show summary even if the user typed a medicine name but didn't pick from suggestions yet.
    const valid = rows.filter((r) => r.medicineId || String(r.productName || '').trim())
    const totals = valid.reduce(
      (acc, r) => {
        const t = lineTotals(r)
        acc.items += 1
        acc.qty += Number(r.quantity || 0) + Number(r.freeQuantity || 0)
        acc.gross += t.taxableAmount
        acc.discount += t.discountAmount
        acc.gst += t.gstAmount
        acc.net += t.netAmount
        return acc
      },
      { items: 0, qty: 0, gross: 0, discount: 0, gst: 0, net: 0 },
    )
    const round = Math.round(totals.net)
    const roundOff = round - totals.net
    return {
      ...totals,
      cgst: totals.gst / 2,
      sgst: totals.gst / 2,
      roundOff,
      netRounded: round,
    }
  }, [rows])

  function updateRow(index, patch) {
    setSuccess(false)
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function addMedicine() {
    setRows((prev) => [...prev, emptyRow()])
    setActiveRow(rows.length)
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

  function removeMedicine() {
    if (rows.length <= 1) return
    setRows((prev) => prev.filter((_, i) => i !== activeRow))
    setActiveRow((cur) => (cur > 0 ? cur - 1 : 0))
  }

  function cancel() {
    setHeader({
      supplierId: '',
      invoiceNumber: '',
      invoiceDate: isoToday(),
      purchaseDate: isoToday(),
      purchaseType: 'Cash',
      paidAmount: 0,
      dueDate: '',
      remarks: '',
    })
    setRows([emptyRow()])
    setActiveRow(0)
    setSuccess(false)
    setError(null)
  }

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    setSuccess(false)
    try {
      async function resolveMedicineIdByName(name) {
        const q = String(name || '').trim()
        if (!q) return null
        const list = await searchMedicines(token, q)
        const exact = Array.isArray(list)
          ? list.find((m) => String(m?.medicineName || '').toLowerCase() === q.toLowerCase())
          : null
        if (exact?._id) return exact._id
        if (Array.isArray(list) && list.length === 1 && list[0]?._id) return list[0]._id
        return null
      }

      const items = []
      let hasAnyRow = false

      const paid = Math.min(
        Math.max(0, Number(header.paidAmount || 0)),
        Math.max(0, Number(summary.netRounded || 0)),
      )

      for (let idx = 0; idx < rows.length; idx += 1) {
        const r = rows[idx]
        const hasData =
          String(r.productName || '').trim() ||
          String(r.batchNumber || '').trim() ||
          String(r.expiry || '').trim()
        if (!hasData) continue

        hasAnyRow = true

        let medicineId = r.medicineId
        if (!medicineId) {
          medicineId = await resolveMedicineIdByName(r.productName)
          if (medicineId) updateRow(idx, { medicineId })
        }
        if (!medicineId) throw new Error(`Row ${idx + 1}: select medicine from suggestions`)
        if (!r.batchNumber) throw new Error(`Row ${idx + 1}: enter batch number`)
        if (!r.expiry) throw new Error(`Row ${idx + 1}: enter expiry (DD/MM/YYYY)`)

        const expiryDate = parseExpiryToDate(r.expiry)
        if (!expiryDate) throw new Error(`Row ${idx + 1}: invalid expiry (DD/MM/YYYY): ${r.expiry}`)

        const t = lineTotals(r)

        items.push({
          medicineId,
          batchNumber: r.batchNumber,
          rackLocation: r.rackLocation || '',
          expiryDate,
          hsnCode: r.hsnCode || '',
          mrp: Number(r.mrp || 0),
          discountPercent: Number(r.discountPercent || 0),
          gstPercent: Number(r.gstPercent || 0),
          tradeRate: Number.isFinite(t.tradeRate) ? t.tradeRate : 0,
          purchaseRate: Number.isFinite(t.purchaseRate) ? t.purchaseRate : 0,
          saleRate: Number(r.saleRate || 0),
          quantity: Number(r.quantity || 0),
          freeQuantity: Number(r.freeQuantity || 0),
        })
      }

      if (!hasAnyRow) throw new Error('Add at least one medicine row')

      await createPurchase(token, {
        header: {
          supplierId: header.supplierId,
          invoiceNumber: header.invoiceNumber,
          invoiceDate: new Date(header.invoiceDate),
          purchaseDate: new Date(header.purchaseDate),
          paymentType: header.purchaseType,
          paidAmount: paid,
          dueDate: header.purchaseType === 'Credit' ? new Date(header.dueDate) : undefined,
          remarks: header.remarks || '',
        },
        items,
      })

      setSuccess(true)
      cancel()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save purchase')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader />
      <main className="py-8">
        <div className="mx-auto w-full px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-[220px]">
              <div className="text-lg font-semibold tracking-tight">Purchase Module</div>
              <div className="mt-0.5 text-xs text-slate-400">Batch based entry â€¢ Role: {user?.role}</div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setTab('purchase')}
                className={[
                  'rounded-full px-4 py-2 text-sm ring-1 ring-inset',
                  tab === 'purchase'
                    ? 'bg-white/10 text-slate-100 ring-white/15'
                    : 'bg-transparent text-slate-300 ring-white/10 hover:bg-white/5',
                ].join(' ')}
              >
                Purchase Entry
              </button>
              <button
                type="button"
                onClick={() => setTab('distributor')}
                className={[
                  'rounded-full px-4 py-2 text-sm ring-1 ring-inset',
                  tab === 'distributor'
                    ? 'bg-white/10 text-slate-100 ring-white/15'
                    : 'bg-transparent text-slate-300 ring-white/10 hover:bg-white/5',
                ].join(' ')}
              >
                Add Distributor
              </button>
              <Link
                className="rounded-full bg-transparent px-4 py-2 text-sm text-slate-300 ring-1 ring-inset ring-white/10 hover:bg-white/5"
                to={`${base}/medicines`}
              >
                Add Medicine
              </Link>
              <Link
                className="rounded-full bg-transparent px-4 py-2 text-sm text-slate-300 ring-1 ring-inset ring-white/10 hover:bg-white/5"
                to={`${base}/distributors`}
              >
                Distributor Management
              </Link>
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
              Purchase saved. Stock updated batch-wise.
            </div>
          ) : null}

          <div className="mt-6 grid gap-6">
            {tab === 'distributor' ? (
              <form
                onSubmit={onCreateDistributor}
                className="rounded-3xl bg-white/5 p-6 ring-1 ring-inset ring-white/10"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold">Add Distributor</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Fields: Distributor name, DL No, Address
                    </div>
                  </div>
                  {!canManageSuppliers ? (
                    <div className="text-xs text-amber-200">
                      Only PharmacyAdmin can add distributors.
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <input
                    className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                    placeholder="Distributor name"
                    value={distributor.supplierName}
                    onChange={(e) =>
                      setDistributor((s) => ({ ...s, supplierName: e.target.value }))
                    }
                    required
                    disabled={!canManageSuppliers}
                  />
                  <input
                    className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                    placeholder="DL No"
                    value={distributor.dlNumber}
                    onChange={(e) =>
                      setDistributor((s) => ({ ...s, dlNumber: e.target.value }))
                    }
                    required
                    disabled={!canManageSuppliers}
                  />
                  <input
                    className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                    placeholder="Address"
                    value={distributor.address}
                    onChange={(e) =>
                      setDistributor((s) => ({ ...s, address: e.target.value }))
                    }
                    required
                    disabled={!canManageSuppliers}
                  />
                </div>

                <div className="mt-5 flex justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={() => setTab('purchase')}>
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={!canManageSuppliers || savingDistributor}
                  >
                    {savingDistributor ? 'Saving…' : 'Save Distributor'}
                  </Button>
                </div>
              </form>
            ) : null}

            {tab === 'purchase' ? (
              <form onSubmit={submit} className="grid gap-6">
            <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-inset ring-white/10">
              <div className="text-sm font-semibold">Supplier Details</div>
              <div className="mt-4 grid grid-cols-12 items-end gap-3">
                <label className="grid gap-1.5 col-span-12 lg:col-span-4">
                  <span className="text-sm font-medium text-slate-200">Supplier Name</span>
                  <select
                    className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                    value={header.supplierId}
                    onChange={(e) => setHeader((h) => ({ ...h, supplierId: e.target.value }))}
                    required
                    disabled={loadingSuppliers}
                  >
                    <option value="">{loadingSuppliers ? 'Loading…' : 'Select supplier'}</option>
                    {suppliers.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.supplierName}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="hidden">
                  <span className="text-sm font-medium text-slate-200">Supplier Code</span>
                  <input className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10" value={selectedSupplier?.supplierCode || ''} readOnly />
                </label>

                <label className="hidden">
                  <span className="text-sm font-medium text-slate-200">GST Number</span>
                  <input className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10" value={selectedSupplier?.gstNumber || ''} readOnly />
                </label>

                <label className="grid gap-1.5 col-span-6 sm:col-span-3 lg:col-span-2">
                  <span className="text-xs font-medium text-slate-300">DL No</span>
                  <input className="h-10 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10" value={selectedSupplier?.dlNumber || ''} readOnly />
                </label>

                <label className="hidden">
                  <span className="text-sm font-medium text-slate-200">Mobile Number</span>
                  <input className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10" value={selectedSupplier?.mobileNumber || ''} readOnly />
                </label>

                <label className="grid gap-1.5 col-span-6 sm:col-span-3 lg:col-span-2">
                  <span className="text-xs font-medium text-slate-300">Invoice No</span>
                  <input className="h-10 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400" value={header.invoiceNumber} onChange={(e) => setHeader((h) => ({ ...h, invoiceNumber: e.target.value }))} required />
                </label>

                <label className="grid gap-1.5 col-span-6 sm:col-span-3 lg:col-span-2">
                  <span className="text-xs font-medium text-slate-300">Invoice Date</span>
                  <input className="h-10 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400" type="date" value={header.invoiceDate} onChange={(e) => setHeader((h) => ({ ...h, invoiceDate: e.target.value }))} required />
                </label>

                <label className="grid gap-1.5 col-span-6 sm:col-span-3 lg:col-span-2">
                  <span className="text-xs font-medium text-slate-300">Type</span>
                  <select className="h-10 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400" value={header.purchaseType} onChange={(e) => setHeader((h) => ({ ...h, purchaseType: e.target.value }))} required>
                    <option value="Cash">Cash</option>
                    <option value="Credit">Credit</option>
                  </select>
                </label>

              </div>
            </div>

            <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-inset ring-white/10">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm font-semibold">Medicine Entry</div>
                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" onClick={addMedicine}>
                      Add Medicine
                    </Button>
                    <Button type="button" variant="secondary" onClick={removeMedicine} disabled={rows.length <= 1}>
                      Remove Medicine
                    </Button>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto overflow-y-visible">
                  <table className="w-full min-w-[1100px] table-fixed text-left text-xs">
                    <thead className="sticky top-0 z-10 bg-slate-950/80 uppercase tracking-wide text-slate-400 backdrop-blur">
                      <tr className="h-9">
                        <th className="py-0 pr-2 w-64 align-middle">Product</th>
                        <th className="py-0 pr-2 w-28 align-middle text-center">Batch</th>
                        <th className="py-0 pr-2 w-14 align-middle text-center">Rack</th>
                        <th className="py-0 pr-2 w-32 align-middle text-center">Exp</th>
                        <th className="py-0 pr-2 w-16 align-middle text-center">MRP</th>
                        <th className="py-0 pr-2 w-14 align-middle text-center">Disc%</th>
                        <th className="py-0 pr-2 w-16 align-middle text-center">T.R</th>
                        <th className="py-0 pr-2 w-14 align-middle text-center">GST%</th>
                        <th className="py-0 pr-2 w-16 align-middle text-center">P.R</th>
                        <th className="py-0 pr-2 w-14 align-middle text-center">Qty</th>
                        <th className="py-0 pr-2 w-14 align-middle text-center">Free</th>
                        <th className="py-0 pr-2 w-20 align-middle text-center">Final</th>
                        <th className="py-0 pr-2 w-16 align-middle text-center">S.R</th>
                        <th className="py-0 pr-2 w-20 align-middle text-center">Amt</th>
                        <th className="py-0 pr-2 w-10 align-middle"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, idx) => (
                          <PurchaseItemRow
                            key={idx}
                            index={idx}
                            row={row}
                            onChange={updateRow}
                            onRemove={() => removeRow(idx)}
                            onActivate={setActiveRow}
                            search={search}
                          />
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

            <div className="grid gap-6 lg:grid-cols-12">
              <div className="lg:col-span-4 rounded-3xl bg-white/5 p-6 ring-1 ring-inset ring-white/10">
                <div className="text-sm font-semibold">Batch Information</div>
                <p className="mt-2 text-sm text-slate-400">Select a medicine row to view existing batches and stock.</p>

                {!active?.medicineId ? (
                  <div className="mt-4 text-sm text-slate-500">No medicine selected.</div>
                ) : batchLoading ? (
                  <div className="mt-4 text-sm text-slate-400">Loading batches…</div>
                ) : batches.length === 0 ? (
                  <div className="mt-4 text-sm text-slate-500">No batches found for this medicine.</div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {batches.map((b) => (
                      <button
                        key={b._id}
                        type="button"
                        className="w-full rounded-2xl bg-slate-950/40 p-4 text-left ring-1 ring-inset ring-white/10 hover:bg-white/5"
                        onClick={() => {
                          const mrp = Number(b.mrp || 0)
                          const trade = Number(b.tradeRate || 0)
                          const discountPercent = mrp > 0 && trade >= 0 && trade <= mrp ? ((mrp - trade) / mrp) * 100 : 0
                          updateRow(activeRow, {
                            batchNumber: b.batchNumber,
                            rackLocation: b.rackLocation || '',
                            expiry: fmtExpiryValue(b.expiryDate),
                            mrp: Number(b.mrp || 0),
                            discountPercent,
                            saleRate: Number(b.saleRate || 0),
                            quantity: 1,
                            freeQuantity: 0,
                          })
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold">{b.batchNumber}</div>
                          <div className="text-xs text-slate-400">{fmtExpiryLabel(b.expiryDate)}</div>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-300">
                          <div>Stock: <span className="text-slate-100">{b.quantity}</span></div>
                          <div>Free: <span className="text-slate-100">{b.freeQuantity}</span></div>
                          <div>MRP: <span className="text-slate-100">{Number(b.mrp || 0).toFixed(2)}</span></div>
                          <div>Sale: <span className="text-slate-100">{Number(b.saleRate || 0).toFixed(2)}</span></div>
                          <div>Purchase: <span className="text-slate-100">{Number(b.purchaseRate || 0).toFixed(2)}</span></div>
                          <div>Trade: <span className="text-slate-100">{Number(b.tradeRate || 0).toFixed(2)}</span></div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="lg:col-span-8 rounded-3xl bg-white/5 p-6 ring-1 ring-inset ring-white/10">
              <div className="text-sm font-semibold">Purchase Summary</div>
              <div className="mt-4 grid gap-4 md:grid-cols-4">
                <div className="rounded-2xl bg-slate-950/40 p-4 ring-1 ring-inset ring-white/10">
                  <div className="text-xs text-slate-400">Total Items</div>
                  <div className="mt-1 text-lg font-semibold">{summary.items}</div>
                </div>
                <div className="rounded-2xl bg-slate-950/40 p-4 ring-1 ring-inset ring-white/10">
                  <div className="text-xs text-slate-400">Total Quantity</div>
                  <div className="mt-1 text-lg font-semibold">{summary.qty}</div>
                </div>
                <div className="rounded-2xl bg-slate-950/40 p-4 ring-1 ring-inset ring-white/10">
                  <div className="text-xs text-slate-400">Gross Amount</div>
                  <div className="mt-1 text-lg font-semibold">{summary.gross.toFixed(2)}</div>
                </div>
                <div className="rounded-2xl bg-slate-950/40 p-4 ring-1 ring-inset ring-white/10">
                  <div className="text-xs text-slate-400">Discount</div>
                  <div className="mt-1 text-lg font-semibold">{summary.discount.toFixed(2)}</div>
                </div>
                <div className="rounded-2xl bg-slate-950/40 p-4 ring-1 ring-inset ring-white/10">
                  <div className="text-xs text-slate-400">CGST</div>
                  <div className="mt-1 text-lg font-semibold">{summary.cgst.toFixed(2)}</div>
                </div>
                <div className="rounded-2xl bg-slate-950/40 p-4 ring-1 ring-inset ring-white/10">
                  <div className="text-xs text-slate-400">SGST</div>
                  <div className="mt-1 text-lg font-semibold">{summary.sgst.toFixed(2)}</div>
                </div>
                <div className="rounded-2xl bg-slate-950/40 p-4 ring-1 ring-inset ring-white/10">
                  <div className="text-xs text-slate-400">Total GST</div>
                  <div className="mt-1 text-lg font-semibold">{summary.gst.toFixed(2)}</div>
                </div>
                <div className="rounded-2xl bg-slate-950/40 p-4 ring-1 ring-inset ring-white/10">
                  <div className="text-xs text-slate-400">Round Off</div>
                  <div className="mt-1 text-lg font-semibold">{summary.roundOff.toFixed(2)}</div>
                </div>
              </div>

               <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                 <div className="flex flex-wrap items-end gap-3 text-sm text-slate-300">
                   <div>
                     Net Amount:{' '}
                     <span className="text-xl font-semibold text-slate-100">
                       {summary.netRounded.toFixed(2)}
                     </span>
                   </div>
                   <div className="flex items-end gap-2">
                     <span>Paid:</span>
                     <input
                       className="h-9 w-28 rounded-xl bg-slate-950/40 px-3 text-sm text-slate-100 ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                       type="number"
                       min={0}
                       step="0.01"
                       value={header.paidAmount}
                       onKeyDown={(e) => {
                         if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') e.preventDefault()
                       }}
                       onChange={(e) => setHeader((h) => ({ ...h, paidAmount: Number(e.target.value) }))}
                     />
                   </div>
                   <div>
                     Payable:{' '}
                     <span className="text-xl font-semibold text-slate-100">
                       {(Math.max(0, summary.netRounded - Math.min(Math.max(0, Number(header.paidAmount || 0)), summary.netRounded))).toFixed(2)}
                     </span>
                   </div>
                 </div>
                 <div className="flex flex-wrap gap-2">
                   <Button type="button" variant="secondary" onClick={() => window.print()}>
                     Print Purchase Invoice
                   </Button>
                  <Button type="button" variant="secondary" onClick={cancel}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving…' : 'Save Purchase'}
                  </Button>
                </div>
              </div>
            </div>
            </div>
              </form>
            ) : null}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
