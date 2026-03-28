import { Navigate, Outlet, useParams } from 'react-router-dom'
import { setDevTenantSlug } from '../services/tenant'

export default function TenantLayout() {
  const { tenantSlug } = useParams()
  const slug = (tenantSlug || '').trim().toLowerCase()

  if (!slug) return <Navigate to="/" replace />
  setDevTenantSlug(slug)

  return <Outlet />
}

