export function requireSuperAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' })
  if (req.user.role !== 'SuperAdmin') {
    return res.status(403).json({ error: 'SuperAdmin only' })
  }
  return next()
}

