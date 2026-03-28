import { Router } from 'express'
import { requireTenant } from '../middleware/tenant.js'
import { requireAuth } from '../middleware/auth.js'
import { attachPharmacyId } from '../middleware/attachPharmacyId.js'
import { requireModuleAccess } from '../middleware/requireModuleAccess.js'
import { listBatchesByMedicine } from '../controllers/batchController.js'

const router = Router()

router.get(
  '/:medicineId',
  requireTenant,
  requireAuth,
  attachPharmacyId,
  requireModuleAccess('purchases', 'view'),
  listBatchesByMedicine,
)

export default router

