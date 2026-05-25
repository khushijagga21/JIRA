const QUICK_TOPICS = [
  {
    id: 'pm',
    title: 'Project management',
    prompts: ['How should we set up a simple Kanban workflow for our team?'],
  },
  {
    id: 'worksphere',
    title: 'workSphere help',
    prompts: ['How do I use workSphere chat and team channels?'],
  },
  {
    id: 'tickets',
    title: 'Tickets & boards',
    prompts: ['What makes a good ticket on a shared board?'],
  },
  {
    id: 'general',
    title: 'Ask anything',
    prompts: ['Explain Scrum vs Kanban in simple terms'],
  },
]

function contains(text, words) {
  return words.some((w) => text.includes(w))
}

export function getQuickTopics() {
  return QUICK_TOPICS
}

/** Reply when the user attaches an image (optional text caption). */
export function getBotReplyForImage(caption) {
  const intro = [
    'Thanks for sharing an image.',
    'This assistant can’t view or analyze pictures—describe what you’re trying to do in text and I’ll help with workflows, tickets, and using workSphere.',
  ].join('\n')
  const trimmed = String(caption ?? '').trim()
  if (!trimmed) {
    return intro
  }
  return [intro, '', 'Here’s what I can share based on your message:', getBotReply(trimmed)].join('\n')
}

export function getBotReply(raw) {
  const text = String(raw ?? '').trim().toLowerCase()
  if (!text) {
    return "Tell me what you’re trying to do (example: “set up a workflow”, “track tasks”, “create a report”)."
  }

  // Greetings
  if (contains(text, ['hi', 'hello', 'hey'])) {
    return 'Hi! I can help you learn workSphere workflows and how to use this site. What are you trying to do today?'
  }

  // Auth
  if (contains(text, ['login', 'log in', 'sign in', 'signin', 'cant login', "can't login"])) {
    return [
      'If you already created an account, go to **Sign in** and enter the same email you used during signup.',
      '',
      'If you see “Account not found”, it usually means:',
      '- You used a different email',
      '- You haven’t signed up yet (go to **Sign up**)',
      '',
      'Run **npm run dev** so the sign-in API is available (it starts the API and the site).',
    ].join('\n')
  }

  if (contains(text, ['signup', 'sign up', 'register', 'create account'])) {
    return [
      'To create an account:',
      '- Open **Sign up** and enter **Name**, **Email**, and **Password**',
      '- Submit — your account is stored in the database',
      '- Then go to **Sign in** and log in with the same email and password to use workSphere',
      '',
      'If it says “already exists”, use **Sign in** with that email.',
    ].join('\n')
  }

  // Workflow / PM
  if (contains(text, ['workflow', 'process', 'flow'])) {
    return [
      'A simple project workflow you can use in workSphere:',
      '1) **To do** (planned) → 2) **In progress** (being worked on) → 3) **Review/QA** → 4) **Done**',
      '',
      'Best practice:',
      '- Keep columns small and clear',
      '- Add “Blocked” only if your team actively manages blockers',
      '- Limit work-in-progress (WIP) to reduce context switching',
    ].join('\n')
  }

  if (contains(text, ['kanban', 'scrum', 'sprint'])) {
    return [
      '**Kanban**: continuous flow (no fixed sprints). Best for support/ops or flexible priorities.',
      '',
      '**Scrum**: time-boxed sprints (e.g., 1–2 weeks). Best when you plan work in batches and review every sprint.',
      '',
      'If you’re unsure, start with **Kanban** and add sprints later.',
    ].join('\n')
  }

  // Tickets / tasks
  if (contains(text, ['ticket', 'task', 'issue', 'story', 'bug'])) {
    return [
      'A good ticket in workSphere should include:',
      '- **Title**: outcome-focused (what will change)',
      '- **Description**: context + acceptance criteria',
      '- **Owner**: who is responsible',
      '- **Priority** + **due date** (if needed)',
      '',
      'Tip: Keep tickets small enough to finish in 1–3 days.',
    ].join('\n')
  }

  if (contains(text, ['status', 'in progress', 'done', 'blocked', 'qa', 'review'])) {
    return [
      'Common status set:',
      '- **To do**',
      '- **In progress**',
      '- **Review/QA**',
      '- **Done**',
      '',
      'Optional:',
      '- **Blocked** (only if you review blockers daily)',
      '- **On hold** (for paused work)',
    ].join('\n')
  }

  // Reporting
  if (contains(text, ['report', 'reporting', 'metrics', 'dashboard'])) {
    return [
      'Useful reporting metrics for project management:',
      '- **Cycle time**: how long items take from start → done',
      '- **Throughput**: items completed per week',
      '- **Work in progress (WIP)**: how many items are active',
      '- **Blocked time**: how long items are blocked',
      '',
      'Goal: spot bottlenecks and improve predictability.',
    ].join('\n')
  }

  // Site navigation
  if (contains(text, ['navigate', 'where', 'section', 'page', 'how to use site'])) {
    return [
      'On the homepage, scroll through sections:',
      '- **Teams**: roles & how teams use workSphere',
      '- **Single source of truth**: planning/prioritization',
      '- **Collaboration / Reporting**: examples of how teams work',
      '- **Everything you need**: feature overview',
      '',
      'Tell me what you’re trying to achieve and I’ll point you to the right section.',
    ].join('\n')
  }

  // Fallback
  return [
    "I can help with workSphere project-management workflow and using this site.",
    '',
    'Try asking one of these:',
    '- “Explain a simple workflow”',
    '- “Kanban vs Scrum”',
    '- “What statuses should we use?”',
    '- “How do I track progress?”',
    '- “I can’t log in”',
  ].join('\n')
}

