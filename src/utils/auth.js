export const CURRENT_USER_KEY = 'jira_ui_current_user'

export function normalizeEmail(email) {
  return (email ?? '').trim().toLowerCase()
}

export function setCurrentUser(user, { remember } = {}) {
  if (!user) return
  const payload = { email: user.email, name: user.name, remember: Boolean(remember) }
  window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(payload))
}

export function getCurrentUser() {
  try {
    const raw = window.localStorage.getItem(CURRENT_USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearCurrentUser() {
  try {
    window.localStorage.removeItem(CURRENT_USER_KEY)
  } catch {
    // ignore
  }
}
