import { WORKSPHERE_CONTEXT } from './worksphere-context.js'

const SYSTEM_PROMPT = `You are the workSphere AI assistant—a helpful, knowledgeable helper built into the workSphere app.

## Your expertise (prioritize when relevant)
1. **Project management** — Agile, Scrum, Kanban, sprints, backlogs, workflows, statuses, tickets, prioritization, standups, retros, risk/blockers, metrics (cycle time, WIP, throughput), team rituals, and delivery best practices.
2. **workSphere software** — How to use every part of the product (chat, boards, meet, whiteboard, signup, navigation). Use the product reference below.
3. **Everything else** — Answer any general question: coding, math, writing, career advice, explanations, brainstorming, debugging, creative tasks.

## How to respond
- Be warm, clear, and practical.
- Use markdown: **bold**, bullet lists, numbered steps, and fenced code blocks for code.
- For workSphere “how do I…?” questions, give concrete UI steps (navbar, buttons, routes).
- For PM theory, give actionable advice teams can apply today.
- If unsure, say so. Never invent features that are not in the product reference.

${WORKSPHERE_CONTEXT}`

const DEFAULT_MODEL = 'gpt-4o-mini'
const MAX_HISTORY = 24
const MAX_TEXT_LEN = 12000

function getOpenAIConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL
  return { apiKey, model }
}

function trimText(s, max = 4000) {
  const t = String(s ?? '').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

/** @param {unknown} raw */
export function normalizeClientMessages(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  for (const item of raw.slice(-MAX_HISTORY)) {
    if (!item || typeof item !== 'object') continue
    const role = item.role === 'assistant' || item.role === 'bot' ? 'assistant' : 'user'
    if (item.image && typeof item.image === 'string' && item.image.startsWith('data:image/')) {
      const text = trimText(item.text, 2000)
      const parts = []
      if (text) parts.push({ type: 'text', text })
      parts.push({ type: 'image_url', image_url: { url: item.image } })
      if (!parts.length) continue
      out.push({ role, content: parts })
      continue
    }
    const text = trimText(item.text ?? item.content, MAX_TEXT_LEN)
    if (!text) continue
    out.push({ role, content: text })
  }
  return out
}

export async function completeChat(clientMessages) {
  const { apiKey, model } = getOpenAIConfig()
  if (!apiKey) {
    const err = new Error('openai_not_configured')
    err.code = 'openai_not_configured'
    throw err
  }

  if (!clientMessages.length) {
    const err = new Error('empty_messages')
    err.code = 'empty_messages'
    throw err
  }

  const messages = [{ role: 'system', content: SYSTEM_PROMPT }, ...clientMessages]

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 2048,
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const apiMsg = String(data?.error?.message || '')
    const err = new Error(apiMsg || `OpenAI HTTP ${res.status}`)
    err.code = 'openai_error'
    err.status = res.status
    err.detail = data?.error
    if (/quota|billing|insufficient/i.test(apiMsg)) err.code = 'openai_quota'
    throw err
  }

  const reply = data?.choices?.[0]?.message?.content
  if (!reply || typeof reply !== 'string') {
    const err = new Error('empty_reply')
    err.code = 'empty_reply'
    throw err
  }
  return reply.trim()
}

export async function handleAssistantChat(req, res) {
  try {
    const clientMessages = normalizeClientMessages(req.body?.messages)
    if (!clientMessages.length) {
      res.status(400).json({ ok: false, reason: 'empty_messages' })
      return
    }
    const reply = await completeChat(clientMessages)
    res.json({ ok: true, reply })
  } catch (err) {
    if (err.code === 'openai_not_configured') {
      res.status(503).json({
        ok: false,
        reason: 'openai_not_configured',
        message:
          'OpenAI API key is not set. Add OPENAI_API_KEY to your .env file and restart npm run dev.',
      })
      return
    }
    if (err.code === 'empty_messages') {
      res.status(400).json({ ok: false, reason: 'empty_messages' })
      return
    }
    if (err.code === 'openai_quota') {
      res.status(402).json({
        ok: false,
        reason: 'openai_quota',
        message:
          'Your OpenAI account has no credits or hit its usage limit. Add billing at platform.openai.com/settings/billing and try again.',
      })
      return
    }
    console.error('[workSphere] assistant error:', err?.message || err)
    res.status(502).json({
      ok: false,
      reason: 'openai_error',
      message: err?.message || 'The AI service returned an error. Try again in a moment.',
    })
  }
}
