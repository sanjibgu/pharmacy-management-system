import mongoose from 'mongoose'
import { Sale } from '../models/Sale.js'
import { SaleItem } from '../models/SaleItem.js'
import { Stock } from '../models/Stock.js'
import { Medicine } from '../models/Medicine.js'

function toObjectId(id) {
  return new mongoose.Types.ObjectId(id)
}

async function withOptionalTransaction(work) {
  const session = await mongoose.startSession()
  try {
    let result
    await session.withTransaction(async () => {
      result = await work(session)
    })
    return result
  } catch {
    await session.endSession()
    return work(null)
  } finally {
    try {
      await session.endSession()
    } catch {
      // ignore
    }
  }
}

export async function listSaleBatches({ pharmacyId, medicineId }) {
  const medId = toObjectId(medicineId)
  const [medicine, stocks] = await Promise.all([
    Medicine.findOne({ _id: medId, pharmacyId, isDeleted: { $ne: true } }).lean(),
    Stock.find({ pharmacyId, medicineId: medId })
      .sort({ expiryDate: 1, batchNumber: 1 })
      .lean(),
  ])

  if (!medicine) return { ok: false, reason: 'Medicine not found', items: [] }

  const allowLooseSale = Boolean(medicine.allowLooseSale)
  const unitsPerStrip = Math.max(1, Number(medicine.unitsPerStrip || 1))

  const items = stocks
    .map((s) => {
      const packs = Math.max(0, Number(s.quantity || 0) + Number(s.freeQuantity || 0))
      const units = packs * unitsPerStrip
      return {
        _id: s._id,
        batchNumber: s.batchNumber,
        expiryDate: s.expiryDate,
        rackLocation: s.rackLocation || '',
        availablePacks: packs,
        availableUnits: units,
        mrp: Number(s.mrp || 0),
        saleRate: Number(s.saleRate || 0),
        finalPurchaseRate: Number(s.finalPurchaseRate || 0),
        unitsPerStrip,
        allowLooseSale,
      }
    })
    // Avoid showing "0.00" due to floating-point/rounding after loose sales.
    .filter((i) => i.availablePacks > 1e-6)

  return { ok: true, items }
}

export async function createSaleInvoice({ pharmacyId, createdBy, header, items }) {
  const medIds = [...new Set(items.map((i) => String(i.medicineId)))]
  const medicines = await Medicine.find({ pharmacyId, _id: { $in: medIds } }).lean()
  const medicineMap = new Map(medicines.map((m) => [String(m._id), m]))

  const computed = []

  for (let idx = 0; idx < items.length; idx += 1) {
    const it = items[idx]
    const med = medicineMap.get(String(it.medicineId))
    if (!med) throw new Error(`Row ${idx + 1}: medicine not found`)

    const unitsPerStrip = Math.max(1, Number(med.unitsPerStrip || 1))
    const allowLooseSale = Boolean(med.allowLooseSale)
    const unitType = it.unitType === 'unit' ? 'unit' : 'pack'

    if (unitType === 'unit' && !allowLooseSale) {
      throw new Error(`Row ${idx + 1}: loose sale not allowed for this medicine`)
    }

    const qty = Number(it.quantity || 0)
    if (!Number.isFinite(qty) || qty <= 0) throw new Error(`Row ${idx + 1}: invalid quantity`)

    const qtyPacks = unitType === 'unit' ? qty / unitsPerStrip : qty

    const stock = await Stock.findOne({
      pharmacyId,
      medicineId: toObjectId(it.medicineId),
      batchNumber: it.batchNumber,
      expiryDate: it.expiryDate,
    })
    if (!stock) throw new Error(`Row ${idx + 1}: batch not found in stock`)

    const availablePacks = Math.max(0, Number(stock.quantity || 0) + Number(stock.freeQuantity || 0))
    if (qtyPacks > availablePacks + 1e-9) {
      throw new Error(`Row ${idx + 1}: not enough stock`)
    }

    const mrpPack = Math.max(0, Number(stock.mrp || 0))
    const mrpUnit = unitsPerStrip > 0 ? mrpPack / unitsPerStrip : 0
    const mrp = unitType === 'unit' ? mrpUnit : mrpPack

    const saleRate = Math.max(0, Number(it.saleRate || 0))
    if (saleRate > mrp + 1e-9) {
      throw new Error(`Row ${idx + 1}: sale rate cannot exceed MRP`)
    }

    const discountPerUnit = Math.max(0, mrp - saleRate)
    const discountAmount = discountPerUnit * qty
    const discountPercent = mrp > 0 ? Math.min(100, Math.max(0, (discountPerUnit / mrp) * 100)) : 0

    const finalPurchaseRatePack = Math.max(0, Number(stock.finalPurchaseRate || 0))
    const finalPurchaseRateUnit = unitsPerStrip > 0 ? finalPurchaseRatePack / unitsPerStrip : 0
    const finalPurchaseRate = unitType === 'unit' ? finalPurchaseRateUnit : finalPurchaseRatePack

    const amount = saleRate * qty
    const cost = finalPurchaseRatePack * qtyPacks
    const profit = amount - cost

    computed.push({
      stock,
      qtyPacks,
      item: {
        medicineId: toObjectId(it.medicineId),
        hsnCode: med.hsnCode || '',
        batchNumber: it.batchNumber,
        expiryDate: it.expiryDate,
        unitType,
        quantity: qty,
        unitsPerStrip,
        mrp,
        saleRate,
        finalPurchaseRate,
        discountPercent,
        discountAmount,
        amount,
        profit,
      },
    })
  }

  const totals = computed.reduce(
    (acc, c) => {
      acc.subtotal += c.item.amount
      acc.profit += c.item.profit
      return acc
    },
    { subtotal: 0, profit: 0 },
  )

  const billDiscountPercent = Math.min(100, Math.max(0, Number(header?.billDiscountPercent || 0)))
  const billDiscountAmount = (totals.subtotal * billDiscountPercent) / 100
  const net = Math.max(0, totals.subtotal - billDiscountAmount)

  const desiredPaid =
    header && typeof header.paidAmount === 'number' ? Math.max(0, Number(header.paidAmount || 0)) : null
  const defaultPaid = header?.paymentType === 'Credit' ? 0 : net
  const paidAmount = Math.min(net, desiredPaid === null ? defaultPaid : desiredPaid)
  const balanceAmount = Math.max(0, net - paidAmount)

  return withOptionalTransaction(async (session) => {
    const sale = await Sale.create(
      [
        {
          pharmacyId: toObjectId(pharmacyId),
          saleDate: header.saleDate || new Date(),
          paymentType: header.paymentType,
          totalAmount: totals.subtotal,
          discountAmount: billDiscountAmount,
          gstAmount: 0,
          netAmount: net,
          paidAmount,
          balanceAmount,
          patientName: header.patientName || '',
          phone: header.phone || '',
          doctorName: header.doctorName || '',
          remarks: header.remarks || '',
          createdBy: toObjectId(createdBy),
        },
      ],
      session ? { session } : undefined,
    )

    const saleDoc = sale[0]

    await SaleItem.insertMany(
      computed.map((c) => ({
        pharmacyId: toObjectId(pharmacyId),
        saleId: saleDoc._id,
        ...c.item,
      })),
      session ? { session } : undefined,
    )

    for (const c of computed) {
      const stock = c.stock
      let remaining = c.qtyPacks
      const q = Math.max(0, Number(stock.quantity || 0))
      const fq = Math.max(0, Number(stock.freeQuantity || 0))

      if (q >= remaining) {
        stock.quantity = q - remaining
        remaining = 0
      } else {
        stock.quantity = 0
        remaining -= q
      }

      if (remaining > 0) {
        stock.freeQuantity = Math.max(0, fq - remaining)
      }

      // eslint-disable-next-line no-await-in-loop
      await stock.save(session ? { session } : undefined)
    }

    return { sale: saleDoc, totals }
  })
}
