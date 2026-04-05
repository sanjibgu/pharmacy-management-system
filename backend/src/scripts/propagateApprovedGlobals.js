import mongoose from 'mongoose'
import { env } from '../config/env.js'
import { Pharmacy } from '../models/Pharmacy.js'
import { GlobalItem } from '../models/GlobalItem.js'
import { GlobalManufacturer } from '../models/GlobalManufacturer.js'


async function listEligiblePharmacies() {
  return Pharmacy.find({ status: 'approved', isDeleted: { $ne: true } }).select({ _id: 1 }).lean()
}

async function main() {
  await mongoose.connect(env.mongoUri)

  const pharmacies = await listEligiblePharmacies()
  const globalsItems = await GlobalItem.find({ isDeleted: { $ne: true }, status: 'active' }).lean()
  const globalsManufacturers = await GlobalManufacturer.find({ isDeleted: { $ne: true }, status: 'active' }).lean()

  let createdMedicines = 0
  let createdManufacturers = 0

  for (const p of pharmacies) {
    const pharmacyId = p._id.toString()

    // Global Master + Mapping: no bulk seeding of tenant-local item copies.
    void globalsItems

    // Global Master + Mapping: no tenant-local manufacturer copies to create.
    void globalsManufacturers
  }

  // eslint-disable-next-line no-console
  console.log({ createdMedicines, createdManufacturers })

  await mongoose.disconnect()
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})
