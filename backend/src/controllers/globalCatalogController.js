import mongoose from 'mongoose'
import { GlobalItem } from '../models/GlobalItem.js'
import { GlobalManufacturer } from '../models/GlobalManufacturer.js'
import { Medicine } from '../models/Medicine.js'
import { PharmacyManufacturer } from '../models/PharmacyManufacturer.js'
import { PharmacyGlobalManufacturerSetting } from '../models/PharmacyGlobalManufacturerSetting.js'
import { PharmacyGlobalItemSetting } from '../models/PharmacyGlobalItemSetting.js'

function escRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function suggestGlobalItems(req, res) {
  const q = String(req.query.q || '').trim()
  const category = String(req.query.category || '').trim()
  const manufacturer = String(req.query.manufacturer || '').trim()
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)))

  const query = {
    isDeleted: { $ne: true },
    status: 'active',
    ...(category ? { category: { $regex: `^${escRegex(category)}$`, $options: 'i' } } : {}),
    ...(manufacturer ? { manufacturer: { $regex: `^${escRegex(manufacturer)}$`, $options: 'i' } } : {}),
    ...(q
      ? { medicineName: { $regex: escRegex(q), $options: 'i' } }
      : {}),
  }

  const items = await GlobalItem.find(query).sort({ medicineName: 1 }).limit(limit).lean()
  res.json({ items })
}

export async function enableGlobalItem(req, res) {
  const pharmacyId = req.user.pharmacyId
  const globalItemId = new mongoose.Types.ObjectId(req.params.id)

  const global = await GlobalItem.findOne({ _id: globalItemId, isDeleted: { $ne: true }, status: 'active' }).lean()
  if (!global) return res.status(404).json({ error: 'Global item not found' })

  // Global Master + Mapping: record enablement per pharmacy (no bulk seeding).
  await PharmacyGlobalItemSetting.findOneAndUpdate(
    { pharmacyId, globalItemId, isDeleted: { $ne: true } },
    { $set: { isEnabled: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  // If a tenant-local copy exists, activate it (operational modules reference Medicine _id).
  await Medicine.updateMany(
    { pharmacyId, globalItemId, isDeleted: { $ne: true } },
    { $set: { isActive: true } },
  )

  res.json({ ok: true })
}

export async function suggestGlobalManufacturers(req, res) {
  const q = String(req.query.q || '').trim()
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)))

  const query = {
    isDeleted: { $ne: true },
    status: 'active',
    ...(q ? { name: { $regex: escRegex(q), $options: 'i' } } : {}),
  }

  const items = await GlobalManufacturer.find(query).sort({ name: 1 }).limit(limit).lean()
  res.json({ items })
}

export async function enableGlobalManufacturer(req, res) {
  const pharmacyId = req.user.pharmacyId
  const globalManufacturerId = new mongoose.Types.ObjectId(req.params.id)

  const global = await GlobalManufacturer.findOne({
    _id: globalManufacturerId,
    isDeleted: { $ne: true },
    status: 'active',
  }).lean()
  if (!global) return res.status(404).json({ error: 'Global manufacturer not found' })

  // Global Master + Mapping: no tenant-local copies. Create/update a per-pharmacy setting only.
  const doc = await PharmacyGlobalManufacturerSetting.findOneAndUpdate(
    { pharmacyId, globalManufacturerId, isDeleted: { $ne: true } },
    { $set: { isEnabled: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean()

  res.json({
    item: {
      _id: global._id,
      name: global.name,
      categoryIds: global.categoryIds || [],
      isActive: Boolean(doc.isEnabled),
      source: 'global',
    },
  })
}
