import mongoose from 'mongoose'
import { createSaleInvoice, deleteSaleInvoice, listSaleBatches, updateSaleInvoice } from '../services/saleService.js'
import { Sale } from '../models/Sale.js'
import { SaleItem } from '../models/SaleItem.js'
import { Medicine } from '../models/Medicine.js'

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

  const itemsRaw = await SaleItem.find({ saleId, pharmacyId }).lean()

  const medIds = Array.from(new Set(itemsRaw.map((it) => String(it.medicineId || '')).filter(Boolean)))
  const meds = medIds.length
    ? await Medicine.find({ pharmacyId, _id: { $in: medIds }, isDeleted: { $ne: true } })
        .select('medicineName manufacturer category dosageForm allowLooseSale unitsPerStrip rackLocation')
        .lean()
    : []
  const medById = new Map(meds.map((m) => [String(m._id), m]))

  const items = itemsRaw.map((it) => {
    const m = medById.get(String(it.medicineId || ''))
    return {
      ...it,
      medicine: m
        ? {
            _id: m._id,
            medicineName: m.medicineName,
            manufacturer: m.manufacturer || '',
            category: m.category || m.dosageForm || '',
            allowLooseSale: Boolean(m.allowLooseSale),
            unitsPerStrip: Math.max(1, Number(m.unitsPerStrip || 1)),
            rackLocation: m.rackLocation || '',
          }
        : null,
    }
  })

  res.json({ sale, items })
}

export async function deleteSale(req, res) {
  const pharmacyId = req.pharmacyId
  const saleId = req.params.id

  const result = await deleteSaleInvoice({ pharmacyId, saleId })
  if (!result.ok) return res.status(409).json({ error: result.reason })
  res.json({ ok: true })
}

export async function updateSaleHeader(req, res) {
  const pharmacyId = req.pharmacyId
  const saleId = req.params.id
  const body = req.validatedBody || {}

  const sale = await Sale.findOne({ _id: saleId, pharmacyId }).lean()
  if (!sale) return res.status(404).json({ error: 'Sale not found' })

  const nextPaid =
    typeof body.paidAmount === 'number'
      ? Math.max(0, Math.min(Number(body.paidAmount || 0), Number(sale.netAmount || 0)))
      : Number(sale.paidAmount || 0)

  const nextReturn =
    typeof body.paidAmount === 'number' ? Math.max(0, Number(sale.paidAmount || 0) - nextPaid) : Number(sale.returnAmount || 0)

  const update = {
    ...(body.saleDate ? { saleDate: body.saleDate } : {}),
    ...(body.paymentType ? { paymentType: body.paymentType } : {}),
    ...(typeof body.paidAmount === 'number' ? { paidAmount: nextPaid } : {}),
    ...(typeof body.paidAmount === 'number' ? { returnAmount: nextReturn } : {}),
    balanceAmount: Math.max(0, Number(sale.netAmount || 0) - nextPaid),
    ...(Object.prototype.hasOwnProperty.call(body, 'patientName') ? { patientName: body.patientName || '' } : {}),
    ...(Object.prototype.hasOwnProperty.call(body, 'phone') ? { phone: body.phone || '' } : {}),
    ...(Object.prototype.hasOwnProperty.call(body, 'doctorName') ? { doctorName: body.doctorName || '' } : {}),
    ...(Object.prototype.hasOwnProperty.call(body, 'remarks') ? { remarks: body.remarks || '' } : {}),
  }

  const item = await Sale.findOneAndUpdate({ _id: saleId, pharmacyId }, { $set: update }, { new: true }).lean()
  res.json({ item })
}

export async function updateSaleItems(req, res) {
  const pharmacyId = req.pharmacyId
  const saleId = req.params.id
  const updatedBy = req.user._id
  const { header, items } = req.validatedBody

  const result = await updateSaleInvoice({ pharmacyId, saleId, updatedBy, header, items })
  if (!result.ok) return res.status(409).json({ error: result.reason })

  const sale = await Sale.findOne({ _id: saleId, pharmacyId }).lean()
  const itemsRaw = await SaleItem.find({ saleId, pharmacyId }).lean()

  const medIds = Array.from(new Set(itemsRaw.map((it) => String(it.medicineId || '')).filter(Boolean)))
  const meds = medIds.length
    ? await Medicine.find({ pharmacyId, _id: { $in: medIds }, isDeleted: { $ne: true } })
        .select('medicineName manufacturer category dosageForm allowLooseSale unitsPerStrip rackLocation')
        .lean()
    : []
  const medById = new Map(meds.map((m) => [String(m._id), m]))

  const saleItems = itemsRaw.map((it) => {
    const m = medById.get(String(it.medicineId || ''))
    return {
      ...it,
      medicine: m
        ? {
            _id: m._id,
            medicineName: m.medicineName,
            manufacturer: m.manufacturer || '',
            category: m.category || m.dosageForm || '',
            allowLooseSale: Boolean(m.allowLooseSale),
            unitsPerStrip: Math.max(1, Number(m.unitsPerStrip || 1)),
            rackLocation: m.rackLocation || '',
          }
        : null,
    }
  })

  res.json({ sale, items: saleItems })
}
