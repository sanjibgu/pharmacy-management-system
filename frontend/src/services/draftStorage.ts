export type DraftKeyInput = {
  kind: string
  tenantSlug?: string | null
  userId?: string | null
  extra?: string | null
}

export function makeDraftKey({ kind, tenantSlug, userId, extra }: DraftKeyInput) {
  const k = String(kind || '').trim() || 'draft'
  const t = String(tenantSlug || '').trim() || 'no-tenant'
  const u = String(userId || '').trim() || 'no-user'
  const e = extra ? `:${String(extra).trim()}` : ''
  return `${k}:v1:${t}:${u}${e}`
}

export function loadDraft<T extends object>(
  key: string,
  { maxAgeMs = 1000 * 60 * 60 * 24 * 7 }: { maxAgeMs?: number } = {},
): (T & { updatedAt?: number }) | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as any
    if (!parsed || typeof parsed !== 'object') return null
    const updatedAt = Number(parsed.updatedAt || 0)
    if (updatedAt && Date.now() - updatedAt > maxAgeMs) {
      localStorage.removeItem(key)
      return null
    }
    return parsed as any
  } catch {
    return null
  }
}

export function saveDraft(key: string, payload: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}

export function clearDraft(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

