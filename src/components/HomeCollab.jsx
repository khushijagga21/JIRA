const BENEFITS = [
  {
    icon: '💬',
    title: 'Discuss in context',
    desc: 'Comments, threads, and @mentions sit on the work itself—so answers stay tied to the ticket, not buried in email.',
  },
  {
    icon: '🧭',
    title: 'Align without meetings',
    desc: 'Shared boards and status show what each person owns, what’s blocked, and what ships next—no extra standup deck required.',
  },
  {
    icon: '🔗',
    title: 'One link for the truth',
    desc: 'Requirements, decisions, and delivery history live together. New teammates onboard faster because nothing is scattered.',
  },
]

export default function HomeCollab() {
  return (
    <section className="home-collab" id="collaboration-benefits" aria-labelledby="home-collab-title">
      <div className="container">
        <p className="home-collab-eyebrow">Why teams choose workSphere</p>
        <h2 className="home-collab-title" id="home-collab-title">
          Built for people who build together
        </h2>
        <p className="home-collab-lead">
          workSphere helps distributed teams stay in sync—planning, chatting about work, and tracking delivery
          without juggling five different tools.
        </p>
        <ul className="home-collab-grid">
          {BENEFITS.map((b) => (
            <li key={b.title}>
              <article className="home-collab-card">
                <span className="home-collab-icon" aria-hidden>
                  {b.icon}
                </span>
                <h3 className="home-collab-card-title">{b.title}</h3>
                <p className="home-collab-card-desc">{b.desc}</p>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
