import { User } from '../models/User.js'
import { verifyPassword } from '../services/passwordService.js'
import { issueAccessToken } from '../services/jwtService.js'
import { requireTenant } from '../middleware/tenant.js'
import { hashPassword } from '../services/passwordService.js'

export const requireTenantForLogin = requireTenant

export async function login(req, res) {
  const { email, password } = req.validatedBody
  const pharmacyId = req.tenant.pharmacyId

  const user = await User.findOne({ pharmacyId, email: email.toLowerCase() }).lean()
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })
  if (user.isActive === false) return res.status(403).json({ error: 'User is disabled' })

  const ok = await verifyPassword(password, user.passwordHash)
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' })

  const token = issueAccessToken({
    userId: user._id.toString(),
    role: user.role,
    pharmacyId: user.pharmacyId.toString(),
  })

  res.json({
    accessToken: token,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      pharmacyId: user.pharmacyId.toString(),
      moduleAccess: user.moduleAccess || {},
    },
    tenant: { pharmacyId: req.tenant.pharmacyId, slug: req.tenant.slug },
  })
}

export async function me(req, res) {
  res.json({ user: req.user, tenant: req.tenant ? { pharmacyId: req.tenant.pharmacyId, slug: req.tenant.slug } : null })
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.validatedBody

  const user = await User.findById(req.user.id)
  if (!user || user.isActive === false) return res.status(401).json({ error: 'Invalid user' })

  const ok = await verifyPassword(currentPassword, user.passwordHash)
  if (!ok) return res.status(400).json({ error: 'Current password is incorrect' })

  user.passwordHash = await hashPassword(newPassword)
  await user.save()

  return res.json({ ok: true })
}
