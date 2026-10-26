import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

/**
 * Only accept same-origin, app-relative paths as a post-login destination so
 * `?next=` cannot be used as an open redirect.
 */
export function safeNextPath(next: string | null | undefined, fallback = '/dashboard'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return fallback
  }
  return next
}

/**
 * Route guard for signed-in areas. Redirects signed-out visitors to `/login`,
 * carrying the requested path in `?next=` so Login can return them there.
 * UX only — the backend must still enforce authentication.
 */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    const next = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }

  return <>{children}</>
}
