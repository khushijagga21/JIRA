export default function HomeIntro() {
  return (
    <section className="intro-v2" id="tour-intro" aria-label="About workSphere">
      <div className="container">
        <div className="intro-v2-card">
          <div className="intro-v2-icon" aria-hidden>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="intro-v2-body">
            <p className="intro-v2-text">
              Remote and hybrid teams lose hours re-explaining decisions. workSphere keeps{' '}
              <strong>conversations, tasks, and owners</strong> in one place—so PMs, engineers, and
              stakeholders collaborate without chasing screenshots or status pings.
            </p>
            <p className="intro-v2-text intro-v2-text--emphasis">
              Less “where is that thread?” More <strong>plan</strong>, <strong>align</strong>, and{' '}
              <strong>ship</strong> together.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
