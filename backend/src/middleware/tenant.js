import { env } from '../config/env.js'
import { Pharmacy } from '../models/Pharmacy.js'

function getHost(req) {
  const forwarded = req.headers['x-forwarded-host']
  const host = Array.isArray(forwarded) ? forwarded[0] : forwarded
  return (host || req.headers.host || '').toString()
}

function stripPort(host) {
  return host.split(':')[0].trim().toLowerCase()
}

function extractSlugFromHost(hostname) {
  const root = env.rootDomain.toLowerCase()
  if (!hostname) return null

  // dev convenience: abcpharmacy.localhost or localhost with X-Tenant-Slug
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    const parts = hostname.split('.')
    if (parts.length >= 2) return parts[0]
    return null
  }

  if (hostname === root) return null
  if (hostname === `www.${root}`) return null
  if (!hostname.endsWith(`.${root}`)) return null

  const slug = hostname.slice(0, -1 * (`.${root}`.length))
  if (!slug) return null
  if (slug.includes('.')) return null
  return slug
}

export async function tenantResolver(req, res, next) {
  req.tenant = null

  const hostname = stripPort(getHost(req))
  const headerSlug = (req.headers['x-tenant-slug'] || '').toString().trim()
  const slug = headerSlug || extractSlugFromHost(hostname)

  if (!slug) return next()

  const pharmacy = await Pharmacy.findOne({ slug, status: 'approved' }).lean()
  if (!pharmacy) return next()

  req.tenant = {
    slug,
    pharmacyId: pharmacy._id.toString(),
    pharmacy,
  }
  req.pharmacyId = pharmacy._id.toString()
  return next()
}

export function requireTenant(req, res, next) {
  if (!req.tenant) {
    return res.status(400).json({ error: 'Tenant not resolved for this request' })
  }
  return next()
}

