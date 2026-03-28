import mongoose from 'mongoose'
import { tenantPlugin } from './plugins/tenantPlugin.js'

const SaleSchema = new mongoose.Schema(
  {
    pharmacyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pharmacy',
      required: true,
      index: true,
    },
    saleDate: { type: Date, required: true, default: Date.now },
    paymentType: { type: String, enum: ['Cash', 'Credit', 'UPI'], required: true, default: 'Cash' },
    totalAmount: { type: Number, required: true, min: 0, default: 0 },
    gstAmount: { type: Number, required: true, min: 0, default: 0 },
    discountAmount: { type: Number, required: true, min: 0, default: 0 },
    netAmount: { type: Number, required: true, min: 0, default: 0 },
    paidAmount: { type: Number, required: true, min: 0, default: 0 },
    balanceAmount: { type: Number, required: true, min: 0, default: 0 },
    patientName: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    doctorName: { type: String, trim: true, default: '' },
    remarks: { type: String, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
)

SaleSchema.plugin(tenantPlugin, { field: 'pharmacyId' })
SaleSchema.index({ pharmacyId: 1, createdAt: -1 })

export const Sale = mongoose.model('Sale', SaleSchema)
