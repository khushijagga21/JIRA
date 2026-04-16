import { getCurrentUser } from './auth.js'

export const COLLAB_IDENTITY_KEY = 'slack_collab_identity'

/**
 * Session identity wins over workSphere login so you can join rooms / chat as a
 * different email (e.g. phone testing with a second address).
 */
export function loadCollabIdentity() {
  try {
    const raw = window.sessionStorage.getItem(COLLAB_IDENTITY_KEY)
    if (raw) {
      const j = JSON.parse(raw)
      if (j?.email && j?.name) {
        return { name: String(j.name), email: String(j.email), source: 'session' }
      }
    }
  } catch {
    // ignore
  }
  const u = getCurrentUser()
  if (u?.email && u?.name) {
    return { name: u.name, email: u.email, source: 'account' }
  }
  return null
}

export function saveCollabIdentity(name, email) {
  window.sessionStorage.setItem(
    COLLAB_IDENTITY_KEY,
    JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase() }),
  )
}

export function clearCollabIdentity() {
  try {
    window.sessionStorage.removeItem(COLLAB_IDENTITY_KEY)
  } catch {
    // ignore
  }
}
