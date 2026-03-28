import mongoose from 'mongoose'
import { tenantPlugin } from './plugins/tenantPlugin.js'

const PurchaseItemSchema = new mongoose.Schema(
  {
    pharmacyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pharmacy',
      required: true,
      index: true,
    },
    purchaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Purchase',
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
    manufactureDate: { type: Date },
    expiryDate: { type: Date, required: true },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    freeQuantity: { type: Number, required: true, min: 0, default: 0 },
    purchaseRate: { type: Number, required: true, min: 0, default: 0 },
    mrp: { type: Number, required: true, min: 0, default: 0 },
    saleRate: { type: Number, required: true, min: 0, default: 0 },
    tradeRate: { type: Number, required: true, min: 0, default: 0 },
    gstPercent: { type: Number, required: true, min: 0, default: 0 },
    discountPercent: { type: Number, required: true, min: 0, default: 0 },
    // Effective purchase rate after scheme (free quantity) adjustment:
    // finalPurchaseRate = (quantity * purchaseRate) / (quantity + freeQuantity)
    finalPurchaseRate: { type: Number, required: true, min: 0, default: 0 },
    amount: { type: Number, required: true, min: 0, default: 0 },
    gstAmount: { type: Number, required: true, min: 0, default: 0 },
    discountAmount: { type: Number, required: true, min: 0, default: 0 },
    totalAmount: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true },
)

PurchaseItemSchema.index({ pharmacyId: 1, purchaseId: 1 })
PurchaseItemSchema.plugin(tenantPlugin, { field: 'pharmacyId' })

export const PurchaseItem = mongoose.model('PurchaseItem', PurchaseItemSchema)
