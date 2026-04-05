import mongoose from 'mongoose'
import { tenantPlugin } from './plugins/tenantPlugin.js'

const MedicineSchema = new mongoose.Schema(
  {
    pharmacyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pharmacy',
      required: true,
      index: true,
    },
    medicineName: { type: String, required: true, trim: true, index: true },
    manufacturer: { type: String, required: true, trim: true, default: '' },
    dosageForm: { type: String, trim: true, default: '' },
    strength: { type: String, trim: true, default: '' },
    category: { type: String, required: true, trim: true, default: '' },
    // Default rack/location for this medicine (can be overridden per batch in purchase).
    rackLocation: { type: String, trim: true, default: '' },
    hsnCode: { type: String, required: true, trim: true, default: '' },
    gstPercent: { type: Number, required: true, min: 0, default: 0 },
    // Pack details (e.g., 10 tablets per strip). Used later for loose/partial sales.
    unitsPerStrip: { type: Number, min: 1, default: 10 },
    allowLooseSale: { type: Boolean, required: true, default: false },
    // Category-driven dynamic fields (configured by SuperAdmin in Category Master)
    // Example for Diaper category: { size: "M", packOf: 42 }
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
    globalItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'GlobalItem', index: true },
    isActive: { type: Boolean, required: true, default: true, index: true },
    isDeleted: { type: Boolean, required: true, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true },
)

MedicineSchema.index({ pharmacyId: 1, medicineName: 1 })
MedicineSchema.index(
  { pharmacyId: 1, medicineName: 1, manufacturer: 1, category: 1 },
  {
    name: 'uniq_medicine_pharmacy_name_manufacturer_category',
    unique: true,
    partialFilterExpression: { isDeleted: false },
    collation: { locale: 'en', strength: 2 },
  },
)
MedicineSchema.plugin(tenantPlugin, { field: 'pharmacyId' })

export const Medicine = mongoose.model('Medicine', MedicineSchema)
