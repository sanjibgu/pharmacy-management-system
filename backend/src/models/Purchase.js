import mongoose from 'mongoose'
import { tenantPlugin } from './plugins/tenantPlugin.js'

const PurchaseSchema = new mongoose.Schema(
  {
    pharmacyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pharmacy',
      required: true,
      index: true,
    },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    invoiceNumber: { type: String, required: true, trim: true },
    invoiceDate: { type: Date, required: true },
    purchaseDate: { type: Date, required: true, default: Date.now },
    paymentType: { type: String, enum: ['Cash', 'Credit', 'UPI'], required: true, default: 'Cash' },
    dueDate: { type: Date },
    totalAmount: { type: Number, required: true, min: 0, default: 0 },
    discountAmount: { type: Number, required: true, min: 0, default: 0 },
    gstAmount: { type: Number, required: true, min: 0, default: 0 },
    netAmount: { type: Number, required: true, min: 0, default: 0 },
    paidAmount: { type: Number, required: true, min: 0, default: 0 },
    balanceAmount: { type: Number, required: true, min: 0, default: 0 },
    remarks: { type: String, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
)

PurchaseSchema.plugin(tenantPlugin, { field: 'pharmacyId' })
PurchaseSchema.index({ pharmacyId: 1, invoiceNumber: 1 }, { unique: true })

export const Purchase = mongoose.model('Purchase', PurchaseSchema)
