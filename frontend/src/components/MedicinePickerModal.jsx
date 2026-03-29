import { useEffect, useMemo, useState } from 'react'
import Button from './Button'
import { getSaleBatches, searchMedicines } from '../services/salesService'

function fmtExpiryLabel(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = String(d.getFullYear())
  return `${dd}/${mm}/${yyyy}`
}

export default function MedicinePickerModal({ open, token, onClose, onPickBatch }) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([])
  const [batchesById, setBatchesById] = useState({})
  const [batchLoadingByMedicineId, setBatchLoadingByMedicineId] = useState({})
  const [qtyByKey, setQtyByKey] = useState({})
  const [addedSigByBatchKey, setAddedSigByBatchKey] = useState({})
  const [overWarnedByKey, setOverWarnedByKey] = useState({})
  const [discByBatchKey, setDiscByBatchKey] = useState({})
  // Sale rate is managed per batch (pack/strip rate). Unit rate is derived by unitsPerStrip.
  const [saleRatePackByBatchKey, setSaleRatePackByBatchKey] = useState({})

  const canSearch = useMemo(() => Boolean(open && token), [open, token])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setItems([])
    setBatchesById({})
    setBatchLoadingByMedicineId({})
    setQtyByKey({})
    setAddedSigByBatchKey({})
    setOverWarnedByKey({})
    setDiscByBatchKey({})
    setSaleRatePackByBatchKey({})
  }, [open])

  useEffect(() => {
    if (!canSearch) return
    let mounted = true
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await searchMedicines(token, query)
        if (!mounted) return
        setItems(res.items || [])
      } catch {
        if (!mounted) return
        setItems([])
      } finally {
        if (mounted) setLoading(false)
      }
    }, 250)
    return () => {
      mounted = false
      clearTimeout(t)
    }
  }, [canSearch, query, token])

  useEffect(() => {
    if (!open || !token) return

    let cancelled = false
    async function ensureBatches() {
      for (const m of items) {
        if (cancelled) return
        if (batchesById[m._id]) continue
        setBatchLoadingByMedicineId((prev) => ({ ...prev, [m._id]: true }))
        try {
          const res = await getSaleBatches(token, m._id)
          if (cancelled) return
          setBatchesById((prev) => ({ ...prev, [m._id]: res.items || [] }))
        } catch {
          if (cancelled) return
          setBatchesById((prev) => ({ ...prev, [m._id]: [] }))
        } finally {
          if (!cancelled) setBatchLoadingByMedicineId((prev) => ({ ...prev, [m._id]: false }))
        }
      }
    }

    void ensureBatches()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, token, items])

  const visibleItems = useMemo(() => {
    // Hide medicines that have no in-stock batches (after batches are loaded).
    return (items || []).filter((m) => {
      const loaded = Object.prototype.hasOwnProperty.call(batchesById, m._id)
      if (!loaded) return true
      const batches = batchesById[m._id] || []
      return batches.some(
        (b) => Number(b.availablePacks || 0) > 1e-6 || Number(b.availableUnits || 0) > 1e-6,
      )
    })
  }, [items, batchesById])

  function qtyFor(key) {
    const v = Number(qtyByKey[key] ?? 0)
    return Number.isFinite(v) && v > 0 ? v : 1
  }

  function setQty(key, value) {
    setQtyByKey((prev) => ({ ...prev, [key]: value }))
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100000] flex items-start justify-center bg-slate-950/70 px-4 py-10 backdrop-blur">
      <div className="w-full max-w-4xl rounded-3xl bg-slate-950 p-5 ring-1 ring-inset ring-white/10 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-100">Add Medicine</div>
            <div className="mt-0.5 text-xs text-slate-400">Search medicines, then pick a batch.</div>
          </div>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
          <input
            className="h-10 w-full rounded-xl bg-white/5 px-3 text-sm text-slate-100 ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by medicine name…"
            autoFocus
          />
          <div className="text-xs text-slate-400 sm:text-right">
            {loading ? 'Searching…' : `${visibleItems.length} found`}
          </div>
        </div>

        <div className="mt-4 max-h-[65vh] overflow-auto rounded-2xl ring-1 ring-inset ring-white/10">
          {visibleItems.length === 0 ? (
            <div className="p-4 text-sm text-slate-400">{loading ? 'Loading…' : 'No medicines found.'}</div>
          ) : (
            <div className="divide-y divide-white/10">
              {visibleItems.map((m) => {
                const batches = batchesById[m._id] || null
                const isLoadingBatches = Boolean(batchLoadingByMedicineId[m._id])

                return (
                  <div key={m._id} className="p-4">
                    <div className="flex w-full flex-wrap items-start justify-between gap-3 rounded-2xl px-2 py-2 text-left">
                      <div className="min-w-[220px]">
                        <div className="text-base font-semibold text-slate-100">{m.medicineName}</div>
                        <div className="mt-0.5 text-xs text-slate-400">
                          {m.rackLocation ? `Rack: ${m.rackLocation}` : 'Rack: -'}
                          {m.hsnCode ? ` • HSN: ${m.hsnCode}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 rounded-2xl bg-white/5 p-3 ring-1 ring-inset ring-white/10">
                      {isLoadingBatches ? (
                        <div className="text-sm text-slate-400">Loading batches…</div>
                      ) : !batches || batches.length === 0 ? (
                        <div className="text-sm text-slate-400">No batches found.</div>
                      ) : (
                        <div className="grid gap-2">
                          {batches.map((b) => {
                            const packKey = `${m._id}:${b._id}:pack`
                            const unitKey = `${m._id}:${b._id}:unit`
                            const batchSigKey = `${m._id}:${b._id}`
                            const packQty = Math.max(0, Math.floor(Number(qtyByKey[packKey] ?? 0)))
                            const unitQty = Math.max(0, Math.floor(Number(qtyByKey[unitKey] ?? 0)))
                            const allowLooseSale = Boolean(b.allowLooseSale)
                            const availablePacks = Math.floor(Number(b.availablePacks || 0) + 1e-6)
                            const availableUnits = Math.floor(Number(b.availableUnits || 0) + 1e-6)
                            const exceedsPackStock = packQty > availablePacks
                            const exceedsUnitStock = unitQty > availableUnits

                            const unitsPerStrip = Math.max(1, Number(b.unitsPerStrip || m.unitsPerStrip || 1))
                            const mrpPack = Math.max(0, Number(b.mrp || 0))
                            const mrpUnit = unitsPerStrip > 0 ? mrpPack / unitsPerStrip : 0

                            const defaultSaleRatePack = Math.max(0, Number(b.saleRate || 0))
                            const saleRateRaw = saleRatePackByBatchKey[batchSigKey]
                            const saleRatePack =
                              saleRateRaw === '' || saleRateRaw == null
                                ? defaultSaleRatePack
                                : Math.max(0, Number(saleRateRaw))
                            const saleRateUnit = unitsPerStrip > 0 ? saleRatePack / unitsPerStrip : 0
                            const exceedsMrp = saleRatePack > mrpPack + 1e-9

                            const discRaw = discByBatchKey[batchSigKey]
                            const disc =
                              discRaw === '' || discRaw == null
                                ? mrpPack > 0
                                  ? Math.min(100, Math.max(0, ((mrpPack - saleRatePack) / mrpPack) * 100))
                                  : 0
                                : Math.min(100, Math.max(0, Number(discRaw)))

                            const currentSig = allowLooseSale ? `${packQty}|${unitQty}` : String(packQty)
                            const addedSig = addedSigByBatchKey[batchSigKey] || null
                            const missingExpiry = !b.expiryDate
                            const disableAdd =
                              missingExpiry ||
                              exceedsMrp ||
                              (allowLooseSale ? (packQty <= 0 && unitQty <= 0) : packQty <= 0) ||
                              (packQty > 0 && exceedsPackStock) ||
                              (unitQty > 0 && exceedsUnitStock) ||
                              (addedSig != null && addedSig === currentSig)

                            return (
                              <div
                                key={b._id}
                                className={`grid gap-2 rounded-xl bg-slate-950/40 px-3 py-2 ring-1 ring-inset lg:grid-cols-[1fr_auto] lg:items-center ${
                                  missingExpiry ? 'ring-rose-400/40' : 'ring-white/10'
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                                    <div className="font-semibold text-slate-100">{b.batchNumber}</div>
                                    <div className={`text-xs ${missingExpiry ? 'text-rose-200' : 'text-slate-300'}`}>
                                      Exp: {missingExpiry ? 'Missing' : fmtExpiryLabel(b.expiryDate)}
                                    </div>
                                    {b.rackLocation ? <div className="text-xs text-slate-300">Rack: {b.rackLocation}</div> : null}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-300">
                                    MRP: {Number(b.mrp || 0).toFixed(2)} • S.R: {Number(b.saleRate || 0).toFixed(2)} • Stock:{' '}
                                    {Number(b.availablePacks || 0).toFixed(2)} pack
                                  </div>
                                  {missingExpiry ? (
                                    <div className="mt-1 text-[11px] font-medium text-rose-200">
                                      Expiry date missing — cannot add this batch.
                                    </div>
                                  ) : null}
                                  {exceedsPackStock ? (
                                    <div className="mt-1 text-[11px] font-medium text-rose-200">
                                      Strip exceeds stock. Available strips: {availablePacks}
                                    </div>
                                  ) : null}
                                  {allowLooseSale && exceedsUnitStock ? (
                                    <div className="mt-1 text-[11px] font-medium text-rose-200">
                                      Single exceeds stock. Available singles: {availableUnits}
                                    </div>
                                  ) : null}
                                  {exceedsMrp ? (
                                    <div className="mt-1 text-[11px] font-medium text-rose-200">
                                      Sale rate cannot exceed MRP.
                                    </div>
                                  ) : null}
                                </div>

                                <div className="flex flex-wrap items-end justify-end gap-2">
                                  <label className="grid gap-1">
                                    <span className="text-[10px] font-medium text-slate-400 text-right">Strip</span>
                                    <input
                                      className="h-9 w-24 rounded-lg bg-slate-950/40 px-2 text-right text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                                      type="number"
                                      min={0}
                                      step="1"
                                      value={packQty <= 0 ? '' : packQty}
                                      onKeyDown={(e) => {
                                        if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') e.preventDefault()
                                      }}
                                      onChange={(e) => {
                                        const next = e.target.value === '' ? '' : Number(e.target.value)
                                        setQty(packKey, next)
                                        const nextQty = Math.max(0, Math.floor(Number(next || 0)))
                                        if (nextQty > availablePacks && !overWarnedByKey[packKey]) {
                                          alert(`You entered more than the stock.\n\nAvailable strips: ${availablePacks}`)
                                          setOverWarnedByKey((prev) => ({ ...prev, [packKey]: true }))
                                        }
                                        if (nextQty <= availablePacks && overWarnedByKey[packKey]) {
                                          setOverWarnedByKey((prev) => ({ ...prev, [packKey]: false }))
                                        }
                                      }}
                                    />
                                  </label>

                                  {allowLooseSale ? (
                                    <label className="grid gap-1">
                                      <span className="text-[10px] font-medium text-slate-400 text-right">Single</span>
                                      <input
                                        className="h-9 w-24 rounded-lg bg-slate-950/40 px-2 text-right text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                                        type="number"
                                        min={0}
                                        step="1"
                                        value={unitQty <= 0 ? '' : unitQty}
                                        onKeyDown={(e) => {
                                          if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') e.preventDefault()
                                        }}
                                        onChange={(e) => {
                                          const next = e.target.value === '' ? '' : Number(e.target.value)
                                          setQty(unitKey, next)
                                          const nextQty = Math.max(0, Math.floor(Number(next || 0)))
                                          if (nextQty > availableUnits && !overWarnedByKey[unitKey]) {
                                            alert(`You entered more than the stock.\n\nAvailable singles: ${availableUnits}`)
                                            setOverWarnedByKey((prev) => ({ ...prev, [unitKey]: true }))
                                          }
                                          if (nextQty <= availableUnits && overWarnedByKey[unitKey]) {
                                            setOverWarnedByKey((prev) => ({ ...prev, [unitKey]: false }))
                                          }
                                        }}
                                      />
                                    </label>
                                  ) : null}

                                  <label className="grid gap-1">
                                    <span className="text-[10px] font-medium text-slate-400 text-right">Disc%</span>
                                    <input
                                      className="h-9 w-20 rounded-lg bg-slate-950/40 px-2 text-right text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                                      type="number"
                                      min={0}
                                      max={100}
                                      step="0.01"
                                      value={disc <= 0 ? '' : disc}
                                      onKeyDown={(e) => {
                                        if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') e.preventDefault()
                                      }}
                                      onChange={(e) => {
                                        const raw = e.target.value === '' ? '' : Number(e.target.value)
                                        const nextDisc = raw === '' ? '' : Math.min(100, Math.max(0, Number(raw)))
                                        setDiscByBatchKey((prev) => ({ ...prev, [batchSigKey]: nextDisc }))
                                        if (mrpPack > 0 && nextDisc !== '') {
                                          const nextSaleRate = Math.max(0, mrpPack - (mrpPack * Number(nextDisc)) / 100)
                                          setSaleRatePackByBatchKey((prev) => ({ ...prev, [batchSigKey]: nextSaleRate }))
                                        }
                                      }}
                                    />
                                  </label>

                                  <label className="grid gap-1">
                                    <span className="text-[10px] font-medium text-slate-400 text-right">S.R</span>
                                    <input
                                      className="h-9 w-24 rounded-lg bg-slate-950/40 px-2 text-right text-sm ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      value={saleRatePack <= 0 ? '' : saleRatePack}
                                      onKeyDown={(e) => {
                                        if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') e.preventDefault()
                                      }}
                                      onChange={(e) => {
                                        const raw = e.target.value === '' ? '' : Number(e.target.value)
                                        const nextSaleRate = raw === '' ? '' : Math.max(0, Number(raw))
                                        setSaleRatePackByBatchKey((prev) => ({ ...prev, [batchSigKey]: nextSaleRate }))
                                        if (mrpPack > 0 && nextSaleRate !== '') {
                                          const nextDisc = Math.min(100, Math.max(0, ((mrpPack - Number(nextSaleRate)) / mrpPack) * 100))
                                          setDiscByBatchKey((prev) => ({ ...prev, [batchSigKey]: nextDisc }))
                                        }
                                      }}
                                    />
                                  </label>

                                  <Button
                                    type="button"
                                    disabled={disableAdd}
                                    onClick={() => {
                                      const nextPackQty = Math.max(0, Math.floor(Number(qtyByKey[packKey] ?? 0)))
                                      const nextUnitQty = Math.max(0, Math.floor(Number(qtyByKey[unitKey] ?? 0)))
                                      const payload = {
                                        packQty: nextPackQty,
                                        unitQty: allowLooseSale ? nextUnitQty : 0,
                                        saleRatePack,
                                        discountPercent: disc,
                                      }
                                      onPickBatch(m, b, payload)
                                      const sig = allowLooseSale
                                        ? `${payload.packQty}|${payload.unitQty}`
                                        : String(payload.packQty)
                                      setAddedSigByBatchKey((prev) => ({ ...prev, [batchSigKey]: sig }))
                                    }}
                                  >
                                    {addedSig && addedSig === currentSig ? 'Added' : 'Add'}
                                  </Button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
