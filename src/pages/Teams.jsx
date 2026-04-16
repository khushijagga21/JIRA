export default function Teams() {
  return (
    <section className="teams teams-hero" id="teams">
        <div className="container">
          <h1 className="teams-title">How your team uses workSphere day to day</h1>

          <div className="teams-cards" role="list">
            <article className="teams-card" role="listitem">
              <div className="teams-avatar dev" aria-hidden="true"></div>
              <h2 className="teams-card-title">Developer</h2>
              <p className="teams-card-desc">
                Reduce context switching and spend more time building cool software. We’ll handle the
                processes and workflows for you.
              </p>
              <a className="teams-cta" href="#">
                Get started <span aria-hidden="true">→</span>
              </a>
            </article>

            <article className="teams-card" role="listitem">
              <div className="teams-avatar platform" aria-hidden="true"></div>
              <h2 className="teams-card-title">Platform engineer</h2>
              <p className="teams-card-desc">
                Manage delivery of platform-spanning features alongside your product development
                counterparts.
              </p>
              <a className="teams-cta" href="#">
                Get started <span aria-hidden="true">→</span>
              </a>
            </article>

            <article className="teams-card" role="listitem">
              <div className="teams-avatar leadership" aria-hidden="true"></div>
              <h2 className="teams-card-title">Engineering leadership</h2>
              <p className="teams-card-desc">
                Understand development progress - without the shoulder taps - so your teams can stay
                focused on tasks at hand.
              </p>
              <a className="teams-cta" href="#">
                Get started <span aria-hidden="true">→</span>
              </a>
            </article>
          </div>
        </div>
      </section>
  )
}

