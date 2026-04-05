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

    // Determine how much of the sale will come from normal quantity vs free quantity (in packs).
    const qPacks = Math.max(0, Number(stock.quantity || 0))
    const fqPacks = Math.max(0, Number(stock.freeQuantity || 0))
    const consumeFromQty = Math.min(qPacks, qtyPacks)
    const consumeFromFree = Math.max(0, qtyPacks - consumeFromQty)
    if (consumeFromFree - fqPacks > 1e-9) {
      throw new Error(`Row ${idx + 1}: not enough stock`)
    }

    computed.push({
      stock,
      qtyPacks,
      consumeFromQty,
      consumeFromFree,
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
        consumedQuantityPacks: consumeFromQty,
        consumedFreeQuantityPacks: consumeFromFree,
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
  const returnAmount = 0
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
          billDiscountPercent,
          gstAmount: 0,
          netAmount: net,
          paidAmount,
          returnAmount,
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
      stock.quantity = Math.max(0, Number(stock.quantity || 0) - Number(c.consumeFromQty || 0))
      stock.freeQuantity = Math.max(0, Number(stock.freeQuantity || 0) - Number(c.consumeFromFree || 0))

      // eslint-disable-next-line no-await-in-loop
      await stock.save(session ? { session } : undefined)
    }

    return { sale: saleDoc, totals }
  })
}

export async function deleteSaleInvoice({ pharmacyId, saleId }) {
  return withOptionalTransaction(async (session) => {
    const sale = await Sale.findOne({ _id: saleId, pharmacyId }, null, session ? { session } : undefined).lean()
    if (!sale) return { ok: false, reason: 'Sale not found' }

    const items = await SaleItem.find({ saleId, pharmacyId }, null, session ? { session } : undefined).lean()

    for (const it of items) {
      const qtyPacks = it.unitType === 'unit'
        ? Number(it.quantity || 0) / Math.max(1, Number(it.unitsPerStrip || 1))
        : Number(it.quantity || 0)

      const restoreQty = typeof it.consumedQuantityPacks === 'number' ? Number(it.consumedQuantityPacks || 0) : qtyPacks
      const restoreFree = typeof it.consumedFreeQuantityPacks === 'number' ? Number(it.consumedFreeQuantityPacks || 0) : 0

      // eslint-disable-next-line no-await-in-loop
      const stock = await Stock.findOne(
        {
          pharmacyId,
          medicineId: it.medicineId,
          batchNumber: it.batchNumber,
          expiryDate: it.expiryDate,
        },
        null,
        session ? { session } : undefined,
      )
      if (!stock) {
        return { ok: false, reason: 'Cannot delete: stock batch missing' }
      }

      stock.quantity = Math.max(0, Number(stock.quantity || 0) + restoreQty)
      stock.freeQuantity = Math.max(0, Number(stock.freeQuantity || 0) + restoreFree)
      // eslint-disable-next-line no-await-in-loop
      await stock.save(session ? { session } : undefined)
    }

    await SaleItem.deleteMany({ saleId, pharmacyId }, session ? { session } : undefined)
    await Sale.deleteOne({ _id: saleId, pharmacyId }, session ? { session } : undefined)
    return { ok: true }
  })
}

export async function updateSaleInvoice({ pharmacyId, saleId, updatedBy, header, items }) {
  // Full edit: reverse old stock, delete old items, then create new items & stock decrement.
  return withOptionalTransaction(async (session) => {
    const sale = await Sale.findOne({ _id: saleId, pharmacyId }, null, session ? { session } : undefined).lean()
    if (!sale) return { ok: false, reason: 'Sale not found' }

    const oldItems = await SaleItem.find({ saleId, pharmacyId }, null, session ? { session } : undefined).lean()

    // Restore old stock first.
    for (const it of oldItems) {
      const qtyPacks = it.unitType === 'unit'
        ? Number(it.quantity || 0) / Math.max(1, Number(it.unitsPerStrip || 1))
        : Number(it.quantity || 0)

      const restoreQty = typeof it.consumedQuantityPacks === 'number' ? Number(it.consumedQuantityPacks || 0) : qtyPacks
      const restoreFree = typeof it.consumedFreeQuantityPacks === 'number' ? Number(it.consumedFreeQuantityPacks || 0) : 0

      // eslint-disable-next-line no-await-in-loop
      const stock = await Stock.findOne(
        { pharmacyId, medicineId: it.medicineId, batchNumber: it.batchNumber, expiryDate: it.expiryDate },
        null,
        session ? { session } : undefined,
      )
      if (!stock) return { ok: false, reason: 'Cannot edit: stock batch missing' }

      stock.quantity = Math.max(0, Number(stock.quantity || 0) + restoreQty)
      stock.freeQuantity = Math.max(0, Number(stock.freeQuantity || 0) + restoreFree)
      // eslint-disable-next-line no-await-in-loop
      await stock.save(session ? { session } : undefined)
    }

    await SaleItem.deleteMany({ saleId, pharmacyId }, session ? { session } : undefined)

    // Compute new invoice by reusing create logic pieces.
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

      const stock = await Stock.findOne(
        { pharmacyId, medicineId: toObjectId(it.medicineId), batchNumber: it.batchNumber, expiryDate: it.expiryDate },
        null,
        session ? { session } : undefined,
      )
      if (!stock) throw new Error(`Row ${idx + 1}: batch not found in stock`)

      const availablePacks = Math.max(0, Number(stock.quantity || 0) + Number(stock.freeQuantity || 0))
      if (qtyPacks > availablePacks + 1e-9) throw new Error(`Row ${idx + 1}: not enough stock`)

      const mrpPack = Math.max(0, Number(stock.mrp || 0))
      const mrpUnit = unitsPerStrip > 0 ? mrpPack / unitsPerStrip : 0
      const mrp = unitType === 'unit' ? mrpUnit : mrpPack

      const saleRate = Math.max(0, Number(it.saleRate || 0))
      if (saleRate > mrp + 1e-9) throw new Error(`Row ${idx + 1}: sale rate cannot exceed MRP`)

      const discountPerUnit = Math.max(0, mrp - saleRate)
      const discountAmount = discountPerUnit * qty
      const discountPercent = mrp > 0 ? Math.min(100, Math.max(0, (discountPerUnit / mrp) * 100)) : 0

      const finalPurchaseRatePack = Math.max(0, Number(stock.finalPurchaseRate || 0))
      const finalPurchaseRateUnit = unitsPerStrip > 0 ? finalPurchaseRatePack / unitsPerStrip : 0
      const finalPurchaseRate = unitType === 'unit' ? finalPurchaseRateUnit : finalPurchaseRatePack

      const amount = saleRate * qty
      const cost = finalPurchaseRatePack * qtyPacks
      const profit = amount - cost

      const qPacks = Math.max(0, Number(stock.quantity || 0))
      const fqPacks = Math.max(0, Number(stock.freeQuantity || 0))
      const consumeFromQty = Math.min(qPacks, qtyPacks)
      const consumeFromFree = Math.max(0, qtyPacks - consumeFromQty)
      if (consumeFromFree - fqPacks > 1e-9) throw new Error(`Row ${idx + 1}: not enough stock`)

      computed.push({
        stock,
        consumeFromQty,
        consumeFromFree,
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
          consumedQuantityPacks: consumeFromQty,
          consumedFreeQuantityPacks: consumeFromFree,
          amount,
          profit,
        },
      })
    }

    const subtotal = computed.reduce((acc, c) => acc + c.item.amount, 0)
    const billDiscountPercent = Math.min(100, Math.max(0, Number(header?.billDiscountPercent ?? sale.billDiscountPercent ?? 0)))
    const billDiscountAmount = (subtotal * billDiscountPercent) / 100
    const net = Math.max(0, subtotal - billDiscountAmount)

    const desiredPaid =
      header && Object.prototype.hasOwnProperty.call(header, 'paidAmount')
        ? Math.max(0, Number(header.paidAmount || 0))
        : Number(sale.paidAmount || 0)
    const paidAmount = Math.min(net, desiredPaid)
    const returnAmount = Math.max(0, Number(sale.paidAmount || 0) - paidAmount)
    const balanceAmount = Math.max(0, net - paidAmount)

    await Sale.updateOne(
      { _id: saleId, pharmacyId },
      {
        $set: {
          saleDate: header?.saleDate || sale.saleDate,
          paymentType: header?.paymentType || sale.paymentType,
          totalAmount: subtotal,
          discountAmount: billDiscountAmount,
          billDiscountPercent,
          netAmount: net,
          paidAmount,
          returnAmount,
          balanceAmount,
          patientName: header?.patientName ?? sale.patientName,
          phone: header?.phone ?? sale.phone,
          doctorName: header?.doctorName ?? sale.doctorName,
          remarks: header?.remarks ?? sale.remarks,
        },
      },
      session ? { session } : undefined,
    )

    await SaleItem.insertMany(
      computed.map((c) => ({
        pharmacyId: toObjectId(pharmacyId),
        saleId: toObjectId(saleId),
        ...c.item,
      })),
      session ? { session } : undefined,
    )

    for (const c of computed) {
      const stock = c.stock
      stock.quantity = Math.max(0, Number(stock.quantity || 0) - Number(c.consumeFromQty || 0))
      stock.freeQuantity = Math.max(0, Number(stock.freeQuantity || 0) - Number(c.consumeFromFree || 0))
      // eslint-disable-next-line no-await-in-loop
      await stock.save(session ? { session } : undefined)
    }

    const updatedSale = await Sale.findOne({ _id: saleId, pharmacyId }, null, session ? { session } : undefined).lean()
    return { ok: true, item: updatedSale }
  })
}
