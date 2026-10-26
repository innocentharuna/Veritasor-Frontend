import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { LocaleProvider } from './i18n/provider'
import { ToastProvider } from './components/ToastContext'
import Layout from './components/Layout'
import { CookieConsentProvider } from './components/CookieConsentContext'
import { AttestationsProvider } from './state/attestations'
import { AuthProvider } from './auth/AuthContext'
import RequireAuth from './auth/RequireAuth'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import OnboardingWizard from './pages/OnboardingWizard'
import Dashboard from './pages/Dashboard'
import Attestations from './pages/Attestations'
import AttestationDetail from './pages/AttestationDetail'
import NotFound from './pages/NotFound'
import ServerError from './pages/ServerError'
import ApiKeys from './pages/ApiKeys'
import HelpArticle from './pages/HelpArticle'
import RevenueSources from './pages/RevenueSources'
import Settings from './pages/Settings'
import ConsentPreferences from './pages/ConsentPreferences'
import {
  ConnectSourceWizard,
  SelectSourceProviderStep,
  AuthorizeSourceStep,
  OAuthCallbackLandingStep,
  ConfigureSourceScopeStep,
  MapCurrenciesStep,
  ConfirmSourceStep,
} from './pages/connect-source/ConnectSourceWizard'

const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/login', element: <Login /> },
  { path: '/signup', element: <Signup /> },
  { path: '/forgot-password', element: <ForgotPassword /> },
  { path: '/onboarding', element: <OnboardingWizard /> },
  { path: '/500', element: <ServerError /> },
  {
    element: (
      <RequireAuth>
        <Layout />
      </RequireAuth>
    ),
    children: [
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'attestations', element: <Attestations /> },
      { path: 'attestations/:id', element: <AttestationDetail /> },
      { path: 'sources', element: <RevenueSources /> },
      { path: 'settings', element: <Settings /> },
      { path: 'api-keys', element: <ApiKeys /> },
      { path: 'help', element: <HelpArticle /> },
      { path: 'consent-preferences', element: <ConsentPreferences /> },
      {
        path: 'connect-source',
        element: <ConnectSourceWizard />,
        children: [
          { path: 'provider', element: <SelectSourceProviderStep /> },
          { path: 'authorize', element: <AuthorizeSourceStep /> },
          { path: 'callback', element: <OAuthCallbackLandingStep /> },
          { path: 'scope', element: <ConfigureSourceScopeStep /> },
          { path: 'mapping', element: <MapCurrenciesStep /> },
          { path: 'confirm', element: <ConfirmSourceStep /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFound /> },
], {
  future: { v7_relativeSplatPath: true },
})

/** Production entry point — wraps the data router in app-wide providers. */
export default function App() {
  return (
    <LocaleProvider>
      <ToastProvider>
        <AuthProvider>
          <AttestationsProvider>
            <CookieConsentProvider>
              <RouterProvider router={router} future={{ v7_startTransition: true }} />
            </CookieConsentProvider>
          </AttestationsProvider>
        </AuthProvider>
      </ToastProvider>
    </LocaleProvider>
  )
}
