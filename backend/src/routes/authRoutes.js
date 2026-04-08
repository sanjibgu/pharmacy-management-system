import { Router } from 'express'
import { z } from 'zod'
import { validateBody } from '../middleware/validate.js'
import { requireAuth } from '../middleware/auth.js'
import { changePassword, login, me, requireTenantForLogin } from '../controllers/authController.js'

const router = Router()

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

router.post('/login', requireTenantForLogin, validateBody(loginSchema), login)
router.get('/me', requireAuth, me)

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
    confirmNewPassword: z.string().min(8),
  })
  .refine((v) => v.newPassword === v.confirmNewPassword, { message: 'Passwords do not match', path: ['confirmNewPassword'] })

router.post('/change-password', requireAuth, validateBody(changePasswordSchema), changePassword)

export default router
