import mongoose from 'mongoose'
import { Category } from '../models/Category.js'
import { PharmacyManufacturer } from '../models/PharmacyManufacturer.js'
import { GlobalManufacturer } from '../models/GlobalManufacturer.js'
import { ApprovalRequest } from '../models/ApprovalRequest.js'
import { makeManufacturerKey } from '../services/normalizeService.js'
import { PharmacyGlobalManufacturerSetting } from '../models/PharmacyGlobalManufacturerSetting.js'

function isDuplicateKeyError(err) {
  if (!err || typeof err !== 'object') return false
  if (err.code === 11000) return true
  if (err.errorResponse && err.errorResponse.code === 11000) return true
  if (err.cause && err.cause.code === 11000) return true
  return false
}

function uniqueObjectIds(values) {
  const out = []
  const seen = new Set()
  for (const v of values || []) {
    const s = v.toString()
    if (seen.has(s)) continue
    seen.add(s)
    out.push(v)
  }
  return out
}

async function resolveCategoryIds(rawIds) {
  const ids = (rawIds || [])
    .filter(Boolean)
    .map((id) => {
      try {
        return new mongoose.Types.ObjectId(id)
      } catch {
        return null
      }
    })
    .filter(Boolean)

  const unique = uniqueObjectIds(ids)
  if (unique.length === 0) return []

  const found = await Category.find({ _id: { $in: unique }, isDeleted: { $ne: true } })
    .select({ _id: 1 })
    .lean()

  const foundSet = new Set(found.map((c) => c._id.toString()))
  const missing = unique.filter((id) => !foundSet.has(id.toString()))
  if (missing.length) throw new Error('Invalid category selected')

  return unique
}

export async function listManufacturers(req, res) {
  const pharmacyId = req.user.pharmacyId
  const includeInactive =
    String(req.query.includeInactive || '') === '1' ||
    String(req.query.includeInactive || '').toLowerCase() === 'true'

  let categoryFilter = null
  if (req.query.categoryId) {
    try {
      categoryFilter = new mongoose.Types.ObjectId(String(req.query.categoryId))
    } catch {
      return res.status(400).json({ error: 'Invalid categoryId' })
    }
  }

  const query = {
    pharmacyId,
    isDeleted: { $ne: true },
    ...(includeInactive ? {} : { isActive: { $ne: false } }),
  }
  if (categoryFilter) query.categoryIds = categoryFilter

  const [localItems, settings] = await Promise.all([
    PharmacyManufacturer.find(query).sort({ nameLower: 1 }).lean(),
    PharmacyGlobalManufacturerSetting.find({ pharmacyId, isDeleted: { $ne: true } })
      .select({ globalManufacturerId: 1, isEnabled: 1 })
      .lean(),
  ])

  const settingByGlobalId = new Map(settings.map((s) => [String(s.globalManufacturerId), Boolean(s.isEnabled)]))

  // Global manufacturers are visible by default (no seeding rows). Pharmacies can disable via settings.
  const globalQuery = {
    isDeleted: { $ne: true },
    status: 'active',
    ...(categoryFilter ? { categoryIds: categoryFilter } : {}),
  }
  const globalManufacturers = await GlobalManufacturer.find(globalQuery).sort({ name: 1 }).lean()

  const globalItems = globalManufacturers
    .map((g) => {
      const enabled = settingByGlobalId.has(String(g._id)) ? settingByGlobalId.get(String(g._id)) : true
      return {
        _id: g._id,
        name: g.name,
        categoryIds: g.categoryIds || [],
        isActive: enabled,
        source: 'global',
      }
    })
    .filter((g) => (includeInactive ? true : g.isActive !== false))

  const locals = localItems.map((m) => ({
    ...m,
    source: 'local',
  }))

  // Dedupe by name (case/space insensitive) within the same pharmacy: prefer local entry.
  const seen = new Set()
  const items = []
  for (const m of [...locals, ...globalItems]) {
    const key = String(m.name || '').trim().replace(/\s+/g, ' ').toLowerCase()
    if (!key) continue
    if (seen.has(key)) continue
    seen.add(key)
    items.push(m)
  }

  res.json({ items })
}

export async function setGlobalManufacturerEnabled(req, res) {
  const pharmacyId = req.user.pharmacyId
  const globalManufacturerId = new mongoose.Types.ObjectId(req.params.id)

  const global = await GlobalManufacturer.findOne({
    _id: globalManufacturerId,
    isDeleted: { $ne: true },
    status: 'active',
  }).lean()
  if (!global) return res.status(404).json({ error: 'Global manufacturer not found' })

  const isEnabled = Boolean(req.validatedBody.isActive)

  const doc = await PharmacyGlobalManufacturerSetting.findOneAndUpdate(
    { pharmacyId, globalManufacturerId, isDeleted: { $ne: true } },
    { $set: { isEnabled } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean()

  return res.json({
    item: {
      _id: global._id,
      name: global.name,
      categoryIds: global.categoryIds || [],
      isActive: Boolean(doc.isEnabled),
      source: 'global',
    },
  })
}

export async function createManufacturer(req, res) {
  const pharmacyId = req.user.pharmacyId
  const name = (req.validatedBody.name || '').toString().trim()
  if (!name) return res.status(400).json({ error: 'Manufacturer name is required' })

  try {
    const normalizedKey = makeManufacturerKey({ name })
    const globalExists = await GlobalManufacturer.findOne({
      normalizedKey,
      isDeleted: { $ne: true },
      status: 'active',
    }).lean()
    if (globalExists) {
      return res.status(409).json({
        error:
          'This manufacturer is already available in the Global list. Please enable it in your pharmacy instead of creating a duplicate.',
        globalManufacturerId: String(globalExists._id),
      })
    }

    const categoryIds = await resolveCategoryIds(req.validatedBody.categoryIds)
    if (!categoryIds.length) return res.status(400).json({ error: 'Select at least one category' })
    const item = await PharmacyManufacturer.create({
      pharmacyId,
      name,
      categoryIds,
      globalManufacturerId: null,
      isActive: true,
      isDeleted: false,
    })

    try {
      await ApprovalRequest.create({
        entityType: 'manufacturer',
        normalizedKey,
        requestedByPharmacyId: pharmacyId,
        requestedByUserId: req.user.id,
        localEntityId: item._id,
        payload: { name: item.name, categoryIds: item.categoryIds || [] },
        status: 'pending',
      })
    } catch {
      // best-effort
    }

    return res.status(201).json({ item })
  } catch (err) {
    if (isDuplicateKeyError(err)) return res.status(409).json({ error: 'Manufacturer already exists' })
    if (err instanceof Error) return res.status(400).json({ error: err.message })
    throw err
  }
}

export async function updateManufacturer(req, res) {
  const pharmacyId = req.user.pharmacyId
  const id = req.params.id

  const existing = await PharmacyManufacturer.findOne({ _id: id, pharmacyId, isDeleted: { $ne: true } })
  if (!existing) return res.status(404).json({ error: 'Manufacturer not found' })

  const update = {}
  if (typeof req.validatedBody.name === 'string') update.name = req.validatedBody.name
  if (Object.prototype.hasOwnProperty.call(req.validatedBody, 'categoryIds')) {
    const nextCategoryIds = await resolveCategoryIds(req.validatedBody.categoryIds || [])
    if (!nextCategoryIds.length) return res.status(400).json({ error: 'Select at least one category' })
    update.categoryIds = nextCategoryIds
  }
  if (Object.prototype.hasOwnProperty.call(req.validatedBody, 'isActive')) {
    update.isActive = Boolean(req.validatedBody.isActive)
  }

  try {
    const item = await PharmacyManufacturer.findOneAndUpdate({ _id: id, pharmacyId }, { $set: update }, { new: true, runValidators: true }).lean()
    if (!item) return res.status(404).json({ error: 'Manufacturer not found' })
    return res.json({ item })
  } catch (err) {
    if (isDuplicateKeyError(err)) return res.status(409).json({ error: 'Manufacturer already exists' })
    if (err instanceof Error) return res.status(400).json({ error: err.message })
    throw err
  }
}

export async function deleteManufacturer(req, res) {
  const pharmacyId = req.user.pharmacyId
  const id = req.params.id
  const item = await PharmacyManufacturer.findOneAndUpdate(
    { _id: id, pharmacyId },
    { $set: { isDeleted: true } },
    { new: true },
  ).lean()
  if (!item) return res.status(404).json({ error: 'Manufacturer not found' })
  return res.json({ ok: true })
}
