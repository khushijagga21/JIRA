/**
 * Base URL for invite/join links shared with other devices.
 * `localhost` only works on this computer — phones need your Wi‑Fi IP or this override.
 */
export function getPublicAppOrigin() {
  const raw = import.meta.env.VITE_PUBLIC_APP_URL
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim().replace(/\/$/, '')
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return ''
}

/** True when the user is on localhost and has not set VITE_PUBLIC_APP_URL. */
export function inviteLinksNeedLanSetup() {
  if (typeof window === 'undefined') return false
  const hasOverride =
    typeof import.meta.env.VITE_PUBLIC_APP_URL === 'string' &&
    import.meta.env.VITE_PUBLIC_APP_URL.trim().length > 0
  if (hasOverride) return false
  const h = window.location.hostname.toLowerCase()
  return h === 'localhost' || h === '127.0.0.1'
}
