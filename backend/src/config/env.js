import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().min(1),
  ROOT_DOMAIN: z.string().default('mypharmacyapp.com'),
  DEV_TENANT_PROTOCOL: z.string().default('http'),
  DEV_TENANT_HOST: z.string().default('localhost:5173'),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('1h'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
})

const parsed = schema.parse(process.env)

export const env = {
  nodeEnv: parsed.NODE_ENV,
  port: parsed.PORT,
  mongoUri: parsed.MONGODB_URI,
  rootDomain: parsed.ROOT_DOMAIN,
  devTenantProtocol: parsed.DEV_TENANT_PROTOCOL,
  devTenantHost: parsed.DEV_TENANT_HOST,
  jwtAccessSecret: parsed.JWT_ACCESS_SECRET,
  jwtAccessExpiresIn: parsed.JWT_ACCESS_EXPIRES_IN,
  corsOrigins: parsed.CORS_ORIGINS.split(',').map((s) => s.trim()),
}
