const keyFor = (email) => `slack_last_room:${String(email ?? '').toLowerCase()}`

export function getLastCollabRoomId(email) {
  if (!email) return null
  try {
    const v = sessionStorage.getItem(keyFor(email))
    const id = Number.parseInt(String(v), 10)
    return Number.isFinite(id) && id > 0 ? id : null
  } catch {
    return null
  }
}

export function setLastCollabRoomId(email, roomId) {
  if (!email || roomId == null) return
  try {
    sessionStorage.setItem(keyFor(email), String(roomId))
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearLastCollabRoomId(email) {
  if (!email) return
  try {
    sessionStorage.removeItem(keyFor(email))
  } catch {
    /* ignore */
  }
}
