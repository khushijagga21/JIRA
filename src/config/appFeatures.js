/** Shared feature list for /features cards and the Features nav menu. */
export const APP_FEATURES = [
  {
    id: 'collab',
    title: 'Team channels',
    navLabel: 'workSphere chat',
    desc: 'Group conversations tied to real delivery work—so updates, decisions, and @mentions stay with the project, not scattered across tools.',
    to: '/?slack=picker',
    cardTone: 'slack',
  },
  {
    id: 'teams',
    title: 'workSphere teams',
    navLabel: 'workSphere teams',
    desc: 'Product, engineering, and leadership work from the same source of truth—aligned on what ships without another status meeting.',
    to: '/#teams',
    cardTone: 'teams',
  },
  {
    id: 'whiteboard',
    title: 'workSphere whiteboard',
    navLabel: 'workSphere whiteboard',
    desc: 'Sketch flows, map ideas, and align in real time—then keep the drawing linked to the conversation that started it.',
    to: '/whiteboard',
    cardTone: 'whiteboard',
  },
  {
    id: 'todo',
    title: 'workSphere To-Do',
    navLabel: 'workSphere To-Do',
    desc: 'Plan, assign, and track tasks across your team—organise work in To do, Doing, and Done columns without leaving the workspace.',
    to: '/todo',
    cardTone: 'todo',
  },
  {
    id: 'workspace',
    title: 'Coding workspace',
    navLabel: 'Coding workspace',
    desc: 'Jump from team discussion into focused build context—linked issues, reviews, and tasks without losing the thread.',
    cardTone: 'workspace',
    comingSoon: true,
    anchor: 'coding-workspace',
  },
]

export function buildNavFeatures({ onOpenSlack } = {}) {
  return [
    { label: 'All features', to: '/features' },
    {
      label: 'workSphere chat',
      onAction: () => onOpenSlack?.(),
    },
    { label: 'workSphere teams', to: '/#teams' },
    { label: 'workSphere whiteboard', to: '/whiteboard' },
    { label: 'workSphere To-Do', to: '/todo' },
    { label: 'Coding workspace', to: '/features#coding-workspace' },
  ]
}
