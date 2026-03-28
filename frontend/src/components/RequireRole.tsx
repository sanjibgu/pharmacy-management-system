import { Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { ReactNode } from 'react'

export default function RequireRole({
  role,
  children,
  loginPath,
}: {
  role: 'SuperAdmin' | 'PharmacyAdmin' | 'Staff'
  children: ReactNode
  loginPath?: string
}) {
  const { user } = useAuth()
  const { tenantSlug } = useParams()
  const resolvedLoginPath =
    loginPath || (tenantSlug ? `/${tenantSlug}/login` : '/login')

  if (!user) return <Navigate to={resolvedLoginPath} replace />
  if (user.role !== role) return <Navigate to="/" replace />
  return <>{children}</>
}
