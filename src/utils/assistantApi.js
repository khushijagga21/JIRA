import { fetchApi } from './apiFetch.js'

/**
 * @param {Array<{ role: 'user' | 'assistant', text?: string, image?: string }>} messages
 */
export async function requestAssistantReply(messages) {
  const res = await fetchApi('/api/assistant/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data?.message || data?.reason || res.statusText || 'request_failed')
    err.reason = data?.reason
    err.status = res.status
    err.network = false
    throw err
  }
  return String(data?.reply ?? '').trim()
}

export function assistantErrorMessage(err) {
  if (err?.status === 404) {
    return [
      'The assistant API is not available (server is out of date or not fully started).',
      '',
      '1. Stop every **npm run dev** terminal (close them).',
      '2. In `jira-ui`, run: **npm run dev:restart**',
      '3. Open the site URL shown in the terminal and try again.',
    ].join('\n')
  }
  if (err?.reason === 'openai_not_configured') {
    return [
      'The AI assistant is not configured on this server yet.',
      '',
      'Add OPENAI_API_KEY=sk-your-key-here to jira-ui/.env, then restart npm run dev.',
    ].join('\n')
  }
  if (err?.reason === 'openai_quota') {
    return [
      'Your OpenAI account needs billing or more credits.',
      '',
      'Go to platform.openai.com → Settings → Billing, add a payment method or increase your limit, then try again.',
    ].join('\n')
  }
  if (err?.reason === 'openai_error' || err?.status === 502 || err?.status === 402) {
    return err?.message || 'The AI service had a problem. Please try again in a moment.'
  }
  if (err?.message === 'network_error' || err?.network !== false) {
    return [
      'Could not reach the workSphere API.',
      '',
      'Make sure **npm run dev** is running in the `jira-ui` folder (both API + web).',
      'If it still fails, run **npm run dev:restart** to free port 8787 and start fresh.',
    ].join('\n')
  }
  return err?.message || 'Something went wrong. Try again or run **npm run dev:restart**.'
}
