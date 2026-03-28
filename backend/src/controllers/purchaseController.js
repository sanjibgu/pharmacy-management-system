import { Purchase } from '../models/Purchase.js'
import { PurchaseItem } from '../models/PurchaseItem.js'
import { createPurchaseInvoice, deletePurchaseInvoice } from '../services/purchaseService.js'

export async function createPurchase(req, res) {
  const pharmacyId = req.pharmacyId
  const createdBy = req.user.id
  const { header, items } = req.validatedBody

  const purchase = await createPurchaseInvoice({ pharmacyId, createdBy, header, items })
  res.status(201).json({ item: purchase })
}

export async function listPurchases(req, res) {
  const pharmacyId = req.pharmacyId
  const items = await Purchase.find({ pharmacyId }).sort({ createdAt: -1 }).lean()
  res.json({ items })
}

export async function getPurchaseDetails(req, res) {
  const pharmacyId = req.pharmacyId
  const purchase = await Purchase.findOne({ _id: req.params.id, pharmacyId }).lean()
  if (!purchase) return res.status(404).json({ error: 'Purchase not found' })

  const items = await PurchaseItem.find({ purchaseId: purchase._id, pharmacyId })
    .populate('medicineId', 'medicineName manufacturer category')
    .lean()

  res.json({ purchase, items })
}

export async function deletePurchase(req, res) {
  const pharmacyId = req.pharmacyId
  const purchaseId = req.params.id
  const result = await deletePurchaseInvoice({ pharmacyId, purchaseId })
  if (!result.ok) return res.status(409).json({ error: result.reason })
  res.json({ ok: true })
}

