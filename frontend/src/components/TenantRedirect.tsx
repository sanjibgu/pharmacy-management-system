import { Navigate } from 'react-router-dom'
import { getTenantSlug } from '../services/tenant'

export default function TenantRedirect({ to }: { to: string }) {
  const slug = getTenantSlug()
  if (!slug) return <Navigate to="/" replace />
  const normalized = to.startsWith('/') ? to : `/${to}`
  return <Navigate to={`/${slug}${normalized}`} replace />
}

