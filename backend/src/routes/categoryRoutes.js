import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { validateBody } from '../middleware/validate.js'
import { requireSuperAdmin } from '../middleware/requireSuperAdmin.js'
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '../controllers/categoryController.js'

const router = Router()

router.get('/', requireAuth, listCategories)

const upsertSchema = z.object({ name: z.string().min(2).max(120) })

router.post('/', requireAuth, requireSuperAdmin, validateBody(upsertSchema), createCategory)
router.patch('/:id', requireAuth, requireSuperAdmin, validateBody(upsertSchema), updateCategory)
router.delete('/:id', requireAuth, requireSuperAdmin, deleteCategory)

export default router

