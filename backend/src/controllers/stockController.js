import { Stock } from '../models/Stock.js'
import { Medicine } from '../models/Medicine.js'

export async function listStocks(req, res) {
  const pharmacyId = req.pharmacyId

  const stocks = await Stock.find({ pharmacyId }).sort({ updatedAt: -1, createdAt: -1 }).lean()

  const medicineIds = Array.from(
    new Set(stocks.map((s) => String(s.medicineId || '')).filter(Boolean)),
  )

  const medicines = medicineIds.length
    ? await Medicine.find({ pharmacyId, _id: { $in: medicineIds }, isDeleted: { $ne: true } })
        .select('medicineName manufacturer category dosageForm unitsPerStrip allowLooseSale rackLocation hsnCode gstPercent')
        .lean()
    : []

  const medicineById = new Map(medicines.map((m) => [String(m._id), m]))

  const items = stocks.map((s) => {
    const m = medicineById.get(String(s.medicineId || ''))
    return {
      ...s,
      medicine: m
        ? {
            _id: m._id,
            medicineName: m.medicineName,
            manufacturer: m.manufacturer || '',
            category: m.category || m.dosageForm || '',
            dosageForm: m.dosageForm || m.category || '',
            unitsPerStrip: Number(m.unitsPerStrip || 0),
            allowLooseSale: Boolean(m.allowLooseSale),
            defaultRackLocation: m.rackLocation || '',
            hsnCode: m.hsnCode || '',
            gstPercent: Number(m.gstPercent || 0),
          }
        : null,
    }
  })

  res.json({ items })
}

