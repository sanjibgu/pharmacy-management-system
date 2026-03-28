import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getTenantSlug } from '../services/tenant'

function fmtMoney(n) {
  const v = Number(n || 0)
  return Number.isFinite(v) ? v.toFixed(2) : '0.00'
}

function calc(row) {
  const qty = Math.max(0, Number(row.quantity || 0))
  const saleRate = Math.max(0, Number(row.saleRate || 0))
  const amount = saleRate * qty
  return { amount }
}

export default function SaleItemRow({ index, row, onChange, onRemove, onActivate, search }) {
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
      unitsPerStrip: Number(m.unitsPerStrip || 1),
      allowLooseSale: Boolean(m.allowLooseSale),
      unitType: Boolean(m.allowLooseSale) ? 'unit' : 'pack',
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
        const res = await search(q)
        lastFetchedQuery.current = q
        setResults(res)
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
    <tr className="border-t border-white/10 align-top hover:bg-white/[0.03]" onClick={() => onActivate(index)}>
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
                onClick={() => selectMedicine(m)}
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
        <input className={inputBase} value={row.batchNumber} readOnly placeholder="Batch" />
      </td>

      <td className={cell}>
        <input className={inputBase} value={row.expiryLabel || ''} readOnly placeholder="Expiry" />
      </td>

      <td className={cell}>
        <select
          className={inputBase}
          value={row.unitType}
          onChange={(e) => onChange(index, { unitType: e.target.value })}
          disabled={!row.allowLooseSale}
        >
          <option value="pack">Pack</option>
          <option value="unit">Unit</option>
        </select>
      </td>

      <td className={cell}>
        <input className={inputNum} value={fmtMoney(row.mrp)} readOnly />
      </td>

      <td className={cell}>
        <input
          className={inputNum}
          type="number"
          min={0}
          step="0.01"
          value={row.saleRate}
          onChange={(e) => onChange(index, { saleRate: Number(e.target.value) })}
          onKeyDown={blockInvalidNumberKeys}
          required
        />
      </td>

      <td className={cell}>
        <input
          className={inputNum}
          type="number"
          min={0}
          step={row.unitType === 'unit' ? '1' : '0.01'}
          value={row.quantity}
          onChange={(e) => onChange(index, { quantity: Number(e.target.value) })}
          onKeyDown={blockInvalidNumberKeys}
          required
        />
      </td>

      <td className={`${cell} text-right text-xs tabular-nums text-slate-200`}>{fmtMoney(totals.amount)}</td>

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
