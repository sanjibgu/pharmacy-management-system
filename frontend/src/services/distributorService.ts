import { apiFetch } from './api'

export type Distributor = {
  _id: string
  supplierName: string
  dlNumber: string
  address: string
  mobileNumber?: string
  email?: string
}

export async function listDistributors(token: string | null) {
  return apiFetch<{ items: Distributor[] }>('/api/suppliers', { token })
}

export async function createDistributor(token: string | null, body: Partial<Distributor>) {
  return apiFetch<{ item: Distributor }>('/api/suppliers', { method: 'POST', token, body })
}

export async function updateDistributor(
  token: string | null,
  id: string,
  body: Partial<Distributor>,
) {
  return apiFetch<{ item: Distributor }>(`/api/suppliers/${id}`, { method: 'PUT', token, body })
}

export async function deleteDistributor(token: string | null, id: string) {
  return apiFetch<{ ok: true }>(`/api/suppliers/${id}`, { method: 'DELETE', token })
}

