function getModuleAccessValue(moduleAccess, moduleKey, action) {
  if (!moduleAccess) return false
  const entry = moduleAccess[moduleKey] || moduleAccess.get?.(moduleKey)
  if (!entry) return false
  return Boolean(entry[action])
}

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

export function requireModuleAccess(moduleKey, action = 'view') {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' })
    const role = normalizeRole(req.user.role)
    if (role === 'SuperAdmin') return next()
    // Tenant admin should never be locked out by misconfigured module access.
    if (role === 'PharmacyAdmin') return next()

    const ok = getModuleAccessValue(req.user.moduleAccess, moduleKey, action)
    if (!ok)
      return res.status(403).json({
        error: 'Module access denied',
        required: { moduleKey, action },
      })
    return next()
  }
}
