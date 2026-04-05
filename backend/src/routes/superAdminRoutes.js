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
import { listApprovalRequests, approveApprovalRequest, rejectApprovalRequest } from '../controllers/approvalController.js'
import {
  deletePharmacy,
  listPharmacies,
  resetPharmacyAdminPassword,
  setPharmacyActive,
  updatePharmacy,
} from '../controllers/pharmacyAdminController.js'

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

router.get('/pharmacies', requireAuth, requireRole('SuperAdmin'), listPharmacies)

const updatePharmacySchema = z.object({
  pharmacyName: z.string().min(2).max(200).optional(),
  ownerName: z.string().min(2).max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(6).max(40).optional(),
  address: z.string().min(2).max(500).optional(),
})
router.patch(
  '/pharmacies/:id',
  requireAuth,
  requireRole('SuperAdmin'),
  validateBody(updatePharmacySchema),
  updatePharmacy,
)

const activeSchema = z.object({
  isActive: z.coerce.boolean(),
  remark: z.string().optional(),
})
router.patch(
  '/pharmacies/:id/active',
  requireAuth,
  requireRole('SuperAdmin'),
  validateBody(activeSchema),
  setPharmacyActive,
)

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8),
})
router.post(
  '/pharmacies/:id/reset-password',
  requireAuth,
  requireRole('SuperAdmin'),
  validateBody(resetPasswordSchema),
  resetPharmacyAdminPassword,
)

router.delete('/pharmacies/:id', requireAuth, requireRole('SuperAdmin'), deletePharmacy)

router.get('/approvals', requireAuth, requireRole('SuperAdmin'), listApprovalRequests)

router.post('/approvals/:id/approve', requireAuth, requireRole('SuperAdmin'), approveApprovalRequest)

const rejectApprovalSchema = z.object({
  note: z.string().min(2).max(500).optional(),
})
router.post(
  '/approvals/:id/reject',
  requireAuth,
  requireRole('SuperAdmin'),
  validateBody(rejectApprovalSchema),
  rejectApprovalRequest,
)

export default router
