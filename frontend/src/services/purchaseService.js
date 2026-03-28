import { apiFetch } from './api'

export function listSuppliers(token) {
  return apiFetch('/api/suppliers', { token })
}

export function createSupplier(token, payload) {
  return apiFetch('/api/suppliers', { method: 'POST', token, body: payload })
}

export function searchMedicines(token, q) {
  const qs = new URLSearchParams({ q: q || '' }).toString()
  return apiFetch(`/api/medicines/search?${qs}`, { token })
}

export function createMedicine(token, payload) {
  return apiFetch('/api/medicines', { method: 'POST', token, body: payload })
}

export function createPurchase(token, payload) {
  return apiFetch('/api/purchase/create', { method: 'POST', token, body: payload })
}

export function getBatches(token, medicineId) {
  return apiFetch(`/api/batches/${medicineId}`, { token })
}
