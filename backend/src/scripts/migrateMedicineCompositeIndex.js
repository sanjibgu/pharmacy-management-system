import mongoose from 'mongoose'
import { env } from '../config/env.js'

async function main() {
  await mongoose.connect(env.mongoUri)
  const col = mongoose.connection.collection('medicines')

  const indexes = await col.indexes()
  const toDrop = [
    'pharmacyId_1_medicineName_1_manufacturer_1_dosageForm_1_strength_1',
    'pharmacyId_1_medicineName_1_manufacturer_1_dosageForm_1_strength_1_isDeleted_1',
    'pharmacyId_1_medicineName_1_manufacturer_1_category_1',
  ]

  for (const name of toDrop) {
    if (indexes.some((i) => i.name === name)) {
      // eslint-disable-next-line no-console
      console.log(`Dropping index: ${name}`)
      // eslint-disable-next-line no-await-in-loop
      await col.dropIndex(name)
    }
  }

  const targetName = 'uniq_medicine_pharmacy_name_manufacturer_category'
  if (!indexes.some((i) => i.name === targetName)) {
    // eslint-disable-next-line no-console
    console.log(`Creating index: ${targetName}`)
    // Ensure legacy docs have isDeleted so partial index behaves as expected.
    await col.updateMany({ isDeleted: { $exists: false } }, { $set: { isDeleted: false } })
    await col.createIndex(
      { pharmacyId: 1, medicineName: 1, manufacturer: 1, category: 1 },
      {
        name: targetName,
        unique: true,
        partialFilterExpression: { isDeleted: false },
        collation: { locale: 'en', strength: 2 },
      },
    )
  } else {
    // eslint-disable-next-line no-console
    console.log(`Index already exists: ${targetName}`)
  }

  await mongoose.disconnect()
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})
