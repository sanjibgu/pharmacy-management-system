import mongoose from 'mongoose'

function normalizeName(value) {
  return (value || '').toString().trim()
}

const ManufacturerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameLower: { type: String, required: true, trim: true, index: true },
    categoryIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Category', default: [] },
    isDeleted: { type: Boolean, required: true, default: false, index: true },
  },
  { timestamps: true },
)

ManufacturerSchema.index(
  { nameLower: 1 },
  {
    name: 'uniq_manufacturer_nameLower_active',
    unique: true,
    partialFilterExpression: { isDeleted: false },
    collation: { locale: 'en', strength: 2 },
  },
)

ManufacturerSchema.pre('validate', function preValidate(next) {
  const name = normalizeName(this.name)
  this.name = name
  this.nameLower = name.toLowerCase()
  next()
})

export const Manufacturer = mongoose.model('Manufacturer', ManufacturerSchema)

