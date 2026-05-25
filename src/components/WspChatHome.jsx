import workSphereLogo from '../assets/worksphere-logo.png'

function homeGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function channelSlug(name) {
  return String(name ?? '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
}

export default function WspChatHome({
  identity,
  rooms,
  visibleRooms,
  hiddenCount,
  pickerExpanded,
  apiError,
  showCreate,
  maxMembers,
  channelHue,
  memberInitials,
  onClose,
  onCreate,
  onOpenRoom,
  onShowMore,
  onSwitchAccount,
}) {
  const firstName = identity.name.split(/\s+/)[0] || 'there'

  return (
    <div className="wsp-home">
      <button type="button" className="wsp-home-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <div className="wsp-home-layout">
        <aside className="wsp-home-hero">
          <div className="wsp-home-hero-glow wsp-home-hero-glow--a" aria-hidden />
          <div className="wsp-home-hero-glow wsp-home-hero-glow--b" aria-hidden />
          <div className="wsp-home-brand">
            <img src={workSphereLogo} alt="" className="wsp-home-logo" width={40} height={40} />
            <span className="wsp-home-brand-name">workSphere chat</span>
          </div>
          <h1 className="wsp-home-hero-title" id="slack-room-title">
            Your team hub,
            <span className="wsp-home-hero-accent"> one place.</span>
          </h1>
          <p className="wsp-home-hero-desc">
            Pick a workspace to jump into chat, or spin up a fresh channel for your next project.
          </p>
          <div className="wsp-home-user-pill">
            <span className="wsp-home-user-avatar">{memberInitials(identity.name, identity.email)}</span>
            <div className="wsp-home-user-meta">
              <span className="wsp-home-user-name">{identity.name}</span>
              <span className="wsp-home-user-email">{identity.email}</span>
            </div>
          </div>
          <ul className="wsp-home-stats" aria-label="Overview">
            <li>
              <span className="wsp-home-stat-num">{rooms.length}</span>
              <span className="wsp-home-stat-label">Workspace{rooms.length === 1 ? '' : 's'}</span>
            </li>
            <li>
              <span className="wsp-home-stat-num">{maxMembers}</span>
              <span className="wsp-home-stat-label">Seats / channel</span>
            </li>
          </ul>
        </aside>

        <main className="wsp-home-main">
          <header className="wsp-home-main-head">
            <div>
              <p className="wsp-home-greeting">
                {homeGreeting()}, {firstName}
              </p>
              <h2 className="wsp-home-main-title">Choose a workspace</h2>
            </div>
            <button type="button" className="wsp-home-create-btn" onClick={onCreate}>
              <span className="wsp-home-create-icon" aria-hidden>
                +
              </span>
              New workspace
            </button>
          </header>

          {apiError && !showCreate ? <div className="slack-banner wsp-home-banner">{apiError}</div> : null}

          {rooms.length === 0 ? (
            <div className="wsp-home-empty">
              <div className="wsp-home-empty-orbit" aria-hidden>
                <span />
                <span />
                <span />
              </div>
              <h3 className="wsp-home-empty-title">No workspaces yet</h3>
              <p className="wsp-home-empty-desc">
                Create your first channel — invite teammates and start chatting in seconds.
              </p>
              <button type="button" className="wsp-home-create-btn wsp-home-create-btn--large" onClick={onCreate}>
                Create your first workspace
              </button>
            </div>
          ) : (
            <>
              <ul className="wsp-home-grid" aria-label="Your workspaces">
                {visibleRooms.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className="wsp-home-card"
                      onClick={() => onOpenRoom(r.id)}
                      style={{ '--wsp-card-hue': channelHue(r.id) }}
                    >
                      <span className="wsp-home-card-accent" aria-hidden />
                      <span className="wsp-home-card-badge">
                        {memberInitials(r.name, `${r.name}@local`).slice(0, 2)}
                      </span>
                      <span className="wsp-home-card-name">{r.name}</span>
                      <span className="wsp-home-card-channel">#{channelSlug(r.name)}</span>
                      <span className="wsp-home-card-footer">
                        <span className="wsp-home-card-faces">
                          {(r.preview_members || []).slice(0, 4).map((m, i) => (
                            <span
                              key={`${r.id}-${m.email}-${i}`}
                              className="wsp-home-card-face"
                              style={{ zIndex: 4 - i }}
                              title={m.name}
                            >
                              {memberInitials(m.name, m.email)}
                            </span>
                          ))}
                        </span>
                        <span className="wsp-home-card-meta">
                          {(r.member_count ?? 0).toLocaleString()} member
                          {(r.member_count ?? 0) === 1 ? '' : 's'}
                        </span>
                      </span>
                      <span className="wsp-home-card-enter">
                        Open
                        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                          <path
                            fill="currentColor"
                            d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z"
                          />
                        </svg>
                      </span>
                    </button>
                  </li>
                ))}
                <li>
                  <button type="button" className="wsp-home-card wsp-home-card--new" onClick={onCreate}>
                    <span className="wsp-home-card-new-icon" aria-hidden>
                      +
                    </span>
                    <span className="wsp-home-card-new-label">New workspace</span>
                  </button>
                </li>
              </ul>
              {hiddenCount > 0 && !pickerExpanded ? (
                <button type="button" className="wsp-home-show-more" onClick={onShowMore}>
                  Show {hiddenCount} more workspace{hiddenCount === 1 ? '' : 's'}
                </button>
              ) : null}
            </>
          )}

          {identity.source === 'session' ? (
            <button type="button" className="wsp-home-switch" onClick={onSwitchAccount}>
              Sign in with a different account
            </button>
          ) : null}
        </main>
      </div>
    </div>
  )
}
