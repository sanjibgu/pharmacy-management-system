import mongoose from 'mongoose'

const ModuleAccessSchema = new mongoose.Schema(
  {
    view: { type: Boolean, default: false },
    manage: { type: Boolean, default: false },
  },
  { _id: false },
)

const UserSchema = new mongoose.Schema(
  {
    pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy' },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['SuperAdmin', 'PharmacyAdmin', 'Staff'],
      required: true,
      index: true,
    },
    // Tenant-scoped, per-user module access. PharmacyAdmin can manage this for their tenant.
    // Example: { medicines: { view: true, manage: true }, sales: { view: true, manage: true } }
    moduleAccess: {
      type: Map,
      of: ModuleAccessSchema,
      default: {},
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
)

UserSchema.index({ pharmacyId: 1, email: 1 }, { unique: true })

export const User = mongoose.model('User', UserSchema)
