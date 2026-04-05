import { Category } from '../models/Category.js'

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function toNumber(value) {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim() !== '') return Number(value)
  return NaN
}

function toBoolean(value) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase()
    if (v === 'true') return true
    if (v === 'false') return false
  }
  return null
}

function toDate(value) {
  if (value instanceof Date) return value
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d
}

export async function coerceCustomFieldsForCategory(categoryName, customFields) {
  const nameLower = (categoryName || '').toString().trim().toLowerCase()
  if (!nameLower) return {}

  const category = await Category.findOne({ nameLower, isDeleted: { $ne: true } }).lean()
  const fields = Array.isArray(category?.fields) ? category.fields : []
  if (fields.length === 0) return {}

  const input = isPlainObject(customFields) ? customFields : {}
  const allowed = new Set(fields.map((f) => f.key))

  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) throw new Error(`Invalid custom field: ${key}`)
  }

  const out = {}
  for (const field of fields) {
    const key = field.key
    const raw = input[key]
    const empty = raw === undefined || raw === null || raw === ''

    if (empty) {
      if (field.required) throw new Error(`${field.label} is required`)
      continue
    }

    if (field.type === 'text') {
      out[key] = String(raw)
      continue
    }

    if (field.type === 'select') {
      const v = String(raw).trim()
      const opts = Array.isArray(field.options) ? field.options : []
      const ok = opts.some((o) => String(o).trim().toLowerCase() === v.toLowerCase())
      if (!ok) throw new Error(`${field.label} must be one of: ${opts.join(', ')}`)
      // store canonical option casing if possible
      const canonical = opts.find((o) => String(o).trim().toLowerCase() === v.toLowerCase()) || v
      out[key] = canonical
      continue
    }

    if (field.type === 'number') {
      const n = toNumber(raw)
      if (!Number.isFinite(n)) throw new Error(`${field.label} must be a number`)
      if (typeof field.min === 'number' && n < field.min) throw new Error(`${field.label} must be >= ${field.min}`)
      if (typeof field.max === 'number' && n > field.max) throw new Error(`${field.label} must be <= ${field.max}`)
      out[key] = n
      continue
    }

    if (field.type === 'boolean') {
      const b = toBoolean(raw)
      if (b === null) throw new Error(`${field.label} must be true/false`)
      out[key] = b
      continue
    }

    if (field.type === 'date') {
      const d = toDate(raw)
      if (!d) throw new Error(`${field.label} must be a valid date`)
      out[key] = d
      continue
    }
  }

  return out
}

export async function getLooseSaleAllowedForCategory(categoryName) {
  const nameLower = (categoryName || '').toString().trim().toLowerCase()
  if (!nameLower) return false
  const category = await Category.findOne({ nameLower, isDeleted: { $ne: true } }).lean()
  return Boolean(category?.looseSaleAllowed)
}
