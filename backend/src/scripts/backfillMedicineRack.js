import mongoose from 'mongoose'
import { env } from '../config/env.js'
import { connectDB } from '../config/db.js'
import { Medicine } from '../models/Medicine.js'

async function main() {
  await connectDB()

  const res = await Medicine.updateMany(
    {
      $or: [{ rackLocation: { $exists: false } }, { rackLocation: null }],
    },
    { $set: { rackLocation: '' } },
  )

  // eslint-disable-next-line no-console
  console.log(`Backfilled rackLocation on medicines. matched=${res.matchedCount} modified=${res.modifiedCount}`)
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      await mongoose.disconnect()
    } catch {
      // ignore
    }
  })

