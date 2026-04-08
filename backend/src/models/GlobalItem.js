import mongoose from 'mongoose'

function normalize(value) {
  return (value || '').toString().trim()
}

const GlobalItemSchema = new mongoose.Schema(
  {
    normalizedKey: { type: String, required: true, trim: true, index: true },
    medicineName: { type: String, required: true, trim: true, index: true },
    manufacturer: { type: String, required: true, trim: true, index: true },
    dosageForm: { type: String, trim: true, default: '' },
    strength: { type: String, trim: true, default: '' },
    category: { type: String, required: true, trim: true, index: true },
    rackLocation: { type: String, trim: true, default: '' },
    hsnCode: { type: String, required: true, trim: true, default: '' },
    gstPercent: { type: Number, required: true, min: 0, default: 0 },
    allowLooseSale: { type: Boolean, required: true, default: false },
    unitsPerStrip: { type: Number, required: true, min: 1, default: 1 },
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, required: true, enum: ['active', 'inactive'], default: 'active', index: true },
    isDeleted: { type: Boolean, required: true, default: false, index: true },
  },
  { timestamps: true },
)

GlobalItemSchema.index(
  { normalizedKey: 1 },
  {
    name: 'uniq_global_item_key_active',
    unique: true,
    partialFilterExpression: { isDeleted: false },
    collation: { locale: 'en', strength: 2 },
  },
)

GlobalItemSchema.pre('validate', function preValidate(next) {
  this.medicineName = normalize(this.medicineName)
  this.manufacturer = normalize(this.manufacturer)
  this.dosageForm = normalize(this.dosageForm)
  this.strength = normalize(this.strength)
  this.category = normalize(this.category)
  this.normalizedKey = normalize(this.normalizedKey)
  this.unitsPerStrip = Math.max(1, Number(this.unitsPerStrip || 1))
  next()
})

export const GlobalItem = mongoose.model('GlobalItem', GlobalItemSchema)
