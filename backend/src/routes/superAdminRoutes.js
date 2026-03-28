import { Router } from 'express'
import { z } from 'zod'
import { validateBody } from '../middleware/validate.js'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import {
  approvePharmacy,
  listPendingPharmacies,
  rejectPharmacy,
  superAdminLogin,
} from '../controllers/superAdminController.js'

const router = Router()

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

router.post('/auth/login', validateBody(loginSchema), superAdminLogin)

router.get(
  '/pharmacies/pending',
  requireAuth,
  requireRole('SuperAdmin'),
  listPendingPharmacies,
)

const approveSchema = z.object({
  adminName: z.string().min(2),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
})

router.patch(
  '/pharmacies/:id/approve',
  requireAuth,
  requireRole('SuperAdmin'),
  validateBody(approveSchema),
  approvePharmacy,
)

const rejectSchema = z.object({
  reason: z.string().min(2).optional(),
})

router.patch(
  '/pharmacies/:id/reject',
  requireAuth,
  requireRole('SuperAdmin'),
  validateBody(rejectSchema),
  rejectPharmacy,
)

export default router

