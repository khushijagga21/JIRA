export default function HomeHero() {
  return (
    <section className="hero-v2" id="tour-hero">
      <div className="hero-v2-backdrop" aria-hidden>
        <span className="hero-v2-orb hero-v2-orb--a" />
        <span className="hero-v2-orb hero-v2-orb--b" />
      </div>
      <div className="container hero-v2-layout">
        <div className="hero-v2-copy">
          <p className="hero-v2-chip">
            <span className="hero-v2-chip-dot" aria-hidden />
            Team collaboration for product delivery
          </p>
          <h1 className="hero-v2-title">
            Keep your whole team{' '}
            <span className="hero-v2-title-accent">aligned from plan to ship</span>
          </h1>
          <p className="hero-v2-lead">
            workSphere brings conversations, tasks, and priorities into one calm workspace—so designers,
            engineers, and leads always know who is doing what, and why it matters.
          </p>
          <ul className="hero-v2-pills" aria-label="How teams collaborate">
            <li>Discuss work in context</li>
            <li>Share updates with the whole team</li>
            <li>Spot blockers before they spread</li>
          </ul>
          <div className="hero-v2-actions">
            <a className="btn btn-primary large hero-v2-cta" href="#">
              Get workSphere free
            </a>
            <a className="hero-v2-link" href="#collaboration-benefits">
              How collaboration works →
            </a>
          </div>
        </div>

        <div className="hero-v2-visual" aria-label="Team collaboration preview">
          <div className="hero-v2-bento">
            <div className="hero-v2-panel hero-v2-panel--thread">
              <div className="hero-v2-panel-head">
                <span className="hero-v2-panel-label"># release-week</span>
                <span className="hero-v2-live">3 online</span>
              </div>
              <div className="hero-v2-thread">
                <div className="hero-v2-msg">
                  <span className="hero-v2-msg-av">PM</span>
                  <div className="hero-v2-msg-body">
                    <span className="hero-v2-msg-who">Priya · 2m ago</span>
                    <p>Can we confirm API freeze for Thursday? @dev needs the spec locked.</p>
                  </div>
                </div>
                <div className="hero-v2-msg hero-v2-msg--highlight">
                  <span className="hero-v2-msg-av hero-v2-msg-av--dev">DEV</span>
                  <div className="hero-v2-msg-body">
                    <span className="hero-v2-msg-who">Alex · just now</span>
                    <p>
                      Yes—linked <strong>WSP-142</strong> in the board. QA can pick up once deploy lands.
                    </p>
                  </div>
                </div>
                <div className="hero-v2-msg">
                  <span className="hero-v2-msg-av hero-v2-msg-av--qa">QA</span>
                  <div className="hero-v2-msg-body">
                    <span className="hero-v2-msg-who">Jordan</span>
                    <p>On it. I’ll post results in this thread.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="hero-v2-panel hero-v2-panel--compact">
              <span className="hero-v2-stat-label">Shared board</span>
              <div className="hero-v2-mini-board">
                <span className="hero-v2-mini-col">
                  <span className="hero-v2-mini-label">Doing</span>
                  <span className="hero-v2-mini-card">API spec</span>
                </span>
                <span className="hero-v2-mini-col">
                  <span className="hero-v2-mini-label">Review</span>
                  <span className="hero-v2-mini-card hero-v2-mini-card--on">Deploy</span>
                </span>
              </div>
            </div>
            <div className="hero-v2-panel hero-v2-panel--compact">
              <span className="hero-v2-stat-label">Team pulse</span>
              <div className="hero-v2-avatars">
                <span className="hero-v2-av hero-v2-av--1">PM</span>
                <span className="hero-v2-av hero-v2-av--2">DEV</span>
                <span className="hero-v2-av hero-v2-av--3">QA</span>
              </div>
              <span className="hero-v2-stat-sub">Everyone sees the same status</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
