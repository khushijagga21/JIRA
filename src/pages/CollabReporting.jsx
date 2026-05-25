function Frame({ tone = 'green', variant = 'collab' }) {
  return (
    <div className={`feature-frame tone-${tone}`}>
      <div className={`feature-window ${variant}`}>
        <div className="feature-window-top">
          <div className="feature-top-title">
            {variant === 'collab' ? 'Create new web page for feature launch' : 'Progress by status'}
          </div>
          <div className="feature-top-actions">
            <span className="feature-top-btn" aria-hidden="true"></span>
            <span className="feature-top-btn" aria-hidden="true"></span>
          </div>
        </div>
        <div className="feature-window-body">
          {variant === 'collab' ? (
            <>
              <div className="feature-line w60"></div>
              <div className="feature-line w88"></div>
              <div className="feature-video">
                <div className="feature-play" aria-hidden="true"></div>
              </div>
              <div className="feature-mini-row">
                <span className="feature-mini-avatar" aria-hidden="true"></span>
                <span className="feature-mini-pill" aria-hidden="true"></span>
                <span className="feature-mini-pill" aria-hidden="true"></span>
              </div>
            </>
          ) : (
            <>
              <div className="feature-metrics">
                <span className="metric-pill g"></span>
                <span className="metric-pill b"></span>
                <span className="metric-pill p"></span>
              </div>
              <div className="feature-charts">
                <div className="chart donut"></div>
                <div className="chart bars"></div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CollabReporting() {
  return (
    <section className="feature-pair" id="collaboration">
      <div className="container">
        <div className="feature-row feature-row-right">
          <div className="feature-copy">
            <p className="feature-kicker">TEAM CONVERSATIONS</p>
            <h3 className="feature-title">Talk about the work where the work lives</h3>
            <p className="feature-desc">
              Threads, mentions, and updates stay on tasks and projects—so your team resolves questions
              together instead of losing context across email and side chats.
            </p>
          </div>
          <div className="feature-media">
            <Frame tone="green" variant="collab" />
          </div>
        </div>

        <div className="feature-row feature-row-left">
          <div className="feature-media">
            <Frame tone="blue" variant="report" />
          </div>
          <div className="feature-copy">
            <p className="feature-kicker">TEAM VISIBILITY</p>
            <h3 className="feature-title">Support your team without micromanaging</h3>
            <p className="feature-desc">
              See who is stuck, what depends on what, and how collaboration is flowing—so leads can
              unblock people and celebrate progress with real data.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

