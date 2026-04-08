import mongoose from 'mongoose'
import { env } from '../config/env.js'
import { Category } from '../models/Category.js'
import { makeItemKey } from '../services/normalizeService.js'

async function main() {
  await mongoose.connect(env.mongoUri)

  const categories = await Category.find({ isDeleted: { $ne: true } })
    .select({ nameLower: 1, uniqueFields: 1 })
    .lean()
  const uniqueFieldsByCategoryLower = new Map(
    (categories || []).map((c) => [String(c.nameLower || '').toLowerCase(), Array.isArray(c.uniqueFields) ? c.uniqueFields : []]),
  )

  const medicinesCol = mongoose.connection.collection('medicines')
  const globalItemsCol = mongoose.connection.collection('globalitems')
  const globalKeyById = new Map()

  // Ensure legacy docs have isDeleted so partial index behaves as expected.
  await medicinesCol.updateMany({ isDeleted: { $exists: false } }, { $set: { isDeleted: false } })
  await globalItemsCol.updateMany({ isDeleted: { $exists: false } }, { $set: { isDeleted: false } })

  // Backfill / recompute GlobalItem.normalizedKey using category.uniqueFields.
  // Note: may skip updates that would violate unique index (duplicates).
  {
    const cursor = globalItemsCol
      .find({ isDeleted: { $ne: true } }, { projection: { normalizedKey: 1, medicineName: 1, manufacturer: 1, category: 1, dosageForm: 1, strength: 1, unitsPerStrip: 1, customFields: 1 } })
    const ops = []
    // eslint-disable-next-line no-await-in-loop
    while (await cursor.hasNext()) {
      // eslint-disable-next-line no-await-in-loop
      const g = await cursor.next()
      if (!g) break
      const categoryLower = String(g.category || '').trim().toLowerCase()
      const uniqueFields = uniqueFieldsByCategoryLower.get(categoryLower) || []
      const desired = makeItemKey({
        medicineName: g.medicineName,
        manufacturer: g.manufacturer,
        category: g.category,
        dosageForm: g.dosageForm || '',
        strength: g.strength || '',
        unitsPerStrip: Number(g.unitsPerStrip || 1),
        customFields: g.customFields || {},
        uniqueFields,
      })
      const current = String(g.normalizedKey || '').trim()
      if (desired && desired !== current) {
        ops.push({
          updateOne: {
            filter: { _id: g._id },
            update: {
              $set: {
                normalizedKey: desired,
                dosageForm: String(g.dosageForm || ''),
                strength: String(g.strength || ''),
                unitsPerStrip: Math.max(1, Number(g.unitsPerStrip || 1)),
              },
            },
          },
        })
      }
      // Record desired key for aligning tenant copies later.
      if (desired) globalKeyById.set(String(g._id), desired)
      if (ops.length >= 500) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await globalItemsCol.bulkWrite(ops, { ordered: false })
        } catch {
          // ignore duplicate errors; some keys may already exist
        }
        ops.length = 0
      }
    }
    if (ops.length) {
      try {
        await globalItemsCol.bulkWrite(ops, { ordered: false })
      } catch {
        // ignore duplicate errors
      }
    }
  }

  // Backfill / recompute Medicine.variantKey using category.uniqueFields.
  {
    const cursor = medicinesCol.find(
      { isDeleted: false },
      {
        projection: {
          variantKey: 1,
          medicineName: 1,
          manufacturer: 1,
          category: 1,
          dosageForm: 1,
          strength: 1,
          unitsPerStrip: 1,
          customFields: 1,
          globalItemId: 1,
        },
      },
    )

    const ops = []
    // eslint-disable-next-line no-await-in-loop
    while (await cursor.hasNext()) {
      // eslint-disable-next-line no-await-in-loop
      const m = await cursor.next()
      if (!m) break

      let desired = ''
      if (m.globalItemId) {
        // Keep tenant copy aligned with global key (important for dedupe/linking).
        desired = String(globalKeyById.get(String(m.globalItemId)) || '').trim()
      }

      if (!desired) {
        const categoryLower = String(m.category || '').trim().toLowerCase()
        const uniqueFields = uniqueFieldsByCategoryLower.get(categoryLower) || []
        desired = makeItemKey({
          medicineName: m.medicineName,
          manufacturer: m.manufacturer,
          category: m.category,
          dosageForm: m.dosageForm || '',
          strength: m.strength || '',
          unitsPerStrip: Number(m.unitsPerStrip || 1),
          customFields: m.customFields || {},
          uniqueFields,
        })
      }

      const current = String(m.variantKey || '').trim()
      if (desired && desired !== current) {
        ops.push({
          updateOne: {
            filter: { _id: m._id },
            update: { $set: { variantKey: desired } },
          },
        })
      }

      if (ops.length >= 500) {
        // eslint-disable-next-line no-await-in-loop
        await medicinesCol.bulkWrite(ops, { ordered: false })
        ops.length = 0
      }
    }
    if (ops.length) await medicinesCol.bulkWrite(ops, { ordered: false })
  }

  // Drop legacy unique indexes that would conflict.
  {
    const indexes = await medicinesCol.indexes()
    const toDrop = [
      'uniq_medicine_pharmacy_name_manufacturer_category',
      'pharmacyId_1_medicineName_1_manufacturer_1_dosageForm_1_strength_1',
      'pharmacyId_1_medicineName_1_manufacturer_1_dosageForm_1_strength_1_isDeleted_1',
      'pharmacyId_1_medicineName_1_manufacturer_1_category_1',
    ]

    for (const name of toDrop) {
      if (indexes.some((i) => i.name === name)) {
        // eslint-disable-next-line no-console
        console.log(`Dropping index: ${name}`)
        // eslint-disable-next-line no-await-in-loop
        await medicinesCol.dropIndex(name)
      }
    }

    const targetName = 'uniq_medicine_pharmacy_variantKey'
    if (!indexes.some((i) => i.name === targetName)) {
      // eslint-disable-next-line no-console
      console.log(`Creating index: ${targetName}`)
      await medicinesCol.createIndex(
        { pharmacyId: 1, variantKey: 1 },
        {
          name: targetName,
          unique: true,
          partialFilterExpression: { isDeleted: false, variantKey: { $type: 'string', $ne: '' } },
          collation: { locale: 'en', strength: 2 },
        },
      )
    } else {
      // eslint-disable-next-line no-console
      console.log(`Index already exists: ${targetName}`)
    }
  }

  await mongoose.disconnect()
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})
