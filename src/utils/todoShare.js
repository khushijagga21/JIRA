/** Pending To-Do task to drop into the next chat channel you open. */

const PENDING_KEY = 'worksphere_todo_pending_share_v1'

function safeRead(key) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function safeWrite(key, value) {
  try {
    if (value == null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

export function queueTaskShare(task) {
  if (!task || !task.title) return
  safeWrite(PENDING_KEY, {
    title: String(task.title),
    owner: String(task.owner || 'Unassigned'),
    priority: String(task.priority || 'med'),
    status: String(task.status || 'todo'),
    queuedAt: Date.now(),
  })
}

export function peekPendingTaskShare() {
  return safeRead(PENDING_KEY)
}

export function consumePendingTaskShare() {
  const data = safeRead(PENDING_KEY)
  safeWrite(PENDING_KEY, null)
  return data
}

export function clearPendingTaskShare() {
  safeWrite(PENDING_KEY, null)
}

const PRIORITY_LABEL = { low: 'Low', med: 'Medium', high: 'High' }
const STATUS_LABEL = { todo: 'To do', doing: 'Doing', done: 'Done' }
const PRIORITY_EMOJI = { low: '🟢', med: '🟡', high: '🔴' }
const STATUS_EMOJI = { todo: '📝', doing: '🚧', done: '✅' }

export function formatTaskMessage(task) {
  if (!task) return ''
  const status = STATUS_LABEL[task.status] || 'To do'
  const priority = PRIORITY_LABEL[task.priority] || 'Medium'
  const pEmoji = PRIORITY_EMOJI[task.priority] || '🟡'
  const sEmoji = STATUS_EMOJI[task.status] || '📝'
  return [
    `📋 *workSphere Task* — ${task.title}`,
    `${sEmoji} Status: *${status}*  ·  ${pEmoji} Priority: *${priority}*  ·  👤 Owner: *${task.owner || 'Unassigned'}*`,
  ].join('\n')
}
