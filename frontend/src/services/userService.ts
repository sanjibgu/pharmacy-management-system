import { apiFetch } from './api'

export type ModuleDef = { key: string; label: string }
export type ModuleAccess = Record<string, { view: boolean; manage: boolean }>

export function listModules() {
  return apiFetch<{ items: ModuleDef[] }>('/api/meta/modules', { tenant: false })
}

export function listUsers(token: string) {
  return apiFetch<{ items: any[] }>('/api/users', { token })
}

export function createUser(token: string, payload: any) {
  return apiFetch('/api/users', { method: 'POST', token, body: payload })
}

export function updateUserModuleAccess(token: string, userId: string, moduleAccess: ModuleAccess) {
  return apiFetch(`/api/users/${userId}/module-access`, {
    method: 'PATCH',
    token,
    body: { moduleAccess },
  })
}

