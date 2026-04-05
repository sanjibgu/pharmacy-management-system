import mongoose from 'mongoose'
import { env } from '../config/env.js'
import { PharmacyManufacturer } from '../models/PharmacyManufacturer.js'

function normalizeKey(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function uniqObjectIdStrings(ids) {
  const out = []
  const seen = new Set()
  for (const id of ids || []) {
    if (!id) continue
    const s = id.toString()
    if (seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

function pickCanonical(docs) {
  return [...docs].sort((a, b) => {
    const aHasGlobal = a.globalManufacturerId ? 1 : 0
    const bHasGlobal = b.globalManufacturerId ? 1 : 0
    if (aHasGlobal !== bHasGlobal) return bHasGlobal - aHasGlobal

    const aActive = a.isActive === false ? 0 : 1
    const bActive = b.isActive === false ? 0 : 1
    if (aActive !== bActive) return bActive - aActive

    const aCats = Array.isArray(a.categoryIds) ? a.categoryIds.length : 0
    const bCats = Array.isArray(b.categoryIds) ? b.categoryIds.length : 0
    if (aCats !== bCats) return bCats - aCats

    const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return aCreated - bCreated
  })[0]
}

async function bulkWriteInChunks(ops, chunkSize = 500) {
  for (let i = 0; i < ops.length; i += chunkSize) {
    // eslint-disable-next-line no-await-in-loop
    await PharmacyManufacturer.collection.bulkWrite(ops.slice(i, i + chunkSize), { ordered: false })
  }
}

async function main() {
  const apply = process.argv.includes('--apply')
  await mongoose.connect(env.mongoUri)

  const docs = await PharmacyManufacturer.find({ isDeleted: { $ne: true } })
    .setOptions({ skipTenantCheck: true })
    .select({ _id: 1, pharmacyId: 1, name: 1, categoryIds: 1, globalManufacturerId: 1, isActive: 1, createdAt: 1 })
    .lean()

  const groups = new Map()
  for (const d of docs) {
    const pharmacyId = d.pharmacyId?.toString?.() || ''
    if (!pharmacyId) continue
    const key = `${pharmacyId}::${normalizeKey(d.name)}`
    const arr = groups.get(key) || []
    arr.push(d)
    groups.set(key, arr)
  }

  const dupGroups = [...groups.values()].filter((arr) => arr.length > 1)
  if (dupGroups.length === 0) {
    // eslint-disable-next-line no-console
    console.log('No duplicate tenant manufacturers found.')
    await mongoose.disconnect()
    return
  }

  let dupRows = 0
  for (const g of dupGroups) dupRows += g.length - 1

  // eslint-disable-next-line no-console
  console.log({
    mode: apply ? 'APPLY' : 'DRY_RUN',
    duplicateGroups: dupGroups.length,
    duplicateRows: dupRows,
  })

  // Show a few examples
  for (const [i, g] of dupGroups.slice(0, 10).entries()) {
    const canonical = pickCanonical(g)
    // eslint-disable-next-line no-console
    console.log(`Example ${i + 1}:`, {
      pharmacyId: canonical.pharmacyId.toString(),
      nameKey: normalizeKey(canonical.name),
      count: g.length,
      ids: g.map((x) => x._id.toString()),
      canonicalId: canonical._id.toString(),
      globalIds: g.map((x) => (x.globalManufacturerId ? x.globalManufacturerId.toString() : null)),
    })
  }

  if (!apply) {
    // eslint-disable-next-line no-console
    console.log("Dry run only. Re-run with '--apply' to merge and soft-delete duplicates.")
    await mongoose.disconnect()
    return
  }

  const ops = []
  let merged = 0
  let softDeleted = 0

  for (const g of dupGroups) {
    const canonical = pickCanonical(g)
    const others = g.filter((x) => x._id.toString() !== canonical._id.toString())

    const unionCategoryIds = uniqObjectIdStrings([
      ...(canonical.categoryIds || []),
      ...others.flatMap((x) => x.categoryIds || []),
    ])

    const anyActive = g.some((x) => x.isActive !== false)
    const anyGlobal = g.find((x) => x.globalManufacturerId)?.globalManufacturerId || null

    const set = {}
    if (unionCategoryIds.length !== (canonical.categoryIds || []).length) {
      set.categoryIds = unionCategoryIds.map((s) => new mongoose.Types.ObjectId(s))
    }
    if (anyActive && canonical.isActive === false) {
      set.isActive = true
    }
    if (!canonical.globalManufacturerId && anyGlobal) {
      set.globalManufacturerId = anyGlobal
    }

    if (Object.keys(set).length) {
      ops.push({
        updateOne: {
          filter: { _id: canonical._id },
          update: { $set: set },
        },
      })
      merged += 1
    }

    const otherIds = others.map((x) => x._id)
    ops.push({
      updateMany: {
        filter: { _id: { $in: otherIds } },
        update: { $set: { isDeleted: true, isActive: false } },
      },
    })
    softDeleted += otherIds.length
  }

  await bulkWriteInChunks(ops, 500)

  // eslint-disable-next-line no-console
  console.log({ mergedCanonicalUpdated: merged, softDeletedDuplicates: softDeleted })

  await mongoose.disconnect()
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})

