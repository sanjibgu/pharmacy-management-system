import mongoose from 'mongoose'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { env } from '../config/env.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function listModelFiles(modelsDir) {
  const entries = await readdir(modelsDir, { withFileTypes: true })
  const out = []
  for (const ent of entries) {
    const full = path.join(modelsDir, ent.name)
    if (ent.isDirectory()) {
      // Skip plugins (not a collection)
      if (ent.name === 'plugins') continue
      const nested = await listModelFiles(full)
      out.push(...nested)
      continue
    }
    if (!ent.isFile()) continue
    if (!ent.name.endsWith('.js')) continue
    out.push(full)
  }
  return out
}

function pad(str, len) {
  const s = String(str)
  if (s.length >= len) return s
  return s + ' '.repeat(len - s.length)
}

async function main() {
  await mongoose.connect(env.mongoUri)

  const modelsDir = path.resolve(__dirname, '..', 'models')
  const files = await listModelFiles(modelsDir)

  // Import model files to ensure mongoose.modelNames() is populated.
  // eslint-disable-next-line no-console
  console.log(`Loading models from ${modelsDir}`)
  for (const f of files) {
    // eslint-disable-next-line no-await-in-loop
    await import(pathToFileURL(f).href)
  }

  const modelNames = mongoose.modelNames()
  const expectedCollections = new Map()
  for (const name of modelNames) {
    try {
      const coll = mongoose.model(name)?.collection?.name
      if (coll) expectedCollections.set(coll, name)
    } catch {
      // ignore
    }
  }

  const existing = await mongoose.connection.db.listCollections().toArray()
  const existingNames = existing.map((c) => c.name).sort((a, b) => a.localeCompare(b))

  const ignore = new Set([
    'system.profile',
    'system.indexes',
    'system.users',
    'system.version',
  ])

  const unknown = existingNames.filter((n) => !ignore.has(n) && !expectedCollections.has(n))
  const known = existingNames.filter((n) => expectedCollections.has(n))

  // eslint-disable-next-line no-console
  console.log('')
  // eslint-disable-next-line no-console
  console.log(`Known collections (have a model): ${known.length}`)
  // eslint-disable-next-line no-console
  console.log(`Unknown collections (no model found): ${unknown.length}`)

  if (!unknown.length) {
    // eslint-disable-next-line no-console
    console.log('\nNo unknown collections detected.')
    await mongoose.disconnect()
    return
  }

  // eslint-disable-next-line no-console
  console.log('\nUnknown collections report:')
  // eslint-disable-next-line no-console
  console.log(`${pad('Collection', 34)}  ${pad('Docs', 10)}  ${pad('SizeMB', 10)}`)
  // eslint-disable-next-line no-console
  console.log(`${'-'.repeat(34)}  ${'-'.repeat(10)}  ${'-'.repeat(10)}`)

  for (const name of unknown) {
    const col = mongoose.connection.db.collection(name)
    // eslint-disable-next-line no-await-in-loop
    const docs = await col.estimatedDocumentCount().catch(() => null)
    // eslint-disable-next-line no-await-in-loop
    const stats = await mongoose.connection.db.command({ collStats: name }).catch(() => null)
    const sizeMb =
      stats && typeof stats.size === 'number' && Number.isFinite(stats.size) ? (stats.size / (1024 * 1024)).toFixed(2) : '-'
    // eslint-disable-next-line no-console
    console.log(`${pad(name, 34)}  ${pad(docs === null ? '-' : docs, 10)}  ${pad(sizeMb, 10)}`)
  }

  // eslint-disable-next-line no-console
  console.log('\nNext step (safe): review this list, then tell me which collections you want to drop.')
  // eslint-disable-next-line no-console
  console.log('I will generate a dedicated migration script that deletes only the approved collection names.')

  await mongoose.disconnect()
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})

