import mongoose from 'mongoose'

function normalize(value) {
  return (value || '').toString().trim()
}

const GlobalManufacturerSchema = new mongoose.Schema(
  {
    normalizedKey: { type: String, required: true, trim: true, index: true },
    name: { type: String, required: true, trim: true, index: true },
    categoryIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Category', default: [] },
    status: { type: String, required: true, enum: ['active', 'inactive'], default: 'active', index: true },
    isDeleted: { type: Boolean, required: true, default: false, index: true },
  },
  { timestamps: true },
)

GlobalManufacturerSchema.index(
  { normalizedKey: 1 },
  {
    name: 'uniq_global_manufacturer_key_active',
    unique: true,
    partialFilterExpression: { isDeleted: false },
    collation: { locale: 'en', strength: 2 },
  },
)

GlobalManufacturerSchema.pre('validate', function preValidate(next) {
  this.name = normalize(this.name)
  this.normalizedKey = normalize(this.normalizedKey)
  next()
})

export const GlobalManufacturer = mongoose.model('GlobalManufacturer', GlobalManufacturerSchema)

