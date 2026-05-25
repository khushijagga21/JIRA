/** Local store for whiteboard drawings + pending chat attachment. */

const GALLERY_KEY = 'worksphere_whiteboard_gallery_v1'
const PENDING_KEY = 'worksphere_whiteboard_pending_share_v1'

function safeRead(key) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function safeWrite(key, value) {
  try {
    if (value == null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

export function loadGallery() {
  const data = safeRead(GALLERY_KEY)
  if (!Array.isArray(data)) return []
  return data.filter(
    (d) => d && typeof d.id === 'string' && typeof d.dataUrl === 'string',
  )
}

export function saveDrawing({ name, dataUrl }) {
  const list = loadGallery()
  const item = {
    id: `wb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: (name || 'Untitled drawing').trim().slice(0, 80) || 'Untitled drawing',
    dataUrl,
    createdAt: Date.now(),
  }
  const next = [item, ...list].slice(0, 24)
  safeWrite(GALLERY_KEY, next)
  return item
}

export function renameDrawing(id, name) {
  const list = loadGallery()
  const next = list.map((d) =>
    d.id === id ? { ...d, name: (name || 'Untitled drawing').trim().slice(0, 80) || 'Untitled drawing' } : d,
  )
  safeWrite(GALLERY_KEY, next)
}

export function deleteDrawing(id) {
  const list = loadGallery()
  const next = list.filter((d) => d.id !== id)
  safeWrite(GALLERY_KEY, next)
}

/** Pending share: a single drawing queued to be sent to the next chat room you open. */
export function queueChatShare({ name, dataUrl }) {
  safeWrite(PENDING_KEY, { name, dataUrl, queuedAt: Date.now() })
}

export function consumePendingChatShare() {
  const data = safeRead(PENDING_KEY)
  safeWrite(PENDING_KEY, null)
  if (!data || !data.dataUrl) return null
  return data
}

export function peekPendingChatShare() {
  return safeRead(PENDING_KEY)
}

export function clearPendingChatShare() {
  safeWrite(PENDING_KEY, null)
}

/** Convert a data URL to a File so it can be uploaded with FormData. */
export function dataUrlToFile(dataUrl, name = 'worksphere-whiteboard.png') {
  try {
    const [meta, b64] = String(dataUrl).split(',')
    if (!b64) return null
    const mimeMatch = meta.match(/data:([^;]+);base64/i)
    const mime = mimeMatch?.[1] || 'image/png'
    const bin = window.atob(b64)
    const len = bin.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i += 1) bytes[i] = bin.charCodeAt(i)
    return new File([bytes], name, { type: mime })
  } catch {
    return null
  }
}
