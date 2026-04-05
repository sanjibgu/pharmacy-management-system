import mongoose from 'mongoose'
import { Sale } from '../models/Sale.js'
import { SaleItem } from '../models/SaleItem.js'
import { Medicine } from '../models/Medicine.js'

function parseYmdUtc(ymd) {
  const str = String(ymd || '').trim()
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null
  const dt = new Date(Date.UTC(year, month - 1, day))
  if (Number.isNaN(dt.getTime())) return null
  return dt
}

function addDaysUtc(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

function ymdUtc(date) {
  const d = new Date(date)
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export async function getProfitReport(req, res) {
  const pharmacyId = req.pharmacyId
  const preset = String(req.query.preset || 'currentMonth')
  const fromQ = req.query.from
  const toQ = req.query.to

  const now = new Date()
  let from
  let toExclusive
  let mode = 'currentMonth'

  if (preset === 'custom') {
    const fromDt = parseYmdUtc(fromQ)
    const toDt = parseYmdUtc(toQ)
    if (!fromDt || !toDt) return res.status(400).json({ error: 'Invalid date range. Use from/to as YYYY-MM-DD.' })
    if (fromDt.getTime() > toDt.getTime()) return res.status(400).json({ error: '`from` must be <= `to`.' })
    from = fromDt
    toExclusive = addDaysUtc(toDt, 1)
    mode = 'custom'
  } else {
    from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    toExclusive = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    mode = 'currentMonth'
  }

  const sales = await Sale.find({
    pharmacyId,
    saleDate: { $gte: from, $lt: toExclusive },
  })
    .select('saleDate totalAmount discountAmount netAmount paidAmount returnAmount balanceAmount paymentType')
    .lean()

  const saleIds = sales.map((s) => s._id)
  const aggBySale = saleIds.length
    ? await SaleItem.aggregate([
        {
          $match: {
            pharmacyId: new mongoose.Types.ObjectId(pharmacyId),
            saleId: { $in: saleIds },
          },
        },
        {
          $group: {
            _id: '$saleId',
            grossAmount: { $sum: '$amount' },
            profitAmount: { $sum: '$profit' },
          },
        },
      ])
    : []

  const bySaleId = new Map(aggBySale.map((a) => [String(a._id), a]))

  const totals = {
    bills: 0,
    grossAmount: 0,
    billDiscountAmount: 0,
    netAmount: 0,
    costAmount: 0,
    grossProfitAmount: 0,
    netProfitAmount: 0,
  }

  const byDayMap = new Map()

  for (const s of sales) {
    const a = bySaleId.get(String(s._id)) || { grossAmount: Number(s.totalAmount || 0), profitAmount: 0 }
    const grossAmount = Number(a.grossAmount || 0)
    const grossProfitAmount = Number(a.profitAmount || 0)
    const billDiscountAmount = Number(s.discountAmount || 0)
    const netProfitAmount = grossProfitAmount - billDiscountAmount
    const costAmount = grossAmount - grossProfitAmount
    const netAmount = Number(s.netAmount || 0)

    totals.bills += 1
    totals.grossAmount += grossAmount
    totals.billDiscountAmount += billDiscountAmount
    totals.netAmount += netAmount
    totals.costAmount += costAmount
    totals.grossProfitAmount += grossProfitAmount
    totals.netProfitAmount += netProfitAmount

    const key = ymdUtc(s.saleDate)
    const cur =
      byDayMap.get(key) || {
        date: key,
        bills: 0,
        grossAmount: 0,
        billDiscountAmount: 0,
        netAmount: 0,
        costAmount: 0,
        netProfitAmount: 0,
      }
    cur.bills += 1
    cur.grossAmount += grossAmount
    cur.billDiscountAmount += billDiscountAmount
    cur.netAmount += netAmount
    cur.costAmount += costAmount
    cur.netProfitAmount += netProfitAmount
    byDayMap.set(key, cur)
  }

  const byDay = Array.from(byDayMap.values()).sort((a, b) => (a.date < b.date ? -1 : 1))

  res.json({
    range: {
      preset: mode,
      from: ymdUtc(from),
      to: ymdUtc(addDaysUtc(toExclusive, -1)),
    },
    totals,
    byDay,
  })
}

export async function getItemsSoldReport(req, res) {
  const pharmacyId = req.pharmacyId
  const preset = String(req.query.preset || 'currentMonth')
  const fromQ = req.query.from
  const toQ = req.query.to

  const now = new Date()
  let from
  let toExclusive
  let mode = 'currentMonth'

  if (preset === 'custom') {
    const fromDt = parseYmdUtc(fromQ)
    const toDt = parseYmdUtc(toQ)
    if (!fromDt || !toDt) return res.status(400).json({ error: 'Invalid date range. Use from/to as YYYY-MM-DD.' })
    if (fromDt.getTime() > toDt.getTime()) return res.status(400).json({ error: '`from` must be <= `to`.' })
    from = fromDt
    toExclusive = addDaysUtc(toDt, 1)
    mode = 'custom'
  } else {
    from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    toExclusive = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    mode = 'currentMonth'
  }

  const sales = await Sale.find({
    pharmacyId,
    saleDate: { $gte: from, $lt: toExclusive },
  })
    .select('_id')
    .lean()

  const saleIds = sales.map((s) => s._id)
  if (saleIds.length === 0) {
    return res.json({
      range: { preset: mode, from: ymdUtc(from), to: ymdUtc(addDaysUtc(toExclusive, -1)) },
      items: [],
      totals: {
        products: 0,
        soldPacks: 0,
        soldUnits: 0,
        mrpAmount: 0,
        salesAmount: 0,
        discountAmount: 0,
        profitAmount: 0,
      },
    })
  }

  const rows = await SaleItem.aggregate([
    {
      $match: {
        pharmacyId: new mongoose.Types.ObjectId(pharmacyId),
        saleId: { $in: saleIds },
      },
    },
    {
      $group: {
        _id: '$medicineId',
        soldPacks: {
          $sum: {
            $cond: [
              { $eq: ['$unitType', 'pack'] },
              '$quantity',
              { $divide: ['$quantity', { $max: ['$unitsPerStrip', 1] }] },
            ],
          },
        },
        soldUnits: {
          $sum: {
            $cond: [
              { $eq: ['$unitType', 'unit'] },
              '$quantity',
              { $multiply: ['$quantity', { $max: ['$unitsPerStrip', 1] }] },
            ],
          },
        },
        mrpAmount: { $sum: { $multiply: ['$mrp', '$quantity'] } },
        salesAmount: { $sum: '$amount' },
        discountAmount: { $sum: '$discountAmount' },
        profitAmount: { $sum: '$profit' },
      },
    },
    { $sort: { salesAmount: -1 } },
  ])

  const medIds = rows.map((r) => r._id)
  const meds = await Medicine.find({ pharmacyId, _id: { $in: medIds } })
    .select('medicineName manufacturer category dosageForm')
    .lean()
  const medById = new Map(meds.map((m) => [String(m._id), m]))

  const items = rows.map((r) => {
    const m = medById.get(String(r._id))
    return {
      medicineId: r._id,
      medicine: m
        ? {
            _id: m._id,
            medicineName: m.medicineName,
            manufacturer: m.manufacturer || '',
            category: m.category || m.dosageForm || '',
          }
        : null,
      soldPacks: Number(r.soldPacks || 0),
      soldUnits: Number(r.soldUnits || 0),
      mrpAmount: Number(r.mrpAmount || 0),
      salesAmount: Number(r.salesAmount || 0),
      discountAmount: Number(r.discountAmount || 0),
      profitAmount: Number(r.profitAmount || 0),
    }
  })

  const totals = items.reduce(
    (acc, it) => {
      acc.products += 1
      acc.soldPacks += Number(it.soldPacks || 0)
      acc.soldUnits += Number(it.soldUnits || 0)
      acc.mrpAmount += Number(it.mrpAmount || 0)
      acc.salesAmount += Number(it.salesAmount || 0)
      acc.discountAmount += Number(it.discountAmount || 0)
      acc.profitAmount += Number(it.profitAmount || 0)
      return acc
    },
    {
      products: 0,
      soldPacks: 0,
      soldUnits: 0,
      mrpAmount: 0,
      salesAmount: 0,
      discountAmount: 0,
      profitAmount: 0,
    },
  )

  res.json({
    range: { preset: mode, from: ymdUtc(from), to: ymdUtc(addDaysUtc(toExclusive, -1)) },
    totals,
    items,
  })
}
