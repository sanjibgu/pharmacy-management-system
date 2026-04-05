import mongoose from 'mongoose'
import { env } from '../config/env.js'

async function main() {
  await mongoose.connect(env.mongoUri)
  const col = mongoose.connection.collection('categories')

  const indexes = await col.indexes()

  // Legacy index created by `unique: true` on schema path.
  const legacy = 'nameLower_1'
  if (indexes.some((i) => i.name === legacy)) {
    // eslint-disable-next-line no-console
    console.log(`Dropping index: ${legacy}`)
    await col.dropIndex(legacy)
  }

  const targetName = 'uniq_category_nameLower_active'
  if (!indexes.some((i) => i.name === targetName)) {
    // eslint-disable-next-line no-console
    console.log(`Creating index: ${targetName}`)
    // Ensure legacy docs have isDeleted so partial index behaves as expected.
    await col.updateMany({ isDeleted: { $exists: false } }, { $set: { isDeleted: false } })
    await col.createIndex(
      { nameLower: 1 },
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

