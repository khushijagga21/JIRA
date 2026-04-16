export const THEME_STORAGE_KEY = 'worksphere_theme'

export function getTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function applyTheme(theme) {
  const root = document.documentElement
  if (theme === 'dark') root.setAttribute('data-theme', 'dark')
  else root.removeAttribute('data-theme')
}

export function setTheme(theme) {
  const next = theme === 'dark' ? 'dark' : 'light'
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next)
  } catch {
    // ignore
  }
  applyTheme(next)
}
