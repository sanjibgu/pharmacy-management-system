import { apiFetch } from './api'

export function searchMedicines(token, q) {
  const qs = new URLSearchParams({ q: q || '' }).toString()
  return apiFetch(`/api/medicines/search?${qs}`, { token })
}

export function getSaleBatches(token, medicineId) {
  return apiFetch(`/api/sales/batches/${medicineId}`, { token })
}

export function createSale(token, payload) {
  return apiFetch('/api/sales/create', { method: 'POST', token, body: payload })
}

