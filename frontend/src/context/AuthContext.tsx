import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => loadInitial())

  const value = useMemo<AuthContextValue>(() => {
    function setAuth(next: AuthState) {
      setState(next)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    }
    function logout() {
      setAuth({ token: null, user: null })
    }
    return { ...state, setAuth, logout }
  }, [state])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
