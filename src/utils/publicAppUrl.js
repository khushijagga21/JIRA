/**
 * Base URL for invite/join links shared with other devices.
 * Prefer `VITE_PUBLIC_APP_URL` or `VITE_WORKSPHERE_PUBLIC_URL` (your deployed workSphere domain).
 * Otherwise falls back to the current browser origin (see `useResolvedAppOrigin` for LAN).
 */
export function getPublicAppOrigin() {
  const raw = import.meta.env.VITE_PUBLIC_APP_URL || import.meta.env.VITE_WORKSPHERE_PUBLIC_URL
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim().replace(/\/$/, '')
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return ''
}

/** True when the browser is on localhost and no public workSphere URL is set in env. */
export function inviteLinksNeedLanSetup() {
  if (typeof window === 'undefined') return false
  const hasOverride =
    (typeof import.meta.env.VITE_PUBLIC_APP_URL === 'string' &&
      import.meta.env.VITE_PUBLIC_APP_URL.trim().length > 0) ||
    (typeof import.meta.env.VITE_WORKSPHERE_PUBLIC_URL === 'string' &&
      import.meta.env.VITE_WORKSPHERE_PUBLIC_URL.trim().length > 0)
  if (hasOverride) return false
  const h = window.location.hostname.toLowerCase()
  return h === 'localhost' || h === '127.0.0.1'
}
