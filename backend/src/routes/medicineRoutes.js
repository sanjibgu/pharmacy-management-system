import { Router } from 'express'
import { z } from 'zod'
import { validateBody } from '../middleware/validate.js'
import { requireAuth } from '../middleware/auth.js'
import { requireTenant } from '../middleware/tenant.js'
import { requireModuleAccess } from '../middleware/requireModuleAccess.js'
import {
  createMedicine,
  deleteMedicine,
  getMedicine,
  getMedicineUsage,
  listMedicines,
  searchMedicines,
  updateMedicine,
} from '../controllers/medicineController.js'

const router = Router()

const createSchema = z.object({
  medicineName: z.string().min(2),
  manufacturer: z.string().min(1),
  dosageForm: z.string().optional().default(''),
  strength: z.string().optional().default(''),
  category: z.string().min(1),
  rackLocation: z.string().optional(),
  hsnCode: z.string().min(1),
  gstPercent: z.coerce.number().min(0),
  unitsPerStrip: z.coerce.number().int().min(1),
  allowLooseSale: z.coerce.boolean().default(false),
})

const updateSchema = createSchema.partial()

router.get(
  '/search',
  requireTenant,
  requireAuth,
  requireModuleAccess('purchases', 'view'),
  searchMedicines,
)

router.get(
  '/',
  requireTenant,
  requireAuth,
  requireModuleAccess('medicines', 'view'),
  listMedicines,
)
router.get(
  '/:id/usage',
  requireTenant,
  requireAuth,
  requireModuleAccess('medicines', 'view'),
  getMedicineUsage,
)
router.post(
  '/',
  requireTenant,
  requireAuth,
  requireModuleAccess('medicines', 'manage'),
  validateBody(createSchema),
  createMedicine,
)
router.get(
  '/:id',
  requireTenant,
  requireAuth,
  requireModuleAccess('medicines', 'view'),
  getMedicine,
)
router.patch(
  '/:id',
  requireTenant,
  requireAuth,
  requireModuleAccess('medicines', 'manage'),
  validateBody(updateSchema),
  updateMedicine,
)
router.delete(
  '/:id',
  requireTenant,
  requireAuth,
  requireModuleAccess('medicines', 'manage'),
  deleteMedicine,
)

export default router
