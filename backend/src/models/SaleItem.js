import mongoose from 'mongoose'
import { tenantPlugin } from './plugins/tenantPlugin.js'

const SaleItemSchema = new mongoose.Schema(
  {
    pharmacyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pharmacy',
      required: true,
      index: true,
    },
    saleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sale',
      required: true,
      index: true,
    },
    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
      index: true,
    },
    hsnCode: { type: String, trim: true, default: '' },
    batchNumber: { type: String, required: true, trim: true },
    expiryDate: { type: Date, required: true },
    unitType: { type: String, enum: ['pack', 'unit'], required: true, default: 'pack' },
    quantity: { type: Number, required: true, min: 0.001 },
    unitsPerStrip: { type: Number, required: true, min: 1, default: 1 },
    mrp: { type: Number, required: true, min: 0, default: 0 }, // MRP per unitType
    saleRate: { type: Number, required: true, min: 0, default: 0 }, // per unitType
    finalPurchaseRate: { type: Number, required: true, min: 0, default: 0 }, // per unitType
    discountPercent: { type: Number, required: true, min: 0, max: 100, default: 0 },
    discountAmount: { type: Number, required: true, min: 0, default: 0 },
    consumedQuantityPacks: { type: Number, required: true, min: 0, default: 0 },
    consumedFreeQuantityPacks: { type: Number, required: true, min: 0, default: 0 },
    amount: { type: Number, required: true, min: 0, default: 0 },
    profit: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
)

SaleItemSchema.index({ pharmacyId: 1, saleId: 1 })
SaleItemSchema.plugin(tenantPlugin, { field: 'pharmacyId' })

export const SaleItem = mongoose.model('SaleItem', SaleItemSchema)
