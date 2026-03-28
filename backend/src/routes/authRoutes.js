import { Router } from 'express'
import { z } from 'zod'
import { validateBody } from '../middleware/validate.js'
import { requireAuth } from '../middleware/auth.js'
import { login, me, requireTenantForLogin } from '../controllers/authController.js'

const router = Router()

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

router.post('/login', requireTenantForLogin, validateBody(loginSchema), login)
router.get('/me', requireAuth, me)

export default router

