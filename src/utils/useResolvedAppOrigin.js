import { useEffect, useState } from 'react'
import { getPublicAppOrigin } from './publicAppUrl.js'

/**
 * Base URL for shareable links (join, meet, email invites).
 * Uses VITE_PUBLIC_APP_URL / VITE_WORKSPHERE_PUBLIC_URL when set (production domain),
 * otherwise asks the API for a LAN URL so phones on the same Wi‑Fi can open links.
 */
export function useResolvedAppOrigin() {
  const [state, setState] = useState(() => ({
    origin: '',
    source: 'bootstrap',
    loading: true,
  }))

  useEffect(() => {
    let cancelled = false
    async function run() {
      const configured =
        import.meta.env.VITE_PUBLIC_APP_URL || import.meta.env.VITE_WORKSPHERE_PUBLIC_URL
      if (typeof configured === 'string' && configured.trim()) {
        setState({
          origin: configured.trim().replace(/\/$/, ''),
          source: 'configured',
          loading: false,
        })
        return
      }
      try {
        const { fetchApi } = await import('./apiFetch.js')
        const r = await fetchApi('/api/public-invite-origin')
        const j = await r.json()
        if (!cancelled && j?.origin) {
          setState({
            origin: String(j.origin).replace(/\/$/, ''),
            source: j.source || 'api',
            loading: false,
          })
          return
        }
      } catch {
        /* ignore */
      }
      if (!cancelled) {
        const o = getPublicAppOrigin() || (typeof window !== 'undefined' ? window.location.origin : '')
        setState({ origin: o, source: 'window', loading: false })
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
