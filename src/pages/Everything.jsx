import { Link } from 'react-router-dom'

const FEATURES = [
  {
    id: 'collab',
    title: 'Team collaboration',
    desc: 'Channels, threads, and @mentions next to your tickets—like Slack, but wired to real delivery context so decisions don’t get lost in DMs.',
    visual: 'slack',
    featured: true,
    learnTo: '/#collaboration',
  },
  {
    id: 'pm',
    title: 'Project management',
    desc: 'Boards, backlogs, priorities, and owners in one place. Plan sprints or run continuous flow—every initiative stays visible from idea to release.',
    visual: 'pm',
    featured: true,
    learnTo: '/#teams',
  },
  {
    id: 'templates',
    title: 'Scrum and kanban templates',
    desc: 'Out-of-the-box and customizable workflows to fit your team’s unique processes.',
    icon: 'spark',
    learnTo: '/#teams',
  },
  {
    id: 'automation',
    title: 'Automation',
    desc: 'Cut manual updates. Build rules or start from templates so status, handoffs, and notifications stay in sync.',
    icon: 'bolt',
    learnTo: '/#everything',
  },
  {
    id: 'insights',
    title: 'Insights & metrics',
    desc: 'Reports for cycle time, throughput, and delivery health—so you can spot bottlenecks early.',
    icon: 'bars',
    learnTo: '/#collaboration',
  },
  {
    id: 'release',
    title: 'Release & deployment management',
    desc: 'Connect SCM and CI/CD and track work as it moves through build, staging, and production.',
    icon: 'rocket',
    learnTo: '/#everything',
  },
  {
    id: 'deps',
    title: 'Dependency mapping',
    desc: 'See how work links together so blockers and upstream changes are obvious before they slip the schedule.',
    icon: 'graph',
    learnTo: '/#single-source',
  },
  {
    id: 'filters',
    title: 'Custom filters',
    desc: 'Slice your backlog with powerful filters and saved views so everyone sees the right work at the right time.',
    icon: 'filter',
    learnTo: '/#single-source',
  },
]

function SlackStylePreview() {
  return (
    <div className="everything-preview everything-preview--slack" aria-hidden="true">
      <div className="everything-preview-slack-rail" />
      <div className="everything-preview-slack-body">
        <div className="everything-preview-slack-head"># delivery-updates</div>
        <div className="everything-preview-slack-row">
          <span className="everything-preview-slack-avatar" />
          <div className="everything-preview-slack-lines">
            <span className="everything-preview-slack-line" />
            <span className="everything-preview-slack-line everything-preview-slack-line--short" />
          </div>
        </div>
        <div className="everything-preview-slack-row">
          <span className="everything-preview-slack-avatar everything-preview-slack-avatar--2" />
          <div className="everything-preview-slack-lines">
            <span className="everything-preview-slack-line everything-preview-slack-line--mid" />
            <span className="everything-preview-slack-line everything-preview-slack-line--tiny" />
          </div>
        </div>
      </div>
    </div>
  )
}

function ProjectPreview() {
  return (
    <div className="everything-preview everything-preview--pm" aria-hidden="true">
      <div className="everything-preview-pm-col">
        <span className="everything-preview-pm-title">To do</span>
        <div className="everything-preview-pm-card" />
        <div className="everything-preview-pm-card everything-preview-pm-card--sm" />
      </div>
      <div className="everything-preview-pm-col">
        <span className="everything-preview-pm-title">Doing</span>
        <div className="everything-preview-pm-card everything-preview-pm-card--accent" />
      </div>
      <div className="everything-preview-pm-col">
        <span className="everything-preview-pm-title">Done</span>
        <div className="everything-preview-pm-card everything-preview-pm-card--done" />
        <div className="everything-preview-pm-card everything-preview-pm-card--done everything-preview-pm-card--sm" />
      </div>
    </div>
  )
}

function CardIcon({ name }) {
  const paths = {
    spark:
      'M12 2l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Zm7.2 10.2 1.3.6-.6 1.3-1.3-.6-.6-1.3 1.2 0Z',
    bolt: 'M13 2 4 14h7l-1 8 10-14h-7l0-6Z',
    bars: 'M5 5h3v3H5V5Zm0 6h3v8H5v-8Zm6-6h3v14h-3V5Zm6 8h3v6h-3v-6Z',
    rocket: 'M7 4h10v2H7V4Zm-2 4h14v2H5V8Zm2 4h10v2H7v-2Zm-2 4h14v2H5v-2Z',
    graph: 'M6 7a3 3 0 1 1 6 0c0 1.2-.7 2.3-1.7 2.8L18 17.5l-1.5 1.5-7.7-7.7A3 3 0 0 1 6 7Z',
    filter: 'M4 6h16v2H4V6Zm0 5h10v2H4v-2Zm0 5h16v2H4v-2Z',
  }
  const d = paths[name] || paths.spark
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path fill="currentColor" d={d} />
    </svg>
  )
}

export default function Everything({ variant = 'embed' }) {
  const isPage = variant === 'page'
  const [first, second, ...rest] = FEATURES

  return (
    <section
      className={`everything${isPage ? ' everything--page' : ''}`}
      id={isPage ? undefined : 'everything'}
      aria-labelledby={isPage ? 'everything-page-title' : undefined}
    >
      <div className={isPage ? undefined : 'container'}>
        <h2 className="everything-title" id={isPage ? 'everything-page-title' : undefined}>
          {isPage ? 'All features' : 'Everything your engineering team needs'}
        </h2>
        {isPage ? (
          <p className="everything-lead">
            Explore what workSphere offers—from Slack-style collaboration beside your work to full project
            management on boards and backlogs.
          </p>
        ) : null}

        <div className="everything-featured-row">
          <article className="everything-card everything-card--featured everything-card--slack">
            <SlackStylePreview />
            <h3 className="everything-card-title">{first.title}</h3>
            <p className="everything-card-desc">{first.desc}</p>
            <Link className="everything-link" to={first.learnTo}>
              Learn more <span aria-hidden="true">→</span>
            </Link>
          </article>
          <article className="everything-card everything-card--featured everything-card--pm">
            <ProjectPreview />
            <h3 className="everything-card-title">{second.title}</h3>
            <p className="everything-card-desc">{second.desc}</p>
            <Link className="everything-link" to={second.learnTo}>
              Learn more <span aria-hidden="true">→</span>
            </Link>
          </article>
        </div>

        {isPage ? null : (
          <div className="everything-grid everything-grid--rest">
            {rest.map((f) => (
              <article className="everything-card" key={f.id}>
                <div className="everything-icon" aria-hidden="true">
                  <CardIcon name={f.icon} />
                </div>
                <h3 className="everything-card-title">{f.title}</h3>
                <p className="everything-card-desc">{f.desc}</p>
                <Link className="everything-link" to={f.learnTo}>
                  Learn more <span aria-hidden="true">→</span>
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
