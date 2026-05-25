import { Link } from 'react-router-dom'
import { APP_FEATURES } from '../config/appFeatures.js'

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

function TeamsPreview() {
  return (
    <div className="everything-preview everything-preview--teams" aria-hidden="true">
      <div className="everything-preview-teams-card everything-preview-teams-card--product">
        <span className="everything-preview-teams-avatar" />
        <span className="everything-preview-teams-line" />
        <span className="everything-preview-teams-line everything-preview-teams-line--short" />
      </div>
      <div className="everything-preview-teams-card everything-preview-teams-card--engineering">
        <span className="everything-preview-teams-avatar" />
        <span className="everything-preview-teams-line" />
        <span className="everything-preview-teams-line everything-preview-teams-line--short" />
      </div>
      <div className="everything-preview-teams-card everything-preview-teams-card--leadership">
        <span className="everything-preview-teams-avatar" />
        <span className="everything-preview-teams-line" />
        <span className="everything-preview-teams-line everything-preview-teams-line--short" />
      </div>
    </div>
  )
}

function CodingWorkspacePreview() {
  return (
    <div className="everything-preview everything-preview--workspace" aria-hidden="true">
      <div className="everything-preview-ws-sidebar">
        <span className="everything-preview-ws-dot" />
        <span className="everything-preview-ws-dot everything-preview-ws-dot--2" />
        <span className="everything-preview-ws-dot everything-preview-ws-dot--3" />
      </div>
      <div className="everything-preview-ws-editor">
        <div className="everything-preview-ws-tab">issue/WSP-142 · workspace.tsx</div>
        <div className="everything-preview-ws-lines">
          <span className="everything-preview-ws-line">
            <span className="everything-preview-ws-num">1</span>
            <span className="everything-preview-ws-code everything-preview-ws-code--kw">export</span>
            <span className="everything-preview-ws-code"> </span>
            <span className="everything-preview-ws-code everything-preview-ws-code--fn">function</span>
            <span className="everything-preview-ws-code"> fix()</span>
            <span className="everything-preview-ws-code everything-preview-ws-code--brace">{' {'}</span>
          </span>
          <span className="everything-preview-ws-line">
            <span className="everything-preview-ws-num">2</span>
            <span className="everything-preview-ws-code"> </span>
            <span className="everything-preview-ws-code everything-preview-ws-code--cmt">{'// linked to ticket'}</span>
          </span>
          <span className="everything-preview-ws-line">
            <span className="everything-preview-ws-num">3</span>
            <span className="everything-preview-ws-code"> </span>
            <span className="everything-preview-ws-code everything-preview-ws-code--kw">return</span>
            <span className="everything-preview-ws-code"> ship()</span>
          </span>
          <span className="everything-preview-ws-line">
            <span className="everything-preview-ws-num">4</span>
            <span className="everything-preview-ws-code everything-preview-ws-code--brace">{'}'}</span>
          </span>
        </div>
      </div>
    </div>
  )
}

function TodoPreview() {
  return (
    <div className="everything-preview everything-preview--todo" aria-hidden="true">
      <div className="everything-preview-todo-head">
        <span className="everything-preview-todo-title">Sprint tasks</span>
        <span className="everything-preview-todo-count">5</span>
      </div>
      <ul className="everything-preview-todo-list">
        <li className="everything-preview-todo-item everything-preview-todo-item--done">
          <span className="everything-preview-todo-check everything-preview-todo-check--done" aria-hidden>
            ✓
          </span>
          <span className="everything-preview-todo-text">Design auth flow</span>
          <span className="everything-preview-todo-tag everything-preview-todo-tag--done">Done</span>
        </li>
        <li className="everything-preview-todo-item everything-preview-todo-item--doing">
          <span className="everything-preview-todo-check everything-preview-todo-check--doing" aria-hidden />
          <span className="everything-preview-todo-text">Build API for tasks</span>
          <span className="everything-preview-todo-tag everything-preview-todo-tag--doing">Doing</span>
        </li>
        <li className="everything-preview-todo-item">
          <span className="everything-preview-todo-check" aria-hidden />
          <span className="everything-preview-todo-text">Wire up Kanban view</span>
          <span className="everything-preview-todo-tag">To do</span>
        </li>
      </ul>
    </div>
  )
}

function WhiteboardPreview() {
  return (
    <div className="everything-preview everything-preview--whiteboard" aria-hidden="true">
      <div className="everything-preview-wb-toolbar">
        <span className="everything-preview-wb-pill everything-preview-wb-pill--on" />
        <span className="everything-preview-wb-pill" />
        <span className="everything-preview-wb-swatch" />
      </div>
      <div className="everything-preview-wb-canvas">
        <svg className="everything-preview-wb-strokes" viewBox="0 0 200 80" preserveAspectRatio="none">
          <path
            d="M12 52 Q48 18 88 42 T168 28"
            fill="none"
            stroke="#0c66e4"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <rect x="118" y="48" width="52" height="22" rx="6" fill="none" stroke="#f59e0b" strokeWidth="2.5" />
          <circle cx="42" cy="62" r="8" fill="none" stroke="#22c55e" strokeWidth="2.5" />
        </svg>
      </div>
    </div>
  )
}

const PREVIEWS = {
  slack: SlackStylePreview,
  teams: TeamsPreview,
  whiteboard: WhiteboardPreview,
  todo: TodoPreview,
  workspace: CodingWorkspacePreview,
}

function FeatureCard({ feature }) {
  const Preview = PREVIEWS[feature.cardTone]
  const cardClass = `everything-card everything-card--featured everything-card--${feature.cardTone}`

  const body = (
    <>
      <Preview />
      {feature.comingSoon ? (
        <div className="everything-card-head everything-card-head--featured">
          <h3 className="everything-card-title">{feature.title}</h3>
          <span className="everything-badge">Coming soon</span>
        </div>
      ) : (
        <h3 className="everything-card-title">{feature.title}</h3>
      )}
      <p className="everything-card-desc">{feature.desc}</p>
      {!feature.comingSoon ? (
        <span className="everything-card-cta">Open {feature.navLabel} →</span>
      ) : null}
    </>
  )

  if (feature.comingSoon) {
    return (
      <article
        id={feature.anchor}
        className={`${cardClass} everything-card--soon`}
        aria-label={`${feature.title} — coming soon`}
      >
        {body}
      </article>
    )
  }

  return (
    <Link
      to={feature.to}
      id={feature.anchor}
      className={`${cardClass} everything-card--clickable`}
      aria-label={`Open ${feature.title}`}
    >
      {body}
    </Link>
  )
}

export default function Everything({ variant = 'embed' }) {
  const isPage = variant === 'page'

  return (
    <section
      className={`everything${isPage ? ' everything--page' : ''}`}
      id={isPage ? undefined : 'everything'}
      aria-labelledby={isPage ? 'everything-page-title' : undefined}
    >
      <div className={isPage ? undefined : 'container'}>
        <h2 className="everything-title" id={isPage ? 'everything-page-title' : undefined}>
          {isPage ? 'All features' : 'Everything your team needs to collaborate'}
        </h2>
        {isPage ? (
          <p className="everything-lead">
            Explore what workSphere offers—from Slack-style chat and role-based teams to a shared whiteboard,
            plus a coding workspace for focused build context. Click a card to try it.
          </p>
        ) : null}

        <div className="everything-featured-row">
          {APP_FEATURES.map((feature) => (
            <FeatureCard key={feature.id} feature={feature} />
          ))}
        </div>
      </div>
    </section>
  )
}
