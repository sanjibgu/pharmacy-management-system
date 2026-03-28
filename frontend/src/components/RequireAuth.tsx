import { Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { ReactNode } from 'react'

export default function RequireAuth({
  children,
  loginPath,
}: {
  children: ReactNode
  loginPath?: string
}) {
  const { token } = useAuth()
  const { tenantSlug } = useParams()
  const resolvedLoginPath =
    loginPath || (tenantSlug ? `/${tenantSlug}/login` : '/login')

  if (!token) return <Navigate to={resolvedLoginPath} replace />
  return <>{children}</>
}
