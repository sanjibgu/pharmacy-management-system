import mongoose from 'mongoose'

const ApprovalRequestSchema = new mongoose.Schema(
  {
    entityType: { type: String, required: true, enum: ['item', 'manufacturer'], index: true },
    normalizedKey: { type: String, required: true, trim: true, index: true },

    requestedByPharmacyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pharmacy',
      required: true,
      index: true,
    },
    requestedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    localEntityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },

    payload: { type: mongoose.Schema.Types.Mixed, required: true },

    status: { type: String, required: true, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    decidedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    decidedAt: { type: Date },
    decisionNote: { type: String, trim: true, default: '' },

    globalEntityId: { type: mongoose.Schema.Types.ObjectId },
  },
  { timestamps: true },
)

ApprovalRequestSchema.index({ entityType: 1, status: 1, createdAt: -1 })

export const ApprovalRequest = mongoose.model('ApprovalRequest', ApprovalRequestSchema)

