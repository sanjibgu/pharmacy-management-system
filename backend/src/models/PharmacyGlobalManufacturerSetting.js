import mongoose from 'mongoose'
import { tenantPlugin } from './plugins/tenantPlugin.js'

const PharmacyGlobalManufacturerSettingSchema = new mongoose.Schema(
  {
    pharmacyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pharmacy',
      required: true,
      index: true,
    },
    globalManufacturerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GlobalManufacturer',
      required: true,
      index: true,
    },
    isEnabled: { type: Boolean, required: true, default: true, index: true },
    isDeleted: { type: Boolean, required: true, default: false, index: true },
  },
  { timestamps: true },
)

PharmacyGlobalManufacturerSettingSchema.index(
  { pharmacyId: 1, globalManufacturerId: 1 },
  {
    name: 'uniq_pharmacy_global_manufacturer_setting',
    unique: true,
    partialFilterExpression: { isDeleted: false },
  },
)

PharmacyGlobalManufacturerSettingSchema.plugin(tenantPlugin, { field: 'pharmacyId' })

export const PharmacyGlobalManufacturerSetting = mongoose.model(
  'PharmacyGlobalManufacturerSetting',
  PharmacyGlobalManufacturerSettingSchema,
)

