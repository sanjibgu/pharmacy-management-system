import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { requireTenant } from '../middleware/tenant.js'
import { validateBody } from '../middleware/validate.js'
import { requireModuleAccess } from '../middleware/requireModuleAccess.js'
import {
  createManufacturer,
  deleteManufacturer,
  listManufacturers,
  setGlobalManufacturerEnabled,
  updateManufacturer,
} from '../controllers/manufacturerController.js'

const router = Router()

const createSchema = z.object({
  name: z.string().min(2).max(120),
  categoryIds: z.array(z.string().min(1)).min(1, 'Select at least one category'),
  isActive: z.coerce.boolean().optional(),
})

// IMPORTANT: no defaults on update, otherwise PATCH requests that only send `isActive`
// would unintentionally overwrite `categoryIds` with an empty array.
const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  categoryIds: z.array(z.string().min(1)).min(1, 'Select at least one category').optional(),
  isActive: z.coerce.boolean().optional(),
})

router.get(
  '/',
  requireTenant,
  requireAuth,
  requireModuleAccess('medicines', 'view'),
  listManufacturers,
)

router.patch(
  '/global/:id',
  requireTenant,
  requireAuth,
  requireModuleAccess('medicines', 'manage'),
  validateBody(z.object({ isActive: z.coerce.boolean() })),
  setGlobalManufacturerEnabled,
)

router.post(
  '/',
  requireTenant,
  requireAuth,
  requireModuleAccess('medicines', 'manage'),
  validateBody(createSchema),
  createManufacturer,
)

router.patch(
  '/:id',
  requireTenant,
  requireAuth,
  requireModuleAccess('medicines', 'manage'),
  validateBody(updateSchema),
  updateManufacturer,
)

router.delete(
  '/:id',
  requireTenant,
  requireAuth,
  requireModuleAccess('medicines', 'manage'),
  deleteManufacturer,
)

export default router
