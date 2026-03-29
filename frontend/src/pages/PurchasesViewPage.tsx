import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Button from '../components/Button'
import Container from '../components/Container'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../services/api'
import { getTenantSlug } from '../services/tenant'

type SupplierRef = { _id: string; supplierName: string }
type Supplier = { _id: string; supplierName: string }

type Purchase = {
  _id: string
  supplierId: string | SupplierRef
  invoiceNumber: string
  invoiceDate: string
  purchaseDate: string
  paymentType: 'Cash' | 'Credit' | 'UPI'
  dueDate?: string
  totalAmount: number
  discountAmount: number
  gstAmount: number
  netAmount: number
  paidAmount: number
  balanceAmount: number
  remarks?: string
  createdAt: string
}

type PurchaseItem = {
  _id: string
  medicineId: { _id: string; medicineName: string } | string
  hsnCode?: string
  batchNumber: string
  expiryDate: string
  quantity: number
  freeQuantity: number
  mrp: number
  discountPercent: number
  gstPercent: number
  purchaseRate: number
  saleRate: number
  totalAmount: number
}

type EditingRow = {
  _id: string
  medicineId: string
  medicineName: string
  hsnCode: string
  batchNumber: string
  expiryDate: string
  quantity: number
  freeQuantity: number
  mrp: number
  discountPercent: number
  gstPercent: number
  saleRate: number
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

function supplierName(supplierId: Purchase['supplierId']) {
  if (!supplierId) return '-'
  if (typeof supplierId === 'string') return supplierId
  return supplierId.supplierName || '-'
}

export default function PurchasesViewPage() {
  const { token, user } = useAuth()
  const { tenantSlug } = useParams()
  const isLocalhost = window.location.hostname === 'localhost'
  const effectiveSlug = tenantSlug || (isLocalhost ? getTenantSlug() : null)
  const base = effectiveSlug ? `/${effectiveSlug}` : ''

  const canView = user?.role === 'PharmacyAdmin' || Boolean(user?.moduleAccess?.purchases?.view)
  const canManage = user?.role === 'PharmacyAdmin' || Boolean(user?.moduleAccess?.purchases?.manage)

  const [items, setItems] = useState<Purchase[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [sortKey, setSortKey] = useState<'new' | 'old' | 'invoice' | 'net'>('new')

  const [viewing, setViewing] = useState<{ purchase: Purchase; lines: PurchaseItem[] } | null>(null)
  const [editing, setEditing] = useState<Purchase | null>(null)
  const [editingItems, setEditingItems] = useState<{ purchaseId: string; rows: EditingRow[] } | null>(null)
  const [savingItems, setSavingItems] = useState(false)
  const [paying, setPaying] = useState<Purchase | null>(null)
  const [payAmount, setPayAmount] = useState(0)
  const [savingPay, setSavingPay] = useState(false)
  const [editForm, setEditForm] = useState({
    supplierId: '',
    invoiceNumber: '',
    invoiceDate: '',
    purchaseDate: '',
    paymentType: 'Cash' as 'Cash' | 'Credit' | 'UPI',
    paidAmount: 0,
    dueDate: '',
    remarks: '',
  })
  const [savingEdit, setSavingEdit] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [purchasesRes, suppliersRes] = await Promise.all([
        apiFetch<{ items: Purchase[] }>('/api/purchases', { token }),
        apiFetch<{ items: Supplier[] }>('/api/suppliers', { token }),
      ])
      setItems(purchasesRes.items || [])
      setSuppliers(suppliersRes.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load purchases')
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
      : items.filter((p) => {
          const hay = `${p.invoiceNumber} ${supplierName(p.supplierId)} ${p.paymentType} ${fmtDate(p.invoiceDate)}`.toLowerCase()
          return hay.includes(q)
        })

    const sorted = [...list]
    sorted.sort((a, b) => {
      if (sortKey === 'invoice') return String(a.invoiceNumber).localeCompare(String(b.invoiceNumber))
      if (sortKey === 'net') return Number(b.netAmount || 0) - Number(a.netAmount || 0)
      if (sortKey === 'old') return +new Date(a.createdAt) - +new Date(b.createdAt)
      return +new Date(b.createdAt) - +new Date(a.createdAt)
    })
    return sorted
  }, [items, searchText, sortKey])

  async function fetchDetails(purchaseId: string) {
    return apiFetch<{ purchase: Purchase; items: PurchaseItem[] }>(`/api/purchases/${purchaseId}`, { token })
  }

  async function openView(p: Purchase) {
    setError(null)
    try {
      const res = await fetchDetails(p._id)
      setViewing({ purchase: res.purchase, lines: res.items || [] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load purchase details')
    }
  }

  function openEditItems(target: { purchase: Purchase; lines: PurchaseItem[] }) {
    if (!canManage) return
    const ok = window.confirm('Edit medicines in this purchase?\n\nThis may fail if some stock is already sold.')
    if (!ok) return

    const rows = target.lines.map((l) => {
      const medId = typeof l.medicineId === 'string' ? l.medicineId : l.medicineId?._id || ''
      return {
        _id: l._id,
        medicineId: medId,
        medicineName: typeof l.medicineId === 'string' ? l.medicineId : l.medicineId?.medicineName || '',
        hsnCode: l.hsnCode || '',
        batchNumber: l.batchNumber || '',
        expiryDate: l.expiryDate ? String(l.expiryDate).slice(0, 10) : '',
        quantity: Number(l.quantity || 0),
        freeQuantity: Number(l.freeQuantity || 0),
        mrp: Number(l.mrp || 0),
        discountPercent: Number(l.discountPercent || 0),
        gstPercent: Number(l.gstPercent || 0),
        saleRate: Number(l.saleRate || 0),
      }
    })

    setEditingItems({ purchaseId: target.purchase._id, rows })
  }

  async function openViewAndEditMedicines(p: Purchase) {
    if (!canManage) return
    setError(null)
    try {
      const res = await fetchDetails(p._id)
      const target = { purchase: res.purchase, lines: res.items || [] }
      setViewing(target)
      openEditItems(target)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load purchase details')
    }
  }

  async function saveEditItems() {
    if (!editingItems) return
    if (!canManage) return
    const ok = window.confirm('Save medicine changes? Stock will be adjusted.')
    if (!ok) return

    setSavingItems(true)
    setError(null)
    try {
      const payloadItems = editingItems.rows.map((r, idx) => {
        if (!r.medicineId) throw new Error(`Row ${idx + 1}: medicine missing`)
        if (!r.batchNumber) throw new Error(`Row ${idx + 1}: batch missing`)
        if (!r.expiryDate) throw new Error(`Row ${idx + 1}: expiry date missing`)
        return {
          medicineId: r.medicineId,
          batchNumber: String(r.batchNumber || '').trim(),
          expiryDate: r.expiryDate,
          quantity: Number(r.quantity || 0),
          freeQuantity: Number(r.freeQuantity || 0),
          mrp: Number(r.mrp || 0),
          discountPercent: Number(r.discountPercent || 0),
          gstPercent: Number(r.gstPercent || 0),
          saleRate: Number(r.saleRate || 0),
          hsnCode: r.hsnCode || '',
        }
      })

      const res = await apiFetch<{ purchase: Purchase; items: PurchaseItem[] }>(
        `/api/purchases/${editingItems.purchaseId}/items`,
        {
          method: 'PUT',
          token,
          body: { items: payloadItems },
        },
      )

      setViewing({ purchase: res.purchase, lines: res.items || [] })
      await load()
      setEditingItems(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update medicines')
    } finally {
      setSavingItems(false)
    }
  }

  function openEdit(p: Purchase) {
    if (!canManage) return
    const ok = window.confirm(`Edit purchase?\n\nInvoice: ${p.invoiceNumber}`)
    if (!ok) return
    setEditing(p)
    setEditForm({
      supplierId: typeof p.supplierId === 'string' ? p.supplierId : p.supplierId?._id || '',
      invoiceNumber: p.invoiceNumber || '',
      invoiceDate: p.invoiceDate ? String(p.invoiceDate).slice(0, 10) : '',
      purchaseDate: p.purchaseDate ? String(p.purchaseDate).slice(0, 10) : '',
      paymentType: p.paymentType,
      paidAmount: Number(p.paidAmount || 0),
      dueDate: p.dueDate ? String(p.dueDate).slice(0, 10) : '',
      remarks: p.remarks || '',
    })
  }

  async function saveEdit() {
    if (!editing) return
    if (!canManage) return
    const ok = window.confirm('Save changes?')
    if (!ok) return
    setSavingEdit(true)
    setError(null)
    try {
      const payload = {
        supplierId: editForm.supplierId,
        invoiceNumber: editForm.invoiceNumber,
        invoiceDate: editForm.invoiceDate,
        purchaseDate: editForm.purchaseDate,
        paymentType: editForm.paymentType,
        paidAmount: Number(editForm.paidAmount || 0),
        dueDate: editForm.dueDate || '',
        remarks: editForm.remarks || '',
      }
      const res = await apiFetch<{ item: Purchase }>(`/api/purchases/${editing._id}`, {
        method: 'PUT',
        token,
        body: payload,
      })
      setItems((prev) => prev.map((p) => (p._id === editing._id ? res.item : p)))
      setEditing(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update purchase')
    } finally {
      setSavingEdit(false)
    }
  }

  async function removePurchase(p: Purchase) {
    if (!canManage) return
    const ok = window.confirm(`Delete purchase?\n\nInvoice: ${p.invoiceNumber}\nThis will rollback stock.`)
    if (!ok) return
    setError(null)
    try {
      await apiFetch(`/api/purchases/${p._id}`, { method: 'DELETE', token })
      setItems((prev) => prev.filter((x) => x._id !== p._id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete purchase')
    }
  }

  function openPay(p: Purchase) {
    if (!canManage) return
    const bal = Number(p.balanceAmount || 0)
    if (bal <= 0) {
      alert('No balance pending.')
      return
    }
    setPaying(p)
    setPayAmount(bal)
  }

  async function savePay() {
    if (!paying) return
    if (!canManage) return
    const amt = Math.max(0, Number(payAmount || 0))
    if (!amt) return
    const ok = window.confirm(`Pay now: ${amt.toFixed(2)}?`)
    if (!ok) return

    setSavingPay(true)
    setError(null)
    try {
      const nextPaid = Math.min(Number(paying.netAmount || 0), Number(paying.paidAmount || 0) + amt)
      const res = await apiFetch<{ item: Purchase }>(`/api/purchases/${paying._id}`, {
        method: 'PUT',
        token,
        body: { paidAmount: nextPaid },
      })
      setItems((prev) => prev.map((p) => (p._id === paying._id ? res.item : p)))
      setPaying(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save payment')
    } finally {
      setSavingPay(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader />
      <main className="py-10">
        <Container>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Purchase Views</h1>
              <div className="mt-1 text-sm text-slate-400">Search, sort, view, edit payment, or delete.</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                className="rounded-full bg-transparent px-4 py-2 text-sm text-slate-300 ring-1 ring-inset ring-white/10 hover:bg-white/5"
                to={`${base}/purchases`}
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
                    placeholder="Search invoice / supplier / type..."
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
                    <option value="invoice">Invoice No</option>
                    <option value="net">Net Amount</option>
                  </select>
                </div>
                <Button variant="secondary" onClick={() => void load()} disabled={loading}>
                  Refresh
                </Button>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="py-2 pr-3">Invoice</th>
                      <th className="py-2 pr-3">Supplier</th>
                      <th className="py-2 pr-3">Invoice Date</th>
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
                      filtered.map((p) => (
                        <tr key={p._id} className="align-top">
                          <td className="py-3 pr-3 font-medium text-slate-100">{p.invoiceNumber}</td>
                          <td className="py-3 pr-3 text-slate-200">{supplierName(p.supplierId)}</td>
                          <td className="py-3 pr-3 text-slate-200">{fmtDate(p.invoiceDate)}</td>
                          <td className="py-3 pr-3 text-slate-200">{p.paymentType}</td>
                          <td className="py-3 pr-3 text-right tabular-nums text-slate-200">
                            {Number(p.netAmount || 0).toFixed(2)}
                          </td>
                          <td className="py-3 pr-3 text-right tabular-nums text-slate-200">
                            {Number(p.paidAmount || 0).toFixed(2)}
                          </td>
                          <td className="py-3 pr-3 text-right tabular-nums text-slate-200">
                            {Number(p.balanceAmount || 0).toFixed(2)}
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="secondary" onClick={() => void openView(p)}>
                                View
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => void openViewAndEditMedicines(p)}
                                disabled={!canManage}
                              >
                                Edit Medicines
                              </Button>
                              <Button variant="secondary" onClick={() => openPay(p)} disabled={!canManage}>
                                Pay
                              </Button>
                              <Button variant="secondary" onClick={() => openEdit(p)} disabled={!canManage}>
                                Edit
                              </Button>
                              <Button variant="danger" onClick={() => void removePurchase(p)} disabled={!canManage}>
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="py-4 text-slate-400" colSpan={8}>
                          No purchases found.
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
                    <div className="text-lg font-semibold">Invoice {viewing.purchase.invoiceNumber}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {supplierName(viewing.purchase.supplierId)} • {fmtDate(viewing.purchase.invoiceDate)} •{' '}
                      {viewing.purchase.paymentType}
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="secondary" onClick={() => openEditItems(viewing)} disabled={!canManage}>
                      Edit Medicines
                    </Button>
                    <Button variant="secondary" onClick={() => setViewing(null)}>
                      Close
                    </Button>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="py-2 pr-3">Product</th>
                        <th className="py-2 pr-3">Batch</th>
                        <th className="py-2 pr-3">Exp</th>
                        <th className="py-2 pr-3 text-right">Qty</th>
                        <th className="py-2 pr-3 text-right">Free</th>
                        <th className="py-2 pr-3 text-right">MRP</th>
                        <th className="py-2 pr-3 text-right">P.R</th>
                        <th className="py-2 pr-3 text-right">S.R</th>
                        <th className="py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {viewing.lines.map((l) => (
                        <tr key={l._id}>
                          <td className="py-2 pr-3 text-slate-100">
                            {typeof l.medicineId === 'string'
                              ? l.medicineId
                              : l.medicineId?.medicineName || '-'}
                          </td>
                          <td className="py-2 pr-3 text-slate-200">{l.batchNumber}</td>
                          <td className="py-2 pr-3 text-slate-200">{fmtDate(l.expiryDate)}</td>
                          <td className="py-2 pr-3 text-right tabular-nums text-slate-200">{l.quantity}</td>
                          <td className="py-2 pr-3 text-right tabular-nums text-slate-200">{l.freeQuantity}</td>
                          <td className="py-2 pr-3 text-right tabular-nums text-slate-200">
                            {Number(l.mrp || 0).toFixed(2)}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums text-slate-200">
                            {Number(l.purchaseRate || 0).toFixed(2)}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums text-slate-200">
                            {Number(l.saleRate || 0).toFixed(2)}
                          </td>
                          <td className="py-2 text-right tabular-nums text-slate-200">
                            {Number(l.totalAmount || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          {editing ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-lg rounded-3xl bg-slate-950 p-6 ring-1 ring-inset ring-white/10">
                <div className="text-lg font-semibold">Edit Purchase</div>
                <div className="mt-1 text-sm text-slate-400">Invoice {editing.invoiceNumber}</div>

                <div className="mt-4 grid gap-3">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-slate-300">Supplier</span>
                    <select
                      className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10"
                      value={editForm.supplierId}
                      onChange={(e) => setEditForm((f) => ({ ...f, supplierId: e.target.value }))}
                      required
                    >
                      <option value="">Select supplier</option>
                      {suppliers.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.supplierName}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-slate-300">Invoice number</span>
                    <input
                      className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10"
                      value={editForm.invoiceNumber}
                      onChange={(e) => setEditForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
                      required
                    />
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-slate-300">Invoice date</span>
                    <input
                      className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10"
                      type="date"
                      value={editForm.invoiceDate}
                      onChange={(e) => setEditForm((f) => ({ ...f, invoiceDate: e.target.value }))}
                      required
                    />
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-slate-300">Purchase date</span>
                    <input
                      className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10"
                      type="date"
                      value={editForm.purchaseDate}
                      onChange={(e) => setEditForm((f) => ({ ...f, purchaseDate: e.target.value }))}
                      required
                    />
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-slate-300">Payment type</span>
                    <select
                      className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10"
                      value={editForm.paymentType}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, paymentType: e.target.value as Purchase['paymentType'] }))
                      }
                    >
                      <option value="Cash">Cash</option>
                      <option value="Credit">Credit</option>
                      <option value="UPI">UPI</option>
                    </select>
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-slate-300">Paid amount</span>
                    <input
                      className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10"
                      type="number"
                      min={0}
                      value={Number(editForm.paidAmount || 0) === 0 ? '' : editForm.paidAmount}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, paidAmount: e.target.value === '' ? 0 : Number(e.target.value) }))
                      }
                    />
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-slate-300">Due date</span>
                    <input
                      className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10"
                      type="date"
                      value={editForm.dueDate}
                      onChange={(e) => setEditForm((f) => ({ ...f, dueDate: e.target.value }))}
                    />
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-slate-300">Remarks</span>
                    <input
                      className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10"
                      value={editForm.remarks}
                      onChange={(e) => setEditForm((f) => ({ ...f, remarks: e.target.value }))}
                    />
                  </label>
                </div>

                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setEditing(null)} disabled={savingEdit}>
                    Cancel
                  </Button>
                  <Button onClick={() => void saveEdit()} disabled={!canManage || savingEdit}>
                    {savingEdit ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {paying ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-md rounded-3xl bg-slate-950 p-6 ring-1 ring-inset ring-white/10">
                <div className="text-lg font-semibold">Pay Balance</div>
                <div className="mt-1 text-sm text-slate-400">
                  Invoice {paying.invoiceNumber} • Balance {Number(paying.balanceAmount || 0).toFixed(2)}
                </div>

                <label className="mt-4 grid gap-1.5">
                  <span className="text-xs font-medium text-slate-300">Pay amount</span>
                  <input
                    className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10"
                    type="number"
                    min={0}
                    max={Number(paying.balanceAmount || 0)}
                    value={Number(payAmount || 0) === 0 ? '' : payAmount}
                    onChange={(e) => setPayAmount(e.target.value === '' ? 0 : Number(e.target.value))}
                  />
                </label>

                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setPaying(null)} disabled={savingPay}>
                    Cancel
                  </Button>
                  <Button onClick={() => void savePay()} disabled={!canManage || savingPay}>
                    {savingPay ? 'Saving…' : 'Pay'}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {editingItems ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-6xl rounded-3xl bg-slate-950 p-6 ring-1 ring-inset ring-white/10">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-lg font-semibold">Edit Purchase Medicines</div>
                    <div className="mt-1 text-sm text-slate-400">
                      Change Qty / Free / MRP / Disc% / GST% / S.R and save.
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="secondary" onClick={() => setEditingItems(null)} disabled={savingItems}>
                      Cancel
                    </Button>
                    <Button onClick={() => void saveEditItems()} disabled={!canManage || savingItems}>
                      {savingItems ? 'Saving…' : 'Save Changes'}
                    </Button>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[1100px] text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="py-2 pr-3">Product</th>
                        <th className="py-2 pr-3">Batch</th>
                        <th className="py-2 pr-3">Expiry</th>
                        <th className="py-2 pr-3 text-right">MRP</th>
                        <th className="py-2 pr-3 text-right">Disc%</th>
                        <th className="py-2 pr-3 text-right">GST%</th>
                        <th className="py-2 pr-3 text-right">Qty</th>
                        <th className="py-2 pr-3 text-right">Free</th>
                        <th className="py-2 text-right">S.R</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {editingItems.rows.map((r, idx) => (
                        <tr key={r._id || idx}>
                          <td className="py-2 pr-3 text-slate-100">{r.medicineName}</td>
                          <td className="py-2 pr-3">
                            <input
                              className="h-9 w-40 rounded-lg bg-slate-950/40 px-2 text-sm ring-1 ring-inset ring-white/10"
                              value={r.batchNumber}
                              onChange={(e) =>
                                setEditingItems((cur) =>
                                  cur
                                    ? {
                                        ...cur,
                                        rows: cur.rows.map((x, i) =>
                                          i === idx ? { ...x, batchNumber: e.target.value } : x,
                                        ),
                                      }
                                    : cur,
                                )
                              }
                              required
                            />
                          </td>
                          <td className="py-2 pr-3">
                            <input
                              className="h-9 w-40 rounded-lg bg-slate-950/40 px-2 text-sm ring-1 ring-inset ring-white/10"
                              type="date"
                              value={r.expiryDate}
                              onChange={(e) =>
                                setEditingItems((cur) =>
                                  cur
                                    ? {
                                        ...cur,
                                        rows: cur.rows.map((x, i) =>
                                          i === idx ? { ...x, expiryDate: e.target.value } : x,
                                        ),
                                      }
                                    : cur,
                                )
                              }
                              required
                            />
                          </td>
                          <td className="py-2 pr-3 text-right">
                            <input
                              className="h-9 w-24 rounded-lg bg-slate-950/40 px-2 text-right text-sm ring-1 ring-inset ring-white/10"
                              type="number"
                              min={0}
                              value={Number(r.mrp || 0) === 0 ? '' : r.mrp}
                              onChange={(e) =>
                                setEditingItems((cur) =>
                                  cur
                                    ? {
                                        ...cur,
                                        rows: cur.rows.map((x, i) =>
                                          i === idx ? { ...x, mrp: e.target.value === '' ? 0 : Number(e.target.value) } : x,
                                        ),
                                      }
                                    : cur,
                                )
                              }
                              required
                            />
                          </td>
                          <td className="py-2 pr-3 text-right">
                            <input
                              className="h-9 w-20 rounded-lg bg-slate-950/40 px-2 text-right text-sm ring-1 ring-inset ring-white/10"
                              type="number"
                              min={0}
                              max={100}
                              step="0.01"
                              value={Number(r.discountPercent || 0) === 0 ? '' : r.discountPercent}
                              onChange={(e) =>
                                setEditingItems((cur) =>
                                  cur
                                    ? {
                                        ...cur,
                                        rows: cur.rows.map((x, i) =>
                                          i === idx
                                            ? { ...x, discountPercent: e.target.value === '' ? 0 : Number(e.target.value) }
                                            : x,
                                        ),
                                      }
                                    : cur,
                                )
                              }
                            />
                          </td>
                          <td className="py-2 pr-3 text-right">
                            <input
                              className="h-9 w-20 rounded-lg bg-slate-950/40 px-2 text-right text-sm ring-1 ring-inset ring-white/10"
                              type="number"
                              min={0}
                              step="0.01"
                              value={Number(r.gstPercent || 0) === 0 ? '' : r.gstPercent}
                              onChange={(e) =>
                                setEditingItems((cur) =>
                                  cur
                                    ? {
                                        ...cur,
                                        rows: cur.rows.map((x, i) =>
                                          i === idx ? { ...x, gstPercent: e.target.value === '' ? 0 : Number(e.target.value) } : x,
                                        ),
                                      }
                                    : cur,
                                )
                              }
                            />
                          </td>
                          <td className="py-2 pr-3 text-right">
                            <input
                              className="h-9 w-20 rounded-lg bg-slate-950/40 px-2 text-right text-sm ring-1 ring-inset ring-white/10"
                              type="number"
                              min={0}
                              value={Number(r.quantity || 0) === 0 ? '' : r.quantity}
                              onChange={(e) =>
                                setEditingItems((cur) =>
                                  cur
                                    ? {
                                        ...cur,
                                        rows: cur.rows.map((x, i) =>
                                          i === idx ? { ...x, quantity: e.target.value === '' ? 0 : Number(e.target.value) } : x,
                                        ),
                                      }
                                    : cur,
                                )
                              }
                              required
                            />
                          </td>
                          <td className="py-2 pr-3 text-right">
                            <input
                              className="h-9 w-20 rounded-lg bg-slate-950/40 px-2 text-right text-sm ring-1 ring-inset ring-white/10"
                              type="number"
                              min={0}
                              value={Number(r.freeQuantity || 0) === 0 ? '' : r.freeQuantity}
                              onChange={(e) =>
                                setEditingItems((cur) =>
                                  cur
                                    ? {
                                        ...cur,
                                        rows: cur.rows.map((x, i) =>
                                          i === idx ? { ...x, freeQuantity: e.target.value === '' ? 0 : Number(e.target.value) } : x,
                                        ),
                                      }
                                    : cur,
                                )
                              }
                            />
                          </td>
                          <td className="py-2 text-right">
                            <input
                              className="h-9 w-24 rounded-lg bg-slate-950/40 px-2 text-right text-sm ring-1 ring-inset ring-white/10"
                              type="number"
                              min={0}
                              value={Number(r.saleRate || 0) === 0 ? '' : r.saleRate}
                              onChange={(e) =>
                                setEditingItems((cur) =>
                                  cur
                                    ? {
                                        ...cur,
                                        rows: cur.rows.map((x, i) =>
                                          i === idx ? { ...x, saleRate: e.target.value === '' ? 0 : Number(e.target.value) } : x,
                                        ),
                                      }
                                    : cur,
                                )
                              }
                              required
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </Container>
      </main>
    </div>
  )
}
