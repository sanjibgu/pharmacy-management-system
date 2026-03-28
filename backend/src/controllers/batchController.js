import mongoose from 'mongoose'
import { Stock } from '../models/Stock.js'

export async function listBatchesByMedicine(req, res) {
  const pharmacyId = req.pharmacyId
  const medicineId = new mongoose.Types.ObjectId(req.params.medicineId)

  const items = await Stock.find({ pharmacyId, medicineId })
    .sort({ expiryDate: 1, batchNumber: 1 })
    .lean()

  res.json({ items })
}

