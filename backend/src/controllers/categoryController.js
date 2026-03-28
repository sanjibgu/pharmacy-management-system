import mongoose from 'mongoose'
import { Category } from '../models/Category.js'

export async function listCategories(req, res) {
  const includeDeleted = req.user?.role === 'SuperAdmin' && String(req.query.includeDeleted || '') === '1'

  const items = await Category.find(includeDeleted ? {} : { isDeleted: { $ne: true } })
    .sort({ nameLower: 1 })
    .lean()

  res.json({ items })
}

export async function createCategory(req, res) {
  const name = (req.validatedBody.name || '').toString().trim()
  if (!name) return res.status(400).json({ error: 'Category name is required' })

  try {
    const doc = await Category.create({ name, isDeleted: false })
    res.status(201).json({ category: doc })
  } catch (err) {
    if (err && typeof err === 'object' && err.code === 11000) {
      return res.status(409).json({ error: 'Category already exists' })
    }
    throw err
  }
}

export async function updateCategory(req, res) {
  const id = new mongoose.Types.ObjectId(req.params.id)
  const name = (req.validatedBody.name || '').toString().trim()
  if (!name) return res.status(400).json({ error: 'Category name is required' })

  try {
    const doc = await Category.findByIdAndUpdate(id, { name }, { new: true })
    if (!doc) return res.status(404).json({ error: 'Category not found' })
    res.json({ category: doc })
  } catch (err) {
    if (err && typeof err === 'object' && err.code === 11000) {
      return res.status(409).json({ error: 'Category already exists' })
    }
    throw err
  }
}

export async function deleteCategory(req, res) {
  const id = new mongoose.Types.ObjectId(req.params.id)
  const doc = await Category.findByIdAndUpdate(id, { isDeleted: true }, { new: true })
  if (!doc) return res.status(404).json({ error: 'Category not found' })
  res.json({ ok: true })
}

