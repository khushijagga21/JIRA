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
            <p className="feature-kicker">COLLABORATION</p>
            <h3 className="feature-title">More collaboration, less context switching</h3>
            <p className="feature-desc">
              Communication is easy when details like business context, project requirements, QA
              comments, and design files are all in one place.
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
            <p className="feature-kicker">REPORTING</p>
            <h3 className="feature-title">Always informed, always prepared</h3>
            <p className="feature-desc">
              Catch blockers and better support your team when you have a clear view of
              dependencies, work progress, and resourcing.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

