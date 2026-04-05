import mongoose from 'mongoose'
import { tenantPlugin } from './plugins/tenantPlugin.js'

const SupplierSchema = new mongoose.Schema(
  {
    pharmacyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pharmacy',
      required: true,
      index: true,
    },
    supplierName: { type: String, required: true, trim: true,},
    supplierCode: { type: String, trim: true, default: '' },
    gstNumber: { type: String, trim: true, default: '' },
    dlNumber: { type: String, trim: true, default: '',index: true,unique:true },
    address: { type: String, trim: true, default: '' },
    mobileNumber: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    isActive: { type: Boolean, required: true, default: true, index: true },
  },
  { timestamps: true },
)

SupplierSchema.index({ pharmacyId: 1, supplierName: 1 }, { unique: true })
// DL No should be unique per pharmacy (when provided).
SupplierSchema.index(
  { pharmacyId: 1, dlNumber: 1 },
  {
    unique: true,
    name: 'uniq_supplier_pharmacy_dlNumber',
    collation: { locale: 'en', strength: 2 },
    partialFilterExpression: { dlNumber: { $type: 'string', $ne: '' } },
  },
)
SupplierSchema.plugin(tenantPlugin, { field: 'pharmacyId' })

export const Supplier = mongoose.model('Supplier', SupplierSchema)
