export default function SingleSource() {
  return (
    <section className="single-source single-v2" id="single-source">
      <div className="container">
        <p className="single-v2-eyebrow">Shared context</p>
        <h2 className="single-v2-title">When the whole team sees the same picture, collaboration gets easier</h2>

        <div className="single-v2-grid">
          <div className="single-media" aria-label="Backlog preview">
            <div className="single-frame" aria-hidden="true">
              <div className="single-window">
                <div className="single-window-top">
                  <div className="single-pill">Team backlog</div>
                  <div className="single-actions">
                    <span className="single-icon" />
                    <span className="single-icon" />
                  </div>
                </div>
                <div className="single-window-body">
                  <div className="single-row">
                    <span className="single-dot p" />
                    <span className="single-text" />
                    <span className="single-tag purple">DISCUSS</span>
                    <span className="single-mini" />
                  </div>
                  <div className="single-row">
                    <span className="single-dot b" />
                    <span className="single-text w2" />
                    <span className="single-tag purple">ALIGN</span>
                    <span className="single-mini" />
                  </div>
                  <div className="single-row">
                    <span className="single-dot g" />
                    <span className="single-text w3" />
                    <span className="single-tag yellow">BUILD</span>
                    <span className="single-mini" />
                  </div>
                  <div className="single-row">
                    <span className="single-dot p" />
                    <span className="single-text w4" />
                    <span className="single-tag green">SHIP</span>
                    <span className="single-mini" />
                  </div>
                  <div className="single-footer" />
                </div>
              </div>
            </div>
          </div>

          <div className="single-copy">
            <p className="single-kicker">PLANNING &amp; PRIORITIES</p>
            <h3 className="single-copy-title">Coordinate as a team—not as a chain of DMs</h3>
            <p className="single-copy-desc">
              Backlog items carry owners, discussion, and links to work in progress. Standups stay short
              because context is already visible to everyone who needs it.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
