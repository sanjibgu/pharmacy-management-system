import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getTenantSlug } from '../services/tenant'

function maskExpiryDmy(value) {
  const digits = String(value || '')
    .replace(/\D/g, '')
    .slice(0, 8)
  if (!digits) return ''
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

function isoToDmy(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return ''
  return `${m[3]}/${m[2]}/${m[1]}`
}

function calc(row) {
  const qty = Number(row.quantity || 0)
  const mrp = Number(row.mrp || 0)
  const schemeQty = Number(row.freeQuantity || 0)
  const discPct = Math.min(100, Math.max(0, Number(row.discountPercent || 0)))
  const gstPct = Math.max(0, Number(row.gstPercent || 0))

  const discountPerUnit = (mrp * discPct) / 100
  const tradeRate = Math.max(0, mrp - discountPerUnit)
  const gstPerUnit = (tradeRate * gstPct) / 100
  const purchaseRate = tradeRate + gstPerUnit

  const taxableAmount = tradeRate * qty
  const gstAmount = gstPerUnit * qty
  const discountAmount = discountPerUnit * qty
  const netAmount = purchaseRate * qty

  const totalUnits = qty + schemeQty
  const finalPurchaseRate = totalUnits > 0 ? netAmount / totalUnits : 0

  return {
    tradeRate,
    purchaseRate,
    finalPurchaseRate,
    taxableAmount,
    gstAmount,
    discountAmount,
    netAmount,
  }
}

export default function PurchaseItemRow({
  index,
  row,
  onChange,
  onRemove,
  onActivate,
  search,
}) {
  const inputBase =
    'h-9 w-full min-w-0 rounded-lg bg-slate-950/40 px-2 text-xs ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400'
  const inputNum = `${inputBase} text-right tabular-nums`
  const cell = 'py-1.5 pr-2'
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState([])
  const [highlight, setHighlight] = useState(0)
  const [query, setQuery] = useState(row.productName || '')
  const lastFetchedQuery = useRef(null)
  const inputRef = useRef(null)
  const expiryPickerRef = useRef(null)
  const [popup, setPopup] = useState({ top: 0, left: 0, width: 0 })

  const totals = useMemo(() => calc(row), [row])

  function blockInvalidNumberKeys(e) {
    if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') e.preventDefault()
  }

  function selectMedicine(m) {
    if (!m) return
    setOpen(false)
    setQuery(m.medicineName)
    onChange(index, {
      medicineId: m._id,
      productName: m.medicineName,
      rackLocation: row.rackLocation ? row.rackLocation : (m.rackLocation || ''),
      hsnCode: m.hsnCode || '',
      gstPercent: Number(m.gstPercent || 0),
    })
  }

  const addProductHref = useMemo(() => {
    const slug = getTenantSlug()
    return slug ? `/${slug}/medicines` : '/'
  }, [])

  useEffect(() => {
    setQuery(row.productName || '')
  }, [row.productName])

  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (lastFetchedQuery.current === q) return
    const t = setTimeout(async () => {
      try {
        const items = await search(q)
        lastFetchedQuery.current = q
        setResults(items)
        setHighlight(0)
      } catch {
        setResults([])
        setHighlight(0)
      }
    }, 200)
    return () => clearTimeout(t)
  }, [open, query, search])

  useEffect(() => {
    if (!open) return

    function updatePopup() {
      const el = inputRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setPopup({
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
  }, [open, query])

  return (
    <tr
      className="border-t border-white/10 align-top hover:bg-white/[0.03]"
      onClick={() => onActivate(index)}
    >
      <td className={`relative ${cell} ${open ? 'z-50' : ''}`}>
        <input
          ref={inputRef}
          className="h-9 w-full min-w-0 rounded-lg bg-slate-950/40 px-2 text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
          value={query}
          onChange={(e) => {
            const next = e.target.value
            setQuery(next)
            if (row.medicineId || row.productName) onChange(index, { medicineId: '', productName: '' })
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false)
              return
            }
            if (e.key === 'ArrowDown') {
              setOpen(true)
              if (results.length > 0) setHighlight((h) => Math.min(h + 1, results.length - 1))
              e.preventDefault()
              return
            }
            if (e.key === 'ArrowUp') {
              if (results.length > 0) setHighlight((h) => Math.max(h - 1, 0))
              e.preventDefault()
              return
            }
            if (e.key === 'Enter' && open && results[highlight]) {
              e.preventDefault()
              selectMedicine(results[highlight])
            }
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setTimeout(() => setOpen(false), 150)
            const q = String(query || '').trim()
            if (q && !row.medicineId) {
              alert('Please select product from suggestions. If not found, add the product first.')
              setQuery('')
              onChange(index, { medicineId: '', productName: '' })
            }
          }}
          placeholder="Search medicine..."
          required
        />

        {open && (results.length > 0 || String(query || '').trim().length >= 2) ? (
          <div
            className="fixed z-[99999] max-h-56 overflow-auto rounded-xl bg-slate-950 p-1 ring-1 ring-inset ring-white/10 shadow-2xl"
            style={{ top: popup.top, left: popup.left, width: popup.width }}
          >
            {results.map((m, i) => (
              <button
                key={m._id}
                type="button"
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/5 ${i === highlight ? 'bg-white/5' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  selectMedicine(m)
                }}
                onMouseEnter={() => setHighlight(i)}
              >
                <div className="font-medium">{m.medicineName}</div>
                <div className="text-xs text-slate-500">
                  {m.manufacturer || ''}
                  {m.rackLocation ? ` • Rack ${m.rackLocation}` : ''}
                  {m.hsnCode ? ` • HSN ${m.hsnCode}` : ''}
                </div>
              </button>
            ))}

            {results.length === 0 ? (
              <div className="px-3 py-2">
                <div className="text-sm text-slate-200">Product not found.</div>
                <Link className="mt-1 inline-block text-sm text-sky-300 hover:text-sky-200" to={addProductHref}>
                  Add product
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}
      </td>

      <td className={cell}>
        <input
          className={inputBase}
          value={row.batchNumber}
          onChange={(e) => onChange(index, { batchNumber: e.target.value })}
          placeholder="Batch"
          required
        />
      </td>

      <td className={cell}>
        <input
          className={inputBase}
          value={row.rackLocation || ''}
          onChange={(e) => onChange(index, { rackLocation: e.target.value })}
          placeholder="Rack"
        />
      </td>

      <td className={cell}>
        <div className="flex items-center gap-2">
          <input
            className={`${inputBase} flex-1`}
            value={row.expiry}
            onChange={(e) => onChange(index, { expiry: maskExpiryDmy(e.target.value) })}
            placeholder="DD/MM/YYYY"
            inputMode="numeric"
            required
          />
          <button
            type="button"
            className="h-9 shrink-0 rounded-lg bg-white/5 px-2 text-[11px] text-slate-200 ring-1 ring-inset ring-white/10 hover:bg-white/10"
            onClick={() => {
              const el = expiryPickerRef.current
              if (!el) return
              if (typeof el.showPicker === 'function') el.showPicker()
              else el.click()
            }}
          >
            Pick
          </button>
          <input
            ref={expiryPickerRef}
            type="date"
            className="absolute -z-10 h-0 w-0 opacity-0"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              const v = isoToDmy(e.target.value)
              if (v) onChange(index, { expiry: v })
            }}
          />
        </div>
      </td>

      <td className={cell}>
        <input
          className={inputNum}
          type="number"
          min={0}
          value={row.mrp}
          onChange={(e) => onChange(index, { mrp: Number(e.target.value) })}
          onKeyDown={blockInvalidNumberKeys}
          required
        />
      </td>

      <td className={cell}>
        <input
          className={inputNum}
          type="number"
          min={0}
          step="0.01"
          value={row.discountPercent}
          onChange={(e) => onChange(index, { discountPercent: Number(e.target.value) })}
          onKeyDown={blockInvalidNumberKeys}
        />
      </td>

      <td className={`${cell} text-right text-xs tabular-nums text-slate-200`}>
        {Number.isFinite(totals.tradeRate) ? totals.tradeRate.toFixed(2) : '0.00'}
      </td>

      <td className={cell}>
        <input
          className={inputNum}
          type="number"
          min={0}
          step="0.01"
          value={row.gstPercent}
          onChange={(e) => onChange(index, { gstPercent: Number(e.target.value) })}
          onKeyDown={blockInvalidNumberKeys}
        />
      </td>

      <td className={`${cell} text-right text-xs tabular-nums text-slate-200`}>
        {Number.isFinite(totals.purchaseRate) ? totals.purchaseRate.toFixed(2) : '0.00'}
      </td>

      <td className={cell}>
        <input
          className={inputNum}
          type="number"
          min={0}
          value={row.quantity}
          onChange={(e) => onChange(index, { quantity: Number(e.target.value) })}
          onKeyDown={blockInvalidNumberKeys}
          required
        />
      </td>

      <td className={cell}>
        <input
          className={inputNum}
          type="number"
          min={0}
          value={row.freeQuantity}
          onChange={(e) => onChange(index, { freeQuantity: Number(e.target.value) })}
          onKeyDown={blockInvalidNumberKeys}
        />
      </td>

      <td className={`${cell} text-right text-xs tabular-nums text-slate-200`}>
        {Number.isFinite(totals.finalPurchaseRate) ? totals.finalPurchaseRate.toFixed(2) : '0.00'}
      </td>

      <td className={cell}>
        <input
          className={inputNum}
          type="number"
          min={0}
          value={row.saleRate}
          onChange={(e) => onChange(index, { saleRate: Number(e.target.value) })}
          onKeyDown={blockInvalidNumberKeys}
          required
        />
      </td>

      <td className={`${cell} text-right text-xs tabular-nums text-slate-200`}>
        {Number.isFinite(totals.netAmount) ? totals.netAmount.toFixed(2) : '0.00'}
      </td>

      <td className={cell}>
        <button
          type="button"
          onClick={() => onRemove(index)}
          aria-label="Remove row"
          title="Remove row"
          className="h-9 w-9 rounded-lg bg-white/5 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-white/10 hover:bg-white/10"
        >
          -
        </button>
      </td>
    </tr>
  )
}
