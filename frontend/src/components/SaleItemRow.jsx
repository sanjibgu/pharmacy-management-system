import { useMemo } from 'react'

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

export default function SaleItemRow({ index, row, onChange, onRemove, onActivate }) {
  const inputBase =
    'h-9 w-full min-w-0 rounded-lg bg-slate-950/40 px-2 text-xs ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400'
  const inputNum = `${inputBase} text-right tabular-nums`
  const cell = 'py-1.5 pr-2'

  const totals = useMemo(() => calc(row), [row])

  function blockInvalidNumberKeys(e) {
    if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') e.preventDefault()
  }

  return (
    <tr className="border-t border-white/10 align-top hover:bg-white/[0.03]" onClick={() => onActivate(index)}>
      <td className={cell}>
        <div className="h-9 w-full min-w-0 rounded-lg bg-slate-950/40 px-2 text-sm text-slate-100 ring-1 ring-inset ring-white/10 flex items-center">
          {row.productName || '-'}
        </div>
      </td>

      <td className={cell}>
        <div className="h-9 w-full rounded-lg bg-slate-950/40 px-2 text-xs text-slate-200 ring-1 ring-inset ring-white/10 flex items-center justify-center">
          {row.batchNumber || '-'}
        </div>
      </td>

      <td className={cell}>
        <div className="h-9 w-full rounded-lg bg-slate-950/40 px-2 text-xs text-slate-200 ring-1 ring-inset ring-white/10 flex items-center justify-center">
          {row.expiryLabel || '-'}
        </div>
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
          max={100}
          step="0.01"
          value={Number(row.discountPercent || 0) === 0 ? '' : row.discountPercent}
          onChange={(e) => onChange(index, { discountPercent: e.target.value === '' ? 0 : Number(e.target.value) })}
          onKeyDown={blockInvalidNumberKeys}
        />
      </td>

      <td className={cell}>
        <input
          className={inputNum}
          type="number"
          min={0}
          step="0.01"
          value={Number(row.saleRate || 0) === 0 ? '' : row.saleRate}
          onChange={(e) => onChange(index, { saleRate: e.target.value === '' ? 0 : Number(e.target.value) })}
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
          value={Number(row.quantity || 0) === 0 ? '' : row.quantity}
          onChange={(e) => onChange(index, { quantity: e.target.value === '' ? 0 : Number(e.target.value) })}
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

