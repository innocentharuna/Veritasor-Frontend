import { createContext, useCallback, useContext, useMemo, useState } from 'react'

/**
 * Client-side session state for the mock sign-in flow.
 *
 * This is a UX guard only: the backend must enforce authentication on every
 * request. Only non-secret display data is persisted — never store tokens or
 * passwords here.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuthUser = {
  name: string
  email: string
}

type AuthContextValue = {
  user: AuthUser | null
  isAuthenticated: boolean
  signIn: (user: AuthUser) => void
  signOut: () => void
}

// ─── Storage ──────────────────────────────────────────────────────────────────

export const AUTH_STORAGE_KEY = 'veritasor_session'

function readSession(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AuthUser>
    if (typeof parsed?.name !== 'string' || typeof parsed?.email !== 'string') return null
    return { name: parsed.name, email: parsed.email }
  } catch {
    return null
  }
}

function writeSession(user: AuthUser | null) {
  try {
    if (user) sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
    else sessionStorage.removeItem(AUTH_STORAGE_KEY)
  } catch {
    // Storage unavailable (private mode / quota) — session lives in memory only.
  }
}

/** Initials for the avatar, e.g. "Joel Agboola" → "JA". */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  const first = parts[0][0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : ''
  return (first + last).toUpperCase()
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null)

const SIGNED_OUT: AuthContextValue = {
  user: null,
  isAuthenticated: false,
  signIn: () => {},
  signOut: () => {},
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readSession)

  const signIn = useCallback((next: AuthUser) => {
    writeSession(next)
    setUser(next)
  }, [])

  const signOut = useCallback(() => {
    writeSession(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, isAuthenticated: user !== null, signIn, signOut }),
    [user, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Returns the current session. Outside an `AuthProvider` (e.g. isolated
 * component tests) it reports signed-out with no-op actions.
 */
export function useAuth(): AuthContextValue {
  return useContext(AuthContext) ?? SIGNED_OUT
}
