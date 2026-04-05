import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Button from '../components/Button'
import SiteFooter from '../components/SiteFooter'
import SiteHeader from '../components/SiteHeader'
import PurchaseItemRow from '../components/PurchaseItemRow'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../services/api'
import {
  createMedicine,
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

function maskExpiryDmy(value) {
  const digits = String(value || '')
    .replace(/\D/g, '')
    .slice(0, 8)
  if (!digits) return ''
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

function emptyRow() {
  return {
    categoryName: '',
    manufacturerName: '',
    productName: '',
    medicineId: '',
    batchNumber: '',
    rackLocation: '',
    expiry: '',
    hsnCode: '',
    mrp: 0,
    saleRate: 0,
    saleRateTouched: false,
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
  const [suppliers, setSuppliers] = useState([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(true)
  const [categories, setCategories] = useState([])
  const [manufacturersByCategoryId, setManufacturersByCategoryId] = useState({})
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [savingDistributor, setSavingDistributor] = useState(false)
  const [showDistributorModal, setShowDistributorModal] = useState(false)
  const [showMedicineModal, setShowMedicineModal] = useState(false)
  const [savingMedicine, setSavingMedicine] = useState(false)
  const [medicineModalError, setMedicineModalError] = useState(null)

  const [distributorOpen, setDistributorOpen] = useState(false)
  const [distributorQuery, setDistributorQuery] = useState('')
  const distributorInputRef = useRef(null)
  const [distributorPopup, setDistributorPopup] = useState({ top: 0, left: 0, width: 0 })

  const [mobileProductOpen, setMobileProductOpen] = useState(false)
  const [mobileProductResults, setMobileProductResults] = useState([])
  const [mobileProductHighlight, setMobileProductHighlight] = useState(0)
  const [mobileProductPopup, setMobileProductPopup] = useState({ top: 0, left: 0, width: 0 })
  const mobileProductRef = useRef(null)

  const [header, setHeader] = useState({
    supplierId: '',
    invoiceNumber: '',
    invoiceDate: isoToday(),
    purchaseDate: isoToday(),
    purchaseType: 'Cash',
    paidAmount: 0,
    paidAmountTouched: false,
    dueDate: '',
    remarks: '',
  })

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s._id === header.supplierId) || null,
    [suppliers, header.supplierId],
  )

  const filteredSuppliers = useMemo(() => {
    const q = String(distributorQuery || '').trim().toLowerCase()
    if (!q) return suppliers
    return (suppliers || []).filter((s) => {
      const hay = `${s.supplierName || ''} ${s.dlNumber || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [suppliers, distributorQuery])

  const canManageSuppliers = user?.role === 'PharmacyAdmin'

  const [distributor, setDistributor] = useState({
    supplierName: '',
    dlNumber: '',
    address: '',
  })

  const [newMedicine, setNewMedicine] = useState({
    category: '',
    manufacturer: '',
    medicineName: '',
    rackLocation: '',
    hsnCode: '',
    gstPercent: 0,
    allowLooseSale: false,
  })
  const [newMedicineCustomFields, setNewMedicineCustomFields] = useState({})

  const [rows, setRows] = useState(() => Array.from({ length: 5 }, () => emptyRow()))
  const [activeRow, setActiveRow] = useState(0)
  const active = rows[activeRow] || emptyRow()
  const activeTotals = useMemo(() => lineTotals(active), [active])

  const [batchLoading, setBatchLoading] = useState(false)
  const [batches, setBatches] = useState([])
  const previewBatch = useMemo(() => {
    if (!active?.medicineId) return null
    if (!Array.isArray(batches) || batches.length === 0) return null
    const currentBatchNo = String(active?.batchNumber || '').trim()
    if (currentBatchNo) {
      const match = batches.find((b) => String(b?.batchNumber || '').trim() === currentBatchNo)
      if (match) return match
    }
    // "Last batch" = most recently updated stock row for this medicine.
    const last = batches.reduce((acc, b) => {
      if (!acc) return b
      const aT = new Date(acc.updatedAt || acc.createdAt || 0).getTime()
      const bT = new Date(b.updatedAt || b.createdAt || 0).getTime()
      return bT > aT ? b : acc
    }, null)
    return last || batches[0] || null
  }, [active?.medicineId, active?.batchNumber, batches])

  const [batchPopoverOpen, setBatchPopoverOpen] = useState(false)
  const batchMoreBtnRef = useRef(null)
  const [batchPopoverPos, setBatchPopoverPos] = useState({ top: 0, left: 0, width: 520 })

  const applyBatchToRow = useCallback(
    (rowIndex, batch, { setQtyIfEmpty = false } = {}) => {
      if (!batch) return
      const mrp = Number(batch.mrp || 0)
      const trade = Number(batch.tradeRate || 0)
      const discountPercent =
        mrp > 0 && trade >= 0 && trade <= mrp ? ((mrp - trade) / mrp) * 100 : 0

      const nextPatch = {
        batchNumber: batch.batchNumber,
        rackLocation: batch.rackLocation || '',
        expiry: fmtExpiryValue(batch.expiryDate),
        mrp,
        discountPercent,
      }

      if (setQtyIfEmpty) {
        const currentQty = Number(rows?.[rowIndex]?.quantity || 0)
        if (!Number.isFinite(currentQty) || currentQty <= 0) nextPatch.quantity = 1
      }

      updateRow(rowIndex, nextPatch)
    },
    [rows, updateRow],
  )

  useEffect(() => {
    // When a medicine is selected, auto-fill the row from the last batch (only if row fields are still blank).
    if (!active?.medicineId) return
    if (!previewBatch) return
    const r = rows?.[activeRow]
    if (!r || r.medicineId !== active.medicineId) return
    // Autofill only when user hasn't started a specific batch entry yet.
    // This avoids overwriting if the user already typed batch/expiry.
    const hasBatchEntry = Boolean(String(r.batchNumber || '').trim()) || Boolean(String(r.expiry || '').trim())
    if (hasBatchEntry) return
    applyBatchToRow(activeRow, previewBatch, { setQtyIfEmpty: false })
  }, [active?.medicineId, activeRow, applyBatchToRow, previewBatch, rows])

  useEffect(() => {
    if (!batchPopoverOpen) return

    function updatePos() {
      const btn = batchMoreBtnRef.current
      if (!btn) return
      const rect = btn.getBoundingClientRect()
      const width = 560
      const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.right - width))
      const top = Math.round(rect.bottom + 8)
      setBatchPopoverPos({ top, left, width })
    }

    updatePos()
    window.addEventListener('scroll', updatePos, true)
    window.addEventListener('resize', updatePos)
    return () => {
      window.removeEventListener('scroll', updatePos, true)
      window.removeEventListener('resize', updatePos)
    }
  }, [batchPopoverOpen])

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') setBatchPopoverOpen(false)
    }
    if (!batchPopoverOpen) return
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [batchPopoverOpen])

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
        setError(e instanceof Error ? e.message : 'Failed to load distributors')
      } finally {
        if (mounted) setLoadingSuppliers(false)
      }
    }
    void load()
    void (async () => {
      try {
        const res = await apiFetch('/api/categories', { token })
        if (mounted) setCategories(res.items || [])
      } catch {
        if (mounted) setCategories([])
      }
    })()
    return () => {
      mounted = false
    }
  }, [token])

  useEffect(() => {
    // keep combobox text aligned with selected distributor
    if (selectedSupplier?.supplierName) setDistributorQuery(selectedSupplier.supplierName)
    else setDistributorQuery('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [header.supplierId])

  useEffect(() => {
    if (!distributorOpen) return

    function updatePopup() {
      const el = distributorInputRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setDistributorPopup({
        top: Math.round(rect.bottom + 4),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
      })
    }

    updatePopup()
    window.addEventListener('scroll', updatePopup, true)
    window.addEventListener('resize', updatePopup)
    return () => {
      window.removeEventListener('scroll', updatePopup, true)
      window.removeEventListener('resize', updatePopup)
    }
  }, [distributorOpen, distributorQuery])

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
      setShowDistributorModal(false)
      alert('Distributor added')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add distributor')
    } finally {
      setSavingDistributor(false)
    }
  }

  async function onCreateMedicine(e) {
    e.preventDefault()
    if (!token) return
    setMedicineModalError(null)
    setSavingMedicine(true)
    try {
      const looseAllowed = Boolean(selectedNewMedicineCategory?.looseSaleAllowed)
      const res = await createMedicine(token, {
        medicineName: newMedicine.medicineName,
        manufacturer: newMedicine.manufacturer,
        dosageForm: '',
        category: newMedicine.category,
        rackLocation: newMedicine.rackLocation,
        hsnCode: newMedicine.hsnCode,
        gstPercent: newMedicine.gstPercent,
        allowLooseSale: looseAllowed ? Boolean(newMedicine.allowLooseSale) : false,
        customFields: newMedicineCustomFields,
      })

      const item = res?.item
      if (item?._id) {
        updateRow(activeRow, {
          medicineId: item._id,
          productName: item.medicineName,
          categoryName: item.category || newMedicine.category,
          manufacturerName: item.manufacturer || newMedicine.manufacturer,
          rackLocation: item.rackLocation || newMedicine.rackLocation || '',
          hsnCode: item.hsnCode || newMedicine.hsnCode || '',
          gstPercent: Number(item.gstPercent || newMedicine.gstPercent || 0),
        })
      }

      setNewMedicine({
        category: '',
        manufacturer: '',
        medicineName: '',
        rackLocation: '',
        hsnCode: '',
        gstPercent: 0,
        allowLooseSale: false,
      })
      setNewMedicineCustomFields({})
      setShowMedicineModal(false)
      alert('Medicine added')
    } catch (err) {
      setMedicineModalError(err instanceof Error ? err.message : 'Failed to add medicine')
    } finally {
      setSavingMedicine(false)
    }
  }

  const search = useCallback(
    async (q, categoryName, manufacturerName) => {
      const res = await searchMedicines(token, q, categoryName, manufacturerName)
      return res.items || []
    },
    [token],
  )

  const categoriesByName = useMemo(() => {
    const m = new Map()
    for (const c of categories || []) m.set(c.name, c._id)
    return m
  }, [categories])

  const selectedNewMedicineCategory = useMemo(
    () => (categories || []).find((c) => c.name === newMedicine.category) || null,
    [categories, newMedicine.category],
  )

  function dateInputValue(v) {
    if (!v) return ''
    const d = v instanceof Date ? v : new Date(String(v))
    if (Number.isNaN(d.getTime())) return ''
    return d.toISOString().slice(0, 10)
  }

  function renderCustomFieldInput(field, value, onChange) {
    const baseClass =
      'h-11 w-full min-w-0 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400'

    if (field.type === 'select') {
      return (
        <select
          className={baseClass}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          required={Boolean(field.required)}
        >
          <option value="">Select</option>
          {(field.options || []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )
    }

    if (field.type === 'boolean') {
      return (
        <label className="flex h-11 items-center gap-3 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10">
          <input
            type="checkbox"
            className="h-4 w-4 accent-sky-400"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="text-slate-200">Yes</span>
        </label>
      )
    }

    if (field.type === 'number') {
      return (
        <input
          className={baseClass}
          type="number"
          value={value === undefined || value === null ? '' : String(value)}
          min={typeof field.min === 'number' ? field.min : undefined}
          max={typeof field.max === 'number' ? field.max : undefined}
          onChange={(e) => onChange(e.target.value)}
          required={Boolean(field.required)}
        />
      )
    }

    if (field.type === 'date') {
      return (
        <input
          className={baseClass}
          type="date"
          value={dateInputValue(value)}
          onChange={(e) => onChange(e.target.value)}
          required={Boolean(field.required)}
        />
      )
    }

    return (
      <input
        className={baseClass}
        value={typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value)}
        required={Boolean(field.required)}
      />
    )
  }

  const ensureManufacturersForCategoryName = useCallback(
    async (categoryName) => {
      const categoryId = categoriesByName.get(categoryName)
      if (!token) return
      if (!categoryId) return
      if (manufacturersByCategoryId[categoryId]) return
      try {
        const res = await apiFetch(`/api/manufacturers?categoryId=${encodeURIComponent(categoryId)}`, { token })
        setManufacturersByCategoryId((prev) => ({ ...prev, [categoryId]: res.items || [] }))
      } catch {
        setManufacturersByCategoryId((prev) => ({ ...prev, [categoryId]: [] }))
      }
    },
    [apiFetch, categoriesByName, manufacturersByCategoryId, token],
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

  useEffect(() => {
    // Default "Paid" equals Net Amount until user manually edits it.
    setHeader((h) => {
      if (h.paidAmountTouched) return h
      const net = Math.max(0, Number(summary.netRounded || 0))
      if (Number(h.paidAmount || 0) === net) return h
      return { ...h, paidAmount: net }
    })
  }, [summary.netRounded])

  function updateRow(index, patch) {
    setSuccess(false)

    if (Object.prototype.hasOwnProperty.call(patch, 'categoryName')) {
      void ensureManufacturersForCategoryName(patch.categoryName)
    }

    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r

        const next = { ...r, ...patch }

        if (
          Object.prototype.hasOwnProperty.call(patch, 'categoryName') &&
          String(patch.categoryName || '') !== String(r.categoryName || '')
        ) {
          // If user manually changed category, clear dependent fields.
          // If category is being set as part of a product selection (medicineId/productName present),
          // do not clear.
          const hasSelectedMedicine =
            Object.prototype.hasOwnProperty.call(patch, 'medicineId') ||
            Object.prototype.hasOwnProperty.call(patch, 'productName') ||
            Object.prototype.hasOwnProperty.call(patch, 'manufacturerName')

          if (!hasSelectedMedicine) {
            next.manufacturerName = ''
            next.medicineId = ''
            next.productName = ''
          }
        }

        if (
          Object.prototype.hasOwnProperty.call(patch, 'manufacturerName') &&
          String(patch.manufacturerName || '') !== String(r.manufacturerName || '')
        ) {
          const hasSelectedMedicine =
            Object.prototype.hasOwnProperty.call(patch, 'medicineId') ||
            Object.prototype.hasOwnProperty.call(patch, 'productName')
          if (!hasSelectedMedicine) {
            next.medicineId = ''
            next.productName = ''
          }
        }

        // Auto-fill S.R with MRP (until user manually overrides S.R).
        if (Object.prototype.hasOwnProperty.call(patch, 'saleRate')) {
          next.saleRateTouched = true
        }

        if (Object.prototype.hasOwnProperty.call(patch, 'mrp')) {
          const prevMrp = Number(r.mrp || 0)
          const prevSale = Number(r.saleRate || 0)
          const nextMrp = Number(next.mrp || 0)

          const shouldAuto =
            !r.saleRateTouched || prevSale === prevMrp || prevSale === 0

          if (shouldAuto) {
            next.saleRate = nextMrp
            next.saleRateTouched = false
          }
        }

        return next
      }),
    )
  }

  useEffect(() => {
    if (!mobileProductOpen) return
    const q = String(active?.productName || '').trim()
    const t = setTimeout(async () => {
      try {
        if (q.length < 2) {
          setMobileProductResults([])
          setMobileProductHighlight(0)
          return
        }
        const items = await search(q, active?.categoryName || '', active?.manufacturerName || '')
        setMobileProductResults(items || [])
        setMobileProductHighlight(0)
      } catch {
        setMobileProductResults([])
        setMobileProductHighlight(0)
      }
    }, 200)
    return () => clearTimeout(t)
  }, [mobileProductOpen, active?.productName, active?.categoryName, active?.manufacturerName, search])

  useEffect(() => {
    if (!mobileProductOpen) return
    function updatePopup() {
      const el = mobileProductRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setMobileProductPopup({
        top: Math.round(rect.bottom + 4),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
      })
    }
    updatePopup()
    window.addEventListener('scroll', updatePopup, true)
    window.addEventListener('resize', updatePopup)
    return () => {
      window.removeEventListener('scroll', updatePopup, true)
      window.removeEventListener('resize', updatePopup)
    }
  }, [mobileProductOpen, activeRow])

  function blockInvalidNumberKeys(e) {
    if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') e.preventDefault()
  }

  function selectMobileMedicine(m) {
    if (!m) return
    setMobileProductOpen(false)
    updateRow(activeRow, {
      medicineId: m._id,
      productName: m.medicineName,
      categoryName: m.category || active?.categoryName || '',
      manufacturerName: m.manufacturer || active?.manufacturerName || '',
      rackLocation: active?.rackLocation ? active.rackLocation : (m.rackLocation || ''),
      hsnCode: m.hsnCode || '',
      gstPercent: Number(m.gstPercent || 0),
    })
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
      paidAmountTouched: false,
      dueDate: '',
      remarks: '',
    })
    setRows(Array.from({ length: 5 }, () => emptyRow()))
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

      const paid = Math.min(
        Math.max(0, Number(header.paidAmount || 0)),
        Math.max(0, Number(summary.netRounded || 0)),
      )

      for (let idx = 0; idx < rows.length; idx += 1) {
        const r = rows[idx]
        const hasProduct = Boolean(r.medicineId) || Boolean(String(r.productName || '').trim())
        // Only validate rows where a product is selected/filled.
        // Default empty rows should never block saving.
        if (!hasProduct) continue

        const qty = Number(r.quantity || 0)
        if (!Number.isFinite(qty) || qty <= 0) throw new Error(`Row ${idx + 1}: enter quantity`)

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
          quantity: qty,
          freeQuantity: Number(r.freeQuantity || 0),
        })
      }

      if (items.length === 0) throw new Error('Add at least one medicine row')

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
      <main className="py-4">
        <div className="mx-auto w-full px-4 sm:px-6">
          {/*
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-[220px]">
              <div className="text-lg font-semibold tracking-tight">Purchase Module</div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowDistributorModal(true)}
                disabled={!canManageSuppliers}
                className="rounded-full bg-white/10 px-4 py-2 text-sm text-slate-100 ring-1 ring-inset ring-white/15 disabled:cursor-not-allowed disabled:opacity-60"
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
                to={`${base}/purchases/view`}
              >
                Purchase Views
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
          */}

          {error ? (
            <div className="rounded-2xl bg-rose-500/10 p-4 text-sm text-rose-200 ring-1 ring-inset ring-rose-400/20">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="mt-4 rounded-2xl bg-emerald-500/10 p-4 text-sm text-emerald-200 ring-1 ring-inset ring-emerald-400/20">
              Purchase saved. Stock updated batch-wise.
            </div>
          ) : null}

          <div className="mt-6 grid gap-6">
            {false ? (
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
                  <Button type="button" variant="secondary" onClick={() => setShowDistributorModal(false)}>
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={!canManageSuppliers || savingDistributor}
                  >
                    {savingDistributor ? 'Saving...' : 'Save Distributor'}
                  </Button>
                </div>
              </form>
            ) : null}

            {true ? (
              <form onSubmit={submit} className="grid gap-1.5">
                <div className="flex items-end justify-between gap-6">
                  <div>
                    <div className="text-xl font-semibold tracking-tight">Purchase Entry</div>
                  </div>
                </div>
            <div className="relative isolate z-30 rounded-2xl bg-white/5 p-3 ring-1 ring-inset ring-white/10">
              <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-12">
                <label className="grid gap-1.5 sm:col-span-2 lg:col-span-4">
                  <span className="text-sm font-medium text-slate-200">
                    Distributor Name{' '}
                    {canManageSuppliers ? (
                      <button
                        type="button"
                        className="ml-2 text-xs text-sky-300 hover:text-sky-200"
                        onClick={() => setShowDistributorModal(true)}
                      >
                        + Add
                      </button>
                    ) : null}
                  </span>
                  <input
                    ref={distributorInputRef}
                    className="h-11 w-full rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                    value={distributorQuery}
                    onChange={(e) => {
                      setDistributorQuery(e.target.value)
                      setDistributorOpen(true)
                      if (header.supplierId) setHeader((h) => ({ ...h, supplierId: '' }))
                    }}
                    onFocus={() => setDistributorOpen(true)}
                    onBlur={() => setTimeout(() => setDistributorOpen(false), 150)}
                    placeholder={loadingSuppliers ? 'Loading...' : 'Search distributor...'}
                    disabled={loadingSuppliers}
                    required
                  />

                  {distributorOpen ? (
                    <div
                      className="fixed z-[999999] max-h-64 overflow-auto rounded-xl bg-slate-950 p-1 ring-1 ring-inset ring-white/10 shadow-2xl"
                      style={{ top: distributorPopup.top, left: distributorPopup.left, width: distributorPopup.width }}
                    >
                      {(filteredSuppliers || []).length ? (
                        filteredSuppliers.slice(0, 50).map((s) => (
                          <button
                            key={s._id}
                            type="button"
                            className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/5"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setHeader((h) => ({ ...h, supplierId: s._id }))
                              setDistributorQuery(s.supplierName || '')
                              setDistributorOpen(false)
                            }}
                          >
                            <div className="font-medium">{s.supplierName}</div>
                            <div className="text-xs text-slate-500">{s.dlNumber ? `DL ${s.dlNumber}` : ''}</div>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-slate-200">No distributor found.</div>
                      )}
                    </div>
                  ) : null}
                </label>

                <label className="hidden">
                  <span className="text-sm font-medium text-slate-200">Distributor Code</span>
                  <input className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10" value={selectedSupplier?.supplierCode || ''} readOnly />
                </label>

                <label className="hidden">
                  <span className="text-sm font-medium text-slate-200">GST Number</span>
                  <input className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10" value={selectedSupplier?.gstNumber || ''} readOnly />
                </label>

                <label className="grid gap-1.5 lg:col-span-2">
                  <span className="text-xs font-medium text-slate-300">DL No</span>
                  <input className="h-10 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10" value={selectedSupplier?.dlNumber || ''} readOnly />
                </label>

                <label className="hidden">
                  <span className="text-sm font-medium text-slate-200">Mobile Number</span>
                  <input className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10" value={selectedSupplier?.mobileNumber || ''} readOnly />
                </label>

                <label className="grid gap-1.5 lg:col-span-2">
                  <span className="text-xs font-medium text-slate-300">Invoice No</span>
                  <input className="h-10 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400" value={header.invoiceNumber} onChange={(e) => setHeader((h) => ({ ...h, invoiceNumber: e.target.value }))} required />
                </label>

                <label className="grid gap-1.5 lg:col-span-2">
                  <span className="text-xs font-medium text-slate-300">Invoice Date</span>
                  <input className="h-10 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400" type="date" value={header.invoiceDate} onChange={(e) => setHeader((h) => ({ ...h, invoiceDate: e.target.value }))} required />
                </label>

                <label className="grid gap-1.5 lg:col-span-2">
                  <span className="text-xs font-medium text-slate-300">Type</span>
                  <select className="h-10 rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400" value={header.purchaseType} onChange={(e) => setHeader((h) => ({ ...h, purchaseType: e.target.value }))} required>
                    <option value="Cash">Cash</option>
                    <option value="Credit">Credit</option>
                  </select>
                </label>

              </div>
            </div>

            <div className="grid gap-6">
            <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-inset ring-white/10">
                <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[auto,1fr,auto]">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold">Medicine Entry</div>
                    <button
                      type="button"
                      className="h-7 rounded-lg bg-white/5 px-2 text-xs text-slate-200 ring-1 ring-inset ring-white/10 hover:bg-white/10"
                      onClick={() => setShowMedicineModal(true)}
                      title="Add item"
                      aria-label="Add item"
                    >
                      + Add item
                    </button>
                  </div>

                  <div className="min-w-0 px-2">
                    <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 whitespace-nowrap overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                      <span className="font-semibold text-slate-200">Batch Info</span>
                      <span className="text-slate-500">-</span>
                      {active?.medicineId ? (
                        <span>
                          <span className="text-slate-200">
                            {String(active.productName || '').trim() ? active.productName : 'Selected item'}
                          </span>{' '}
                          <span className="text-slate-500">
                            ({batches.length} batch{batches.length === 1 ? '' : 'es'})
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-500">No item selected</span>
                      )}
                      {active?.medicineId && previewBatch ? (
                        <>
                          <span className="text-slate-500">-</span>
                          <span>
                            Batch <span className="text-slate-200">{previewBatch.batchNumber}</span> | Exp{' '}
                            <span className="text-slate-200">{fmtExpiryLabel(previewBatch.expiryDate)}</span> | Stock{' '}
                            <span className="text-slate-200">{previewBatch.quantity}</span> | MRP{' '}
                            <span className="text-slate-200">{Number(previewBatch.mrp || 0).toFixed(2)}</span> | Purchase{' '}
                            <span className="text-slate-200">
                              {Number(previewBatch.purchaseRate || 0).toFixed(2)}
                            </span>
                          </span>
                          <button
                            ref={batchMoreBtnRef}
                            type="button"
                            className="text-sky-300 underline underline-offset-2 hover:text-sky-200"
                            onClick={() => {
                              setBatchPopoverOpen((v) => !v)
                            }}
                          >
                            More
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={addMedicine}
                      title="Add medicine row"
                      aria-label="Add medicine row"
                      className="h-9 w-9 rounded-lg bg-white/5 text-base font-semibold text-slate-200 ring-1 ring-inset ring-white/10 hover:bg-white/10"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={removeMedicine}
                      disabled={rows.length <= 1}
                      title="Remove medicine row"
                      aria-label="Remove medicine row"
                      className="h-9 w-9 rounded-lg bg-white/5 text-base font-semibold text-slate-200 ring-1 ring-inset ring-white/10 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      -
                    </button>
                  </div>
                </div>

                <div className="mt-4 md:hidden">
                  <div className="grid gap-3">
                    <label className="grid gap-1.5">
                      <span className="text-xs font-medium text-slate-300">Category</span>
                      <select
                        className="h-10 w-full rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                        value={active.categoryName || ''}
                        onChange={(e) => {
                          const next = e.target.value
                          setMobileProductOpen(false)
                          setMobileProductResults([])
                          updateRow(activeRow, { categoryName: next, manufacturerName: '', medicineId: '', productName: '' })
                        }}
                      >
                        <option value="">Select category</option>
                        {(categories || []).map((c) => (
                          <option key={c._id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-1.5">
                      <span className="text-xs font-medium text-slate-300">Manufacturer (optional)</span>
                      <select
                        className="h-10 w-full rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:opacity-60"
                        value={active.manufacturerName || ''}
                        onChange={(e) => {
                          const next = e.target.value
                          setMobileProductOpen(false)
                          setMobileProductResults([])
                          updateRow(activeRow, { manufacturerName: next, medicineId: '', productName: '' })
                        }}
                        disabled={!active.categoryName}
                      >
                        <option value="">{active.categoryName ? 'Select manufacturer' : 'Select category first'}</option>
                        {(active.categoryName
                          ? manufacturersByCategoryId[categoriesByName.get(active.categoryName)] || []
                          : []
                        ).map((m) => (
                          <option key={m._id || m.name} value={m.name}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-1.5">
                      <span className="text-xs font-medium text-slate-300">Product</span>
                      <input
                        ref={mobileProductRef}
                        className="h-11 w-full rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                        value={active.productName || ''}
                        onChange={(e) => {
                          const next = e.target.value
                          updateRow(activeRow, { productName: next, medicineId: '' })
                          setMobileProductOpen(true)
                        }}
                        onFocus={() => setMobileProductOpen(true)}
                        onBlur={() => setTimeout(() => setMobileProductOpen(false), 150)}
                        placeholder={active.categoryName ? 'Search product...' : 'Select category first'}
                        disabled={!active.categoryName}
                      />
                      {mobileProductOpen ? (
                        <div
                          className="fixed z-[999999] max-h-72 overflow-auto rounded-xl bg-slate-950 p-1 ring-1 ring-inset ring-white/10 shadow-2xl"
                          style={{
                            top: mobileProductPopup.top,
                            left: mobileProductPopup.left,
                            width: mobileProductPopup.width,
                          }}
                        >
                          {(mobileProductResults || []).length ? (
                            (mobileProductResults || []).slice(0, 60).map((m, i) => (
                              <button
                                key={m._id}
                                type="button"
                                className={[
                                  'block w-full rounded-lg px-3 py-2 text-left',
                                  i === mobileProductHighlight ? 'bg-white/5' : 'hover:bg-white/5',
                                ].join(' ')}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => selectMobileMedicine(m)}
                              >
                                <div className="text-sm font-medium text-slate-100">{m.medicineName}</div>
                                <div className="text-xs text-slate-500">
                                  {(m.manufacturer ? `${m.manufacturer}` : '') + (m.category ? ` - ${m.category}` : '')}
                                  {m.rackLocation ? ` - Rack ${m.rackLocation}` : ''}
                                  {m.hsnCode ? ` - HSN ${m.hsnCode}` : ''}
                                </div>
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-sm text-slate-200">
                              Not found. Please add item first.
                            </div>
                          )}
                        </div>
                      ) : null}
                    </label>

                    <label className="grid gap-1.5">
                      <span className="text-xs font-medium text-slate-300">Batch Number</span>
                      <input
                        className="h-10 w-full rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                        value={active.batchNumber || ''}
                        onChange={(e) => updateRow(activeRow, { batchNumber: e.target.value })}
                        placeholder="Batch"
                      />
                    </label>

                    <label className="grid gap-1.5">
                      <span className="text-xs font-medium text-slate-300">Rack</span>
                      <input
                        className="h-10 w-full rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                        value={active.rackLocation || ''}
                        onChange={(e) => updateRow(activeRow, { rackLocation: e.target.value })}
                        placeholder="Rack"
                      />
                    </label>

                    <label className="grid gap-1.5">
                      <span className="text-xs font-medium text-slate-300">Expiry (DD/MM/YYYY)</span>
                      <input
                        className="h-10 w-full rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                        value={active.expiry || ''}
                        onChange={(e) => updateRow(activeRow, { expiry: maskExpiryDmy(e.target.value) })}
                        placeholder="DD/MM/YYYY"
                      />
                      <input
                        className="h-10 w-full rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                        type="date"
                        value={(() => {
                          const d = parseExpiryToDate(active.expiry)
                          return d ? d.toISOString().slice(0, 10) : ''
                        })()}
                        onChange={(e) => updateRow(activeRow, { expiry: fmtExpiryValue(e.target.value) })}
                      />
                    </label>

                    <label className="grid gap-1.5">
                      <span className="text-xs font-medium text-slate-300">MRP</span>
                      <input
                        className="h-10 w-full rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                        type="number"
                        min={0}
                        step="0.01"
                        onKeyDown={blockInvalidNumberKeys}
                        value={Number(active.mrp || 0) === 0 ? '' : active.mrp}
                        onChange={(e) => updateRow(activeRow, { mrp: Number(e.target.value || 0) })}
                        placeholder="MRP"
                      />
                    </label>

                    <label className="grid gap-1.5">
                      <span className="text-xs font-medium text-slate-300">Disc%</span>
                      <input
                        className="h-10 w-full rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        onKeyDown={blockInvalidNumberKeys}
                        value={Number(active.discountPercent || 0) === 0 ? '' : active.discountPercent}
                        onChange={(e) => updateRow(activeRow, { discountPercent: Number(e.target.value || 0) })}
                        placeholder="Discount %"
                      />
                    </label>

                    <label className="grid gap-1.5">
                      <span className="text-xs font-medium text-slate-300">GST%</span>
                      <input
                        className="h-10 w-full rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                        type="number"
                        min={0}
                        step="0.01"
                        onKeyDown={blockInvalidNumberKeys}
                        value={Number(active.gstPercent || 0) === 0 ? '' : active.gstPercent}
                        onChange={(e) => updateRow(activeRow, { gstPercent: Number(e.target.value || 0) })}
                        placeholder="GST %"
                      />
                    </label>

                    <label className="grid gap-1.5">
                      <span className="text-xs font-medium text-slate-300">Qty</span>
                      <input
                        className="h-10 w-full rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                        type="number"
                        min={0}
                        step="1"
                        onKeyDown={blockInvalidNumberKeys}
                        value={Number(active.quantity || 0) === 0 ? '' : active.quantity}
                        onChange={(e) => updateRow(activeRow, { quantity: Number(e.target.value || 0) })}
                        placeholder="Quantity"
                      />
                    </label>

                    <label className="grid gap-1.5">
                      <span className="text-xs font-medium text-slate-300">Free</span>
                      <input
                        className="h-10 w-full rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                        type="number"
                        min={0}
                        step="1"
                        onKeyDown={blockInvalidNumberKeys}
                        value={Number(active.freeQuantity || 0) === 0 ? '' : active.freeQuantity}
                        onChange={(e) => updateRow(activeRow, { freeQuantity: Number(e.target.value || 0) })}
                        placeholder="Free"
                      />
                    </label>

                    <label className="grid gap-1.5">
                      <span className="text-xs font-medium text-slate-300">S.R</span>
                      <input
                        className="h-10 w-full rounded-xl bg-slate-950/40 px-3 text-sm ring-1 ring-inset ring-white/10"
                        type="number"
                        min={0}
                        step="0.01"
                        onKeyDown={blockInvalidNumberKeys}
                        value={Number(active.saleRate || 0) === 0 ? '' : active.saleRate}
                        onChange={(e) => updateRow(activeRow, { saleRateTouched: true, saleRate: Number(e.target.value || 0) })}
                        placeholder="Sale rate"
                      />
                    </label>

                    <div className="rounded-2xl bg-black/20 p-3 text-xs text-slate-300 ring-1 ring-inset ring-white/10">
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <div>
                          T.R <span className="tabular-nums text-slate-100">{Number(activeTotals.tradeRate || 0).toFixed(2)}</span>
                        </div>
                        <div>
                          P.R <span className="tabular-nums text-slate-100">{Number(activeTotals.purchaseRate || 0).toFixed(2)}</span>
                        </div>
                        <div>
                          Final <span className="tabular-nums text-slate-100">{Number(activeTotals.finalPurchaseRate || 0).toFixed(2)}</span>
                        </div>
                        <div>
                          Amt <span className="tabular-nums text-slate-100">{Number(activeTotals.netAmount || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-950/40 p-3 text-xs text-slate-400 ring-1 ring-inset ring-white/10">
                      Added items: {(rows || []).filter((r) => Boolean(r.medicineId) || Boolean(String(r.productName || '').trim())).length}
                    </div>
                  </div>

                  {(rows || []).some((r) => Boolean(r.medicineId) || Boolean(String(r.productName || '').trim())) ? (
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
                                <div className="truncate text-sm font-semibold text-slate-100">{r.productName || 'Item'}</div>
                                <div className="mt-0.5 truncate text-xs text-slate-400">
                                  {(r.batchNumber ? `Batch ${r.batchNumber}` : '') + (r.expiry ? ` - Exp ${r.expiry}` : '')}
                                </div>
                              </div>
                              <div className="text-right text-xs text-slate-400">
                                Qty <span className="tabular-nums text-slate-100">{Number(r.quantity || 0)}</span>
                              </div>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="rounded-xl bg-white/5 px-3 py-2 text-xs text-slate-200 ring-1 ring-inset ring-white/10 hover:bg-white/10"
                                onClick={() => setActiveRow(i)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-200 ring-1 ring-inset ring-rose-400/20 hover:bg-rose-500/15"
                                onClick={() => removeRow(i)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 hidden md:block overflow-x-hidden overflow-y-visible">
                  <table className="w-full table-fixed text-left text-xs">
                    <thead className="sticky top-0 z-10 bg-slate-950/80 uppercase tracking-wide text-slate-400 backdrop-blur">
                      <tr className="h-9">
                        <th className="py-0 pr-1 w-24 align-middle">Cat</th>
                        <th className="py-0 pr-1 w-28 align-middle">Mfg</th>
                        <th className="py-0 pr-1 w-40 align-middle">Product</th>
                        <th className="py-0 pr-1 w-16 align-middle text-center">Batch</th>
                        <th className="py-0 pr-1 w-10 align-middle text-center">Rack</th>
                        <th className="py-0 pr-1 w-20 align-middle text-center">Exp</th>
                        <th className="py-0 pr-1 w-12 align-middle text-center">MRP</th>
                        <th className="py-0 pr-1 w-10 align-middle text-center">Disc</th>
                        <th className="py-0 pr-1 w-12 align-middle text-center">T.R</th>
                        <th className="py-0 pr-1 w-10 align-middle text-center">GST</th>
                        <th className="py-0 pr-1 w-12 align-middle text-center">P.R</th>
                        <th className="py-0 pr-1 w-10 align-middle text-center">Qty</th>
                        <th className="py-0 pr-1 w-10 align-middle text-center">Free</th>
                        <th className="py-0 pr-1 w-12 align-middle text-center">Final</th>
                        <th className="py-0 pr-1 w-12 align-middle text-center">S.R</th>
                        <th className="py-0 pr-1 w-12 align-middle text-center">Amt</th>
                        <th className="py-0 pr-1 w-7 align-middle"></th>
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
                            categories={categories}
                            manufacturers={
                              row.categoryName
                                ? manufacturersByCategoryId[categoriesByName.get(row.categoryName)] || []
                                : []
                            }
                            ensureManufacturers={ensureManufacturersForCategoryName}
                          />
                        ))}
                    </tbody>
                  </table>
                </div>

              </div>

              <div className="rounded-3xl bg-white/5 p-4 ring-1 ring-inset ring-white/10">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="md:hidden grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-black/20 p-2 ring-1 ring-inset ring-white/10">
                    <div className="text-slate-500">Items</div>
                    <div className="mt-0.5 tabular-nums text-slate-200">{summary.items}</div>
                  </div>
                  <div className="rounded-xl bg-black/20 p-2 ring-1 ring-inset ring-white/10">
                    <div className="text-slate-500">Qty</div>
                    <div className="mt-0.5 tabular-nums text-slate-200">{summary.qty}</div>
                  </div>
                  <div className="rounded-xl bg-black/20 p-2 ring-1 ring-inset ring-white/10">
                    <div className="text-slate-500">Gross</div>
                    <div className="mt-0.5 tabular-nums text-slate-200">{summary.gross.toFixed(2)}</div>
                  </div>
                  <div className="rounded-xl bg-black/20 p-2 ring-1 ring-inset ring-white/10">
                    <div className="text-slate-500">Disc</div>
                    <div className="mt-0.5 tabular-nums text-slate-200">{summary.discount.toFixed(2)}</div>
                  </div>
                  <div className="rounded-xl bg-black/20 p-2 ring-1 ring-inset ring-white/10">
                    <div className="text-slate-500">GST</div>
                    <div className="mt-0.5 tabular-nums text-slate-200">{summary.gst.toFixed(2)}</div>
                  </div>
                  <div className="rounded-xl bg-black/20 p-2 ring-1 ring-inset ring-white/10">
                    <div className="text-slate-500">Net</div>
                    <div className="mt-0.5 tabular-nums text-slate-200">{summary.netRounded.toFixed(2)}</div>
                  </div>
                </div>
                <div className="hidden md:block min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-sm text-slate-300 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  <span>
                    Items <span className="font-semibold tabular-nums text-slate-100">{summary.items}</span>
                  </span>
                  <span className="mx-2 text-slate-600">|</span>
                  <span>
                    Qty <span className="font-semibold tabular-nums text-slate-100">{summary.qty}</span>
                  </span>
                  <span className="mx-2 text-slate-600">|</span>
                  <span>
                    Gross <span className="font-semibold tabular-nums text-slate-100">{summary.gross.toFixed(2)}</span>
                  </span>
                  <span className="mx-2 text-slate-600">|</span>
                  <span>
                    Disc <span className="font-semibold tabular-nums text-slate-100">{summary.discount.toFixed(2)}</span>
                  </span>
                  <span className="mx-2 text-slate-600">|</span>
                  <span>
                    GST <span className="font-semibold tabular-nums text-slate-100">{summary.gst.toFixed(2)}</span>
                  </span>
                  <span className="mx-2 text-slate-600">|</span>
                  <span>
                    Round <span className="font-semibold tabular-nums text-slate-100">{summary.roundOff.toFixed(2)}</span>
                  </span>
                  <span className="mx-2 text-slate-600">|</span>
                  <span>
                    Net <span className="font-semibold tabular-nums text-slate-100">{summary.netRounded.toFixed(2)}</span>
                  </span>
                  <span className="mx-2 text-slate-600">|</span>
                  <span className="inline-flex items-center gap-1">
                    Paid
                    <input
                      className="h-9 w-28 rounded-xl bg-slate-950/40 px-3 text-sm text-slate-100 ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
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
                          paidAmountTouched: true,
                          paidAmount: e.target.value === '' ? 0 : Number(e.target.value),
                        }))
                      }
                    />
                  </span>
                  <span className="mx-2 text-slate-600">|</span>
                  <span>
                    Payable{' '}
                    <span className="font-semibold tabular-nums text-slate-100">
                      {(
                        Math.max(
                          0,
                          summary.netRounded -
                            Math.min(Math.max(0, Number(header.paidAmount || 0)), summary.netRounded),
                        )
                      ).toFixed(2)}
                    </span>
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button type="button" variant="secondary" onClick={() => window.print()}>
                    Print
                  </Button>
                  <Button type="button" variant="secondary" onClick={cancel}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>
            </div>
            </div>
              </form>
            ) : null}
          </div>

          {batchPopoverOpen ? (
            <div
              className="fixed inset-0 z-[99998]"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setBatchPopoverOpen(false)
              }}
            >
              <div
                className="fixed z-[99999] max-h-[60vh] overflow-auto rounded-2xl bg-slate-950 p-2 ring-1 ring-inset ring-white/10 shadow-2xl"
                style={{ top: batchPopoverPos.top, left: batchPopoverPos.left, width: batchPopoverPos.width }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-3 px-2 py-1">
                  <div className="text-xs font-semibold text-slate-200">Batches</div>
                  <button
                    type="button"
                    className="text-xs text-slate-400 hover:text-slate-200"
                    onClick={() => setBatchPopoverOpen(false)}
                  >
                    Close
                  </button>
                </div>

                {!active?.medicineId ? (
                  <div className="px-2 py-3 text-sm text-slate-500">No medicine selected.</div>
                ) : batchLoading ? (
                  <div className="px-2 py-3 text-sm text-slate-400">Loading batches...</div>
                ) : batches.length === 0 ? (
                  <div className="px-2 py-3 text-sm text-slate-500">No batches found for this item.</div>
                ) : (
                  <div className="grid gap-2 p-1">
                    {batches.map((b) => (
                      <button
                        key={b._id}
                        type="button"
                        className="w-full rounded-xl bg-white/5 px-3 py-2 text-left ring-1 ring-inset ring-white/10 hover:bg-white/10"
                        onClick={() => {
                          applyBatchToRow(activeRow, b, { setQtyIfEmpty: true })
                          setBatchPopoverOpen(false)
                        }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-slate-100">{b.batchNumber}</div>
                          <div className="text-xs text-slate-400">{fmtExpiryLabel(b.expiryDate)}</div>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-300">
                          Stock <span className="text-slate-100">{b.quantity}</span> | MRP{' '}
                          <span className="text-slate-100">{Number(b.mrp || 0).toFixed(2)}</span> | Purchase{' '}
                          <span className="text-slate-100">{Number(b.purchaseRate || 0).toFixed(2)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {showDistributorModal ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setShowDistributorModal(false)
              }}
            >
              <div className="w-full max-w-2xl rounded-3xl bg-slate-950 p-6 ring-1 ring-inset ring-white/10">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold">Add Distributor</div>
                    <div className="mt-1 text-xs text-slate-500">Fields: Distributor name, DL No, Address</div>
                  </div>
                  <button
                    type="button"
                    className="text-sm text-slate-300 hover:text-slate-100"
                    onClick={() => setShowDistributorModal(false)}
                  >
                    Close
                  </button>
                </div>

                {!canManageSuppliers ? (
                  <div className="mt-4 rounded-2xl bg-amber-500/10 p-3 text-xs text-amber-200 ring-1 ring-inset ring-amber-400/20">
                    Only PharmacyAdmin can add distributors.
                  </div>
                ) : null}

                <form onSubmit={onCreateDistributor} className="mt-5 grid gap-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <input
                      className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                      placeholder="Distributor name"
                      value={distributor.supplierName}
                      onChange={(e) => setDistributor((s) => ({ ...s, supplierName: e.target.value }))}
                      required
                      disabled={!canManageSuppliers}
                    />
                    <input
                      className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                      placeholder="DL No"
                      value={distributor.dlNumber}
                      onChange={(e) => setDistributor((s) => ({ ...s, dlNumber: e.target.value }))}
                      required
                      disabled={!canManageSuppliers}
                    />
                    <input
                      className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                      placeholder="Address"
                      value={distributor.address}
                      onChange={(e) => setDistributor((s) => ({ ...s, address: e.target.value }))}
                      required
                      disabled={!canManageSuppliers}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="secondary" onClick={() => setShowDistributorModal(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={!canManageSuppliers || savingDistributor}>
                      {savingDistributor ? 'Saving...' : 'Save Distributor'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}

          {showMedicineModal ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setShowMedicineModal(false)
              }}
            >
              <div className="w-full max-w-4xl rounded-3xl bg-slate-950 p-6 ring-1 ring-inset ring-white/10">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold">Add Medicine</div>
                    <div className="mt-1 text-xs text-slate-500">Add a new item quickly without leaving purchase.</div>
                  </div>
                  <button
                    type="button"
                    className="text-sm text-slate-300 hover:text-slate-100"
                    onClick={() => setShowMedicineModal(false)}
                  >
                    Close
                  </button>
                </div>

                {medicineModalError ? (
                  <div className="mt-4 rounded-2xl bg-rose-500/10 p-3 text-xs text-rose-200 ring-1 ring-inset ring-rose-400/20">
                    {medicineModalError}
                  </div>
                ) : null}

                <form onSubmit={onCreateMedicine} className="mt-5 grid gap-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="grid gap-1.5">
                      <span className="text-xs font-medium text-slate-300">Category *</span>
                      <select
                        className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                        value={newMedicine.category}
                        onChange={(e) => {
                          const next = e.target.value
                          setNewMedicine((m) => ({ ...m, category: next, manufacturer: '', allowLooseSale: false }))
                          setNewMedicineCustomFields({})
                          void ensureManufacturersForCategoryName(next)
                        }}
                        required
                      >
                        <option value="">Select category</option>
                        {categories.map((c) => (
                          <option key={c._id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-1.5">
                      <span className="text-xs font-medium text-slate-300">Manufacturer *</span>
                      <select
                        className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                        value={newMedicine.manufacturer}
                        onChange={(e) => setNewMedicine((m) => ({ ...m, manufacturer: e.target.value }))}
                        disabled={!newMedicine.category}
                        required
                      >
                        <option value="">{newMedicine.category ? 'Select manufacturer' : 'Select category first'}</option>
                        {(newMedicine.category
                          ? manufacturersByCategoryId[categoriesByName.get(newMedicine.category)] || []
                          : []
                        ).map((m) => (
                          <option key={m._id || m.name} value={m.name}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-1.5">
                      <span className="text-xs font-medium text-slate-300">Medicine name *</span>
                      <input
                        className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                        value={newMedicine.medicineName}
                        onChange={(e) => setNewMedicine((m) => ({ ...m, medicineName: e.target.value }))}
                        required
                      />
                    </label>

                    <label className="grid gap-1.5">
                      <span className="text-xs font-medium text-slate-300">Rack</span>
                      <input
                        className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                        value={newMedicine.rackLocation}
                        onChange={(e) => setNewMedicine((m) => ({ ...m, rackLocation: e.target.value }))}
                      />
                    </label>

                    <label className="grid gap-1.5">
                      <span className="text-xs font-medium text-slate-300">HSN *</span>
                      <input
                        className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                        value={newMedicine.hsnCode}
                        onChange={(e) => setNewMedicine((m) => ({ ...m, hsnCode: e.target.value }))}
                        required
                      />
                    </label>

                    <label className="grid gap-1.5">
                      <span className="text-xs font-medium text-slate-300">GST % *</span>
                      <input
                        className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                        type="number"
                        min={0}
                        step="0.01"
                        value={Number(newMedicine.gstPercent || 0) === 0 ? '' : newMedicine.gstPercent}
                        onChange={(e) =>
                          setNewMedicine((m) => ({ ...m, gstPercent: e.target.value === '' ? 0 : Number(e.target.value) }))
                        }
                        required
                      />
                    </label>
                  </div>

                  {selectedNewMedicineCategory?.looseSaleAllowed ? (
                    <label className="flex items-center gap-3 rounded-2xl bg-slate-950/40 px-4 py-3 text-sm ring-1 ring-inset ring-white/10">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-sky-400"
                        checked={Boolean(newMedicine.allowLooseSale)}
                        onChange={(e) => setNewMedicine((m) => ({ ...m, allowLooseSale: e.target.checked }))}
                      />
                      <span className="text-slate-200">Allow loose sale</span>
                    </label>
                  ) : null}

                  {selectedNewMedicineCategory?.fields?.length ? (
                    <div className="rounded-2xl bg-black/20 p-4 ring-1 ring-inset ring-white/10">
                      <div className="text-xs font-semibold text-slate-300">Category fields</div>
                      <div className="mt-3 grid gap-4 md:grid-cols-3">
                        {selectedNewMedicineCategory.fields.map((f) => (
                          <label key={f.key} className="grid gap-1.5">
                            <span className="text-xs font-medium text-slate-300">
                              {f.label} {f.required ? <span className="text-rose-400">*</span> : null}
                            </span>
                            {renderCustomFieldInput(f, newMedicineCustomFields[f.key], (v) =>
                              setNewMedicineCustomFields((p) => ({ ...p, [f.key]: v })),
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="secondary" onClick={() => setShowMedicineModal(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={savingMedicine}>
                      {savingMedicine ? 'Saving...' : 'Save Medicine'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
