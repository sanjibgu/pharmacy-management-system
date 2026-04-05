import mongoose from 'mongoose'
import { ApprovalRequest } from '../models/ApprovalRequest.js'
import { GlobalItem } from '../models/GlobalItem.js'
import { GlobalManufacturer } from '../models/GlobalManufacturer.js'
import { Medicine } from '../models/Medicine.js'
import { PharmacyManufacturer } from '../models/PharmacyManufacturer.js'
import { Pharmacy } from '../models/Pharmacy.js'

async function listEligiblePharmacies() {
  return Pharmacy.find({
    status: 'approved',
    isDeleted: { $ne: true },
  })
    .select({ _id: 1 })
    .lean()
}

async function propagateGlobalItem(global) {
  // With Global Master + Mapping approach, we do NOT create tenant-local copies for each pharmacy.
  // Tenant-local copies are created lazily when a pharmacy searches/uses an item.
  void global
}

async function propagateGlobalManufacturer(global) {
  // With Global Master + Mapping approach, we do NOT create tenant-local copies for each pharmacy.
  // Global manufacturers are visible by default; pharmacies can optionally disable via settings.
  // (Migration script cleans old seeded copies.)
  void global
}

export async function listApprovalRequests(req, res) {
  const entityType = String(req.query.entityType || '').trim()
  const status = String(req.query.status || 'pending').trim()

  const filter = {
    ...(entityType ? { entityType } : {}),
    ...(status ? { status } : {}),
  }

  const items = await ApprovalRequest.find(filter).sort({ createdAt: -1 }).limit(200).lean()
  res.json({ items })
}

export async function approveApprovalRequest(req, res) {
  const id = new mongoose.Types.ObjectId(req.params.id)
  const reqDoc = await ApprovalRequest.findById(id)
  if (!reqDoc) return res.status(404).json({ error: 'Request not found' })
  if (reqDoc.status !== 'pending') return res.status(409).json({ error: 'Request already decided' })

  const decidedByUserId = new mongoose.Types.ObjectId(req.user.id)
  const decidedAt = new Date()

  if (reqDoc.entityType === 'item') {
    const p = reqDoc.payload || {}
    const normalizedKey = String(reqDoc.normalizedKey || '').trim()

    const global =
      (await GlobalItem.findOne({ normalizedKey, isDeleted: { $ne: true } })) ||
      (await GlobalItem.create({
        normalizedKey,
        medicineName: p.medicineName,
        manufacturer: p.manufacturer,
        category: p.category,
        rackLocation: p.rackLocation || '',
        hsnCode: p.hsnCode || '',
        gstPercent: Number(p.gstPercent || 0),
        allowLooseSale: Boolean(p.allowLooseSale),
        customFields: p.customFields || {},
        status: 'active',
        isDeleted: false,
      }))

    await Medicine.findOneAndUpdate(
      { _id: reqDoc.localEntityId, pharmacyId: reqDoc.requestedByPharmacyId },
      { $set: { globalItemId: global._id, isActive: true } },
    )

    // Do not propagate tenant-local copies (Global Master + Mapping). Other pharmacies will see it via global list
    // and a local copy will be created lazily when they search/use it.
    await propagateGlobalItem(global)

    reqDoc.status = 'approved'
    reqDoc.decidedByUserId = decidedByUserId
    reqDoc.decidedAt = decidedAt
    reqDoc.globalEntityId = global._id
    await reqDoc.save()

    return res.json({ ok: true, globalId: String(global._id) })
  }

  if (reqDoc.entityType === 'manufacturer') {
    const p = reqDoc.payload || {}
    const normalizedKey = String(reqDoc.normalizedKey || '').trim()

    const global =
      (await GlobalManufacturer.findOne({ normalizedKey, isDeleted: { $ne: true } })) ||
      (await GlobalManufacturer.create({
        normalizedKey,
        name: p.name,
        categoryIds: Array.isArray(p.categoryIds) ? p.categoryIds : [],
        status: 'active',
        isDeleted: false,
      }))

    // Soft-delete the local manufacturer to avoid duplicates. Global is visible by default.
    await PharmacyManufacturer.findOneAndUpdate(
      { _id: reqDoc.localEntityId, pharmacyId: reqDoc.requestedByPharmacyId },
      { $set: { isDeleted: true, isActive: false, globalManufacturerId: global._id } },
    )

    reqDoc.status = 'approved'
    reqDoc.decidedByUserId = decidedByUserId
    reqDoc.decidedAt = decidedAt
    reqDoc.globalEntityId = global._id
    await reqDoc.save()

    return res.json({ ok: true, globalId: String(global._id) })
  }

  return res.status(400).json({ error: 'Unsupported entityType' })
}

export async function rejectApprovalRequest(req, res) {
  const id = new mongoose.Types.ObjectId(req.params.id)
  const reqDoc = await ApprovalRequest.findById(id)
  if (!reqDoc) return res.status(404).json({ error: 'Request not found' })
  if (reqDoc.status !== 'pending') return res.status(409).json({ error: 'Request already decided' })

  reqDoc.status = 'rejected'
  reqDoc.decidedByUserId = new mongoose.Types.ObjectId(req.user.id)
  reqDoc.decidedAt = new Date()
  reqDoc.decisionNote = String(req.validatedBody?.note || '').trim()
  await reqDoc.save()

  res.json({ ok: true })
}
