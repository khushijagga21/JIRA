import { useCallback, useEffect, useRef, useState } from 'react'
import { MeetBackgroundProcessor } from '../utils/meetBackgroundProcessor.js'
import { preloadMeetSegmenter } from '../utils/meetSegmenter.js'
import { meetBackgroundAllowedOnDevice } from '../utils/meetDevice.js'
import { acquireMeetMediaStream, loadMeetBackground, saveMeetBackground } from '../utils/meetVideo.js'

/**
 * Camera preview / publish pipeline with optional virtual background.
 */
export function useMeetCamera({
  active = true,
  backgroundId: controlledBg,
  onBackgroundChange,
  /** When true, preview uses the raw camera stream only (no blur/segmentation). Effects still apply after you join. */
  previewWithoutEffects = false,
} = {}) {
  const processorRef = useRef(null)
  const rawStreamRef = useRef(null)
  const handoffRef = useRef(false)
  const [displayStream, setDisplayStream] = useState(null)
  const [backgroundId, setBackgroundIdState] = useState(() => loadMeetBackground())
  const [bgLoading, setBgLoading] = useState(false)
  const [effectsReady, setEffectsReady] = useState(false)
  const [error, setError] = useState(null)
  const [mediaRetryKey, setMediaRetryKey] = useState(0)

  const retryOpen = useCallback(() => {
    setError(null)
    setMediaRetryKey((k) => k + 1)
  }, [])

  const backgroundIdEffective = controlledBg ?? backgroundId

  const setBackgroundId = useCallback(
    (id) => {
      saveMeetBackground(id)
      setBackgroundIdState(id)
      onBackgroundChange?.(id)
    },
    [onBackgroundChange],
  )

  const applyBackground = useCallback(async (rawStream, bgId) => {
    if (previewWithoutEffects) {
      processorRef.current?.stop()
      return rawStream
    }
    if (!processorRef.current) processorRef.current = new MeetBackgroundProcessor()
    const processor = processorRef.current
    const bgEffective = meetBackgroundAllowedOnDevice() ? bgId : 'none'
    if (!bgEffective || bgEffective === 'none') {
      processor.stop()
      return rawStream
    }
    setBgLoading(true)
    try {
      if (processor.isActive && processor.sourceStream === rawStream) {
        processor.setBackgroundId(bgEffective)
        return processor.outputStream
      }
      const out = await processor.start(rawStream, bgEffective)
      return out
    } finally {
      setBgLoading(false)
    }
  }, [previewWithoutEffects])

  const refreshDisplay = useCallback(
    async (rawStream, bgId) => {
      if (!rawStream) {
        setDisplayStream(null)
        return
      }
      try {
        const out = await applyBackground(rawStream, bgId)
        if (rawStreamRef.current !== rawStream) return
        setDisplayStream(out)
      } catch {
        if (rawStreamRef.current !== rawStream) return
        setDisplayStream(null)
      }
    },
    [applyBackground],
  )

  const refreshDisplayRef = useRef(refreshDisplay)
  refreshDisplayRef.current = refreshDisplay
  const backgroundIdEffectiveRef = useRef(backgroundIdEffective)
  backgroundIdEffectiveRef.current = backgroundIdEffective

  useEffect(() => {
    if (!active) return undefined
    let cancelled = false
    void preloadMeetSegmenter()
      .then(() => {
        if (!cancelled) setEffectsReady(true)
      })
      .catch(() => {
        if (!cancelled) setEffectsReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [active])

  useEffect(() => {
    if (!active) {
      if (rawStreamRef.current) {
        for (const t of rawStreamRef.current.getTracks()) t.stop()
        rawStreamRef.current = null
      }
      processorRef.current?.stop()
      setDisplayStream(null)
      return undefined
    }

    let cancelled = false
    async function open() {
      setError(null)
      let raw
      try {
        raw = await acquireMeetMediaStream(null)
        if (cancelled) {
          for (const t of raw.getTracks()) t.stop()
          return
        }
        rawStreamRef.current = raw
        await refreshDisplayRef.current(raw, backgroundIdEffectiveRef.current)
        if (cancelled) {
          for (const t of raw.getTracks()) t.stop()
          rawStreamRef.current = null
          setDisplayStream(null)
          return
        }
      } catch (err) {
        if (raw) {
          for (const t of raw.getTracks()) t.stop()
          rawStreamRef.current = null
        }
        if (!cancelled) {
          setError(
            err?.name === 'NotAllowedError'
              ? 'Allow camera and microphone access in your browser.'
              : err?.name === 'NotReadableError' || err?.name === 'TrackStartError'
                ? 'Camera may be busy. Close other apps using it, then try again.'
                : 'Could not access camera.',
          )
        }
      }
    }
    void open()

    return () => {
      cancelled = true
      if (handoffRef.current) return
      processorRef.current?.stop()
      if (rawStreamRef.current) {
        for (const t of rawStreamRef.current.getTracks()) t.stop()
        rawStreamRef.current = null
      }
    }
  }, [active, mediaRetryKey])

  useEffect(() => {
    if (!rawStreamRef.current || !active) return
    void refreshDisplay(rawStreamRef.current, backgroundIdEffective)
  }, [backgroundIdEffective, active, refreshDisplay])

  const setMicEnabled = useCallback((enabled) => {
    const a = rawStreamRef.current?.getAudioTracks()[0]
    if (a) a.enabled = enabled
  }, [])

  const setCamEnabled = useCallback((enabled) => {
    const v = rawStreamRef.current?.getVideoTracks()[0]
    if (v) v.enabled = enabled
  }, [])

  const stop = useCallback(() => {
    handoffRef.current = false
    processorRef.current?.stop()
    if (rawStreamRef.current) {
      for (const t of rawStreamRef.current.getTracks()) t.stop()
      rawStreamRef.current = null
    }
    setDisplayStream(null)
  }, [])

  /** Pass the live camera stream to the meeting without stopping tracks. */
  const releaseToHandoff = useCallback(() => {
    handoffRef.current = true
    processorRef.current?.stop()
    const stream = rawStreamRef.current
    rawStreamRef.current = null
    setDisplayStream(null)
    return stream
  }, [])

  return {
    rawStream: rawStreamRef.current,
    displayStream,
    backgroundId: backgroundIdEffective,
    setBackgroundId,
    bgLoading,
    effectsReady,
    error,
    retryOpen,
    setMicEnabled,
    setCamEnabled,
    stop,
    releaseToHandoff,
    getRawStream: () => rawStreamRef.current,
  }
}
