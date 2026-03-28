import mongoose from 'mongoose'

const PharmacySchema = new mongoose.Schema(
  {
    pharmacyName: { type: String, required: true, trim: true },
    ownerName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      required: true,
      default: 'pending',
      index: true,
    },
    slug: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    rejectionReason: { type: String, trim: true },
  },
  { timestamps: true },
)

PharmacySchema.index({ email: 1 }, { unique: true })

export const Pharmacy = mongoose.model('Pharmacy', PharmacySchema)
