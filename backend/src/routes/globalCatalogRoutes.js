import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { requireTenant } from '../middleware/tenant.js'
import { requireModuleAccess } from '../middleware/requireModuleAccess.js'
import {
  enableGlobalItem,
  enableGlobalManufacturer,
  suggestGlobalItems,
  suggestGlobalManufacturers,
} from '../controllers/globalCatalogController.js'

const router = Router()

router.get(
  '/items/suggest',
  requireTenant,
  requireAuth,
  requireModuleAccess('medicines', 'view'),
  suggestGlobalItems,
)
router.post(
  '/items/:id/enable',
  requireTenant,
  requireAuth,
  requireModuleAccess('medicines', 'manage'),
  enableGlobalItem,
)

router.get(
  '/manufacturers/suggest',
  requireTenant,
  requireAuth,
  requireModuleAccess('medicines', 'view'),
  suggestGlobalManufacturers,
)
router.post(
  '/manufacturers/:id/enable',
  requireTenant,
  requireAuth,
  requireModuleAccess('medicines', 'manage'),
  enableGlobalManufacturer,
)

export default router

