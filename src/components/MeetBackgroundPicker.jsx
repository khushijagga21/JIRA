import { useEffect, useRef, useState } from 'react'
import { MEET_BACKGROUNDS } from '../utils/meetVideo.js'

export default function MeetBackgroundPicker({ backgroundId, onChange, loading, effectsReady, dark }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const ctl = dark ? 'meet-ctl meet-ctl--dark' : 'meet-ctl'
  const blurBg = MEET_BACKGROUNDS.find((b) => b.id === 'blur')
  const sceneBgs = MEET_BACKGROUNDS.filter((b) => b.id !== 'none' && b.id !== 'blur')

  function swatchStyle(bg) {
    if (bg.id === 'blur') {
      return {
        background:
          'linear-gradient(135deg, rgba(148,163,184,0.9), rgba(71,85,105,0.95)), repeating-linear-gradient(45deg, rgba(255,255,255,0.15) 0 6px, transparent 6px 12px)',
      }
    }
    if (bg.gradient) {
      return { background: `linear-gradient(135deg, ${bg.gradient[0]}, ${bg.gradient[1]})` }
    }
    return { background: bg.swatch }
  }

  return (
    <div className="meet-bg-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`${ctl} meet-ctl--round${open || (backgroundId && backgroundId !== 'none') ? ' is-on' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="Backgrounds and effects"
        aria-label="Backgrounds and effects"
        aria-expanded={open}
      >
        <span className="meet-ctl-icon meet-ctl-icon--effects" aria-hidden />
      </button>
      {open ? (
        <div
          className={`meet-bg-panel${dark ? ' meet-bg-panel--dark' : ''}`}
          role="dialog"
          aria-label="Backgrounds and effects"
        >
          <p className="meet-bg-panel-title">Backgrounds and effects</p>
          {!effectsReady ? (
            <p className="meet-bg-loading">Loading effects…</p>
          ) : loading ? (
            <p className="meet-bg-loading">Applying…</p>
          ) : null}

          <div className="meet-bg-scroll" role="list">
            <button
              type="button"
              role="listitem"
              className={`meet-bg-thumb${backgroundId === 'none' ? ' is-active' : ''}`}
              onClick={() => onChange('none')}
              title="No background"
            >
              <span className="meet-bg-thumb-inner meet-bg-thumb-inner--none">
                <span className="meet-bg-none-icon" aria-hidden />
              </span>
              <span className="meet-bg-thumb-label">None</span>
            </button>

            {blurBg ? (
              <button
                type="button"
                role="listitem"
                className={`meet-bg-thumb${backgroundId === 'blur' ? ' is-active' : ''}`}
                onClick={() => onChange('blur')}
                title="Blur"
                disabled={!effectsReady}
              >
                <span className="meet-bg-thumb-inner" style={swatchStyle(blurBg)} />
                <span className="meet-bg-thumb-label">Blur</span>
              </button>
            ) : null}

            {sceneBgs.map((bg) => (
              <button
                key={bg.id}
                type="button"
                role="listitem"
                className={`meet-bg-thumb${backgroundId === bg.id ? ' is-active' : ''}`}
                onClick={() => onChange(bg.id)}
                title={bg.label}
                disabled={!effectsReady}
              >
                <span className="meet-bg-thumb-inner" style={swatchStyle(bg)} />
                <span className="meet-bg-thumb-label">{bg.label}</span>
              </button>
            ))}
          </div>

          <p className="meet-bg-note">
            Replaces the area behind you in your video. Everyone in the call sees it.
          </p>
        </div>
      ) : null}
    </div>
  )
}
