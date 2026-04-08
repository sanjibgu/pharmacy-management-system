function normalizePart(value) {
  return (value || '')
    .toString()
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function normalizeValue(value) {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (Array.isArray(value)) return value.map((v) => normalizeValue(v)).filter(Boolean).join(',')
  if (typeof value === 'object') {
    // Best-effort stable stringify for small objects
    const keys = Object.keys(value).sort()
    const out = {}
    for (const k of keys) out[k] = value[k]
    try {
      return JSON.stringify(out)
    } catch {
      return ''
    }
  }
  return normalizePart(value)
}

function getVariantFieldValue(input, key) {
  if (!input || !key) return ''
  if (Object.prototype.hasOwnProperty.call(input, key)) return input[key]

  // Case-insensitive lookup for top-level keys (e.g. "dosageForm" vs "dosageform")
  const keyLower = String(key).toLowerCase()
  for (const k of Object.keys(input)) {
    if (String(k).toLowerCase() === keyLower) return input[k]
  }

  const cf = input.customFields
  if (cf && typeof cf === 'object') {
    if (Object.prototype.hasOwnProperty.call(cf, key)) return cf[key]
    for (const k of Object.keys(cf)) {
      if (String(k).toLowerCase() === keyLower) return cf[k]
    }
  }
  return ''
}

// Builds a normalized "variant key" for items.
// Always includes (medicineName, manufacturer, category).
// Optionally includes category-specific uniqueFields (built-in or customFields keys).
export function makeItemKey(input) {
  const medicineName = input?.medicineName
  const manufacturer = input?.manufacturer
  const category = input?.category

  const parts = [normalizePart(medicineName), normalizePart(manufacturer), normalizePart(category)]

  const uniqueFieldsRaw = Array.isArray(input?.uniqueFields) ? input.uniqueFields : []
  const uniqueFields = uniqueFieldsRaw
    .map((k) => (k || '').toString().trim())
    .filter(Boolean)
    .map((k) => k.toLowerCase())

  // Dedupe/sort to keep keys stable even if admin reorders.
  const seen = new Set()
  const stable = uniqueFields.filter((k) => {
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  stable.sort()

  for (const key of stable) {
    const raw = getVariantFieldValue(input, key)
    const v = normalizeValue(raw)
    parts.push(`${key}:${v}`)
  }

  return parts.join('|')
}

export function makeManufacturerKey({ name }) {
  return normalizePart(name)
}
