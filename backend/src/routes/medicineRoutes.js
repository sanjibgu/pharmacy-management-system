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
  setGlobalItemEnabled,
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
  allowLooseSale: z.coerce.boolean().optional().default(false),
  customFields: z.record(z.string(), z.unknown()).optional(),
})

const updateSchema = z.object({
  medicineName: z.string().min(2).optional(),
  manufacturer: z.string().min(1).optional(),
  dosageForm: z.string().optional(),
  strength: z.string().optional(),
  category: z.string().min(1).optional(),
  rackLocation: z.string().optional(),
  hsnCode: z.string().min(1).optional(),
  gstPercent: z.coerce.number().min(0).optional(),
  allowLooseSale: z.coerce.boolean().optional(),
  isActive: z.coerce.boolean().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
})

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

router.patch(
  '/global/:id',
  requireTenant,
  requireAuth,
  requireModuleAccess('medicines', 'manage'),
  validateBody(z.object({ isActive: z.coerce.boolean() })),
  setGlobalItemEnabled,
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
