import { Router } from 'express'
import { requireTenant } from '../middleware/tenant.js'
import { requireAuth } from '../middleware/auth.js'
import { attachPharmacyId } from '../middleware/attachPharmacyId.js'
import { requireModuleAccess } from '../middleware/requireModuleAccess.js'
import { getItemsSoldReport, getProfitReport } from '../controllers/reportController.js'

const router = Router()

router.get('/profit', requireTenant, requireAuth, attachPharmacyId, requireModuleAccess('reports', 'view'), getProfitReport)
router.get('/items-sold', requireTenant, requireAuth, attachPharmacyId, requireModuleAccess('reports', 'view'), getItemsSoldReport)

export default router
