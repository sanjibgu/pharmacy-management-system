import mongoose from 'mongoose'
import { createSaleInvoice, listSaleBatches } from '../services/saleService.js'
import { Sale } from '../models/Sale.js'
import { SaleItem } from '../models/SaleItem.js'

export async function getSaleBatches(req, res) {
  const pharmacyId = req.pharmacyId
  const medicineId = req.params.medicineId

  const result = await listSaleBatches({ pharmacyId, medicineId })
  if (!result.ok) return res.status(404).json({ error: result.reason })
  res.json({ items: result.items })
}

export async function createSale(req, res) {
  const pharmacyId = req.pharmacyId
  const createdBy = req.user._id

  const { header, items } = req.validatedBody

  const out = await createSaleInvoice({
    pharmacyId,
    createdBy,
    header,
    items,
  })

  res.status(201).json({ sale: out.sale })
}

export async function listSales(req, res) {
  const pharmacyId = req.pharmacyId
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)))

  const items = await Sale.find({ pharmacyId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()

  res.json({ items })
}

export async function getSaleDetails(req, res) {
  const pharmacyId = req.pharmacyId
  const saleId = new mongoose.Types.ObjectId(req.params.id)

  const sale = await Sale.findOne({ _id: saleId, pharmacyId }).lean()
  if (!sale) return res.status(404).json({ error: 'Sale not found' })

  const items = await SaleItem.find({ saleId, pharmacyId }).lean()
  res.json({ sale, items })
}

