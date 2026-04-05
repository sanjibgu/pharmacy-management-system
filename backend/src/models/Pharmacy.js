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
    // SuperAdmin can disable a pharmacy to block all tenant access.
    isActive: { type: Boolean, required: true, default: true, index: true },
    deactivationRemark: { type: String, trim: true, default: '' },
    slug: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    rejectionReason: { type: String, trim: true },
    isDeleted: { type: Boolean, required: true, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true },
)

PharmacySchema.index({ email: 1 }, { unique: true })

export const Pharmacy = mongoose.model('Pharmacy', PharmacySchema)
