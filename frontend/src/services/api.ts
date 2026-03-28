import { getTenantSlug } from './tenant'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')

export type ApiError = { error: string; details?: unknown }

type ApiFetchOptions = {
  method?: string
  body?: unknown
  token?: string | null
  tenant?: boolean
}

export async function apiFetch<T>(path: string, opts: ApiFetchOptions = {}): Promise<T> {
  const { method = 'GET', body, token, tenant = true } = opts
  const headers: Record<string, string> = { Accept: 'application/json' }

  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  if (tenant) {
    const slug = getTenantSlug()
    if (slug) headers['X-Tenant-Slug'] = slug
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const data = (await res.json().catch(() => ({}))) as unknown
  if (!res.ok) {
    const err = (data || { error: 'Request failed' }) as ApiError
    const msg = String(err.error || 'Request failed')
    if (/E11000 duplicate key/i.test(msg) || /duplicate key error/i.test(msg)) {
      throw new Error('Already exists.')
    }
    throw new Error(msg)
  }
  return data as T
}
