import { Router } from 'express'
import { z } from 'zod'
import { requireTenant } from '../middleware/tenant.js'
import { requireAuth } from '../middleware/auth.js'
import { attachPharmacyId } from '../middleware/attachPharmacyId.js'
import { requireModuleAccess } from '../middleware/requireModuleAccess.js'
import { validateBody } from '../middleware/validate.js'
import {
  createPurchase,
  deletePurchase,
  getPurchaseDetails,
  listPurchases,
  updatePurchaseHeader,
  updatePurchaseItems,
} from '../controllers/purchaseController.js'

const router = Router()

const purchaseItemSchema = z.object({
  medicineId: z.string().min(1),
  productName: z.string().optional(),
  batchNumber: z.string().min(1),
  hsnCode: z.string().optional(),
  rackLocation: z.string().optional(),
  manufactureDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date(),
  quantity: z.coerce.number().min(0),
  freeQuantity: z.coerce.number().min(0).default(0),
  mrp: z.coerce.number().min(0),
  // Derived server-side from MRP, Discount%, GST%
  purchaseRate: z.coerce.number().min(0).optional(),
  saleRate: z.coerce.number().min(0),
  tradeRate: z.coerce.number().min(0).optional(),
  gstPercent: z.coerce.number().min(0).default(0),
  discountPercent: z.coerce.number().min(0).default(0),
})

const createSchema = z.object({
  header: z.object({
    supplierId: z.string().min(1),
    invoiceNumber: z.string().min(1),
    invoiceDate: z.coerce.date(),
    purchaseDate: z.coerce.date(),
    paymentType: z.enum(['Cash', 'Credit', 'UPI']),
    paidAmount: z.coerce.number().min(0).optional(),
    dueDate: z.coerce.date().optional(),
    remarks: z.string().optional(),
  }),
  items: z.array(purchaseItemSchema).min(1),
})

router.post(
  '/',
  requireTenant,
  requireAuth,
  attachPharmacyId,
  requireModuleAccess('purchases', 'manage'),
  validateBody(createSchema),
  createPurchase,
)

router.get(
  '/',
  requireTenant,
  requireAuth,
  attachPharmacyId,
  requireModuleAccess('purchases', 'view'),
  listPurchases,
)

router.get(
  '/:id',
  requireTenant,
  requireAuth,
  attachPharmacyId,
  requireModuleAccess('purchases', 'view'),
  getPurchaseDetails,
)

router.delete(
  '/:id',
  requireTenant,
  requireAuth,
  attachPharmacyId,
  requireModuleAccess('purchases', 'manage'),
  deletePurchase,
)

const updateHeaderSchema = z
  .object({
    supplierId: z.string().min(1).optional(),
    invoiceNumber: z.string().min(1).optional(),
    invoiceDate: z.coerce.date().optional(),
    purchaseDate: z.coerce.date().optional(),
    paymentType: z.enum(['Cash', 'Credit', 'UPI']).optional(),
    paidAmount: z.coerce.number().min(0).optional(),
    dueDate: z.preprocess((v) => (v === '' || v === null ? undefined : v), z.coerce.date().optional()),
    remarks: z.string().optional(),
  })
  .refine((body) => Object.keys(body || {}).length > 0, { message: 'No fields to update' })

router.put(
  '/:id',
  requireTenant,
  requireAuth,
  attachPharmacyId,
  requireModuleAccess('purchases', 'manage'),
  validateBody(updateHeaderSchema),
  updatePurchaseHeader,
)

const updateItemsSchema = z.object({
  header: updateHeaderSchema.optional(),
  items: z.array(purchaseItemSchema).min(1),
})

router.put(
  '/:id/items',
  requireTenant,
  requireAuth,
  attachPharmacyId,
  requireModuleAccess('purchases', 'manage'),
  validateBody(updateItemsSchema),
  updatePurchaseItems,
)

export default router
