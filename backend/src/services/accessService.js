import { MODULE_KEYS } from '../config/modules.js'

export function fullAccess() {
  const access = {}
  for (const key of MODULE_KEYS) {
    access[key] = { view: true, manage: true }
  }
  return access
}

export function defaultStaffAccess() {
  return {
    dashboard: { view: true, manage: false },
    medicines: { view: true, manage: false },
    purchases: { view: false, manage: false },
    sales: { view: true, manage: true },
    expenses: { view: false, manage: false },
    stock: { view: true, manage: false },
    expiry: { view: true, manage: false },
    reports: { view: true, manage: false },
  }
}

export function sanitizeModuleAccess(input) {
  const out = {}
  if (!input || typeof input !== 'object') return out

  for (const [moduleKey, val] of Object.entries(input)) {
    if (!MODULE_KEYS.includes(moduleKey)) continue
    const view = Boolean(val && typeof val === 'object' ? val.view : false)
    const manage = Boolean(val && typeof val === 'object' ? val.manage : false)
    out[moduleKey] = { view, manage }
  }
  return out
}
