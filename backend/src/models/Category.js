import mongoose from 'mongoose'

function normalizeName(value) {
  return (value || '').toString().trim()
}

const CategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameLower: { type: String, required: true, trim: true, unique: true, index: true },
    isDeleted: { type: Boolean, required: true, default: false, index: true },
  },
  { timestamps: true },
)

CategorySchema.pre('validate', function preValidate(next) {
  const name = normalizeName(this.name)
  this.name = name
  this.nameLower = name.toLowerCase()
  next()
})

export const Category = mongoose.model('Category', CategorySchema)

