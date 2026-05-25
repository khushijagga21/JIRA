/** WebSocket URL for meet signaling (proxied in dev, same host in prod). */
export function getMeetWsUrl() {
  if (typeof window === 'undefined') return ''
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  return `${protocol}//${host}/meet-ws`
}

/** Fallback when Vite proxy is unavailable (phone on LAN hitting API port). */
export function getMeetWsFallbackUrl() {
  if (typeof window === 'undefined') return ''
  const hostname = window.location.hostname
  if (!hostname) return ''
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${hostname}:8787/meet-ws`
}
