import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'

import { env } from './config/env.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'
import { tenantResolver } from './middleware/tenant.js'

import authRoutes from './routes/authRoutes.js'
import medicineRoutes from './routes/medicineRoutes.js'
import metaRoutes from './routes/metaRoutes.js'
import publicRoutes from './routes/publicRoutes.js'
import superAdminRoutes from './routes/superAdminRoutes.js'
import userRoutes from './routes/userRoutes.js'
import purchaseRoutes from './routes/purchaseRoutes.js'
import supplierRoutes from './routes/supplierRoutes.js'
import batchRoutes from './routes/batchRoutes.js'
import purchaseLegacyRoutes from './routes/purchaseLegacyRoutes.js'
import salesRoutes from './routes/salesRoutes.js'
import categoryRoutes from './routes/categoryRoutes.js'
import stockRoutes from './routes/stockRoutes.js'
import reportRoutes from './routes/reportRoutes.js'
import manufacturerRoutes from './routes/manufacturerRoutes.js'
import globalCatalogRoutes from './routes/globalCatalogRoutes.js'

export function createApp() {
  const app = express()

  app.set('trust proxy', true)

  app.use(helmet())
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin) return cb(null, true)
        if (env.corsOrigins.includes(origin)) return cb(null, true)
        if (env.nodeEnv === 'development') {
          try {
            const u = new URL(origin)
            const isViteDevPort = u.port === '5173'
            const isLocalhostFamily =
              u.hostname === 'localhost' ||
              u.hostname.endsWith('.localhost') ||
              u.hostname === '127.0.0.1'
            if (u.protocol === 'http:' && isViteDevPort && isLocalhostFamily) {
              return cb(null, true)
            }
          } catch {
            // fallthrough
          }
        }
        return cb(new Error('CORS origin not allowed'))
      },
      credentials: true,
    }),
  )
  app.use(express.json({ limit: '1mb' }))
  app.use(morgan('dev'))

  // Resolves pharmacy tenant from subdomain and attaches req.tenant (when applicable)
  app.use(tenantResolver)

  app.get('/api/health', (req, res) => {
    res.json({
      ok: true,
      env: env.nodeEnv,
      tenant: req.tenant
        ? { id: req.tenant.pharmacyId, slug: req.tenant.slug }
        : null,
    })
  })

  app.use('/api/public', publicRoutes)
  app.use('/api/meta', metaRoutes)
  app.use('/api/auth', authRoutes)
  app.use('/api/superadmin', superAdminRoutes)

  app.use('/api/medicines', medicineRoutes)
  app.use('/api/manufacturers', manufacturerRoutes)
  app.use('/api/categories', categoryRoutes)
  app.use('/api/global', globalCatalogRoutes)
  app.use('/api/users', userRoutes)
  app.use('/api/purchases', purchaseRoutes)
  app.use('/api/purchase', purchaseLegacyRoutes)
  app.use('/api/suppliers', supplierRoutes)
  app.use('/api/batches', batchRoutes)
  app.use('/api/sales', salesRoutes)
  app.use('/api/stocks', stockRoutes)
  app.use('/api/reports', reportRoutes)

  app.use(notFound)
  app.use(errorHandler)

  return app
}
