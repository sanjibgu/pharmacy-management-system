import mongoose from 'mongoose'
import { env } from '../config/env.js'
import { Medicine } from '../models/Medicine.js'
import { PharmacyGlobalItemSetting } from '../models/PharmacyGlobalItemSetting.js'

async function main() {
  const apply = process.argv.includes('--apply')
  await mongoose.connect(env.mongoUri)

  const seeded = await Medicine.find({
    isDeleted: { $ne: true },
    globalItemId: { $ne: null },
  })
    .setOptions({ skipTenantCheck: true })
    .select({ _id: 1, pharmacyId: 1, globalItemId: 1, isActive: 1 })
    .lean()

  if (!seeded.length) {
    // eslint-disable-next-line no-console
    console.log('No seeded tenant items (medicines) found.')
    await mongoose.disconnect()
    return
  }

  const settingOps = []
  for (const m of seeded) {
    const isEnabled = m.isActive === false ? false : true
    settingOps.push({
      updateOne: {
        filter: { pharmacyId: m.pharmacyId, globalItemId: m.globalItemId, isDeleted: { $ne: true } },
        update: { $set: { isEnabled } },
        upsert: true,
      },
    })
  }

  // eslint-disable-next-line no-console
  console.log({
    mode: apply ? 'APPLY' : 'DRY_RUN',
    seededRows: seeded.length,
    settingsUpserts: settingOps.length,
  })

  if (!apply) {
    // eslint-disable-next-line no-console
    console.log("Dry run only. Re-run with '--apply' to write settings. (No deletes for items)")
    await mongoose.disconnect()
    return
  }

  const chunk = 500
  for (let i = 0; i < settingOps.length; i += chunk) {
    // eslint-disable-next-line no-await-in-loop
    await PharmacyGlobalItemSetting.collection.bulkWrite(settingOps.slice(i, i + chunk), { ordered: false })
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

