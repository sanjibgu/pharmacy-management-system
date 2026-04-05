import { Supplier } from '../models/Supplier.js'
import { Purchase } from '../models/Purchase.js'

function isDuplicateKeyError(err) {
  if (!err || typeof err !== 'object') return false
  if (err.code === 11000) return true
  if (err.errorResponse && err.errorResponse.code === 11000) return true
  if (err.cause && err.cause.code === 11000) return true
  return false
}

export async function listSuppliers(req, res) {
  const pharmacyId = req.pharmacyId
  const includeInactive =
    String(req.query.includeInactive || '') === '1' ||
    String(req.query.includeInactive || '').toLowerCase() === 'true'

  const query = { pharmacyId, ...(includeInactive ? {} : { isActive: { $ne: false } }) }
  const items = await Supplier.find(query).sort({ supplierName: 1 }).lean()
  res.json({ items })
}

export async function createSupplier(req, res) {
  const pharmacyId = req.pharmacyId
  const body = req.validatedBody || {}
  const dlNumber = (body.dlNumber || body.dlNo || body.dl_number || '').toString().trim()

  try {
    if (dlNumber) {
      const existingDl = await Supplier.findOne({ pharmacyId, dlNumber })
        .collation({ locale: 'en', strength: 2 })
        .lean()
      if (existingDl) {
        return res.status(409).json({ error: 'DL No already available.' })
      }
    }

    const supplier = await Supplier.create({
      ...body,
      // Ensure DL number persists even if client uses a different key.
      ...(dlNumber ? { dlNumber } : {}),
      pharmacyId,
    })
    res.status(201).json({ item: supplier })
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return res.status(409).json({ error: 'Distributor already available.' })
    }
    throw err
  }
}

export async function updateSupplier(req, res) {
  const pharmacyId = req.pharmacyId
  const body = req.validatedBody || {}
  const dlNumber = (body.dlNumber || body.dlNo || body.dl_number || '').toString().trim()

  const update = {
    ...body,
    ...(dlNumber ? { dlNumber } : {}),
  }
  delete update.dlNo
  delete update.dl_number

  let item
  try {
    if (dlNumber) {
      const existingDl = await Supplier.findOne({
        pharmacyId,
        dlNumber,
        _id: { $ne: req.params.id },
      })
        .collation({ locale: 'en', strength: 2 })
        .lean()
      if (existingDl) {
        return res.status(409).json({ error: 'DL No already available.' })
      }
    }

    item = await Supplier.findOneAndUpdate(
      { _id: req.params.id, pharmacyId },
      { $set: update },
      { new: true, runValidators: true },
    ).lean()
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return res.status(409).json({ error: 'Distributor already available.' })
    }
    throw err
  }

  if (!item) return res.status(404).json({ error: 'Distributor not found' })
  res.json({ item })
}

export async function toggleSupplierActive(req, res) {
  const pharmacyId = req.pharmacyId
  const supplierId = req.params.id
  const isActive = Boolean(req.validatedBody.isActive)

  const item = await Supplier.findOneAndUpdate(
    { _id: supplierId, pharmacyId },
    { $set: { isActive } },
    { new: true },
  ).lean()

  if (!item) return res.status(404).json({ error: 'Distributor not found' })
  res.json({ item })
}

export async function deleteSupplier(req, res) {
  const pharmacyId = req.pharmacyId
  const supplierId = req.params.id

  const usage = await Purchase.countDocuments({ pharmacyId, supplierId })
  if (usage > 0) {
    return res.status(409).json({
      error: 'Cannot delete distributor: already used in purchases.',
    })
  }

  const out = await Supplier.deleteOne({ _id: supplierId, pharmacyId })
  if (!out.deletedCount) return res.status(404).json({ error: 'Distributor not found' })
  res.json({ ok: true })
}
