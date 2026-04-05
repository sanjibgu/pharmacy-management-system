import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { env } from '../config/env.js'
import { ApprovalRequest } from '../models/ApprovalRequest.js'
import { Medicine } from '../models/Medicine.js'
import { PharmacyManufacturer } from '../models/PharmacyManufacturer.js'
import { makeItemKey, makeManufacturerKey } from '../services/normalizeService.js'

dotenv.config()

async function main() {
  await mongoose.connect(env.mongoUri)

  const existing = await ApprovalRequest.find({})
    .select({ entityType: 1, localEntityId: 1 })
    .lean()

  const seen = new Set(existing.map((r) => `${r.entityType}:${String(r.localEntityId)}`))

  let created = 0

  const medicines = await Medicine.find({
    isDeleted: { $ne: true },
    globalItemId: { $in: [null, undefined] },
  })
    .select({
      _id: 1,
      pharmacyId: 1,
      medicineName: 1,
      manufacturer: 1,
      category: 1,
      rackLocation: 1,
      hsnCode: 1,
      gstPercent: 1,
      allowLooseSale: 1,
      customFields: 1,
      createdAt: 1,
    })
    .setOptions({ skipTenantCheck: true })
    .lean()

  for (const m of medicines) {
    const key = `item:${String(m._id)}`
    if (seen.has(key)) continue
    const normalizedKey = makeItemKey({ medicineName: m.medicineName, manufacturer: m.manufacturer, category: m.category })
    await ApprovalRequest.create({
      entityType: 'item',
      normalizedKey,
      requestedByPharmacyId: m.pharmacyId,
      requestedByUserId: new mongoose.Types.ObjectId('000000000000000000000000'),
      localEntityId: m._id,
      payload: {
        medicineName: m.medicineName,
        manufacturer: m.manufacturer,
        category: m.category,
        rackLocation: m.rackLocation || '',
        hsnCode: m.hsnCode || '',
        gstPercent: Number(m.gstPercent || 0),
        allowLooseSale: Boolean(m.allowLooseSale),
        customFields: m.customFields || {},
      },
      status: 'pending',
      decisionNote: 'Backfilled from existing tenant records',
    })
    created += 1
  }

  const manufacturers = await PharmacyManufacturer.find({
    isDeleted: { $ne: true },
    globalManufacturerId: { $in: [null, undefined] },
  })
    .select({ _id: 1, pharmacyId: 1, name: 1, categoryIds: 1 })
    .setOptions({ skipTenantCheck: true })
    .lean()

  for (const man of manufacturers) {
    const key = `manufacturer:${String(man._id)}`
    if (seen.has(key)) continue
    const normalizedKey = makeManufacturerKey({ name: man.name })
    await ApprovalRequest.create({
      entityType: 'manufacturer',
      normalizedKey,
      requestedByPharmacyId: man.pharmacyId,
      requestedByUserId: new mongoose.Types.ObjectId('000000000000000000000000'),
      localEntityId: man._id,
      payload: { name: man.name, categoryIds: man.categoryIds || [] },
      status: 'pending',
      decisionNote: 'Backfilled from existing tenant records',
    })
    created += 1
  }

  // eslint-disable-next-line no-console
  console.log(`Backfill done. Created ${created} approval requests.`)

  await mongoose.disconnect()
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})
