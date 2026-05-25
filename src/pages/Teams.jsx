const ROLES = [
  {
    key: 'product',
    title: 'Product & design',
    desc: 'Share specs, gather feedback in threads, and keep engineering aligned on what ships next—without another alignment meeting.',
    tone: 'product',
  },
  {
    key: 'engineering',
    title: 'Engineering',
    desc: 'See blockers early, coordinate in context on tickets, and hand off work with full history—so nobody repeats the same question twice.',
    tone: 'engineering',
  },
  {
    key: 'leadership',
    title: 'Leads & stakeholders',
    desc: 'Get an honest picture of progress and risk from one workspace—support the team without interrupting deep work.',
    tone: 'leadership',
  },
]

export default function Teams() {
  return (
    <section className="teams teams-v2" id="teams">
      <div className="container">
        <p className="teams-v2-eyebrow">Collaboration by role</p>
        <h2 className="teams-v2-title">How different teammates use workSphere together</h2>
        <p className="teams-v2-lead">
          Everyone works from the same source of truth—whether they’re planning, building, or reviewing delivery.
        </p>
        <div className="teams-v2-grid" role="list">
          {ROLES.map((r) => (
            <article key={r.key} className={`teams-v2-card teams-v2-card--${r.tone}`} role="listitem">
              <div className={`teams-v2-avatar teams-v2-avatar--${r.tone}`} aria-hidden />
              <h3 className="teams-v2-card-title">{r.title}</h3>
              <p className="teams-v2-card-desc">{r.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
