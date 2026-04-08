import mongoose from 'mongoose'
import { env } from '../config/env.js'

function parseArgs(argv) {
  const names = []
  for (const a of argv.slice(2)) {
    if (!a) continue
    if (a.startsWith('-')) continue
    names.push(a.trim())
  }
  return names.filter(Boolean)
}

async function main() {
  const names = parseArgs(process.argv)
  if (!names.length) {
    // eslint-disable-next-line no-console
    console.log('Usage: node src/scripts/dropMongoCollections.js <collection1> <collection2> ...')
    // eslint-disable-next-line no-console
    console.log('Safety: set CONFIRM_DROP=YES to actually drop.')
    process.exit(1)
  }

  const confirm = String(process.env.CONFIRM_DROP || '').trim().toUpperCase()
  const dryRun = confirm !== 'YES'

  await mongoose.connect(env.mongoUri)

  // eslint-disable-next-line no-console
  console.log(dryRun ? 'DRY RUN (no changes):' : 'Dropping collections:')

  const existing = new Set((await mongoose.connection.db.listCollections().toArray()).map((c) => c.name))
  for (const name of names) {
    if (!existing.has(name)) {
      // eslint-disable-next-line no-console
      console.log(`- ${name} (skip: not found)`)
      continue
    }
    // eslint-disable-next-line no-console
    console.log(`- ${name}${dryRun ? '' : ' (dropping...)'}`)
    if (!dryRun) {
      // eslint-disable-next-line no-await-in-loop
      await mongoose.connection.db.dropCollection(name)
    }
  }

  await mongoose.disconnect()

  // eslint-disable-next-line no-console
  console.log(dryRun ? '\nSet CONFIRM_DROP=YES to perform the drop.' : '\nDone.')
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})

