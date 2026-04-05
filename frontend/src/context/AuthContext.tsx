import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

type User = {
  id: string
  name: string
  email: string
  role: 'SuperAdmin' | 'PharmacyAdmin' | 'Staff'
  pharmacyId: string | null
  moduleAccess?: Record<string, { view?: boolean; manage?: boolean }>
}

type AuthState = {
  token: string | null
  user: User | null
}

type AuthContextValue = AuthState & {
  setAuth: (next: AuthState) => void
  logout: () => void
}

const STORAGE_KEY = 'auth'

function loadInitial(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { token: null, user: null }
    const parsed = JSON.parse(raw) as AuthState
    return parsed?.token ? parsed : { token: null, user: null }
  } catch {
    return { token: null, user: null }
  }
}

const AuthContext = createContext<AuthContextValue | null>(null)

function decodeJwtExpMs(token: string) {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=')
    const json = atob(padded)
    const payload = JSON.parse(json) as { exp?: number }
    const exp = Number(payload?.exp)
    if (!Number.isFinite(exp) || exp <= 0) return null
    return exp * 1000
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => loadInitial())

  const setAuth = useCallback((next: AuthState) => {
    setState(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }, [])

  const logout = useCallback(() => {
    setAuth({ token: null, user: null })
  }, [setAuth])

  const logoutTimer = useRef<number | null>(null)

  // Auto logout when JWT expires (client-side timer; server-side still enforces expiry).
  useEffect(() => {
    if (logoutTimer.current != null) {
      clearTimeout(logoutTimer.current)
      logoutTimer.current = null
    }

    if (!state.token) return

    const expMs = decodeJwtExpMs(state.token)
    if (!expMs) return

    // Logout a bit early to avoid "expired" flashes during API calls.
    const skewMs = 5000
    const delay = Math.max(0, expMs - Date.now() - skewMs)
    logoutTimer.current = window.setTimeout(() => {
      logout()
    }, delay)

    return () => {
      if (logoutTimer.current != null) {
        clearTimeout(logoutTimer.current)
        logoutTimer.current = null
      }
    }
  }, [logout, state.token])

  // Auto logout on 401 responses (dispatched by apiFetch).
  useEffect(() => {
    const handler = () => logout()
    window.addEventListener('auth:logout', handler)
    return () => window.removeEventListener('auth:logout', handler)
  }, [logout])

  const value = useMemo<AuthContextValue>(() => ({ ...state, setAuth, logout }), [logout, setAuth, state])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
