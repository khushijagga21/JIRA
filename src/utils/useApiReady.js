import { useCallback, useEffect, useState } from 'react'
import { checkApiHealth } from './apiFetch.js'
import { isApiMisconfigured } from './apiStatus.js'

/**
 * Warms the API on mount (helps Render cold starts) and tracks readiness
 * for login/signup forms.
 */
export function useApiReady() {
  const [state, setState] = useState(() =>
    isApiMisconfigured() ? 'misconfigured' : 'checking',
  )

  const recheck = useCallback(async () => {
    if (isApiMisconfigured()) {
      setState('misconfigured')
      return false
    }
    setState('checking')
    const result = await checkApiHealth({ attempts: 4, delayMs: 2500 })
    if (result.ok) {
      setState('ready')
      return true
    }
    if (result.code === 'misconfigured') {
      setState('misconfigured')
      return false
    }
    setState('offline')
    return false
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (isApiMisconfigured()) {
        if (!cancelled) setState('misconfigured')
        return
      }
      const result = await checkApiHealth({ attempts: 4, delayMs: 2500 })
      if (cancelled) return
      if (result.ok) setState('ready')
      else if (result.code === 'misconfigured') setState('misconfigured')
      else setState('offline')
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return { state, recheck }
}
