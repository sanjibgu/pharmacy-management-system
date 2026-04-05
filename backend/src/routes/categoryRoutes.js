import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { validateBody } from '../middleware/validate.js'
import { requireSuperAdmin } from '../middleware/requireSuperAdmin.js'
import {
  createCategory,
  deleteCategory,
  listCategories,
  listCategoryManufacturers,
  addCategoryManufacturer,
  removeCategoryManufacturer,
  updateCategory,
} from '../controllers/categoryController.js'

const router = Router()

router.get('/', requireAuth, listCategories)

const fieldSchema = z
  .object({
    key: z.string().min(1).max(40).regex(/^[a-z][a-z0-9_]*$/i, 'Invalid field key'),
    label: z.string().min(1).max(60),
    type: z.enum(['text', 'number', 'select', 'boolean', 'date']),
    required: z.coerce.boolean().optional().default(false),
    options: z.array(z.string().min(1).max(50)).optional(),
    min: z.coerce.number().optional(),
    max: z.coerce.number().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.type === 'select') {
      if (!val.options || val.options.length === 0) {
        ctx.addIssue({ code: 'custom', path: ['options'], message: 'Options are required for select field' })
      }
    }
  })

const upsertSchema = z.object({
  name: z.string().min(2).max(120),
  fields: z.array(fieldSchema).optional().default([]),
  looseSaleAllowed: z.coerce.boolean().optional().default(false),
})

router.post('/', requireAuth, requireSuperAdmin, validateBody(upsertSchema), createCategory)
router.patch('/:id', requireAuth, requireSuperAdmin, validateBody(upsertSchema), updateCategory)
router.delete('/:id', requireAuth, requireSuperAdmin, deleteCategory)

const addManufacturerSchema = z.object({
  name: z.string().min(2).max(120),
})

router.get('/:id/manufacturers', requireAuth, requireSuperAdmin, listCategoryManufacturers)
router.post(
  '/:id/manufacturers',
  requireAuth,
  requireSuperAdmin,
  validateBody(addManufacturerSchema),
  addCategoryManufacturer,
)
router.delete(
  '/:id/manufacturers/:manufacturerId',
  requireAuth,
  requireSuperAdmin,
  removeCategoryManufacturer,
)

export default router
