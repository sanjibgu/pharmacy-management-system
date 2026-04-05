import { Router } from 'express'
import { z } from 'zod'
import { requireTenant } from '../middleware/tenant.js'
import { requireAuth } from '../middleware/auth.js'
import { attachPharmacyId } from '../middleware/attachPharmacyId.js'
import { requireModuleAccess } from '../middleware/requireModuleAccess.js'
import { validateBody } from '../middleware/validate.js'
import { createSale, deleteSale, getSaleBatches, getSaleDetails, listSales, updateSaleHeader, updateSaleItems } from '../controllers/saleController.js'

const router = Router()

router.get(
  '/batches/:medicineId',
  requireTenant,
  requireAuth,
  attachPharmacyId,
  requireModuleAccess('sales', 'view'),
  getSaleBatches,
)

const saleItemSchema = z.object({
  medicineId: z.string().min(1),
  batchNumber: z.string().min(1),
  expiryDate: z.coerce.date(),
  unitType: z.enum(['pack', 'unit']).default('pack'),
  quantity: z.coerce.number().positive(),
  saleRate: z.coerce.number().min(0),
})

const createSchema = z.object({
  header: z.object({
    saleDate: z.coerce.date().optional(),
    paymentType: z.enum(['Cash', 'Credit', 'UPI']),
    paidAmount: z.coerce.number().min(0).optional(),
    billDiscountPercent: z.coerce.number().min(0).max(100).optional(),
    patientName: z.string().max(120).optional(),
    phone: z.string().max(30).optional(),
    doctorName: z.string().max(120).optional(),
    remarks: z.string().optional(),
  }),
  items: z.array(saleItemSchema).min(1),
})

router.post(
  '/create',
  requireTenant,
  requireAuth,
  attachPharmacyId,
  requireModuleAccess('sales', 'manage'),
  validateBody(createSchema),
  createSale,
)

router.get(
  '/',
  requireTenant,
  requireAuth,
  attachPharmacyId,
  requireModuleAccess('sales', 'view'),
  listSales,
)

router.get(
  '/:id',
  requireTenant,
  requireAuth,
  attachPharmacyId,
  requireModuleAccess('sales', 'view'),
  getSaleDetails,
)

router.delete(
  '/:id',
  requireTenant,
  requireAuth,
  attachPharmacyId,
  requireModuleAccess('sales', 'manage'),
  deleteSale,
)

const updateHeaderSchema = z
  .object({
    saleDate: z.coerce.date().optional(),
    paymentType: z.enum(['Cash', 'Credit', 'UPI']).optional(),
    paidAmount: z.coerce.number().min(0).optional(),
    patientName: z.string().max(120).optional(),
    phone: z.string().max(30).optional(),
    doctorName: z.string().max(120).optional(),
    remarks: z.string().optional(),
  })
  .refine((body) => Object.keys(body || {}).length > 0, { message: 'No fields to update' })

router.put(
  '/:id',
  requireTenant,
  requireAuth,
  attachPharmacyId,
  requireModuleAccess('sales', 'manage'),
  validateBody(updateHeaderSchema),
  updateSaleHeader,
)

const updateItemsSchema = z.object({
  header: z
    .object({
      saleDate: z.coerce.date().optional(),
      paymentType: z.enum(['Cash', 'Credit', 'UPI']).optional(),
      paidAmount: z.coerce.number().min(0).optional(),
      billDiscountPercent: z.coerce.number().min(0).max(100).optional(),
      patientName: z.string().max(120).optional(),
      phone: z.string().max(30).optional(),
      doctorName: z.string().max(120).optional(),
      remarks: z.string().optional(),
    })
    .optional(),
  items: z.array(saleItemSchema).min(1),
})

router.put(
  '/:id/items',
  requireTenant,
  requireAuth,
  attachPharmacyId,
  requireModuleAccess('sales', 'manage'),
  validateBody(updateItemsSchema),
  updateSaleItems,
)

export default router
