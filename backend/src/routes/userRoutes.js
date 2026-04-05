import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { requireTenant } from '../middleware/tenant.js'
import { validateBody } from '../middleware/validate.js'
import { requireModuleAccess } from '../middleware/requireModuleAccess.js'
import { createUser, listUsers, updateUserModuleAccess } from '../controllers/userController.js'
import { z } from 'zod'

const router = Router()

router.get('/', requireTenant, requireAuth, requireModuleAccess('users', 'view'), listUsers)

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(6).optional(),
  password: z.string().min(8),
  role: z.enum(['PharmacyAdmin', 'Staff']).default('Staff'),
  moduleAccess: z.record(z.string(), z.unknown()).optional(),
})

router.post(
  '/',
  requireTenant,
  requireAuth,
  requireModuleAccess('users', 'manage'),
  validateBody(createSchema),
  createUser,
)

const accessSchema = z.object({
  moduleAccess: z.record(z.string(), z.unknown()),
})

router.patch(
  '/:id/module-access',
  requireTenant,
  requireAuth,
  requireModuleAccess('users', 'manage'),
  validateBody(accessSchema),
  updateUserModuleAccess,
)

export default router
