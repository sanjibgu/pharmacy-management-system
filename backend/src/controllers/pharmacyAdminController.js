import mongoose from 'mongoose'
import { Pharmacy } from '../models/Pharmacy.js'
import { User } from '../models/User.js'
import { hashPassword } from '../services/passwordService.js'

function isDuplicateKeyError(err) {
  if (!err || typeof err !== 'object') return false
  if (err.code === 11000) return true
  if (err.errorResponse && err.errorResponse.code === 11000) return true
  if (err.cause && err.cause.code === 11000) return true
  return false
}

export async function listPharmacies(req, res) {
  const includeDeleted = String(req.query.includeDeleted || '') === '1'
  const q = String(req.query.q || '').trim()

  const filter = includeDeleted ? {} : { isDeleted: { $ne: true } }
  if (q) {
    filter.$or = [
      { pharmacyName: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
      { ownerName: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
      { email: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
      { slug: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
    ]
  }

  const items = await Pharmacy.find(filter).sort({ createdAt: -1 }).lean()
  res.json({ items })
}

export async function updatePharmacy(req, res) {
  const id = new mongoose.Types.ObjectId(req.params.id)
  const body = req.validatedBody || {}

  const update = {
    ...(typeof body.pharmacyName === 'string' ? { pharmacyName: body.pharmacyName.trim() } : {}),
    ...(typeof body.ownerName === 'string' ? { ownerName: body.ownerName.trim() } : {}),
    ...(typeof body.email === 'string' ? { email: body.email.trim().toLowerCase() } : {}),
    ...(typeof body.phone === 'string' ? { phone: body.phone.trim() } : {}),
    ...(typeof body.address === 'string' ? { address: body.address.trim() } : {}),
  }

  let item
  try {
    item = await Pharmacy.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true }).lean()
  } catch (err) {
    if (isDuplicateKeyError(err)) return res.status(409).json({ error: 'Pharmacy email already exists' })
    throw err
  }
  if (!item) return res.status(404).json({ error: 'Pharmacy not found' })
  res.json({ item })
}

export async function setPharmacyActive(req, res) {
  const id = new mongoose.Types.ObjectId(req.params.id)
  const isActive = Boolean(req.validatedBody?.isActive)
  const remark = String(req.validatedBody?.remark || '').trim()

  if (!isActive && remark.length < 2) {
    return res.status(400).json({ error: 'Remark is required when deactivating' })
  }

  const item = await Pharmacy.findByIdAndUpdate(
    id,
    { $set: { isActive, deactivationRemark: isActive ? '' : remark } },
    { new: true },
  ).lean()

  if (!item) return res.status(404).json({ error: 'Pharmacy not found' })
  res.json({ item })
}

export async function resetPharmacyAdminPassword(req, res) {
  const id = new mongoose.Types.ObjectId(req.params.id)
  const newPassword = String(req.validatedBody?.newPassword || '').trim()
  if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })

  const pharmacy = await Pharmacy.findById(id).lean()
  if (!pharmacy || pharmacy.isDeleted) return res.status(404).json({ error: 'Pharmacy not found' })

  const admin = await User.findOne({ pharmacyId: id, role: 'PharmacyAdmin' })
  if (!admin) return res.status(404).json({ error: 'PharmacyAdmin user not found for this pharmacy' })

  admin.passwordHash = await hashPassword(newPassword)
  await admin.save()

  res.json({ ok: true })
}

export async function deletePharmacy(req, res) {
  const id = new mongoose.Types.ObjectId(req.params.id)
  const item = await Pharmacy.findByIdAndUpdate(
    id,
    { $set: { isDeleted: true, deletedAt: new Date(), isActive: false } },
    { new: true },
  ).lean()
  if (!item) return res.status(404).json({ error: 'Pharmacy not found' })
  res.json({ ok: true })
}

