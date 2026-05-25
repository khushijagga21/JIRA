export function randomMeetCode() {
  const part = () => Math.random().toString(36).slice(2, 6)
  return `${part()}-${part()}-${part()}`.toLowerCase()
}

/** Accept raw code or full meet URL (Google Meet–style paste). */
export function parseMeetCode(input) {
  const trimmed = String(input ?? '').trim()
  if (!trimmed) return ''
  try {
    const url = new URL(trimmed)
    const fromQuery = url.searchParams.get('room')
    if (fromQuery) return sanitizeMeetCode(fromQuery)
    const parts = url.pathname.split('/').filter(Boolean)
    const meetIdx = parts.indexOf('meet')
    if (meetIdx >= 0 && parts[meetIdx + 1]) return sanitizeMeetCode(parts[meetIdx + 1])
  } catch {
    /* not a URL */
  }
  const queryMatch = trimmed.match(/[?&]room=([^&]+)/i)
  if (queryMatch) return sanitizeMeetCode(decodeURIComponent(queryMatch[1]))
  return sanitizeMeetCode(trimmed)
}

export function sanitizeMeetCode(raw) {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 64)
}

const MEET_NAME_KEY = 'worksphere_meet_name'

export function loadMeetDisplayName() {
  try {
    const saved = localStorage.getItem(MEET_NAME_KEY)
    if (saved?.trim()) return saved.trim().slice(0, 80)
  } catch {
    /* ignore */
  }
  return ''
}

export function saveMeetDisplayName(name) {
  try {
    localStorage.setItem(MEET_NAME_KEY, String(name ?? '').trim().slice(0, 80))
  } catch {
    /* ignore */
  }
}
