import mongoose from 'mongoose'

function normalizeName(value) {
  return (value || '').toString().trim()
}

function normalizeKey(value) {
  return (value || '').toString().trim()
}

const CategoryFieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: ['text', 'number', 'select', 'boolean', 'date'], default: 'text' },
    required: { type: Boolean, required: true, default: false },
    options: { type: [String], default: undefined }, // for select
    min: { type: Number, default: undefined }, // for number
    max: { type: Number, default: undefined }, // for number
  },
  { _id: false },
)

const CategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameLower: { type: String, required: true, trim: true, index: true },
    fields: { type: [CategoryFieldSchema], default: [] },
    looseSaleAllowed: { type: Boolean, required: true, default: false },
    isDeleted: { type: Boolean, required: true, default: false, index: true },
  },
  { timestamps: true },
)

// Allow recreating a previously deleted category with the same name.
CategorySchema.index(
  { nameLower: 1 },
  {
    name: 'uniq_category_nameLower_active',
    unique: true,
    partialFilterExpression: { isDeleted: false },
    collation: { locale: 'en', strength: 2 },
  },
)

CategorySchema.pre('validate', function preValidate(next) {
  const name = normalizeName(this.name)
  this.name = name
  this.nameLower = name.toLowerCase()

  if (Array.isArray(this.fields)) {
    const seen = new Set()
    this.fields = this.fields
      .map((f) => {
        const key = normalizeKey(f.key)
        const label = normalizeName(f.label)
        const type = (f.type || 'text').toString().trim()
        const required = Boolean(f.required)

        const out = { ...f.toObject?.() }
        out.key = key
        out.label = label
        out.type = type
        out.required = required

        if (type === 'select') {
          const opts = Array.isArray(f.options) ? f.options : []
          out.options = opts.map((o) => normalizeName(o)).filter(Boolean)
        } else {
          out.options = undefined
        }

        if (type === 'number') {
          out.min = typeof f.min === 'number' ? f.min : undefined
          out.max = typeof f.max === 'number' ? f.max : undefined
        } else {
          out.min = undefined
          out.max = undefined
        }

        return out
      })
      .filter((f) => f.key && f.label)

    for (const f of this.fields) {
      const keyLower = String(f.key || '').toLowerCase()
      if (seen.has(keyLower)) {
        // eslint-disable-next-line no-param-reassign
        this.invalidate('fields', `Duplicate field key: ${f.key}`)
        break
      }
      seen.add(keyLower)
    }
  }

  next()
})

export const Category = mongoose.model('Category', CategorySchema)
