import { Pharmacy } from '../models/Pharmacy.js'

function basicSlugify(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '')
    .trim()
}

export async function generateUniquePharmacySlug(pharmacyName) {
  const base = basicSlugify(pharmacyName) || 'pharmacy'
  let slug = base
  let i = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Sparse unique index handles uniqueness but we want deterministic UX
    // eslint-disable-next-line no-await-in-loop
    const exists = await Pharmacy.findOne({ slug }).lean()
    if (!exists) return slug
    i += 1
    slug = `${base}${i}`
  }
}

