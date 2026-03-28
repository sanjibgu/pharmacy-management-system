import { User } from '../models/User.js'
import { hashPassword } from '../services/passwordService.js'
import { fullAccess, sanitizeModuleAccess } from '../services/accessService.js'

export async function listUsers(req, res) {
  const pharmacyId = req.user.pharmacyId
  const items = await User.find({ pharmacyId })
    .select({ passwordHash: 0 })
    .sort({ createdAt: -1 })
    .lean()
  res.json({ items })
}

export async function createUser(req, res) {
  const parsed = req.validatedBody
  const pharmacyId = req.user.pharmacyId

  const passwordHash = await hashPassword(parsed.password)
  const moduleAccess =
    parsed.role === 'PharmacyAdmin' ? fullAccess() : sanitizeModuleAccess(parsed.moduleAccess)

  const user = await User.create({
    pharmacyId,
    role: parsed.role,
    name: parsed.name,
    email: parsed.email,
    phone: parsed.phone,
    passwordHash,
    moduleAccess,
    isActive: true,
  })

  res.status(201).json({
    item: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      moduleAccess: user.moduleAccess,
    },
  })
}

export async function updateUserModuleAccess(req, res) {
  const pharmacyId = req.user.pharmacyId
  const { moduleAccess } = req.validatedBody
  const nextAccess = sanitizeModuleAccess(moduleAccess)

  const target = await User.findOne({ _id: req.params.id, pharmacyId }).lean()
  if (!target) return res.status(404).json({ error: 'User not found' })
  if (target.role === 'PharmacyAdmin') {
    return res
      .status(400)
      .json({ error: 'PharmacyAdmin always has full access; module access cannot be changed.' })
  }

  const user = await User.findOneAndUpdate(
    { _id: req.params.id, pharmacyId },
    { $set: { moduleAccess: nextAccess } },
    { new: true, runValidators: true },
  )
    .select({ passwordHash: 0 })
    .lean()

  if (!user) return res.status(404).json({ error: 'User not found' })
  res.json({ item: user })
}
