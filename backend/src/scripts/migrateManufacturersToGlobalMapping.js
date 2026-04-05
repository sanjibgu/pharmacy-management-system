import mongoose from 'mongoose'
import { env } from '../config/env.js'
import { PharmacyManufacturer } from '../models/PharmacyManufacturer.js'
import { PharmacyGlobalManufacturerSetting } from '../models/PharmacyGlobalManufacturerSetting.js'

async function main() {
  const apply = process.argv.includes('--apply')
  await mongoose.connect(env.mongoUri)

  const seeded = await PharmacyManufacturer.find({
    isDeleted: { $ne: true },
    globalManufacturerId: { $ne: null },
  })
    .setOptions({ skipTenantCheck: true })
    .select({ _id: 1, pharmacyId: 1, globalManufacturerId: 1, isActive: 1 })
    .lean()

  if (!seeded.length) {
    // eslint-disable-next-line no-console
    console.log('No seeded tenant manufacturers found.')
    await mongoose.disconnect()
    return
  }

  // If a pharmacy had locally deactivated a seeded global manufacturer, preserve that preference as isEnabled=false.
  const settingOps = []
  const deleteOps = []

  for (const m of seeded) {
    const isEnabled = m.isActive === false ? false : true
    settingOps.push({
      updateOne: {
        filter: { pharmacyId: m.pharmacyId, globalManufacturerId: m.globalManufacturerId, isDeleted: { $ne: true } },
        update: { $set: { isEnabled } },
        upsert: true,
      },
    })
    deleteOps.push({
      updateOne: {
        filter: { _id: m._id },
        update: { $set: { isDeleted: true, isActive: false } },
      },
    })
  }

  // eslint-disable-next-line no-console
  console.log({
    mode: apply ? 'APPLY' : 'DRY_RUN',
    seededRows: seeded.length,
    settingsUpserts: settingOps.length,
    softDeletes: deleteOps.length,
  })

  if (!apply) {
    // eslint-disable-next-line no-console
    console.log("Dry run only. Re-run with '--apply' to write settings and soft-delete seeded copies.")
    await mongoose.disconnect()
    return
  }

  // Apply in chunks
  const chunk = 500
  for (let i = 0; i < settingOps.length; i += chunk) {
    // eslint-disable-next-line no-await-in-loop
    await PharmacyGlobalManufacturerSetting.collection.bulkWrite(settingOps.slice(i, i + chunk), { ordered: false })
  }
  for (let i = 0; i < deleteOps.length; i += chunk) {
    // eslint-disable-next-line no-await-in-loop
    await PharmacyManufacturer.collection.bulkWrite(deleteOps.slice(i, i + chunk), { ordered: false })
  }

  // eslint-disable-next-line no-console
  console.log('Migration completed.')
  await mongoose.disconnect()
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})

