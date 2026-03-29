import { Router } from 'express'
import { requireTenant } from '../middleware/tenant.js'
import { requireAuth } from '../middleware/auth.js'
import { attachPharmacyId } from '../middleware/attachPharmacyId.js'
import { requireModuleAccess } from '../middleware/requireModuleAccess.js'
import { listStocks } from '../controllers/stockController.js'

const router = Router()

router.get(
  '/',
  requireTenant,
  requireAuth,
  attachPharmacyId,
  requireModuleAccess('medicines', 'view'),
  listStocks,
)

export default router

