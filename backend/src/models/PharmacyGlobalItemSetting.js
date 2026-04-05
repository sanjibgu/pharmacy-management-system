import mongoose from 'mongoose'
import { tenantPlugin } from './plugins/tenantPlugin.js'

const PharmacyGlobalItemSettingSchema = new mongoose.Schema(
  {
    pharmacyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pharmacy',
      required: true,
      index: true,
    },
    globalItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GlobalItem',
      required: true,
      index: true,
    },
    isEnabled: { type: Boolean, required: true, default: true, index: true },
    isDeleted: { type: Boolean, required: true, default: false, index: true },
  },
  { timestamps: true },
)

PharmacyGlobalItemSettingSchema.index(
  { pharmacyId: 1, globalItemId: 1 },
  {
    name: 'uniq_pharmacy_global_item_setting',
    unique: true,
    partialFilterExpression: { isDeleted: false },
  },
)

PharmacyGlobalItemSettingSchema.plugin(tenantPlugin, { field: 'pharmacyId' })

export const PharmacyGlobalItemSetting = mongoose.model('PharmacyGlobalItemSetting', PharmacyGlobalItemSettingSchema)

