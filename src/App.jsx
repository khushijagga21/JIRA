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
import ProductTour from './components/ProductTour.jsx'
import SlackCollaboration from './components/SlackCollaboration.jsx'

const NAV_FEATURES = [
  { label: 'All features', to: '/features' },
  { label: 'Boards & backlogs', to: '/#teams' },
  { label: 'Planning & priorities', to: '/#single-source' },
]

const NAV_SOLUTIONS = [
  { label: 'Engineering teams', to: '/#teams' },
  { label: 'Product & design', to: '/#collaboration' },
  { label: 'Growing teams', to: '/#single-source' },
]

const NAV_MORE = [
  { label: 'Help center', href: '#' },
  { label: "What's new", href: '#' },
  { label: 'API & integrations', to: '/features' },
]

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
      { label: 'Product overview', to: '/features' },
    ],
    [onProductGuide],
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
            items={NAV_FEATURES}
            menuOpen={menuOpen}
            setMenuOpen={setMenuOpen}
          />
          <NavDropdown
            id="solutions"
            label="Solutions"
            items={NAV_SOLUTIONS}
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
            className="nav-link nav-link-plain"
            onClick={() => {
              onOpenSlack?.()
              setMenuOpen(null)
            }}
          >
            Slack
          </button>
          <a className="nav-link nav-link-plain" href="#">
            Pricing
          </a>
          <Link
            className="nav-link nav-link-plain subtle"
            to="/#teams"
            onClick={() => setMenuOpen(null)}
          >
            Teams
          </Link>
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
            className="icon-btn burger"
            type="button"
            aria-label="Open menu"
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
              items={NAV_FEATURES}
              expandedId={mobileAccordion}
              setExpandedId={setMobileAccordion}
              onLinkNavigate={closeMobile}
            />
            <MobileNavGroup
              id="solutions"
              label="Solutions"
              items={NAV_SOLUTIONS}
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
              Slack
            </button>
            <a href="#" className="mobile-link" onClick={closeMobile}>
              Pricing
            </a>
            <MobileNavGroup
              id="more"
              label="More"
              items={NAV_MORE}
              expandedId={mobileAccordion}
              setExpandedId={setMobileAccordion}
              onLinkNavigate={closeMobile}
            />
            <Link className="mobile-link" to="/#teams" onClick={closeMobile}>
              Teams
            </Link>
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

function Hero() {
  return (
    <section className="hero" id="tour-hero">
      <div className="container hero-grid">
        <div className="hero-copy">
          <p className="eyebrow">PROJECT TRACKING FOR DEVELOPER TEAMS</p>
          <h1 className="hero-title">
            Manage projects, track work, and ship with clear priorities
          </h1>
          <p className="hero-subtitle">
            workSphere is where your team plans work, sets priorities, follows tasks from idea to
            release, and collaborates in one place—built for engineers who need visibility without
            the noise.
          </p>
          <ul className="hero-bullets" aria-label="What you can do">
            <li>Organize work into boards and backlogs</li>
            <li>Assign owners, due dates, and priority</li>
            <li>See status at a glance and unblock faster</li>
          </ul>
          <div className="hero-actions">
            <a className="btn btn-primary large" href="#">Get workSphere free</a>
          </div>
        </div>

        <div className="hero-media" aria-label="Product preview">
          <div className="screenshot-card">
            <div className="screenshot-top">
              <div className="dot red" aria-hidden="true"></div>
              <div className="dot yellow" aria-hidden="true"></div>
              <div className="dot green" aria-hidden="true"></div>
              <div className="screenshot-title">Team board</div>
            </div>
            <div className="screenshot-body">
              <div className="board">
                <div className="col">
                  <div className="col-title">TO DO</div>
                  <div className="card">
                    <div className="tag">API</div>
                    <div className="card-title">OpenAPI spec for search</div>
                    <div className="meta">WSP-142</div>
                  </div>
                  <div className="card">
                    <div className="tag">FRONTEND</div>
                    <div className="card-title">Virtualize long issue lists</div>
                    <div className="meta">WSP-156</div>
                  </div>
                </div>
                <div className="col">
                  <div className="col-title">IN PROGRESS</div>
                  <div className="card">
                    <div className="tag green">INFRA</div>
                    <div className="card-title">Canary deploy for API</div>
                    <div className="meta">WSP-089</div>
                  </div>
                  <div className="card">
                    <div className="tag green">PLATFORM</div>
                    <div className="card-title">Redis session migration</div>
                    <div className="meta">WSP-201</div>
                  </div>
                </div>
                <div className="col">
                  <div className="col-title">DONE</div>
                  <div className="card">
                    <div className="tag purple">CI/CD</div>
                    <div className="card-title">Release notes in Slack</div>
                    <div className="meta">WSP-399</div>
                  </div>
                  <div className="card">
                    <div className="tag purple">QA</div>
                    <div className="card-title">Stabilize integration suite</div>
                    <div className="meta">WSP-301</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="avatar-stack" aria-hidden="true">
            <div className="avatar a1"></div>
            <div className="avatar a2"></div>
          </div>

          <div className="floating-bubble bubble-1" aria-hidden="true"></div>
          <div className="floating-bubble bubble-2" aria-hidden="true"></div>
        </div>
      </div>
    </section>
  )
}

function IntroBand() {
  return (
    <section className="intro-band" id="tour-intro" aria-label="About workSphere">
      <div className="container">
        <p className="intro-band-text">
          Whether you run a small product squad or a larger engineering org, workSphere keeps
          project context, task history, and team discussion together—so everyone knows what matters
          now, what’s next, and what’s done.
        </p>
        <p className="intro-band-text intro-band-text--second">
          Teams use workSphere to <strong>plan</strong>, <strong>track</strong>, and{' '}
          <strong>collaborate</strong> on real software delivery.
        </p>
      </div>
    </section>
  )
}

function Home() {
  return (
    <main id="main">
      <div id="top"></div>
      <Hero />
      <IntroBand />
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
    if (location.pathname !== '/') return
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
    }

    if (changed) setSearchParams(next, { replace: true })
  }, [location.pathname, searchParams, setSearchParams])

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Navbar onProductGuide={startProductTour} onOpenSlack={() => setSlackOpen(true)} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/features" element={<AllFeatures />} />
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
      <ChatbotWidget />
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
