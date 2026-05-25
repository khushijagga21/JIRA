import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCurrentUser } from '../utils/auth.js'
import { queueTaskShare } from '../utils/todoShare.js'

const STORAGE_KEY = 'worksphere_todo_v1'

const COLUMNS = [
  {
    id: 'todo',
    label: 'To do',
    accent: 'todo-col--todo',
    hint: 'New work waiting to be picked up',
  },
  {
    id: 'doing',
    label: 'Doing',
    accent: 'todo-col--doing',
    hint: 'In progress this sprint',
  },
  {
    id: 'done',
    label: 'Done',
    accent: 'todo-col--done',
    hint: 'Completed and ready to ship',
  },
]

const PRIORITIES = [
  { id: 'low', label: 'Low', tone: 'low' },
  { id: 'med', label: 'Medium', tone: 'med' },
  { id: 'high', label: 'High', tone: 'high' },
]

const DEFAULT_TASKS = [
  {
    id: 't-1',
    title: 'Draft sprint kickoff agenda',
    owner: 'Khushi',
    priority: 'high',
    status: 'doing',
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
  },
  {
    id: 't-2',
    title: 'Polish the workSphere whiteboard onboarding tour',
    owner: 'Aarav',
    priority: 'med',
    status: 'todo',
    createdAt: Date.now() - 1000 * 60 * 60 * 5,
  },
  {
    id: 't-3',
    title: 'Ship dark-mode bug fixes for chat',
    owner: 'Mira',
    priority: 'low',
    status: 'done',
    createdAt: Date.now() - 1000 * 60 * 60 * 48,
  },
]

function loadTasks() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_TASKS
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return DEFAULT_TASKS
    return parsed
  } catch {
    return DEFAULT_TASKS
  }
}

function saveTasks(tasks) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  } catch {
    /* ignore */
  }
}

function makeId() {
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function priorityTone(id) {
  return PRIORITIES.find((p) => p.id === id)?.tone ?? 'low'
}

function nextStatus(id) {
  if (id === 'todo') return 'doing'
  if (id === 'doing') return 'done'
  return 'todo'
}

export default function Todo({ onOpenSlack } = {}) {
  const [tasks, setTasks] = useState(loadTasks)
  const [title, setTitle] = useState('')
  const [owner, setOwner] = useState(() => getCurrentUser()?.name || '')
  const [priority, setPriority] = useState('med')
  const [filter, setFilter] = useState('all') // all | mine
  const [dragId, setDragId] = useState(null)
  const [dragOverCol, setDragOverCol] = useState(null)
  const [toast, setToast] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState('')
  const dragIdRef = useRef(null)
  const toastTimerRef = useRef(null)
  const titleInputRef = useRef(null)

  useEffect(() => {
    saveTasks(tasks)
  }, [tasks])

  useEffect(() => {
    return () => window.clearTimeout(toastTimerRef.current)
  }, [])

  function showToast(text) {
    setToast(text)
    window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(''), 1800)
  }

  const currentUser = getCurrentUser()
  const currentName = (currentUser?.name || '').trim()

  const filteredTasks = useMemo(() => {
    if (filter !== 'mine' || !currentName) return tasks
    const target = currentName.toLowerCase()
    return tasks.filter((t) => (t.owner || '').toLowerCase() === target)
  }, [tasks, filter, currentName])

  const stats = useMemo(() => {
    const total = tasks.length
    const done = tasks.filter((t) => t.status === 'done').length
    const doing = tasks.filter((t) => t.status === 'doing').length
    return { total, done, doing, progress: total === 0 ? 0 : Math.round((done / total) * 100) }
  }, [tasks])

  function addTask(e) {
    e.preventDefault()
    const t = title.trim()
    if (!t) {
      titleInputRef.current?.focus()
      return
    }
    const o = owner.trim() || currentName || 'Unassigned'
    setTasks((prev) => [
      {
        id: makeId(),
        title: t,
        owner: o,
        priority,
        status: 'todo',
        createdAt: Date.now(),
      },
      ...prev,
    ])
    setTitle('')
    showToast('Task added to “To do”')
    titleInputRef.current?.focus()
  }

  function removeTask(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    showToast('Task deleted')
  }

  function moveTask(id, status) {
    let moved = false
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id || t.status === status) return t
        moved = true
        return { ...t, status }
      }),
    )
    if (moved) {
      const label = status === 'todo' ? 'To do' : status === 'doing' ? 'Doing' : 'Done'
      showToast(`Moved to “${label}”`)
    }
  }

  function advanceTask(id) {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t
        const next = nextStatus(t.status)
        const label = next === 'todo' ? 'To do' : next === 'doing' ? 'Doing' : 'Done'
        showToast(`Moved to “${label}”`)
        return { ...t, status: next }
      }),
    )
  }

  function clearDone() {
    const n = tasks.filter((t) => t.status === 'done').length
    if (n === 0) return
    setTasks((prev) => prev.filter((t) => t.status !== 'done'))
    showToast(`Cleared ${n} completed task${n === 1 ? '' : 's'}`)
  }

  function resetDemo() {
    setTasks(DEFAULT_TASKS)
    showToast('Sample tasks restored')
  }

  function beginEdit(t) {
    setEditingId(t.id)
    setEditDraft(t.title)
  }

  function saveEdit() {
    const next = editDraft.trim()
    if (editingId && next) {
      setTasks((prev) => prev.map((t) => (t.id === editingId ? { ...t, title: next } : t)))
    }
    setEditingId(null)
    setEditDraft('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft('')
  }

  function setTaskPriority(id, p) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, priority: p } : t)))
  }

  function shareTaskToChat(t) {
    queueTaskShare(t)
    showToast('Pick a chat to send this task.')
    onOpenSlack?.()
  }

  function handleDragStart(e, id) {
    dragIdRef.current = id
    setDragId(id)
    try {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', id)
    } catch {
      /* some browsers throw on setData; ref is the source of truth */
    }
  }

  function handleDragEnd() {
    dragIdRef.current = null
    setDragId(null)
    setDragOverCol(null)
  }

  function handleDragOver(e, colId) {
    if (!dragIdRef.current) return
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
    if (dragOverCol !== colId) setDragOverCol(colId)
  }

  function handleDragLeave(colId) {
    if (dragOverCol === colId) setDragOverCol(null)
  }

  function handleDrop(e, status) {
    e.preventDefault()
    const id = dragIdRef.current || e.dataTransfer?.getData?.('text/plain') || null
    dragIdRef.current = null
    setDragId(null)
    setDragOverCol(null)
    if (!id) return
    moveTask(id, status)
  }

  const columnGroups = COLUMNS.map((col) => ({
    ...col,
    items: filteredTasks.filter((t) => t.status === col.id),
  }))

  return (
    <main id="main" className="todo-page">
      <div className="todo-bg" aria-hidden>
        <div className="todo-bg-glow todo-bg-glow--a" />
        <div className="todo-bg-glow todo-bg-glow--b" />
      </div>

      <div className="todo-shell">
        <div className="todo-toolbar">
          <Link className="todo-back" to="/">
            ← Back to workSphere
          </Link>
        </div>

        <header className="todo-head">
          <div className="todo-head-text">
            <span className="todo-eyebrow">
              <span className="todo-eyebrow-dot" aria-hidden /> Team tasks
            </span>
            <h1 className="todo-title">
              workSphere <span className="todo-title-accent">To-Do</span>
            </h1>
            <p className="todo-lead">
              Plan, assign, and track tasks across your team. Drag a card between columns or use the quick actions to keep
              work flowing.
            </p>
          </div>

          <div className="todo-stats" role="list" aria-label="Task summary">
            <div className="todo-stat" role="listitem">
              <span className="todo-stat-num">{stats.total}</span>
              <span className="todo-stat-label">Total</span>
            </div>
            <div className="todo-stat todo-stat--doing" role="listitem">
              <span className="todo-stat-num">{stats.doing}</span>
              <span className="todo-stat-label">In progress</span>
            </div>
            <div className="todo-stat todo-stat--done" role="listitem">
              <span className="todo-stat-num">{stats.done}</span>
              <span className="todo-stat-label">Done</span>
            </div>
            <div className="todo-stat todo-stat--progress" role="listitem" aria-label={`Progress ${stats.progress}%`}>
              <span className="todo-stat-num">{stats.progress}%</span>
              <span className="todo-stat-label">Progress</span>
              <span
                className="todo-stat-bar"
                aria-hidden
                style={{ '--todo-progress': `${stats.progress}%` }}
              />
            </div>
          </div>
        </header>

        <form className="todo-compose" onSubmit={addTask} aria-label="Add a task">
          <div className="todo-compose-row">
            <input
              ref={titleInputRef}
              className="todo-compose-input"
              placeholder="What needs to get done? (press Enter to add)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
            />
            <input
              className="todo-compose-owner"
              placeholder="Assign to…"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              maxLength={60}
              aria-label="Assignee"
            />
            <div className="todo-compose-prios" role="radiogroup" aria-label="Priority">
              {PRIORITIES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={priority === p.id}
                  className={`todo-prio todo-prio--${p.tone}${priority === p.id ? ' is-on' : ''}`}
                  onClick={() => setPriority(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button type="submit" className="todo-compose-add" disabled={!title.trim()}>
              <span aria-hidden>＋</span> Add task
            </button>
          </div>
        </form>

        <div className="todo-controls">
          <div className="todo-filter" role="tablist" aria-label="Task filter">
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'all'}
              className={`todo-filter-btn${filter === 'all' ? ' is-on' : ''}`}
              onClick={() => setFilter('all')}
            >
              All tasks
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'mine'}
              className={`todo-filter-btn${filter === 'mine' ? ' is-on' : ''}`}
              onClick={() => setFilter('mine')}
              disabled={!currentName}
              title={currentName ? `Tasks assigned to ${currentName}` : 'Sign in to filter by your tasks'}
            >
              Assigned to me
            </button>
          </div>
          <div className="todo-controls-right">
            <button type="button" className="todo-mini-btn" onClick={clearDone} disabled={stats.done === 0}>
              Clear completed
            </button>
            <button type="button" className="todo-mini-btn" onClick={resetDemo}>
              Reset sample
            </button>
          </div>
        </div>

        <div className="todo-board" aria-label="Task board">
          {columnGroups.map((col) => (
            <section
              key={col.id}
              className={`todo-col ${col.accent}${dragOverCol === col.id ? ' is-drop-target' : ''}${dragId ? ' is-drop-active' : ''}`}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragEnter={(e) => handleDragOver(e, col.id)}
              onDragLeave={() => handleDragLeave(col.id)}
              onDrop={(e) => handleDrop(e, col.id)}
              aria-label={col.label}
            >
              <header className="todo-col-head">
                <div className="todo-col-head-main">
                  <span className={`todo-col-dot todo-col-dot--${col.id}`} aria-hidden />
                  <h2 className="todo-col-title">{col.label}</h2>
                  <span className="todo-col-count">{col.items.length}</span>
                </div>
                <p className="todo-col-hint">{col.hint}</p>
              </header>

              <ul className="todo-col-list">
                {col.items.length === 0 ? (
                  <li className="todo-col-empty">No tasks here yet.</li>
                ) : (
                  col.items.map((t) => {
                    const tone = priorityTone(t.priority)
                    const isEditing = editingId === t.id
                    const isDragging = dragId === t.id
                    return (
                      <li
                        key={t.id}
                        className={`todo-card todo-card--${tone}${isDragging ? ' is-dragging' : ''}`}
                        draggable={!isEditing}
                        onDragStart={(e) => handleDragStart(e, t.id)}
                        onDragEnd={handleDragEnd}
                      >
                        <div className="todo-card-top">
                          <div className="todo-card-prio-set" role="radiogroup" aria-label="Priority">
                            {PRIORITIES.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                role="radio"
                                aria-checked={t.priority === p.id}
                                className={`todo-card-prio-dot todo-card-prio-dot--${p.tone}${t.priority === p.id ? ' is-on' : ''}`}
                                onClick={() => setTaskPriority(t.id, p.id)}
                                title={`${p.label} priority`}
                                aria-label={`${p.label} priority`}
                              />
                            ))}
                          </div>
                          <div className="todo-card-top-actions">
                            <button
                              type="button"
                              className="todo-card-share"
                              onClick={() => shareTaskToChat(t)}
                              aria-label="Send task to workSphere chat"
                              title="Send to workSphere chat"
                            >
                              ✈
                            </button>
                            <button
                              type="button"
                              className="todo-card-x"
                              onClick={() => removeTask(t.id)}
                              aria-label="Delete task"
                              title="Delete task"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                        {isEditing ? (
                          <input
                            className="todo-card-edit"
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                saveEdit()
                              } else if (e.key === 'Escape') {
                                e.preventDefault()
                                cancelEdit()
                              }
                            }}
                            autoFocus
                            maxLength={140}
                            aria-label="Edit task title"
                          />
                        ) : (
                          <p
                            className="todo-card-title"
                            onDoubleClick={() => beginEdit(t)}
                            title="Double-click to edit"
                          >
                            {t.title}
                          </p>
                        )}
                        <div className="todo-card-foot">
                          <span className="todo-card-owner" title={`Assigned to ${t.owner}`}>
                            <span className="todo-card-avatar" aria-hidden>
                              {(t.owner || '?').slice(0, 1).toUpperCase()}
                            </span>
                            <span className="todo-card-owner-name">{t.owner || 'Unassigned'}</span>
                          </span>
                          <button
                            type="button"
                            className="todo-card-move"
                            onClick={() => advanceTask(t.id)}
                            title={
                              t.status === 'done'
                                ? 'Move back to To do'
                                : `Move to ${nextStatus(t.status) === 'doing' ? 'Doing' : nextStatus(t.status) === 'done' ? 'Done' : 'To do'}`
                            }
                          >
                            {t.status === 'done' ? '↺ Reopen' : t.status === 'doing' ? '✓ Done' : '→ Start'}
                          </button>
                        </div>
                      </li>
                    )
                  })
                )}
              </ul>
            </section>
          ))}
        </div>

        <p className="todo-foot">
          Tasks are saved to your browser. Drag a card between columns, double-click a title to rename, or use the
          status button. Sign in to sync them across devices (coming soon).
        </p>
      </div>

      {toast ? (
        <div className="todo-toast" role="status" aria-live="polite">
          {toast}
        </div>
      ) : null}
    </main>
  )
}
