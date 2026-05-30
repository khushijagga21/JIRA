import { getApiBases } from './apiFetch.js'

/** True when the UI is served from a static host (Vercel, Netlify, custom domain). */
export function isProductionFrontend() {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  if (!h || h === 'localhost' || h === '127.0.0.1') return false
  if (/^192\.168\./.test(h) || /^10\./.test(h)) return false
  return true
}

export function isApiUrlConfigured() {
  const raw = String(import.meta.env.VITE_API_URL ?? '').trim()
  return raw.length > 0
}

/** On Vercel/static hosts the API must be configured at build time. */
export function isApiMisconfigured() {
  return isProductionFrontend() && !isApiUrlConfigured()
}

export function getApiProblemMessage(kind) {
  if (kind === 'misconfigured') {
    return 'Sign-in is not available on this site yet. The server connection has not been configured.'
  }
  if (kind === 'offline') {
    return 'We could not reach the sign-in server. Wait a moment and try again — the server may be starting up.'
  }
  if (kind === 'server') {
    return 'Something went wrong while signing you in. Please try again in a few seconds.'
  }
  return 'Something went wrong. Please try again.'
}

export function getLocalDevHint() {
  return 'Start the app with npm run dev (runs the API and website together), then try again.'
}

export { getApiBases }
