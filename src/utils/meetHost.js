const HOST_KEY_PREFIX = 'worksphere_meet_host_'

export function generateMeetHostToken() {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
  }
}

export function saveMeetHostToken(roomId, token) {
  const room = String(roomId ?? '').trim()
  const t = String(token ?? '').trim()
  if (!room || !t) return
  try {
    localStorage.setItem(`${HOST_KEY_PREFIX}${room}`, t)
  } catch {
    /* ignore */
  }
}

export function loadMeetHostToken(roomId) {
  const room = String(roomId ?? '').trim()
  if (!room) return ''
  try {
    return localStorage.getItem(`${HOST_KEY_PREFIX}${room}`) || ''
  } catch {
    return ''
  }
}

/** Persist host token from URL and return the token to send when joining. */
export function resolveMeetHostToken(roomId, searchParams) {
  const room = String(roomId ?? '').trim()
  if (!room) return ''
  const fromUrl = searchParams?.get?.('host')?.trim()
  if (fromUrl) {
    saveMeetHostToken(room, fromUrl)
    return fromUrl
  }
  return loadMeetHostToken(room)
}

/** Claim host for a newly created room; returns the token. */
export function claimMeetHost(roomId) {
  const token = generateMeetHostToken()
  saveMeetHostToken(roomId, token)
  return token
}

export function buildMeetShareUrl(origin, roomId, hostToken) {
  const base = String(origin ?? '').replace(/\/$/, '')
  const room = String(roomId ?? '').trim()
  if (!base || !room) return ''
  const sp = new URLSearchParams({ room })
  const host = String(hostToken ?? '').trim()
  if (host) sp.set('host', host)
  return `${base}/teams/meet?${sp.toString()}`
}
