function normalizeApiBase(raw) {
  const s = String(raw ?? '').trim().replace(/\/$/, '')
  return s || null
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
  const bases = []

  if (configured) bases.push(configured)

  const host = window.location.hostname
  const onStaticHost =
    host.endsWith('.vercel.app') ||
    host.endsWith('.netlify.app') ||
    (host && !host.includes('localhost') && !/^127\./.test(host) && !/^192\.168\./.test(host))

  // Static frontend hosts have no /api unless VITE_API_URL is set.
  if (!onStaticHost || !configured) {
    bases.push('')
    if (host) bases.push(`http://${host}:8787`)
  }

  return [...new Set(bases)]
}
export async function fetchApi(path, options = {}) {
  const bases = getApiBases()
  let lastError
  let lastRes
  for (const base of bases) {
    try {
      const res = await fetch(`${base}${path}`, options)
      if (res.ok || res.status !== 404) return res
      lastRes = res
    } catch (err) {
      lastError = err
    }
  }
  if (lastRes) return lastRes
  const err = lastError ?? new Error('network_error')
  err.network = true
  throw err
}

export async function fetchApiJson(path, options = {}) {
  const res = await fetchApi(path, options)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(String(data?.reason || res.statusText || 'request_failed'))
    err.reason = data?.reason
    err.status = res.status
    if (data?.memberLimit != null) err.memberLimit = Number(data.memberLimit)
    throw err
  }
  return data
}
