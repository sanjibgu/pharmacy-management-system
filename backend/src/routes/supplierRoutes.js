import { Router } from 'express'
import { z } from 'zod'
import { requireTenant } from '../middleware/tenant.js'
import { requireAuth } from '../middleware/auth.js'
import { attachPharmacyId } from '../middleware/attachPharmacyId.js'
import { requireModuleAccess } from '../middleware/requireModuleAccess.js'
import { validateBody } from '../middleware/validate.js'
import { createSupplier, deleteSupplier, listSuppliers, updateSupplier } from '../controllers/supplierController.js'

const router = Router()

router.get(
  '/',
  requireTenant,
  requireAuth,
  attachPharmacyId,
  requireModuleAccess('purchases', 'view'),
  listSuppliers,
)

const createSchema = z.object({
  supplierName: z.string().min(2).trim(),
  supplierCode: z.string().optional(),
  gstNumber: z.string().optional(),
  // Accept common variants; normalize in controller.
  dlNumber: z.string().trim().optional(),
  dlNo: z.string().trim().optional(),
  dl_number: z.string().trim().optional(),
  address: z.string().optional(),
  mobileNumber: z.string().optional(),
  email: z.string().email().optional(),
})

router.post(
  '/',
  requireTenant,
  requireAuth,
  attachPharmacyId,
  requireModuleAccess('purchases', 'manage'),
  validateBody(createSchema),
  createSupplier,
)

const updateSchema = createSchema.partial().refine((body) => Object.keys(body || {}).length > 0, {
  message: 'No fields to update',
})

router.put(
  '/:id',
  requireTenant,
  requireAuth,
  attachPharmacyId,
  requireModuleAccess('purchases', 'manage'),
  validateBody(updateSchema),
  updateSupplier,
)

router.delete(
  '/:id',
  requireTenant,
  requireAuth,
  attachPharmacyId,
  requireModuleAccess('purchases', 'manage'),
  deleteSupplier,
)

export default router
