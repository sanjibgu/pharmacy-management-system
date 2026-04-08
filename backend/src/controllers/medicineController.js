import mongoose from 'mongoose'
import { Medicine } from '../models/Medicine.js'
import { PurchaseItem } from '../models/PurchaseItem.js'
import { Stock } from '../models/Stock.js'
import {
  coerceCustomFieldsForCategory,
  getLooseSaleAllowedForCategory,
  getUniqueFieldsForCategory,
} from '../services/customFieldsService.js'
import { GlobalItem } from '../models/GlobalItem.js'
import { ApprovalRequest } from '../models/ApprovalRequest.js'
import { makeItemKey } from '../services/normalizeService.js'
import { PharmacyGlobalItemSetting } from '../models/PharmacyGlobalItemSetting.js'

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
  const includeInactive =
    String(req.query.includeInactive || '') === '1' ||
    String(req.query.includeInactive || '').toLowerCase() === 'true'

  // Management list should include inactive items so pharmacy can activate/deactivate.
  const [localItems, settings] = await Promise.all([
    Medicine.find({ pharmacyId, isDeleted: { $ne: true } }).sort({ createdAt: -1 }).lean(),
    PharmacyGlobalItemSetting.find({ pharmacyId, isDeleted: { $ne: true } })
      .select({ globalItemId: 1, isEnabled: 1 })
      .lean(),
  ])

  const settingByGlobalId = new Map(settings.map((s) => [String(s.globalItemId), Boolean(s.isEnabled)]))

  const globals = await GlobalItem.find({ isDeleted: { $ne: true }, status: 'active' }).sort({ medicineName: 1 }).lean()
  const globalItems = globals
    .map((g) => {
      const enabled = settingByGlobalId.has(String(g._id)) ? settingByGlobalId.get(String(g._id)) : true
      return {
        _id: g._id,
        medicineName: g.medicineName,
        manufacturer: g.manufacturer,
        dosageForm: g.dosageForm || '',
        strength: g.strength || '',
        category: g.category,
        rackLocation: g.rackLocation || '',
        hsnCode: g.hsnCode || '',
        gstPercent: Number(g.gstPercent || 0),
        allowLooseSale: Boolean(g.allowLooseSale),
        unitsPerStrip: Number(g.unitsPerStrip || 1),
        customFields: g.customFields || {},
        variantKey: String(g.normalizedKey || '').trim(),
        isActive: enabled,
        source: 'global',
      }
    })
    .filter((g) => (includeInactive ? true : g.isActive !== false))

  const locals = localItems.map((m) => ({ ...m, source: 'local' }))

  // Merge with global catalog, but never collapse distinct tenant-local items.
  // Use variantKey (preferred) to avoid duplicates between local and global; fall back safely.
  const localKeySet = new Set()
  for (const m of locals) {
    const key =
      String(m.variantKey || '').trim() ||
      makeItemKey({ medicineName: m.medicineName, manufacturer: m.manufacturer, category: m.category })
    if (key) localKeySet.add(key)
  }

  const out = [...locals]
  const seenGlobal = new Set()
  for (const g of globalItems) {
    const gKey =
      String(g.variantKey || '').trim() ||
      makeItemKey({ medicineName: g.medicineName, manufacturer: g.manufacturer, category: g.category })
    if (!gKey) continue
    if (localKeySet.has(gKey)) continue
    if (seenGlobal.has(gKey)) continue
    seenGlobal.add(gKey)
    out.push(g)
  }

  res.json({ items: out })
}

export async function createMedicine(req, res) {
  const pharmacyId = req.user.pharmacyId
  try {
    const { customFields, category, ...rest } = req.validatedBody

    const coercedCustomFields = await coerceCustomFieldsForCategory(category, customFields)
    const uniqueFields = await getUniqueFieldsForCategory(category)

    const variantKey = makeItemKey({
      ...rest,
      category,
      customFields: coercedCustomFields,
      uniqueFields,
    })

    const globalExists = await GlobalItem.findOne({
      normalizedKey: variantKey,
      isDeleted: { $ne: true },
      status: 'active',
    }).lean()
    if (globalExists) {
      return res.status(409).json({
        error: 'This item is already available in the Global list. Please enable it in your pharmacy instead of creating a duplicate.',
        globalItemId: String(globalExists._id),
      })
    }

    const looseSaleAllowed = await getLooseSaleAllowedForCategory(category)
    const allowLooseSale = looseSaleAllowed ? Boolean(rest.allowLooseSale) : false

    const medicine = await Medicine.create({
      ...rest,
      allowLooseSale,
      category,
      customFields: coercedCustomFields,
      variantKey,
      globalItemId: null,
      isActive: true,
      pharmacyId,
    })

    try {
      await ApprovalRequest.create({
        entityType: 'item',
        normalizedKey: variantKey,
        requestedByPharmacyId: pharmacyId,
        requestedByUserId: req.user.id,
        localEntityId: medicine._id,
        payload: {
          medicineName: medicine.medicineName,
          manufacturer: medicine.manufacturer,
          dosageForm: medicine.dosageForm || '',
          strength: medicine.strength || '',
          unitsPerStrip: Number(medicine.unitsPerStrip || 0),
          category: medicine.category,
          rackLocation: medicine.rackLocation,
          hsnCode: medicine.hsnCode,
          gstPercent: medicine.gstPercent,
          allowLooseSale: medicine.allowLooseSale,
          customFields: medicine.customFields || {},
        },
        status: 'pending',
      })
    } catch {
      // Approval workflow is best-effort; do not block item creation.
    }

    res.status(201).json({ item: medicine })
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return res.status(409).json({ error: 'Medicine already available.' })
    }
    if (err instanceof Error) {
      return res.status(400).json({ error: err.message })
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
  const existing = await Medicine.findOne({ _id: req.params.id, pharmacyId }).lean()
  if (!existing) return res.status(404).json({ error: 'Medicine not found' })

  const nextCategory = String(req.validatedBody.category ?? existing.category ?? '')
  const categoryChanged = typeof req.validatedBody.category === 'string' && req.validatedBody.category !== existing.category

  if (Object.prototype.hasOwnProperty.call(req.validatedBody, 'customFields') || categoryChanged) {
    const incoming = Object.prototype.hasOwnProperty.call(req.validatedBody, 'customFields')
      ? req.validatedBody.customFields
      : {}
    try {
      req.validatedBody.customFields = await coerceCustomFieldsForCategory(nextCategory, incoming)
      req.validatedBody.category = nextCategory
    } catch (err) {
      if (err instanceof Error) return res.status(400).json({ error: err.message })
      throw err
    }
  }

  // Enforce category-level loose sale policy.
  if (Object.prototype.hasOwnProperty.call(req.validatedBody, 'allowLooseSale') || categoryChanged) {
    const looseSaleAllowed = await getLooseSaleAllowedForCategory(nextCategory)
    const incomingAllow = Object.prototype.hasOwnProperty.call(req.validatedBody, 'allowLooseSale')
      ? Boolean(req.validatedBody.allowLooseSale)
      : Boolean(existing.allowLooseSale)
    req.validatedBody.allowLooseSale = looseSaleAllowed ? incomingAllow : false
  }

  // Recompute variantKey whenever any relevant attributes change (or if it was missing).
  const affectsKey =
    !existing.variantKey ||
    Object.prototype.hasOwnProperty.call(req.validatedBody, 'medicineName') ||
    Object.prototype.hasOwnProperty.call(req.validatedBody, 'manufacturer') ||
    Object.prototype.hasOwnProperty.call(req.validatedBody, 'category') ||
    Object.prototype.hasOwnProperty.call(req.validatedBody, 'dosageForm') ||
    Object.prototype.hasOwnProperty.call(req.validatedBody, 'strength') ||
    Object.prototype.hasOwnProperty.call(req.validatedBody, 'unitsPerStrip') ||
    Object.prototype.hasOwnProperty.call(req.validatedBody, 'customFields')

  if (affectsKey) {
    const next = {
      medicineName: Object.prototype.hasOwnProperty.call(req.validatedBody, 'medicineName')
        ? req.validatedBody.medicineName
        : existing.medicineName,
      manufacturer: Object.prototype.hasOwnProperty.call(req.validatedBody, 'manufacturer')
        ? req.validatedBody.manufacturer
        : existing.manufacturer,
      dosageForm: Object.prototype.hasOwnProperty.call(req.validatedBody, 'dosageForm')
        ? req.validatedBody.dosageForm
        : existing.dosageForm,
      strength: Object.prototype.hasOwnProperty.call(req.validatedBody, 'strength')
        ? req.validatedBody.strength
        : existing.strength,
      unitsPerStrip: Object.prototype.hasOwnProperty.call(req.validatedBody, 'unitsPerStrip')
        ? req.validatedBody.unitsPerStrip
        : existing.unitsPerStrip,
      category: nextCategory,
      customFields: Object.prototype.hasOwnProperty.call(req.validatedBody, 'customFields')
        ? req.validatedBody.customFields
        : existing.customFields,
    }

    const uniqueFields = await getUniqueFieldsForCategory(nextCategory)
    const nextVariantKey = makeItemKey({ ...next, uniqueFields })

    // If updating a local-only item to match a Global item, block and ask user to enable global instead.
    const global = await GlobalItem.findOne({ normalizedKey: nextVariantKey, isDeleted: { $ne: true }, status: 'active' })
      .select({ _id: 1 })
      .lean()
    if (global && (!existing.globalItemId || String(existing.globalItemId) !== String(global._id))) {
      return res.status(409).json({
        error: 'This item is already available in the Global list. Please enable it in your pharmacy instead of creating a duplicate.',
        globalItemId: String(global._id),
      })
    }

    req.validatedBody.variantKey = nextVariantKey
  }

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
    if (err instanceof Error) {
      return res.status(400).json({ error: err.message })
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
  const category = String(req.query.category || '').trim()
  const manufacturer = String(req.query.manufacturer || '').trim()
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)))

  const categoryFilter = category
    ? { category: { $regex: `^${category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }
    : {}

  const manufacturerFilter = manufacturer
    ? {
        manufacturer: {
          $regex: `^${manufacturer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
          $options: 'i',
        },
      }
    : {}

  const base = {
    pharmacyId,
    isDeleted: { $ne: true },
    isActive: { $ne: false },
    ...categoryFilter,
    ...manufacturerFilter,
  }

  // Load global item enable/disable preferences once per request.
  const settings = await PharmacyGlobalItemSetting.find({ pharmacyId, isDeleted: { $ne: true } })
    .select({ globalItemId: 1, isEnabled: 1 })
    .lean()
  const settingByGlobalId = new Map(settings.map((s) => [String(s.globalItemId), Boolean(s.isEnabled)]))

  // For UI autocomplete: when query is empty, return a small "recent medicines" list.
  if (!q) {
    let query = Medicine.find(base)
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(limit)

    const items = await query.lean()

    return res.json({ items })
  }

  const localQuery = Medicine.find({
    ...base,
    medicineName: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
  })
    .sort({ medicineName: 1 })
    .limit(limit)

  const localItems = await localQuery.lean()

  // Also allow searching global catalog (enabled by default unless explicitly disabled).
  const globalQuery = {
    isDeleted: { $ne: true },
    status: 'active',
    ...categoryFilter,
    ...manufacturerFilter,
    medicineName: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
  }

  const globals = await GlobalItem.find(globalQuery).sort({ medicineName: 1 }).limit(limit).lean()

  // Ensure each matching global item has a tenant-local Medicine record (used by purchase/stock references).
  const ensured = []
  for (const g of globals) {
    const enabled = settingByGlobalId.has(String(g._id)) ? settingByGlobalId.get(String(g._id)) : true
    if (!enabled) continue

    const gKey = String(g.normalizedKey || '').trim()

    // eslint-disable-next-line no-await-in-loop
    let local = await Medicine.findOne({ pharmacyId, globalItemId: g._id, isDeleted: { $ne: true } }).lean()
    if (!local) {
      // Try to link an existing local item by variantKey before creating new.
      // eslint-disable-next-line no-await-in-loop
      const byKey = gKey
        ? await Medicine.findOne({ pharmacyId, isDeleted: { $ne: true }, variantKey: gKey })
            .collation({ locale: 'en', strength: 2 })
            .lean()
        : null

      if (byKey) {
        // eslint-disable-next-line no-await-in-loop
        local = await Medicine.findOneAndUpdate(
          { _id: byKey._id, pharmacyId },
          { $set: { globalItemId: g._id } },
          { new: true },
        ).lean()
      } else {
        // eslint-disable-next-line no-await-in-loop
        local = await Medicine.create({
          pharmacyId,
          medicineName: g.medicineName,
          manufacturer: g.manufacturer,
          dosageForm: g.dosageForm || '',
          strength: g.strength || '',
          category: g.category,
          rackLocation: g.rackLocation || '',
          hsnCode: g.hsnCode || '',
          gstPercent: Number(g.gstPercent || 0),
          allowLooseSale: Boolean(g.allowLooseSale),
          unitsPerStrip: Number(g.unitsPerStrip || 1),
          customFields: g.customFields || {},
          variantKey: gKey,
          globalItemId: g._id,
          isActive: true,
          isDeleted: false,
        })
        local = local.toObject ? local.toObject() : local
      }
    }
    ensured.push(local)
  }

  // Merge/dedupe by _id only (do not collapse item variants).
  const seen = new Set()
  const merged = []
  for (const m of [...localItems, ...ensured]) {
    const id = String(m?._id || '')
    if (!id) continue
    if (seen.has(id)) continue
    seen.add(id)
    merged.push(m)
  }

  res.json({ items: merged.slice(0, limit) })
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

export async function setGlobalItemEnabled(req, res) {
  const pharmacyId = req.user.pharmacyId
  const globalItemId = new mongoose.Types.ObjectId(req.params.id)

  const global = await GlobalItem.findOne({ _id: globalItemId, isDeleted: { $ne: true }, status: 'active' }).lean()
  if (!global) return res.status(404).json({ error: 'Global item not found' })

  const isEnabled = Boolean(req.validatedBody.isActive)

  await PharmacyGlobalItemSetting.findOneAndUpdate(
    { pharmacyId, globalItemId, isDeleted: { $ne: true } },
    { $set: { isEnabled } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  // If a tenant-local copy exists, keep its isActive in sync for operational modules.
  await Medicine.updateMany(
    { pharmacyId, globalItemId, isDeleted: { $ne: true } },
    { $set: { isActive: isEnabled } },
  )

  return res.json({
    item: {
      _id: global._id,
      medicineName: global.medicineName,
      manufacturer: global.manufacturer,
      category: global.category,
      rackLocation: global.rackLocation || '',
      hsnCode: global.hsnCode || '',
      gstPercent: Number(global.gstPercent || 0),
      allowLooseSale: Boolean(global.allowLooseSale),
      customFields: global.customFields || {},
      isActive: isEnabled,
      source: 'global',
    },
  })
}
