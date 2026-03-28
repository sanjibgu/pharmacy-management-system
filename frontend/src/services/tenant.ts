const STORAGE_KEY = 'devTenantSlug'

export function getTenantSlugFromHost(hostname: string) {
  const host = (hostname || '').toLowerCase()
  if (!host) return null
  if (host === 'localhost') return null
  if (host.endsWith('.localhost')) return host.split('.')[0]
  const parts = host.split('.')
  if (parts.length >= 3 && parts[0] !== 'www') return parts[0]
  return null
}

export function getTenantSlug() {
  const fromHost = getTenantSlugFromHost(window.location.hostname)
  if (fromHost) return fromHost
  return localStorage.getItem(STORAGE_KEY) || import.meta.env.VITE_DEV_TENANT_SLUG || null
}

export function setDevTenantSlug(slug: string) {
  localStorage.setItem(STORAGE_KEY, slug.trim().toLowerCase())
}

