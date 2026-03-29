import { Purchase } from '../models/Purchase.js'
import { PurchaseItem } from '../models/PurchaseItem.js'
import { Supplier } from '../models/Supplier.js'
import { Medicine } from '../models/Medicine.js'
import { createPurchaseInvoice, deletePurchaseInvoice, updatePurchaseInvoice } from '../services/purchaseService.js'

function isDuplicateKeyError(err) {
  if (!err || typeof err !== 'object') return false
  if (err.code === 11000) return true
  if (err.errorResponse && err.errorResponse.code === 11000) return true
  if (err.cause && err.cause.code === 11000) return true
  return false
}

export async function createPurchase(req, res) {
  const pharmacyId = req.pharmacyId
  const createdBy = req.user.id
  const { header, items } = req.validatedBody

  const purchase = await createPurchaseInvoice({ pharmacyId, createdBy, header, items })
  res.status(201).json({ item: purchase })
}

export async function listPurchases(req, res) {
  const pharmacyId = req.pharmacyId
  const purchases = await Purchase.find({ pharmacyId }).sort({ createdAt: -1 }).lean()

  const supplierIds = Array.from(
    new Set(purchases.map((p) => String(p.supplierId || '')).filter(Boolean)),
  )

  const suppliers = supplierIds.length
    ? await Supplier.find({ pharmacyId, _id: { $in: supplierIds } })
        .select('supplierName')
        .lean()
    : []

  const supplierById = new Map(suppliers.map((s) => [String(s._id), s]))

  const items = purchases.map((p) => {
    const sup = supplierById.get(String(p.supplierId || ''))
    return {
      ...p,
      supplierId: sup ? { _id: sup._id, supplierName: sup.supplierName } : p.supplierId,
    }
  })

  res.json({ items })
}

export async function getPurchaseDetails(req, res) {
  const pharmacyId = req.pharmacyId
  const purchase = await Purchase.findOne({ _id: req.params.id, pharmacyId }).lean()
  if (!purchase) return res.status(404).json({ error: 'Purchase not found' })

  const itemsRaw = await PurchaseItem.find({ purchaseId: purchase._id, pharmacyId }).lean()

  const medIds = Array.from(
    new Set(itemsRaw.map((it) => String(it.medicineId || '')).filter(Boolean)),
  )
  const meds = medIds.length
    ? await Medicine.find({ pharmacyId, _id: { $in: medIds } }).select('medicineName').lean()
    : []
  const medById = new Map(meds.map((m) => [String(m._id), m]))

  const items = itemsRaw.map((it) => {
    const m = medById.get(String(it.medicineId || ''))
    return {
      ...it,
      medicineId: m ? { _id: m._id, medicineName: m.medicineName } : it.medicineId,
    }
  })

  res.json({ purchase, items })
}

export async function deletePurchase(req, res) {
  const pharmacyId = req.pharmacyId
  const purchaseId = req.params.id
  const result = await deletePurchaseInvoice({ pharmacyId, purchaseId })
  if (!result.ok) return res.status(409).json({ error: result.reason })
  res.json({ ok: true })
}

export async function updatePurchaseHeader(req, res) {
  const pharmacyId = req.pharmacyId
  const purchaseId = req.params.id
  const body = req.validatedBody || {}

  const purchase = await Purchase.findOne({ _id: purchaseId, pharmacyId }).lean()
  if (!purchase) return res.status(404).json({ error: 'Purchase not found' })

  const nextPaid =
    typeof body.paidAmount === 'number'
      ? Math.max(0, Math.min(Number(body.paidAmount || 0), Number(purchase.netAmount || 0)))
      : Number(purchase.paidAmount || 0)

  const update = {
    ...(body.supplierId ? { supplierId: body.supplierId } : {}),
    ...(body.invoiceNumber ? { invoiceNumber: body.invoiceNumber } : {}),
    ...(body.invoiceDate ? { invoiceDate: body.invoiceDate } : {}),
    ...(body.purchaseDate ? { purchaseDate: body.purchaseDate } : {}),
    ...(body.paymentType ? { paymentType: body.paymentType } : {}),
    ...(Object.prototype.hasOwnProperty.call(body, 'dueDate') ? { dueDate: body.dueDate } : {}),
    ...(Object.prototype.hasOwnProperty.call(body, 'remarks') ? { remarks: body.remarks } : {}),
    ...(typeof body.paidAmount === 'number' ? { paidAmount: nextPaid } : {}),
    balanceAmount: Math.max(0, Number(purchase.netAmount || 0) - nextPaid),
  }

  let item
  try {
    item = await Purchase.findOneAndUpdate(
      { _id: purchaseId, pharmacyId },
      { $set: update },
      { new: true, runValidators: true },
    ).lean()
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return res.status(409).json({ error: 'Invoice number already exists.' })
    }
    throw err
  }

  const supplier = await Supplier.findOne({ pharmacyId, _id: item.supplierId })
    .select('supplierName')
    .lean()

  res.json({
    item: {
      ...item,
      supplierId: supplier ? { _id: supplier._id, supplierName: supplier.supplierName } : item.supplierId,
    },
  })
}

export async function updatePurchaseItems(req, res) {
  const pharmacyId = req.pharmacyId
  const purchaseId = req.params.id
  const updatedBy = req.user.id
  const { header, items } = req.validatedBody

  const result = await updatePurchaseInvoice({ pharmacyId, purchaseId, updatedBy, header, items })
  if (!result.ok) return res.status(409).json({ error: result.reason })

  const purchase = await Purchase.findOne({ _id: purchaseId, pharmacyId }).lean()
  const itemsRaw = await PurchaseItem.find({ purchaseId, pharmacyId }).lean()

  const medIds = Array.from(new Set(itemsRaw.map((it) => String(it.medicineId || '')).filter(Boolean)))
  const meds = medIds.length
    ? await Medicine.find({ pharmacyId, _id: { $in: medIds } }).select('medicineName').lean()
    : []
  const medById = new Map(meds.map((m) => [String(m._id), m]))

  const itemsOut = itemsRaw.map((it) => {
    const m = medById.get(String(it.medicineId || ''))
    return {
      ...it,
      medicineId: m ? { _id: m._id, medicineName: m.medicineName } : it.medicineId,
    }
  })

  res.json({ purchase, items: itemsOut })
}
