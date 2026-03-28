export function attachPharmacyId(req, res, next) {
  const pharmacyId = req.user?.pharmacyId
  if (!pharmacyId) return res.status(403).json({ error: 'Pharmacy context missing in token' })
  req.pharmacyId = pharmacyId
  return next()
}

