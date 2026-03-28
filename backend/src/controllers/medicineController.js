import { Medicine } from '../models/Medicine.js'
import { PurchaseItem } from '../models/PurchaseItem.js'
import { Stock } from '../models/Stock.js'

function isDuplicateKeyError(err) {
  if (!err || typeof err !== 'object') return false
  // MongoServerError / Mongoose duplicate key errors typically expose code 11000
  if (err.code === 11000) return true
  if (err.errorResponse && err.errorResponse.code === 11000) return true
  if (err.cause && err.cause.code === 11000) return true
  return false
}

export async function listMedicines(req, res) {
  const pharmacyId = req.user.pharmacyId
  const items = await Medicine.find({ pharmacyId, isDeleted: { $ne: true } })
    .sort({ createdAt: -1 })
    .lean()
  res.json({ items })
}

export async function createMedicine(req, res) {
  const pharmacyId = req.user.pharmacyId
  try {
    const medicine = await Medicine.create({ ...req.validatedBody, pharmacyId })
    res.status(201).json({ item: medicine })
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return res.status(409).json({ error: 'Medicine already available.' })
    }
    throw err
  }
}

export async function getMedicine(req, res) {
  const pharmacyId = req.user.pharmacyId
  const item = await Medicine.findOne({ _id: req.params.id, pharmacyId }).lean()
  if (!item) return res.status(404).json({ error: 'Medicine not found' })
  res.json({ item })
}

export async function updateMedicine(req, res) {
  const pharmacyId = req.user.pharmacyId
  let item
  try {
    item = await Medicine.findOneAndUpdate(
      { _id: req.params.id, pharmacyId },
      { $set: req.validatedBody },
      { new: true, runValidators: true },
    ).lean()
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return res.status(409).json({ error: 'Medicine already available.' })
    }
    throw err
  }
  if (!item) return res.status(404).json({ error: 'Medicine not found' })

  const cascade =
    String(req.query.cascade || '').toLowerCase() === 'true' ||
    String(req.query.cascade || '').toLowerCase() === '1'

  if (cascade) {
    await PurchaseItem.updateMany(
      { pharmacyId, medicineId: item._id },
      {
        $set: {
          hsnCode: item.hsnCode || '',
          gstPercent: Number(item.gstPercent || 0),
        },
      },
    )
  }

  res.json({ item })
}

export async function deleteMedicine(req, res) {
  const pharmacyId = req.user.pharmacyId
  const item = await Medicine.findOneAndUpdate(
    { _id: req.params.id, pharmacyId },
    { $set: { isDeleted: true, deletedAt: new Date() } },
    { new: true },
  ).lean()
  if (!item) return res.status(404).json({ error: 'Medicine not found' })
  res.json({ ok: true })
}

export async function searchMedicines(req, res) {
  const pharmacyId = req.user.pharmacyId
  const q = String(req.query.q || '').trim()
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)))

  // For UI autocomplete: when query is empty, return a small "recent medicines" list.
  if (!q) {
    const items = await Medicine.find({ pharmacyId, isDeleted: { $ne: true } })
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(limit)
      .lean()

    return res.json({ items })
  }

  const items = await Medicine.find({
    pharmacyId,
    isDeleted: { $ne: true },
    medicineName: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
  })
    .sort({ medicineName: 1 })
    .limit(limit)
    .lean()

  res.json({ items })
}

export async function getMedicineUsage(req, res) {
  const pharmacyId = req.user.pharmacyId
  const medicineId = req.params.id

  const [purchaseItems, stockBatches] = await Promise.all([
    PurchaseItem.countDocuments({ pharmacyId, medicineId }),
    Stock.countDocuments({ pharmacyId, medicineId }),
  ])

  res.json({ purchaseItems, stockBatches })
}
