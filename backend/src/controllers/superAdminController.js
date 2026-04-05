import { Pharmacy } from '../models/Pharmacy.js'
import { User } from '../models/User.js'
import { issueAccessToken } from '../services/jwtService.js'
import { hashPassword, verifyPassword } from '../services/passwordService.js'
import { generateUniquePharmacySlug } from '../services/slugService.js'
import { fullAccess } from '../services/accessService.js'

export async function superAdminLogin(req, res) {
  const { email, password } = req.validatedBody
  const user = await User.findOne({
    role: 'SuperAdmin',
    pharmacyId: null,
    email: email.toLowerCase(),
  }).lean()

  if (!user) return res.status(401).json({ error: 'Invalid credentials' })
  const ok = await verifyPassword(password, user.passwordHash)
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' })

  const token = issueAccessToken({
    userId: user._id.toString(),
    role: user.role,
    pharmacyId: null,
  })

  res.json({
    accessToken: token,
    user: { id: user._id.toString(), email: user.email, name: user.name, role: user.role },
  })
}

export async function listPendingPharmacies(req, res) {
  const pending = await Pharmacy.find({ status: 'pending' })
    .sort({ createdAt: -1 })
    .lean()

  res.json({ items: pending })
}

export async function approvePharmacy(req, res) {
  const { adminEmail, adminName, adminPassword } = req.validatedBody
  const pharmacyId = req.params.id

  const pharmacy = await Pharmacy.findById(pharmacyId)
  if (!pharmacy) return res.status(404).json({ error: 'Pharmacy not found' })
  if (pharmacy.status === 'rejected') return res.status(400).json({ error: 'Pharmacy is rejected' })

  if (!pharmacy.slug) {
    pharmacy.slug = await generateUniquePharmacySlug(pharmacy.pharmacyName)
  }
  pharmacy.status = 'approved'
  pharmacy.isActive = true
  pharmacy.deactivationRemark = ''
  pharmacy.rejectionReason = undefined
  await pharmacy.save()

  // Keep only slug for tenant identification; explicitly remove any legacy stored portalUrl.
  await Pharmacy.updateOne(
    { _id: pharmacy._id },
    { $unset: { portalUrl: 1 } },
    { strict: false },
  )

  // Global Master + Mapping:
  // Do not seed tenant-local copies for global items/manufacturers when a pharmacy is approved.
  // They are visible by default; pharmacy can disable via mapping settings.

  // Create the initial PharmacyAdmin user (idempotent)
  const existing = await User.findOne({
    pharmacyId: pharmacy._id,
    email: adminEmail.toLowerCase(),
  })

  if (!existing) {
    const passwordHash = await hashPassword(adminPassword)
    await User.create({
      pharmacyId: pharmacy._id,
      role: 'PharmacyAdmin',
      name: adminName,
      email: adminEmail,
      passwordHash,
      moduleAccess: fullAccess(),
      isActive: true,
    })
  }

  res.json({
    id: pharmacy._id.toString(),
    status: pharmacy.status,
    slug: pharmacy.slug,
  })
}

export async function rejectPharmacy(req, res) {
  const { reason } = req.validatedBody
  const pharmacyId = req.params.id
  const pharmacy = await Pharmacy.findById(pharmacyId)
  if (!pharmacy) return res.status(404).json({ error: 'Pharmacy not found' })

  pharmacy.status = 'rejected'
  pharmacy.rejectionReason = reason || 'Rejected by Super Admin'
  await pharmacy.save()

  res.json({ id: pharmacy._id.toString(), status: pharmacy.status })
}
