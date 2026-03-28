import { Navigate, useLocation, useParams } from 'react-router-dom'
import { setDevTenantSlug } from '../services/tenant'

export default function TenantPathGate() {
  const { tenantSlug } = useParams()
  const loc = useLocation()

  const slug = (tenantSlug || '').trim().toLowerCase()
  if (slug) setDevTenantSlug(slug)

  const rest = loc.pathname.replace(/^\/[^/]+/, '')
  const target = rest && rest !== '/' ? rest : '/login'
  return <Navigate to={target} replace />
}

