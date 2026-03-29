import mongoose from 'mongoose'
import { Purchase } from '../models/Purchase.js'
import { PurchaseItem } from '../models/PurchaseItem.js'
import { Stock } from '../models/Stock.js'

function toObjectId(id) {
  return new mongoose.Types.ObjectId(id)
}

function computeLine({
  quantity,
  freeQuantity,
  mrp,
  discountPercent,
  gstPercent,
}) {
  const q = Math.max(0, Number(quantity || 0))
  const free = Math.max(0, Number(freeQuantity || 0))
  const m = Math.max(0, Number(mrp || 0))
  const discPct = Math.min(100, Math.max(0, Number(discountPercent || 0)))
  const gstPct = Math.max(0, Number(gstPercent || 0))

  const discountPerUnit = (m * discPct) / 100
  const tradeRate = Math.max(0, m - discountPerUnit)
  const gstPerUnit = (tradeRate * gstPct) / 100
  const purchaseRate = tradeRate + gstPerUnit

  const discountTotal = discountPerUnit * q
  const taxableAmount = tradeRate * q
  const gstTotal = gstPerUnit * q
  const netAmount = purchaseRate * q

  const totalUnits = q + free
  const finalPurchaseRate = totalUnits > 0 ? netAmount / totalUnits : 0

  return {
    mrpTotal: m * q,
    discountPerUnit,
    tradeRate,
    gstPerUnit,
    purchaseRate,
    discountTotal,
    taxableAmount,
    gstTotal,
    netAmount,
    finalPurchaseRate,
  }
}

async function withOptionalTransaction(work) {
  const session = await mongoose.startSession()
  try {
    let result
    await session.withTransaction(async () => {
      result = await work(session)
    })
    return result
  } catch (err) {
    // Transactions require a replica set; fallback to non-transactional behavior in local dev.
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

export async function createPurchaseInvoice({
  pharmacyId,
  createdBy,
  header,
  items,
}) {
  const totals = items.reduce(
    (acc, it) => {
      const line = computeLine(it)
      acc.taxable += line.taxableAmount
      acc.gst += line.gstTotal
      acc.discount += line.discountTotal
      acc.net += line.netAmount
      return acc
    },
    { taxable: 0, gst: 0, discount: 0, net: 0 },
  )

  const desiredPaid =
    header && typeof header.paidAmount === 'number' ? Math.max(0, Number(header.paidAmount || 0)) : null
  const defaultPaid = header?.paymentType === 'Credit' ? 0 : totals.net
  const paidAmount = Math.min(totals.net, desiredPaid === null ? defaultPaid : desiredPaid)
  const balanceAmount = Math.max(0, totals.net - paidAmount)

  return withOptionalTransaction(async (session) => {
    const purchase = await Purchase.create(
      [
        {
          pharmacyId: toObjectId(pharmacyId),
          supplierId: toObjectId(header.supplierId),
          invoiceNumber: header.invoiceNumber,
          invoiceDate: header.invoiceDate,
          purchaseDate: header.purchaseDate,
          paymentType: header.paymentType,
          dueDate: header.dueDate || undefined,
          totalAmount: totals.taxable,
          discountAmount: totals.discount,
          gstAmount: totals.gst,
          netAmount: totals.net,
          paidAmount,
          balanceAmount,
          remarks: header.remarks || '',
          createdBy: toObjectId(createdBy),
        },
      ],
      session ? { session } : undefined,
    )

    const purchaseDoc = purchase[0]

    const purchaseItems = items.map((it) => {
      const line = computeLine(it)
      return {
        pharmacyId: toObjectId(pharmacyId),
        purchaseId: purchaseDoc._id,
        medicineId: toObjectId(it.medicineId),
        hsnCode: it.hsnCode || '',
        batchNumber: it.batchNumber,
        manufactureDate: it.manufactureDate || undefined,
        expiryDate: it.expiryDate,
        quantity: Number(it.quantity || 0),
        freeQuantity: Number(it.freeQuantity || 0),
        mrp: Number(it.mrp || 0),
        discountPercent: Number(it.discountPercent || 0),
        gstPercent: Number(it.gstPercent || 0),
        tradeRate: line.tradeRate,
        purchaseRate: line.purchaseRate,
        finalPurchaseRate: line.finalPurchaseRate,
        saleRate: Number(it.saleRate || 0),
        amount: line.taxableAmount,
        gstAmount: line.gstTotal,
        discountAmount: line.discountTotal,
        totalAmount: line.netAmount,
      }
    })

    await PurchaseItem.insertMany(purchaseItems, session ? { session } : undefined)

    for (const it of items) {
      const line = computeLine(it)
      const filter = {
        pharmacyId: toObjectId(pharmacyId),
        medicineId: toObjectId(it.medicineId),
        batchNumber: it.batchNumber,
        expiryDate: it.expiryDate,
      }
      const incQty = Math.max(0, Number(it.quantity || 0))
      const incFree = Math.max(0, Number(it.freeQuantity || 0))
      const newUnits = incQty + incFree
      const newCost = incQty * line.purchaseRate

      // eslint-disable-next-line no-await-in-loop
      const stock = await Stock.findOne(filter, null, session ? { session } : undefined)
      if (!stock) {
        const doc = new Stock({
          ...filter,
          quantity: incQty,
          freeQuantity: incFree,
          rackLocation: typeof it.rackLocation === 'string' ? it.rackLocation.trim() : '',
          mrp: Number(it.mrp || 0),
          tradeRate: line.tradeRate,
          purchaseRate: line.purchaseRate,
          finalPurchaseRate: line.finalPurchaseRate,
          saleRate: Number(it.saleRate || 0),
        })
        // eslint-disable-next-line no-await-in-loop
        await doc.save(session ? { session } : undefined)
        // eslint-disable-next-line no-continue
        continue
      }

      const existingUnits = Math.max(0, Number(stock.quantity || 0)) + Math.max(0, Number(stock.freeQuantity || 0))
      const existingFinalRate =
        typeof stock.finalPurchaseRate === 'number' && Number.isFinite(stock.finalPurchaseRate)
          ? Math.max(0, Number(stock.finalPurchaseRate))
          : existingUnits > 0
            ? (Math.max(0, Number(stock.purchaseRate || 0)) * Math.max(0, Number(stock.quantity || 0))) / existingUnits
            : 0
      const existingCost = existingFinalRate * existingUnits

      const combinedUnits = existingUnits + newUnits
      const combinedFinalRate = combinedUnits > 0 ? (existingCost + newCost) / combinedUnits : line.finalPurchaseRate

      stock.quantity = Math.max(0, Number(stock.quantity || 0)) + incQty
      stock.freeQuantity = Math.max(0, Number(stock.freeQuantity || 0)) + incFree
      stock.mrp = Number(it.mrp || 0)
      stock.tradeRate = line.tradeRate
      stock.purchaseRate = line.purchaseRate
      stock.finalPurchaseRate = combinedFinalRate
      stock.saleRate = Number(it.saleRate || 0)
      if (typeof it.rackLocation === 'string' && it.rackLocation.trim()) {
        stock.rackLocation = it.rackLocation.trim()
      }
      // eslint-disable-next-line no-await-in-loop
      await stock.save(session ? { session } : undefined)
    }

    return purchaseDoc
  })
}

export async function deletePurchaseInvoice({ pharmacyId, purchaseId }) {
  return withOptionalTransaction(async (session) => {
    const purchase = await Purchase.findOne({ _id: purchaseId, pharmacyId }, null, session ? { session } : undefined)
    if (!purchase) return { ok: false, reason: 'Purchase not found' }

    const items = await PurchaseItem.find({ purchaseId, pharmacyId }, null, session ? { session } : undefined).lean()

    for (const it of items) {
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
      if (
        !stock ||
        stock.quantity < Number(it.quantity || 0) ||
        stock.freeQuantity < Number(it.freeQuantity || 0)
      ) {
        return { ok: false, reason: 'Cannot delete: stock would become negative' }
      }
      stock.quantity -= Number(it.quantity || 0)
      stock.freeQuantity -= Number(it.freeQuantity || 0)
      // eslint-disable-next-line no-await-in-loop
      await stock.save(session ? { session } : undefined)
    }

    await PurchaseItem.deleteMany({ purchaseId, pharmacyId }, session ? { session } : undefined)
    await Purchase.deleteOne({ _id: purchaseId, pharmacyId }, session ? { session } : undefined)

    return { ok: true }
  })
}

export async function updatePurchaseInvoice({
  pharmacyId,
  purchaseId,
  updatedBy,
  header,
  items,
}) {
  return withOptionalTransaction(async (session) => {
    const purchase = await Purchase.findOne(
      { _id: purchaseId, pharmacyId },
      null,
      session ? { session } : undefined,
    ).lean()
    if (!purchase) return { ok: false, reason: 'Purchase not found' }

    const existingItems = await PurchaseItem.find(
      { purchaseId, pharmacyId },
      null,
      session ? { session } : undefined,
    ).lean()

    // Reverse old stock (same safety rules as delete).
    for (const it of existingItems) {
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

      if (
        !stock ||
        stock.quantity < Number(it.quantity || 0) ||
        stock.freeQuantity < Number(it.freeQuantity || 0)
      ) {
        return { ok: false, reason: 'Cannot edit: stock would become negative' }
      }

      stock.quantity -= Number(it.quantity || 0)
      stock.freeQuantity -= Number(it.freeQuantity || 0)
      // eslint-disable-next-line no-await-in-loop
      await stock.save(session ? { session } : undefined)
    }

    await PurchaseItem.deleteMany({ purchaseId, pharmacyId }, session ? { session } : undefined)

    const totals = items.reduce(
      (acc, it) => {
        const line = computeLine(it)
        acc.taxable += line.taxableAmount
        acc.gst += line.gstTotal
        acc.discount += line.discountTotal
        acc.net += line.netAmount
        return acc
      },
      { taxable: 0, gst: 0, discount: 0, net: 0 },
    )

    const existingPaid = Math.max(0, Number(purchase.paidAmount || 0))
    const desiredPaid =
      header && Object.prototype.hasOwnProperty.call(header, 'paidAmount')
        ? Math.max(0, Number(header.paidAmount || 0))
        : null
    const paidAmount =
      desiredPaid === null ? Math.min(existingPaid, totals.net) : Math.min(desiredPaid, totals.net)
    const balanceAmount = Math.max(0, totals.net - paidAmount)

    const nextHeader = header || {}

    await Purchase.updateOne(
      { _id: purchaseId, pharmacyId },
      {
        $set: {
          supplierId: nextHeader.supplierId ? toObjectId(nextHeader.supplierId) : purchase.supplierId,
          invoiceNumber: nextHeader.invoiceNumber || purchase.invoiceNumber,
          invoiceDate: nextHeader.invoiceDate || purchase.invoiceDate,
          purchaseDate: nextHeader.purchaseDate || purchase.purchaseDate,
          paymentType: nextHeader.paymentType || purchase.paymentType,
          dueDate: Object.prototype.hasOwnProperty.call(nextHeader, 'dueDate')
            ? nextHeader.dueDate || undefined
            : purchase.dueDate,
          remarks: Object.prototype.hasOwnProperty.call(nextHeader, 'remarks')
            ? nextHeader.remarks || ''
            : purchase.remarks,
          totalAmount: totals.taxable,
          discountAmount: totals.discount,
          gstAmount: totals.gst,
          netAmount: totals.net,
          paidAmount,
          balanceAmount,
        },
      },
      session ? { session } : undefined,
    )

    const purchaseItems = items.map((it) => {
      const line = computeLine(it)
      return {
        pharmacyId: toObjectId(pharmacyId),
        purchaseId: toObjectId(purchaseId),
        medicineId: toObjectId(it.medicineId),
        hsnCode: it.hsnCode || '',
        batchNumber: it.batchNumber,
        manufactureDate: it.manufactureDate || undefined,
        expiryDate: it.expiryDate,
        quantity: Number(it.quantity || 0),
        freeQuantity: Number(it.freeQuantity || 0),
        mrp: Number(it.mrp || 0),
        discountPercent: Number(it.discountPercent || 0),
        gstPercent: Number(it.gstPercent || 0),
        tradeRate: line.tradeRate,
        purchaseRate: line.purchaseRate,
        finalPurchaseRate: line.finalPurchaseRate,
        saleRate: Number(it.saleRate || 0),
        amount: line.taxableAmount,
        gstAmount: line.gstTotal,
        discountAmount: line.discountTotal,
        totalAmount: line.netAmount,
      }
    })

    await PurchaseItem.insertMany(purchaseItems, session ? { session } : undefined)

    // Apply new stock increments (same logic as create).
    for (const it of items) {
      const line = computeLine(it)
      const filter = {
        pharmacyId: toObjectId(pharmacyId),
        medicineId: toObjectId(it.medicineId),
        batchNumber: it.batchNumber,
        expiryDate: it.expiryDate,
      }
      const incQty = Math.max(0, Number(it.quantity || 0))
      const incFree = Math.max(0, Number(it.freeQuantity || 0))
      const newUnits = incQty + incFree
      const newCost = incQty * line.purchaseRate

      // eslint-disable-next-line no-await-in-loop
      const stock = await Stock.findOne(filter, null, session ? { session } : undefined)
      if (!stock) {
        const doc = new Stock({
          ...filter,
          quantity: incQty,
          freeQuantity: incFree,
          rackLocation: typeof it.rackLocation === 'string' ? it.rackLocation.trim() : '',
          mrp: Number(it.mrp || 0),
          tradeRate: line.tradeRate,
          purchaseRate: line.purchaseRate,
          finalPurchaseRate: line.finalPurchaseRate,
          saleRate: Number(it.saleRate || 0),
        })
        // eslint-disable-next-line no-await-in-loop
        await doc.save(session ? { session } : undefined)
        // eslint-disable-next-line no-continue
        continue
      }

      const existingUnits = Math.max(0, Number(stock.quantity || 0)) + Math.max(0, Number(stock.freeQuantity || 0))
      const existingFinalRate =
        typeof stock.finalPurchaseRate === 'number' && Number.isFinite(stock.finalPurchaseRate)
          ? Math.max(0, Number(stock.finalPurchaseRate))
          : existingUnits > 0
            ? (Math.max(0, Number(stock.purchaseRate || 0)) * Math.max(0, Number(stock.quantity || 0))) /
              existingUnits
            : 0
      const existingCost = existingFinalRate * existingUnits

      const combinedUnits = existingUnits + newUnits
      const combinedFinalRate = combinedUnits > 0 ? (existingCost + newCost) / combinedUnits : line.finalPurchaseRate

      stock.quantity = Math.max(0, Number(stock.quantity || 0)) + incQty
      stock.freeQuantity = Math.max(0, Number(stock.freeQuantity || 0)) + incFree
      stock.mrp = Number(it.mrp || 0)
      stock.tradeRate = line.tradeRate
      stock.purchaseRate = line.purchaseRate
      stock.finalPurchaseRate = combinedFinalRate
      stock.saleRate = Number(it.saleRate || 0)
      if (typeof it.rackLocation === 'string' && it.rackLocation.trim()) {
        stock.rackLocation = it.rackLocation.trim()
      }
      // eslint-disable-next-line no-await-in-loop
      await stock.save(session ? { session } : undefined)
    }

    const updatedPurchase = await Purchase.findOne(
      { _id: purchaseId, pharmacyId },
      null,
      session ? { session } : undefined,
    ).lean()

    return { ok: true, item: updatedPurchase }
  })
}
