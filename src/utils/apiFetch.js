function normalizeApiBase(raw) {
  const s = String(raw ?? '').trim().replace(/\/$/, '')
  return s || null
}

function isStaticHost(hostname) {
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') return false
  if (/^192\.168\./.test(hostname) || /^10\./.test(hostname)) return false
  return true
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Fetch the workSphere API.
 * - VITE_API_URL: production backend (required on Vercel/static hosting)
 * - '' (same-origin): Vite dev/preview proxy to port 8787
 * - http://host:8787: direct API on LAN when proxy fails
 */
export function getApiBases() {
  if (typeof window === 'undefined') return ['']

  const configured = normalizeApiBase(import.meta.env.VITE_API_URL)
  const host = window.location.hostname
  const onStatic = isStaticHost(host)
  const bases = []

  if (configured) bases.push(configured)

  // Never hit same-origin /api on static hosts — Vercel rewrites to index.html.
  if (!onStatic) {
    bases.push('')
    if (host) bases.push(`http://${host}:8787`)
  }

  return [...new Set(bases)]
}

function shouldRetryResponse(res) {
  return res.status === 502 || res.status === 503 || res.status === 504
}

function shouldRetryError(err) {
  return err?.network === true || err?.name === 'TypeError'
}

async function fetchOnce(base, path, options) {
  const res = await fetch(`${base}${path}`, options)
  return res
}

/**
 * Fetch with automatic retries (helps Render free tier cold starts).
 */
export async function fetchApi(path, options = {}, retryOpts = {}) {
  const maxAttempts = retryOpts.attempts ?? 3
  const delayMs = retryOpts.delayMs ?? 2000
  const bases = getApiBases()

  if (bases.length === 0) {
    const err = new Error('api_not_configured')
    err.code = 'api_not_configured'
    err.network = true
    throw err
  }

  let lastError
  let lastRes

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    for (const base of bases) {
      try {
        const res = await fetchOnce(base, path, options)
        if (res.ok) return res
        if (shouldRetryResponse(res) && attempt < maxAttempts) {
          lastRes = res
          break
        }
        if (res.status !== 404) return res
        lastRes = res
      } catch (err) {
        lastError = err
        err.network = true
        if (attempt < maxAttempts && shouldRetryError(err)) break
      }
    }
    if (attempt < maxAttempts && (lastError || (lastRes && shouldRetryResponse(lastRes)))) {
      await sleep(delayMs * attempt)
      continue
    }
    break
  }

  if (lastRes) return lastRes
  const err = lastError ?? new Error('network_error')
  err.network = true
  throw err
}

/** Returns parsed JSON or throws if the body is HTML (misconfigured static host). */
export async function parseApiJson(res) {
  const text = await res.text()
  const trimmed = text.trim()
  if (trimmed.startsWith('<!') || trimmed.startsWith('<html')) {
    const err = new Error('invalid_api_response')
    err.code = 'invalid_api_response'
    throw err
  }
  try {
    return trimmed ? JSON.parse(text) : {}
  } catch {
    return {}
  }
}

export async function fetchApiJson(path, options = {}, retryOpts = {}) {
  const res = await fetchApi(path, options, retryOpts)
  const data = await parseApiJson(res)
  if (!res.ok) {
    const err = new Error(String(data?.reason || res.statusText || 'request_failed'))
    err.reason = data?.reason
    err.status = res.status
    if (data?.memberLimit != null) err.memberLimit = Number(data.memberLimit)
    throw err
  }
  return data
}

/** Ping /api/health — used to warm Render and show readiness on login. */
export async function checkApiHealth(retryOpts = {}) {
  const bases = getApiBases()
  if (bases.length === 0) {
    return { ok: false, code: 'misconfigured' }
  }
  try {
    const res = await fetchApi('/api/health', { method: 'GET' }, retryOpts)
    if (!res.ok) return { ok: false, code: 'offline', status: res.status }
    const data = await parseApiJson(res)
    if (data?.ok === true || data?.status === 'ok') return { ok: true }
    return { ok: true }
  } catch (err) {
    if (err?.code === 'api_not_configured') return { ok: false, code: 'misconfigured' }
    if (err?.code === 'invalid_api_response') return { ok: false, code: 'misconfigured' }
    return { ok: false, code: 'offline' }
  }
}
