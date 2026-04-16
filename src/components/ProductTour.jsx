import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'

const STEPS = [
  {
    key: 'welcome',
    center: true,
    title: 'Product tour',
    body: 'Take a quick walk through workSphere—how teams plan work, prioritize backlogs, and collaborate. Use Next to move through each area, or Skip anytime.',
  },
  {
    key: 'hero',
    target: '#tour-hero',
    title: 'Boards & priorities',
    body: 'See work as columns and cards: to do, in progress, and done. That’s the rhythm most engineering teams use to stay aligned without extra ceremony.',
  },
  {
    key: 'intro',
    target: '#tour-intro',
    title: 'One place for context',
    body: 'Issues, discussion, and history stay linked so everyone knows what’s in flight, what’s blocked, and what shipped—without digging through threads.',
  },
  {
    key: 'teams',
    target: '#teams',
    title: 'How your team works',
    body: 'Day-to-day patterns: standups, backlog grooming, and shipping. This section maps workSphere to real team habits.',
  },
  {
    key: 'single',
    target: '#single-source',
    title: 'Backlog & planning',
    body: 'Prioritize with owners, estimates, and links to PRs and docs. The backlog view keeps sprint planning grounded in actual engineering work.',
  },
  {
    key: 'collab',
    target: '#collaboration',
    title: 'Collaboration & reporting',
    body: 'Comment where the work lives, surface blockers early, and roll up status for leads and stakeholders without duplicate spreadsheets.',
  },
  {
    key: 'everything',
    target: '#everything',
    title: 'Everything you need',
    body: 'Slack-style rooms, integrations, and workflows—so your process fits your stack instead of the other way around.',
  },
  {
    key: 'cta',
    target: '#tour-cta',
    title: 'Get started',
    body: 'When you’re ready, jump in with a free space for your team and invite the people who ship with you.',
  },
  {
    key: 'chatbot',
    target: '#tour-chatbot',
    title: 'Need help?',
    body: 'The assistant can answer questions about workflows, this page, and how workSphere fits together. That’s the end of the tour—happy shipping!',
  },
]

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

export default function ProductTour({ active, onClose }) {
  const location = useLocation()
  const [step, setStep] = useState(0)
  const [hole, setHole] = useState(null)
  const popoverRef = useRef(null)
  const [popoverStyle, setPopoverStyle] = useState(() => ({
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 340,
  }))

  const current = STEPS[step]
  const isLast = step >= STEPS.length - 1

  useEffect(() => {
    if (!active) return
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, onClose])

  const updateLayout = useCallback(() => {
    if (!active || !current) return

    if (current.center) {
      setHole(null)
      setPopoverStyle({
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: clamp(340, 280, window.innerWidth - 32),
      })
      return
    }

    const el = document.querySelector(current.target)
    if (!el) {
      setHole(null)
      setPopoverStyle({
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: clamp(340, 280, window.innerWidth - 32),
      })
      return
    }

    const pad = 10
    const r = el.getBoundingClientRect()
    const top = r.top - pad
    const left = r.left - pad
    const width = r.width + pad * 2
    const height = r.height + pad * 2
    setHole({ top, left, width, height })

    const popW = clamp(340, 280, window.innerWidth - 32)
    requestAnimationFrame(() => {
      const ph = popoverRef.current?.offsetHeight ?? 220
      let py = top + height + 16
      if (py + ph > window.innerHeight - 16) py = top - ph - 16
      py = clamp(py, 16, window.innerHeight - ph - 16)
      let px = left + width / 2 - popW / 2
      px = clamp(px, 16, window.innerWidth - popW - 16)
      setPopoverStyle({
        position: 'fixed',
        top: py,
        left: px,
        transform: 'none',
        width: popW,
      })
    })
  }, [active, current])

  /* Spotlight position must follow DOM after scroll — layout effect updates local state from measurements. */
  useLayoutEffect(() => {
    if (!active || location.pathname !== '/') return

    if (current?.center) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync popover to viewport
      updateLayout()
      return
    }

    const el = current?.target ? document.querySelector(current.target) : null
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })

    const t1 = window.setTimeout(updateLayout, 80)
    const t2 = window.setTimeout(updateLayout, 420)
    updateLayout()

    const onScroll = () => updateLayout()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    const ro = el ? new ResizeObserver(updateLayout) : null
    if (el) ro.observe(el)

    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
      ro?.disconnect()
    }
  }, [active, location.pathname, step, current, updateLayout])

  useEffect(() => {
    if (!active) return
    const t = window.setTimeout(() => {
      popoverRef.current?.querySelector?.('.tour-btn-primary')?.focus()
    }, 60)
    return () => window.clearTimeout(t)
  }, [active, step])

  if (!active || location.pathname !== '/') return null

  const clipPath =
    hole &&
    `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, ${hole.left}px ${hole.top}px, ${hole.left + hole.width}px ${hole.top}px, ${hole.left + hole.width}px ${hole.top + hole.height}px, ${hole.left}px ${hole.top + hole.height}px)`

  function next() {
    if (isLast) onClose()
    else setStep((s) => s + 1)
  }

  function back() {
    setStep((s) => Math.max(0, s - 1))
  }

  return createPortal(
    <div className="tour-root" role="presentation">
      <div
        className="tour-scrim"
        style={clipPath ? { clipPath, WebkitClipPath: clipPath } : undefined}
        aria-hidden="true"
      />
      <div
        className="tour-popover"
        ref={popoverRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        style={popoverStyle}
      >
        <p className="tour-step-label">
          Step {step + 1} of {STEPS.length}
        </p>
        <h2 id="tour-title" className="tour-title">
          {current.title}
        </h2>
        <p className="tour-body">{current.body}</p>
        <div className="tour-actions">
          <button type="button" className="tour-btn tour-btn-ghost" onClick={onClose}>
            Skip tour
          </button>
          <div className="tour-actions-main">
            {step > 0 ? (
              <button type="button" className="tour-btn tour-btn-ghost" onClick={back}>
                Back
              </button>
            ) : null}
            <button type="button" className="tour-btn tour-btn-primary" onClick={next}>
              {isLast ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
