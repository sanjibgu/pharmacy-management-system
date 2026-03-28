import { verifyAccessToken } from '../services/jwtService.js'
import { User } from '../models/User.js'

function normalizeRole(role) {
  const value = (role || '').toString().trim()
  if (!value) return role
  const lower = value.toLowerCase()
  if (lower === 'superadmin') return 'SuperAdmin'
  if (lower === 'pharmacyadmin' || lower === 'pharmacy_admin' || lower === 'pharmacy admin')
    return 'PharmacyAdmin'
  if (lower === 'staff') return 'Staff'
  return role
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) return res.status(401).json({ error: 'Missing access token' })

  try {
    const decoded = verifyAccessToken(token)
    const user = await User.findById(decoded.userId).lean()
    if (!user || user.isActive === false)
      return res.status(401).json({ error: 'Invalid user' })

    req.user = {
      id: user._id.toString(),
      role: normalizeRole(user.role),
      pharmacyId: user.pharmacyId ? user.pharmacyId.toString() : null,
      email: user.email,
      name: user.name,
      moduleAccess: user.moduleAccess || {},
    }

    if (req.tenant && req.user.pharmacyId && req.user.pharmacyId !== req.tenant.pharmacyId) {
      return res.status(403).json({ error: 'Token tenant does not match subdomain tenant' })
    }

    return next()
  } catch (err) {
    // In dev, being explicit helps; in prod this still doesn't leak sensitive details.
    if (err && typeof err === 'object' && err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Access token expired' })
    }
    return res.status(401).json({ error: 'Invalid access token' })
  }
}
