import mongoose from 'mongoose'
import { tenantPlugin } from './plugins/tenantPlugin.js'

function normalizeName(value) {
  return (value || '').toString().trim().replace(/\s+/g, ' ')
}

const PharmacyManufacturerSchema = new mongoose.Schema(
  {
    pharmacyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pharmacy',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    nameLower: { type: String, required: true, trim: true, index: true },
    categoryIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Category', default: [] },
    globalManufacturerId: { type: mongoose.Schema.Types.ObjectId, ref: 'GlobalManufacturer', index: true },
    isActive: { type: Boolean, required: true, default: true, index: true },
    isDeleted: { type: Boolean, required: true, default: false, index: true },
  },
  { timestamps: true },
)

PharmacyManufacturerSchema.index(
  { pharmacyId: 1, nameLower: 1 },
  {
    name: 'uniq_pharmacy_manufacturer_active',
    unique: true,
    partialFilterExpression: { isDeleted: false },
    collation: { locale: 'en', strength: 2 },
  },
)

PharmacyManufacturerSchema.pre('validate', function preValidate(next) {
  const name = normalizeName(this.name)
  this.name = name
  this.nameLower = name.toLowerCase()
  next()
})

PharmacyManufacturerSchema.plugin(tenantPlugin, { field: 'pharmacyId' })

export const PharmacyManufacturer = mongoose.model('PharmacyManufacturer', PharmacyManufacturerSchema)
