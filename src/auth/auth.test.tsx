import { act, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, AUTH_STORAGE_KEY, getInitials, useAuth } from './AuthContext'
import RequireAuth, { safeNextPath } from './RequireAuth'
import Login from '../pages/Login'
import TopAppBar from '../components/TopAppBar'
import { ToastProvider } from '../components/ToastContext'
import { EnvironmentProvider } from '../components/EnvironmentContext'
import { LocaleProvider } from '../i18n/provider'
import { SUBMIT_DEMO_MS } from '../components/SubmitButton'

const SESSION_USER = { name: 'Ada Lovelace', email: 'ada@example.com' }

function renderApp(initialEntries: string[], initialIndex = initialEntries.length - 1) {
  const guarded = (label: string) => (
    <RequireAuth>
      <TopAppBar />
      <h1>{label}</h1>
    </RequireAuth>
  )
  const router = createMemoryRouter(
    [
      { path: '/login', element: <Login /> },
      { path: '/dashboard', element: guarded('Dashboard page') },
      { path: '/settings', element: guarded('Settings page') },
    ],
    { initialEntries, initialIndex },
  )
  render(
    <EnvironmentProvider>
      <LocaleProvider>
        <ToastProvider>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </ToastProvider>
      </LocaleProvider>
    </EnvironmentProvider>,
  )
  return router
}

function storedSession() {
  return sessionStorage.getItem(AUTH_STORAGE_KEY)
}

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
})

describe('RequireAuth', () => {
  it('redirects signed-out visitors to /login and preserves the requested path', () => {
    const router = renderApp(['/settings?tab=security'])

    expect(router.state.location.pathname).toBe('/login')
    expect(new URLSearchParams(router.state.location.search).get('next')).toBe(
      '/settings?tab=security',
    )
    expect(screen.queryByRole('heading', { name: 'Settings page' })).not.toBeInTheDocument()
  })

  it('renders the protected route when a session exists', () => {
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(SESSION_USER))
    const router = renderApp(['/settings'])

    expect(router.state.location.pathname).toBe('/settings')
    expect(screen.getByRole('heading', { name: 'Settings page' })).toBeInTheDocument()
  })
})

describe('Login return-to-path', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('lands on the originally requested route after sign-in and MFA', () => {
    const router = renderApp(['/settings'])
    expect(router.state.location.pathname).toBe('/login')

    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: 'ada@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'abc' } })
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
    act(() => {
      vi.advanceTimersByTime(SUBMIT_DEMO_MS)
    })

    // The default MFA method is a security key.
    fireEvent.click(screen.getByRole('button', { name: /tap security key/i }))
    act(() => {
      vi.advanceTimersByTime(1200)
    })

    expect(router.state.location.pathname).toBe('/settings')
    expect(screen.getByRole('heading', { name: 'Settings page' })).toBeInTheDocument()
    expect(JSON.parse(storedSession() ?? 'null')).toMatchObject({ email: 'ada@example.com' })
  })

  it('honours location state.from (session-expiry redirect) as the return path', async () => {
    const router = renderApp(['/login'])
    await act(async () => {
      await router.navigate('/login', {
        replace: true,
        state: { from: { pathname: '/settings', search: '?tab=security', hash: '' } },
      })
    })

    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: 'ada@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'abc' } })
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
    act(() => {
      vi.advanceTimersByTime(SUBMIT_DEMO_MS)
    })
    fireEvent.click(screen.getByRole('button', { name: /tap security key/i }))
    act(() => {
      vi.advanceTimersByTime(1200)
    })

    expect(router.state.location.pathname).toBe('/settings')
    expect(router.state.location.search).toBe('?tab=security')
  })
})

describe('Sign out', () => {
  it('clears the session, returns to /login, and Back does not re-enter the app', async () => {
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(SESSION_USER))
    const router = renderApp(['/dashboard', '/settings'])

    fireEvent.click(screen.getByRole('button', { name: /account menu for ada lovelace/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /sign out/i }))

    expect(router.state.location.pathname).toBe('/login')
    expect(storedSession()).toBeNull()

    await act(async () => {
      await router.navigate(-1)
    })

    expect(router.state.location.pathname).toBe('/login')
    expect(screen.queryByRole('heading', { name: 'Dashboard page' })).not.toBeInTheDocument()
  })

  it('shows the signed-in user in the account menu', () => {
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(SESSION_USER))
    renderApp(['/settings'])

    expect(screen.getByRole('button', { name: /account menu for ada lovelace, ada@example.com/i }))
      .toHaveTextContent('AL')
  })
})

describe('AuthContext persistence', () => {
  function SessionProbe() {
    const { user, isAuthenticated, signIn } = useAuth()
    return (
      <>
        <output data-testid="session">{isAuthenticated ? user?.email : 'signed-out'}</output>
        <button onClick={() => signIn(SESSION_USER)}>sign in</button>
      </>
    )
  }

  function mount() {
    return render(
      <AuthProvider>
        <SessionProbe />
      </AuthProvider>,
    )
  }

  it('survives a reload via sessionStorage', () => {
    const first = mount()
    expect(screen.getByTestId('session')).toHaveTextContent('signed-out')

    fireEvent.click(screen.getByRole('button', { name: 'sign in' }))
    expect(screen.getByTestId('session')).toHaveTextContent('ada@example.com')
    first.unmount()

    // A fresh provider stands in for a page reload.
    mount()
    expect(screen.getByTestId('session')).toHaveTextContent('ada@example.com')
  })

  it('stores only display data', () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'sign in' }))

    expect(Object.keys(JSON.parse(storedSession() ?? '{}')).sort()).toEqual(['email', 'name'])
  })

  it('treats a malformed stored session as signed out', () => {
    sessionStorage.setItem(AUTH_STORAGE_KEY, '{not json')
    mount()
    expect(screen.getByTestId('session')).toHaveTextContent('signed-out')
  })
})

describe('safeNextPath', () => {
  it.each([
    ['/settings', '/settings'],
    ['/attestations/42?x=1#y', '/attestations/42?x=1#y'],
    [null, '/dashboard'],
    ['', '/dashboard'],
    ['https://evil.example', '/dashboard'],
    ['//evil.example', '/dashboard'],
    ['/\\evil.example', '/dashboard'],
  ])('%s → %s', (input, expected) => {
    expect(safeNextPath(input)).toBe(expected)
  })
})

describe('getInitials', () => {
  it('uses the first and last name', () => {
    expect(getInitials('Joel Agboola')).toBe('JA')
    expect(getInitials('  ada  ')).toBe('A')
    expect(getInitials('Mary Ann Evans')).toBe('ME')
  })
})
