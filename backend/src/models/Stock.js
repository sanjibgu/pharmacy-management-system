import mongoose from 'mongoose'
import { tenantPlugin } from './plugins/tenantPlugin.js'

const StockSchema = new mongoose.Schema(
  {
    pharmacyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pharmacy',
      required: true,
      index: true,
    },
    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
      index: true,
    },
    batchNumber: { type: String, required: true, trim: true },
    expiryDate: { type: Date, required: true },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    freeQuantity: { type: Number, required: true, min: 0, default: 0 },
    rackLocation: { type: String, trim: true, default: '' },

    // Latest rates for this batch (captured from purchase entries)
    mrp: { type: Number, required: true, min: 0, default: 0 },
    purchaseRate: { type: Number, required: true, min: 0, default: 0 },
    // Effective rate used for valuation/profit (scheme-adjusted)
    finalPurchaseRate: { type: Number, required: true, min: 0, default: 0 },
    saleRate: { type: Number, required: true, min: 0, default: 0 },
    tradeRate: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true },
)

StockSchema.index({ pharmacyId: 1, medicineId: 1, batchNumber: 1, expiryDate: 1 }, { unique: true })
StockSchema.plugin(tenantPlugin, { field: 'pharmacyId' })

export const Stock = mongoose.model('Stock', StockSchema)
