import mongoose from 'mongoose'
import { env } from '../config/env.js'
import { connectDb } from '../config/db.js'
import { Supplier } from '../models/Supplier.js'

function exitWith(msg) {
  // eslint-disable-next-line no-console
  console.error(msg)
  process.exitCode = 1
}

await connectDb(env.mongoUri)

// Find duplicates (case-insensitive) within each pharmacy.
const duplicates = await Supplier.aggregate([
  { $match: { dlNumber: { $type: 'string', $ne: '' } } },
  {
    $project: {
      pharmacyId: 1,
      dlLower: { $toLower: '$dlNumber' },
      dlNumber: 1,
    },
  },
  {
    $group: {
      _id: { pharmacyId: '$pharmacyId', dlLower: '$dlLower' },
      count: { $sum: 1 },
      examples: { $push: { _id: '$_id', dlNumber: '$dlNumber' } },
    },
  },
  { $match: { count: { $gt: 1 } } },
  { $limit: 20 },
])

if (duplicates.length) {
  exitWith(
    `Cannot create unique DL No index: found duplicates.\n` +
      `Fix duplicates (edit/delete) and re-run.\n` +
      JSON.stringify(duplicates, null, 2),
  )
  await mongoose.disconnect()
  process.exit(1)
}

// Ensure index exists (also aligns name/collation/partial filter).
await Supplier.collection.createIndex(
  { pharmacyId: 1, dlNumber: 1 },
  {
    unique: true,
    name: 'uniq_supplier_pharmacy_dlNumber',
    collation: { locale: 'en', strength: 2 },
    partialFilterExpression: { dlNumber: { $type: 'string', $ne: '' } },
  },
)

// eslint-disable-next-line no-console
console.log('OK: unique DL No index created/verified (uniq_supplier_pharmacy_dlNumber).')

await mongoose.disconnect()

