import mongoose from 'mongoose'
import { Category } from '../models/Category.js'
import { Manufacturer } from '../models/Manufacturer.js'

function normalizeName(value) {
  return (value || '').toString().trim()
}

export async function listCategories(req, res) {
  const includeDeleted = req.user?.role === 'SuperAdmin' && String(req.query.includeDeleted || '') === '1'

  const items = await Category.find(includeDeleted ? {} : { isDeleted: { $ne: true } })
    .sort({ nameLower: 1 })
    .lean()

  res.json({ items })
}

export async function createCategory(req, res) {
  const name = normalizeName(req.validatedBody.name)
  const fields = Array.isArray(req.validatedBody.fields) ? req.validatedBody.fields : []
  const looseSaleAllowed = Boolean(req.validatedBody.looseSaleAllowed)
  if (!name) return res.status(400).json({ error: 'Category name is required' })

  try {
    const doc = await Category.create({ name, fields, looseSaleAllowed, isDeleted: false })
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
  const name = normalizeName(req.validatedBody.name)
  const fields = Array.isArray(req.validatedBody.fields) ? req.validatedBody.fields : []
  const looseSaleAllowed = Boolean(req.validatedBody.looseSaleAllowed)
  if (!name) return res.status(400).json({ error: 'Category name is required' })

  try {
    const doc = await Category.findByIdAndUpdate(
      id,
      { name, fields, looseSaleAllowed },
      { new: true, runValidators: true },
    )
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

  const soft = String(req.query.soft || '') === '1' || String(req.query.soft || '').toLowerCase() === 'true'
  if (soft) {
    const doc = await Category.findByIdAndUpdate(id, { isDeleted: true }, { new: true })
    if (!doc) return res.status(404).json({ error: 'Category not found' })
    return res.json({ ok: true, deleted: 'soft' })
  }

  const doc = await Category.findByIdAndDelete(id)
  if (!doc) return res.status(404).json({ error: 'Category not found' })
  return res.json({ ok: true, deleted: 'hard' })
}

export async function listCategoryManufacturers(req, res) {
  const categoryId = new mongoose.Types.ObjectId(req.params.id)
  const category = await Category.findOne({ _id: categoryId, isDeleted: { $ne: true } }).lean()
  if (!category) return res.status(404).json({ error: 'Category not found' })

  const items = await Manufacturer.find({
    isDeleted: { $ne: true },
    categoryIds: categoryId,
  })
    .sort({ nameLower: 1 })
    .lean()

  res.json({ items })
}

export async function addCategoryManufacturer(req, res) {
  const categoryId = new mongoose.Types.ObjectId(req.params.id)
  const category = await Category.findOne({ _id: categoryId, isDeleted: { $ne: true } }).lean()
  if (!category) return res.status(404).json({ error: 'Category not found' })

  const name = normalizeName(req.validatedBody?.name)
  if (!name) return res.status(400).json({ error: 'Manufacturer name is required' })

  const nameLower = name.toLowerCase()

  let manufacturer = await Manufacturer.findOne({ nameLower, isDeleted: { $ne: true } })
  if (!manufacturer) {
    manufacturer = await Manufacturer.create({ name, categoryIds: [categoryId], isDeleted: false })
  } else {
    manufacturer.name = name
    if (!Array.isArray(manufacturer.categoryIds)) manufacturer.categoryIds = []
    if (!manufacturer.categoryIds.some((x) => x.toString() === categoryId.toString())) {
      manufacturer.categoryIds.push(categoryId)
    }
    await manufacturer.save()
  }

  res.status(201).json({ item: manufacturer })
}

export async function removeCategoryManufacturer(req, res) {
  const categoryId = new mongoose.Types.ObjectId(req.params.id)
  const manufacturerId = new mongoose.Types.ObjectId(req.params.manufacturerId)

  const manufacturer = await Manufacturer.findOne({ _id: manufacturerId, isDeleted: { $ne: true } })
  if (!manufacturer) return res.status(404).json({ error: 'Manufacturer not found' })

  manufacturer.categoryIds = (manufacturer.categoryIds || []).filter((x) => x.toString() !== categoryId.toString())
  await manufacturer.save()

  res.json({ ok: true })
}
