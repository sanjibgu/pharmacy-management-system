import { Pharmacy } from '../models/Pharmacy.js'

export async function registerPharmacy(req, res) {
  const { pharmacyName, ownerName, email, phone, address } = req.validatedBody

  const pharmacy = await Pharmacy.create({
    pharmacyName,
    ownerName,
    email,
    phone,
    address,
    status: 'pending',
  })

  res.status(201).json({
    id: pharmacy._id,
    status: pharmacy.status,
    message: 'Registration submitted. Waiting for Super Admin approval.',
  })
}

