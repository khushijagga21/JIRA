export const CHAT_STORAGE_KEY = 'worksphere_chat_messages_v3'

export function createWelcomeMessage() {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? String(Date.now()),
    role: 'bot',
    text: 'Hi! I’m your workSphere assistant. Ask about **project management**, **how to use workSphere**, or **anything else** you need help with.',
    ts: Date.now(),
    isWelcome: true,
  }
}

export function createInitialMessages() {
  return [createWelcomeMessage()]
}

/** Normalize messages loaded from localStorage (legacy shapes, drop junk). */
export function normalizeStoredMessages(parsed) {
  if (!Array.isArray(parsed)) return null
  const out = []
  for (const raw of parsed) {
    if (!raw || typeof raw !== 'object') continue
    let role = raw.role
    if (role === 'assistant') role = 'bot'
    if (role !== 'user' && role !== 'bot') continue

    const text = String(raw.text ?? raw.content ?? raw.message ?? '').trim()
    const imageSrc =
      typeof raw.imageSrc === 'string' && raw.imageSrc.startsWith('data:image/')
        ? raw.imageSrc
        : undefined

    if (role === 'user' && !text && !imageSrc) continue

    out.push({
      id: raw.id ?? globalThis.crypto?.randomUUID?.() ?? `${role}-${out.length}`,
      role,
      text: text || (imageSrc ? '' : ''),
      ts: typeof raw.ts === 'number' ? raw.ts : Date.now(),
      ...(imageSrc ? { imageSrc } : {}),
      ...(raw.isWelcome ? { isWelcome: true } : {}),
    })
  }
  return out.length ? out : null
}

/** Build API payload from UI messages. */
export function toApiMessages(uiMessages) {
  const mapped = uiMessages
    .filter((m) => !m.isWelcome && (m.role === 'user' || m.role === 'bot'))
    .map((m) => {
      const role = m.role === 'bot' ? 'assistant' : 'user'
      if (role === 'user' && m.imageSrc) {
        return { role: 'user', text: String(m.text ?? '').trim(), image: m.imageSrc }
      }
      const text = String(m.text ?? m.content ?? '').trim()
      if (!text) return null
      return { role, text }
    })
    .filter(Boolean)

  if (mapped.length) return mapped

  const lastUser = [...uiMessages].reverse().find((m) => m.role === 'user')
  const fallbackText = String(lastUser?.text ?? lastUser?.content ?? '').trim()
  if (fallbackText) return [{ role: 'user', text: fallbackText }]
  if (lastUser?.imageSrc) {
    return [{ role: 'user', text: String(lastUser.text ?? '').trim(), image: lastUser.imageSrc }]
  }
  return []
}
