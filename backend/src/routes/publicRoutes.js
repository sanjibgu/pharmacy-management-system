import { Router } from 'express'
import { z } from 'zod'
import { validateBody } from '../middleware/validate.js'
import { registerPharmacy } from '../controllers/pharmacyRegistrationController.js'

const router = Router()

const registerSchema = z.object({
  pharmacyName: z.string().min(2),
  ownerName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(6),
  address: z.string().min(5),
})

router.post('/pharmacies/register', validateBody(registerSchema), registerPharmacy)

export default router

