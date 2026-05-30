import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Teams from './pages/Teams.jsx'
import SingleSource from './pages/SingleSource.jsx'
import CollabReporting from './pages/CollabReporting.jsx'
import Everything from './pages/Everything.jsx'
import AllFeatures from './pages/AllFeatures.jsx'
import CtaFooter from './pages/CtaFooter.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import JoinRoom from './pages/JoinRoom.jsx'
import AcceptEmailInvite from './pages/AcceptEmailInvite.jsx'
import workSphereLogo from './assets/worksphere-logo.png'
import {
  clearCurrentUser,
  CURRENT_USER_KEY,
  getCurrentUser,
} from './utils/auth.js'
import { getTheme, setTheme, THEME_STORAGE_KEY } from './utils/theme.js'
import ChatbotWidget from './components/ChatbotWidget.jsx'
import HomeHero from './components/HomeHero.jsx'
import HomeIntro from './components/HomeIntro.jsx'
import HomeCollab from './components/HomeCollab.jsx'
import ProductTour from './components/ProductTour.jsx'
import SlackCollaboration from './components/SlackCollaboration.jsx'
import TeamsMeet from './components/TeamsMeet.jsx'
import Todo from './pages/Todo.jsx'
import CodingWorkspace from './pages/CodingWorkspace.jsx'
import { buildNavFeatures } from './config/appFeatures.js'
import { checkApiHealth } from './utils/apiFetch.js'
import { isApiMisconfigured } from './utils/apiStatus.js'
import {
  loadGallery as loadWhiteboardGallery,
  saveDrawing as saveWhiteboardDrawing,
  deleteDrawing as deleteWhiteboardDrawing,
  renameDrawing as renameWhiteboardDrawing,
  queueChatShare as queueWhiteboardChatShare,
} from './utils/whiteboardStore.js'

const NAV_MORE = [
  { label: 'Help center', href: '#' },
  { label: "What's new", href: '#' },
  { label: 'API & integrations', to: '/features' },
  { label: 'workSphere Whiteboard', to: '/whiteboard' },
]

const NAV_TEAMS = [
  { label: 'Teams overview', to: '/#teams' },
  { label: 'Meet', to: '/teams/meet' },
]

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n))
}

function Whiteboard({ onOpenSlack }) {
  const canvasRef = useRef(null)
  const ctxRef = useRef(null)
  const [tool, setTool] = useState('pen') // pen | eraser
  const [color, setColor] = useState('#0c66e4')
  const [size, setSize] = useState(6)
  const downRef = useRef(false)
  const lastRef = useRef({ x: 0, y: 0 })
  const [gallery, setGallery] = useState(() => loadWhiteboardGallery())
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [savedToast, setSavedToast] = useState('')
  const [hasStrokes, setHasStrokes] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctxRef.current = ctx

    function resize() {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const nextW = Math.max(1, Math.floor(rect.width * dpr))
      const nextH = Math.max(1, Math.floor(rect.height * dpr))
      if (canvas.width !== nextW || canvas.height !== nextH) {
        canvas.width = nextW
        canvas.height = nextH
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
    }

    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  function point(e) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function clear() {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (!canvas || !ctx) return
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
    setHasStrokes(false)
  }

  function showSavedHint(text) {
    setSavedToast(text)
    window.setTimeout(() => setSavedToast(''), 2400)
  }

  function exportDataUrl() {
    const canvas = canvasRef.current
    if (!canvas) return null
    const out = document.createElement('canvas')
    out.width = canvas.width
    out.height = canvas.height
    const octx = out.getContext('2d')
    if (!octx) return null
    octx.fillStyle = '#ffffff'
    octx.fillRect(0, 0, out.width, out.height)
    octx.drawImage(canvas, 0, 0)
    return out.toDataURL('image/png')
  }

  function downloadDataUrl(dataUrl, name) {
    if (!dataUrl) return
    const a = document.createElement('a')
    a.href = dataUrl
    const safe = (name || 'worksphere-drawing').replace(/[^a-z0-9-_]+/gi, '-').slice(0, 60)
    a.download = `${safe || 'worksphere-drawing'}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  function saveCurrent({ silent } = {}) {
    if (!hasStrokes) {
      if (!silent) showSavedHint('Draw something first to save it.')
      return null
    }
    const defaultName = `Drawing ${new Date().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
    const name = silent ? defaultName : window.prompt('Name this drawing', defaultName) || defaultName
    const dataUrl = exportDataUrl()
    if (!dataUrl) return null
    const item = saveWhiteboardDrawing({ name, dataUrl })
    setGallery(loadWhiteboardGallery())
    if (!silent) {
      downloadDataUrl(dataUrl, name)
      showSavedHint('Drawing saved.')
    }
    return item
  }

  function sendCurrentToChat() {
    if (!hasStrokes) {
      showSavedHint('Draw something first to send.')
      return
    }
    const item = saveCurrent({ silent: true })
    if (!item) return
    queueWhiteboardChatShare({ name: item.name, dataUrl: item.dataUrl })
    showSavedHint('Pick a chat to send your drawing.')
    onOpenSlack?.()
  }

  function sendGalleryItemToChat(item) {
    queueWhiteboardChatShare({ name: item.name, dataUrl: item.dataUrl })
    showSavedHint('Pick a chat to send your drawing.')
    onOpenSlack?.()
  }

  function removeGalleryItem(id) {
    deleteWhiteboardDrawing(id)
    setGallery(loadWhiteboardGallery())
  }

  function renameGalleryItem(item) {
    const next = window.prompt('Rename drawing', item.name)
    if (next == null) return
    renameWhiteboardDrawing(item.id, next)
    setGallery(loadWhiteboardGallery())
  }

  return (
    <main className="wb">
      <header className="wb-top">
        <div className="wb-title">workSphere Whiteboard</div>
        <div className="wb-tools" role="toolbar" aria-label="Whiteboard tools">
          <button
            type="button"
            className={`wb-btn ${tool === 'pen' ? 'is-on' : ''}`}
            onClick={() => setTool('pen')}
          >
            Pen
          </button>
          <button
            type="button"
            className={`wb-btn ${tool === 'eraser' ? 'is-on' : ''}`}
            onClick={() => setTool('eraser')}
          >
            Eraser
          </button>
          <label className="wb-field" aria-label="Color">
            <span className="wb-field-label">Color</span>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              disabled={tool === 'eraser'}
            />
          </label>
          <label className="wb-field" aria-label="Brush size">
            <span className="wb-field-label">Size</span>
            <input
              type="range"
              min="1"
              max="32"
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
            />
          </label>
          <span className="wb-toolbar-sep" aria-hidden />
          <button
            type="button"
            className="wb-btn wb-btn-primary"
            onClick={() => saveCurrent()}
            title="Save this drawing and download a PNG"
          >
            💾 Save
          </button>
          <button
            type="button"
            className="wb-btn wb-btn-accent"
            onClick={sendCurrentToChat}
            title="Send this drawing into a workSphere chat"
          >
            ✈ Send to chat
          </button>
          <button
            type="button"
            className={`wb-btn ${galleryOpen ? 'is-on' : ''}`}
            onClick={() => setGalleryOpen((v) => !v)}
            title="Open saved drawings"
          >
            📁 Saved
            {gallery.length > 0 ? <span className="wb-pill">{gallery.length}</span> : null}
          </button>
          <button type="button" className="wb-btn wb-btn-danger" onClick={clear}>
            Clear
          </button>
        </div>
      </header>

      <div className="wb-stage">
        <canvas
          ref={canvasRef}
          className="wb-canvas"
          onPointerDown={(e) => {
            const ctx = ctxRef.current
            if (!ctx) return
            downRef.current = true
            const p = point(e)
            lastRef.current = p
            ctx.lineCap = 'round'
            ctx.lineJoin = 'round'
            ctx.lineWidth = clamp(size, 1, 48)
            if (tool === 'eraser') {
              ctx.globalCompositeOperation = 'destination-out'
              ctx.strokeStyle = 'rgba(0,0,0,1)'
            } else {
              ctx.globalCompositeOperation = 'source-over'
              ctx.strokeStyle = color
            }
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            setHasStrokes(true)
          }}
          onPointerMove={(e) => {
            const ctx = ctxRef.current
            if (!ctx || !downRef.current) return
            const p = point(e)
            const last = lastRef.current
            lastRef.current = p
            ctx.quadraticCurveTo(last.x, last.y, (last.x + p.x) / 2, (last.y + p.y) / 2)
            ctx.stroke()
          }}
          onPointerUp={() => {
            const ctx = ctxRef.current
            if (!ctx) return
            downRef.current = false
            ctx.closePath()
          }}
          onPointerLeave={() => {
            const ctx = ctxRef.current
            if (!ctx) return
            downRef.current = false
            ctx.closePath()
          }}
        />

        {savedToast ? <div className="wb-toast" role="status">{savedToast}</div> : null}
      </div>

      {galleryOpen ? (
        <aside className="wb-gallery" aria-label="Saved drawings">
          <div className="wb-gallery-head">
            <div>
              <h2 className="wb-gallery-title">Saved drawings</h2>
              <p className="wb-gallery-sub">Stored locally in your browser. Send any one straight into a chat.</p>
            </div>
            <button
              type="button"
              className="wb-gallery-close"
              onClick={() => setGalleryOpen(false)}
              aria-label="Close saved drawings"
            >
              ×
            </button>
          </div>
          {gallery.length === 0 ? (
            <p className="wb-gallery-empty">
              No drawings saved yet. Sketch something, then hit <strong>💾 Save</strong>.
            </p>
          ) : (
            <ul className="wb-gallery-grid">
              {gallery.map((item) => (
                <li key={item.id} className="wb-gallery-card">
                  <div className="wb-gallery-thumb">
                    <img src={item.dataUrl} alt={item.name} />
                  </div>
                  <div className="wb-gallery-meta">
                    <button
                      type="button"
                      className="wb-gallery-name"
                      onClick={() => renameGalleryItem(item)}
                      title="Click to rename"
                    >
                      {item.name}
                    </button>
                    <span className="wb-gallery-date">
                      {new Date(item.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="wb-gallery-actions">
                    <button
                      type="button"
                      className="wb-gallery-action"
                      onClick={() => sendGalleryItemToChat(item)}
                      title="Send into a workSphere chat"
                    >
                      ✈ Send
                    </button>
                    <button
                      type="button"
                      className="wb-gallery-action"
                      onClick={() => downloadDataUrl(item.dataUrl, item.name)}
                      title="Download PNG"
                    >
                      ⤓ Save
                    </button>
                    <button
                      type="button"
                      className="wb-gallery-action wb-gallery-action--danger"
                      onClick={() => removeGalleryItem(item.id)}
                      title="Delete"
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>
      ) : null}
    </main>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M10.5 3a7.5 7.5 0 1 1 4.56 13.45l4.5 4.5-1.41 1.41-4.5-4.5A7.5 7.5 0 0 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"
      />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M21.64 13a9 9 0 1 1-10.73-10.73 1 1 0 0 0 1.24 1.24A6.977 6.977 0 0 0 21 13a1 1 0 0 0 .64-.36z"
      />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 18a6 6 0 1 1 0-12 6 6 0 0 1 0 12Zm0-2a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM11 1h2v3h-2V1Zm0 19h2v3h-2v-3ZM3.5 4.5l1.42-1.42 2.12 2.12-1.41 1.41L3.5 4.5Zm12.44 12.44 2.12 2.12-1.41 1.41-2.12-2.12 1.41-1.41ZM1 11v2h3v-2H1Zm19 0v2h3v-2h-3ZM4.5 19.5l-1.42-1.42 2.12-2.12 1.41 1.41-2.11 2.13Zm12.44-12.44L19.5 3.5l-1.42 1.42-2.12-2.12 1.41-1.41Z"
      />
    </svg>
  )
}

function ThemeControl({ variant }) {
  const [mode, setMode] = useState(() => getTheme())

  useEffect(() => {
    function onStorage(e) {
      if (e.key === THEME_STORAGE_KEY || e.key === null) setMode(getTheme())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  function pick(next) {
    setTheme(next)
    setMode(next)
  }

  if (variant === 'segmented') {
    return (
      <div className="mobile-theme-row">
        <span className="mobile-theme-label" id="mobile-theme-label">
          Appearance
        </span>
        <div className="mobile-theme-switch" role="group" aria-labelledby="mobile-theme-label">
          <button
            type="button"
            className={`mobile-theme-opt${mode === 'light' ? ' is-active' : ''}`}
            onClick={() => pick('light')}
          >
            Light
          </button>
          <button
            type="button"
            className={`mobile-theme-opt${mode === 'dark' ? ' is-active' : ''}`}
            onClick={() => pick('dark')}
          >
            Dark
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      id="tour-theme-toggle"
      className="icon-btn theme-toggle"
      aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={mode === 'dark' ? 'Light mode' : 'Dark mode'}
      onClick={() => pick(mode === 'dark' ? 'light' : 'dark')}
    >
      {mode === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}

function MobileNavGroup({ id, label, items, expandedId, setExpandedId, onLinkNavigate }) {
  const expanded = expandedId === id
  return (
    <div className="mobile-nav-group">
      <button
        type="button"
        className="mobile-link mobile-link-row"
        aria-expanded={expanded}
        onClick={() => setExpandedId(expanded ? null : id)}
      >
        <span>{label}</span>
        <span className={`mobile-chev ${expanded ? 'mobile-chev--open' : ''}`} aria-hidden="true">
          ▾
        </span>
      </button>
      {expanded ? (
        <div className="mobile-submenu">
          {items.map((item) => {
            if (item.onAction) {
              return (
                <button
                  key={item.label}
                  type="button"
                  className="mobile-sublink mobile-sublink-btn"
                  onClick={() => {
                    item.onAction()
                    onLinkNavigate()
                  }}
                >
                  {item.label}
                </button>
              )
            }
            if (item.to) {
              return (
                <Link
                  key={item.label}
                  className="mobile-sublink"
                  to={item.to}
                  onClick={onLinkNavigate}
                >
                  {item.label}
                </Link>
              )
            }
            return (
              <a
                key={item.label}
                className="mobile-sublink"
                href={item.href}
                onClick={onLinkNavigate}
              >
                {item.label}
              </a>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function profileInitials(name, email) {
  const n = String(name ?? '').trim()
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return parts[0].slice(0, 2).toUpperCase()
  }
  const e = String(email ?? '').trim()
  return e.slice(0, 2).toUpperCase() || '?'
}

function profileShortName(name, email) {
  const n = String(name ?? '').trim()
  if (n) return n.split(/\s+/)[0] || n
  const e = String(email ?? '').split('@')[0]
  return e || 'Account'
}

function NavProfileDropdown({ user, menuOpen, setMenuOpen, onLogout }) {
  const id = 'profile'
  const open = menuOpen === id
  const triggerId = 'nav-trigger-profile'
  const panelId = 'nav-panel-profile'
  const initials = profileInitials(user?.name, user?.email)
  const shortName = profileShortName(user?.name, user?.email)

  return (
    <div className={`nav-dropdown-wrap nav-profile-wrap${open ? ' nav-dropdown-wrap--open' : ''}`}>
      <button
        id={triggerId}
        type="button"
        className="nav-profile-trigger"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={panelId}
        onClick={() => setMenuOpen(open ? null : id)}
      >
        <span className="nav-profile-avatar" aria-hidden="true">
          {initials}
        </span>
        <span className="nav-profile-name">{shortName}</span>
        <span className="chev" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <div
          id={panelId}
          className="nav-dropdown-panel nav-profile-panel"
          role="menu"
          aria-labelledby={triggerId}
        >
          <div className="nav-profile-meta" role="none">
            <div className="nav-profile-meta-name">{user?.name || 'Member'}</div>
            <div className="nav-profile-meta-email">{user?.email}</div>
          </div>
          <div className="nav-profile-divider" aria-hidden="true" />
          <a
            role="menuitem"
            className="nav-dropdown-link"
            href="#"
            onClick={() => setMenuOpen(null)}
          >
            Account settings
          </a>
          <Link
            role="menuitem"
            className="nav-dropdown-link"
            to="/#teams"
            onClick={() => setMenuOpen(null)}
          >
            Your work
          </Link>
          <a
            role="menuitem"
            className="nav-dropdown-link"
            href="#"
            onClick={() => setMenuOpen(null)}
          >
            Notifications
          </a>
          <div className="nav-profile-divider" aria-hidden="true" />
          <button
            type="button"
            role="menuitem"
            className="nav-dropdown-link nav-dropdown-link--btn nav-profile-logout"
            onClick={() => {
              onLogout()
              setMenuOpen(null)
            }}
          >
            Log out
          </button>
        </div>
      ) : null}
    </div>
  )
}

function NavDropdown({ id, label, items, menuOpen, setMenuOpen, hideChevron }) {
  const open = menuOpen === id
  const panelId = `nav-panel-${id}`
  const triggerId = `nav-trigger-${id}`

  return (
    <div className={`nav-dropdown-wrap${open ? ' nav-dropdown-wrap--open' : ''}`}>
      <button
        id={triggerId}
        type="button"
        className={`nav-item${hideChevron ? ' nav-item--text' : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={panelId}
        onClick={() => setMenuOpen(open ? null : id)}
      >
        {label}
        {hideChevron ? null : (
          <span className="chev" aria-hidden="true">
            ▾
          </span>
        )}
      </button>
      {open ? (
        <div
          id={panelId}
          className="nav-dropdown-panel"
          role="menu"
          aria-labelledby={triggerId}
        >
          {items.map((item) => {
            if (item.onAction) {
              return (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  className="nav-dropdown-link nav-dropdown-link--btn"
                  onClick={() => {
                    item.onAction()
                    setMenuOpen(null)
                  }}
                >
                  {item.label}
                </button>
              )
            }
            if (item.to) {
              return (
                <Link
                  key={item.label}
                  role="menuitem"
                  className="nav-dropdown-link"
                  to={item.to}
                  onClick={() => setMenuOpen(null)}
                >
                  {item.label}
                </Link>
              )
            }
            return (
              <a
                key={item.label}
                role="menuitem"
                className="nav-dropdown-link"
                href={item.href}
                onClick={() => setMenuOpen(null)}
              >
                {item.label}
              </a>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function Navbar({ onProductGuide, onOpenSlack }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(null)
  const [mobileAccordion, setMobileAccordion] = useState(null)
  const headerRef = useRef(null)
  const [user, setUser] = useState(() => getCurrentUser())

  useEffect(() => {
    queueMicrotask(() => setUser(getCurrentUser()))
  }, [location.pathname])

  useEffect(() => {
    function onStorage(e) {
      if (e.key === CURRENT_USER_KEY || e.key === null) setUser(getCurrentUser())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  function handleLogout() {
    clearCurrentUser()
    setUser(null)
    navigate('/')
  }

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        setOpen(false)
        setMenuOpen(null)
      }
    }
    function onResize() {
      if (window.matchMedia('(min-width: 981px)').matches) {
        setOpen(false)
        setMobileAccordion(null)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  useEffect(() => {
    document.body.classList.toggle('mobile-nav-open', open)
    return () => document.body.classList.remove('mobile-nav-open')
  }, [open])

  useEffect(() => {
    if (!menuOpen) return
    function onPointerDown(e) {
      if (headerRef.current && !headerRef.current.contains(e.target)) {
        setMenuOpen(null)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [menuOpen])

  function closeMobile() {
    setOpen(false)
    setMobileAccordion(null)
  }

  const guideItems = useMemo(
    () => [
      {
        label: 'Interactive product tour',
        onAction: () => onProductGuide?.(),
      },
    ],
    [onProductGuide],
  )

  const navFeatures = useMemo(
    () => buildNavFeatures({ onOpenSlack }),
    [onOpenSlack],
  )

  return (
    <header className="site-header" ref={headerRef}>
      <div className="header-inner">
        <div className="header-brand">
          <Link className="brand" to="/" aria-label="workSphere">
            <span className="brand-mark brand-mark--img" aria-hidden="true">
              <img className="brand-logo" src={workSphereLogo} alt="" />
            </span>
            <span className="brand-text">workSphere</span>
          </Link>
        </div>

        <nav className="nav-desktop header-nav" aria-label="Primary">
          <NavDropdown
            id="features"
            label="Features"
            items={navFeatures}
            menuOpen={menuOpen}
            setMenuOpen={setMenuOpen}
          />
          <NavDropdown
            id="guide"
            label="Guide"
            items={guideItems}
            menuOpen={menuOpen}
            setMenuOpen={setMenuOpen}
            hideChevron
          />
          <button
            type="button"
            id="tour-slack"
            className="nav-link nav-link-plain"
            onClick={() => {
              onOpenSlack?.()
              setMenuOpen(null)
            }}
          >
            workSphere chat
          </button>
          <NavDropdown
            id="teams"
            label="Teams"
            items={NAV_TEAMS}
            menuOpen={menuOpen}
            setMenuOpen={setMenuOpen}
            hideChevron
          />
          <NavDropdown
            id="more"
            label="More"
            items={NAV_MORE}
            menuOpen={menuOpen}
            setMenuOpen={setMenuOpen}
          />
        </nav>

        <div className="header-actions">
          <a className="btn btn-primary nav-cta" href="#">
            Get it free
          </a>
          <button className="icon-btn search" type="button" aria-label="Search">
            <SearchIcon />
          </button>
          <ThemeControl />
          {user ? (
            <NavProfileDropdown
              user={user}
              menuOpen={menuOpen}
              setMenuOpen={setMenuOpen}
              onLogout={handleLogout}
            />
          ) : (
            <Link className="nav-link subtle nav-signin" to="/login">
              Sign in
            </Link>
          )}
          <button
            className={`icon-btn burger${open ? ' is-open' : ''}`}
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open ? 'true' : 'false'}
            aria-controls="mobileMenu"
            onClick={() => setOpen((v) => !v)}
          >
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
          </button>
        </div>
      </div>

      {open ? (
        <div className="mobile-menu" id="mobileMenu" data-mobile>
          <nav className="mobile-nav" aria-label="Mobile">
            <MobileNavGroup
              id="features"
              label="Features"
              items={navFeatures}
              expandedId={mobileAccordion}
              setExpandedId={setMobileAccordion}
              onLinkNavigate={closeMobile}
            />
            <MobileNavGroup
              id="guide"
              label="Guide"
              items={guideItems}
              expandedId={mobileAccordion}
              setExpandedId={setMobileAccordion}
              onLinkNavigate={closeMobile}
            />
            <button
              type="button"
              className="mobile-link mobile-link-row"
              onClick={() => {
                onOpenSlack?.()
                closeMobile()
              }}
            >
              workSphere chat
            </button>
            <MobileNavGroup
              id="more"
              label="More"
              items={NAV_MORE}
              expandedId={mobileAccordion}
              setExpandedId={setMobileAccordion}
              onLinkNavigate={closeMobile}
            />
            <MobileNavGroup
              id="teams"
              label="Teams"
              items={NAV_TEAMS}
              expandedId={mobileAccordion}
              setExpandedId={setMobileAccordion}
              onLinkNavigate={closeMobile}
            />
            <ThemeControl variant="segmented" />
            <div className="mobile-cta">
              <a className="btn btn-primary full" href="#">
                Get it free
              </a>
              {user ? (
                <>
                  <div className="mobile-user-pill">
                    <span className="nav-profile-avatar nav-profile-avatar--sm" aria-hidden="true">
                      {profileInitials(user?.name, user?.email)}
                    </span>
                    <div className="mobile-user-pill-text">
                      <div className="mobile-user-name">{user?.name || 'Member'}</div>
                      <div className="mobile-user-email">{user?.email}</div>
                    </div>
                  </div>
                  <a href="#" className="mobile-link" onClick={closeMobile}>
                    Account settings
                  </a>
                  <Link className="mobile-link" to="/#teams" onClick={closeMobile}>
                    Your work
                  </Link>
                  <button
                    type="button"
                    className="mobile-link mobile-link-danger"
                    onClick={() => {
                      closeMobile()
                      handleLogout()
                    }}
                  >
                    Log out
                  </button>
                </>
              ) : (
                <Link className="btn btn-ghost full" to="/login">
                  Sign in
                </Link>
              )}
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  )
}

function Home() {
  return (
    <main id="main">
      <div id="top"></div>
      <HomeHero />
      <HomeIntro />
      <HomeCollab />
      <Teams />
      <SingleSource />
      <CollabReporting />
      <Everything />
      <CtaFooter />
    </main>
  )
}

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const pendingTourRef = useRef(false)
  const [tourActive, setTourActive] = useState(false)
  const [tourEpoch, setTourEpoch] = useState(0)
  const [slackOpen, setSlackOpen] = useState(false)
  const [slackFocusRoomId, setSlackFocusRoomId] = useState(null)

  // Warm the API in the background (helps Render cold starts before login).
  useEffect(() => {
    if (isApiMisconfigured()) return
    void checkApiHealth({ attempts: 2, delayMs: 1500 })
  }, [])

  const startProductTour = useCallback(() => {
    function begin() {
      setTourEpoch((e) => e + 1)
      setTourActive(true)
    }
    if (location.pathname !== '/') {
      pendingTourRef.current = true
      navigate('/')
    } else {
      begin()
    }
  }, [location.pathname, navigate])

  useEffect(() => {
    if (!pendingTourRef.current || location.pathname !== '/') return
    pendingTourRef.current = false
    queueMicrotask(() => {
      setTourEpoch((e) => e + 1)
      setTourActive(true)
    })
  }, [location.pathname])

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    let changed = false

    const slackPick = searchParams.get('slack')
    if (slackPick === 'picker' || slackPick === '1') {
      next.delete('slack')
      changed = true
      queueMicrotask(() => {
        setSlackOpen(true)
        setSlackFocusRoomId(null)
      })
      if (location.pathname !== '/') {
        navigate({ pathname: '/', search: next.toString() ? `?${next}` : '' }, { replace: true })
        return
      }
    }

    const raw = searchParams.get('slack_room')
    if (raw) {
      const id = Number.parseInt(raw, 10)
      next.delete('slack_room')
      changed = true
      if (Number.isFinite(id) && id > 0) {
        queueMicrotask(() => {
          setSlackOpen(true)
          setSlackFocusRoomId(id)
        })
      }
      if (location.pathname !== '/') {
        navigate({ pathname: '/', search: next.toString() ? `?${next}` : '' }, { replace: true })
        return
      }
    }

    if (changed) setSearchParams(next, { replace: true })
  }, [location.pathname, navigate, searchParams, setSearchParams])

  const hideChrome = location.pathname.startsWith('/workspace')

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      {hideChrome ? null : (
        <Navbar onProductGuide={startProductTour} onOpenSlack={() => setSlackOpen(true)} />
      )}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/features" element={<AllFeatures />} />
        <Route path="/teams/meet" element={<TeamsMeet />} />
        <Route path="/whiteboard" element={<Whiteboard onOpenSlack={() => setSlackOpen(true)} />} />
        <Route path="/todo" element={<Todo onOpenSlack={() => setSlackOpen(true)} />} />
        <Route path="/workspace" element={<CodingWorkspace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/join/:token" element={<JoinRoom />} />
        <Route path="/invite/email/:token" element={<AcceptEmailInvite />} />
      </Routes>
      <ProductTour
        key={tourEpoch}
        active={tourActive}
        onClose={() => setTourActive(false)}
      />
      {hideChrome ? null : <ChatbotWidget />}
      <SlackCollaboration
        open={slackOpen}
        onClose={() => {
          setSlackOpen(false)
          setSlackFocusRoomId(null)
        }}
        focusRoomId={slackFocusRoomId}
        onFocusRoomConsumed={() => setSlackFocusRoomId(null)}
      />
    </>
  )
}

export default App
