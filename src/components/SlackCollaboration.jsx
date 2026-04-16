import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getPublicAppOrigin, inviteLinksNeedLanSetup } from '../utils/publicAppUrl.js'
import { clearCollabIdentity, loadCollabIdentity, saveCollabIdentity } from '../utils/collabIdentity.js'
import { clearLastCollabRoomId, setLastCollabRoomId } from '../utils/collabLastRoom.js'

const MAX_MEMBERS = 200
const WORKSPACE_NAME = 'workSphere'
const PICKER_PAGE_SIZE = 5

function channelHue(roomId) {
  const hues = [268, 330, 196, 18, 204, 152, 310, 48]
  return hues[Number(roomId) % hues.length]
}

async function apiJson(path, options) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(String(data?.reason || res.statusText || 'request_failed'))
    err.reason = data?.reason
    throw err
  }
  return data
}

function errorMessage(reason) {
  if (reason === 'room_full') return `This room is full (${MAX_MEMBERS} people max).`
  if (reason === 'not_a_member') return 'You are not in this room. Join with an invite link first.'
  return null
}

function memberInitials(name, email) {
  const n = String(name ?? '').trim()
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return n.slice(0, 2).toUpperCase()
  }
  const e = String(email ?? '').split('@')[0]
  return (e.slice(0, 2) || '?').toUpperCase()
}

function groupMessagesByAuthor(msgs) {
  const out = []
  for (const m of msgs) {
    const prev = out[out.length - 1]
    const cur = m.author_email?.toLowerCase() ?? ''
    if (prev && prev.authorKey === cur) {
      prev.rows.push(m)
    } else {
      out.push({
        authorKey: cur,
        author_email: m.author_email,
        author_name: m.author_name,
        rows: [m],
      })
    }
  }
  return out
}

function formatMsgTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function normIncludes(hay, needle) {
  const n = String(needle ?? '').trim().toLowerCase()
  if (!n) return true
  return String(hay ?? '').toLowerCase().includes(n)
}

export default function SlackCollaboration({ open, onClose, focusRoomId, onFocusRoomConsumed }) {
  const [identity, setIdentity] = useState(null)
  const [setupName, setSetupName] = useState('')
  const [setupEmail, setSetupEmail] = useState('')
  const [rooms, setRooms] = useState([])
  const [roomId, setRoomId] = useState(null)
  const [roomDetail, setRoomDetail] = useState(null)
  const [composer, setComposer] = useState('')
  const [apiError, setApiError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [copyDone, setCopyDone] = useState(false)
  const [invitePeerEmail, setInvitePeerEmail] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteNotice, setInviteNotice] = useState(null)
  const [mainTab, setMainTab] = useState('messages')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [channelStarred, setChannelStarred] = useState(false)
  const [sessionView, setSessionView] = useState('picker')
  const [pickerExpanded, setPickerExpanded] = useState(false)
  const [workspaceSearchQuery, setWorkspaceSearchQuery] = useState('')
  const [workspaceSearchOpen, setWorkspaceSearchOpen] = useState(false)
  const [jumpToQuery, setJumpToQuery] = useState('')
  const [dmPeer, setDmPeer] = useState(null)
  const [pendingScrollMessageId, setPendingScrollMessageId] = useState(null)
  const prevOpenRef = useRef(false)
  const listRef = useRef(null)
  const fileInputRef = useRef(null)
  const dmSectionRef = useRef(null)
  const searchBlurTimerRef = useRef(null)

  const refreshIdentity = useCallback(() => {
    setIdentity(loadCollabIdentity())
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) refreshIdentity()
    })
    return () => {
      cancelled = true
    }
  }, [open, refreshIdentity])

  useEffect(() => {
    if (!open) {
      prevOpenRef.current = false
      return
    }
    const justOpened = !prevOpenRef.current
    prevOpenRef.current = true
    const frame = requestAnimationFrame(() => {
      if (justOpened) {
        if (focusRoomId != null && Number.isFinite(focusRoomId) && focusRoomId > 0) {
          setSessionView('chat')
          setRoomId(focusRoomId)
          setPickerExpanded(false)
          queueMicrotask(() => onFocusRoomConsumed?.())
        } else {
          setSessionView('picker')
          setRoomId(null)
          setPickerExpanded(false)
        }
      } else if (focusRoomId != null && Number.isFinite(focusRoomId) && focusRoomId > 0) {
        setSessionView('chat')
        setRoomId(focusRoomId)
        onFocusRoomConsumed?.()
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [open, focusRoomId, onFocusRoomConsumed])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setDmPeer(null)
      setWorkspaceSearchQuery('')
      setWorkspaceSearchOpen(false)
      setJumpToQuery('')
      setPendingScrollMessageId(null)
    })
    return () => cancelAnimationFrame(frame)
  }, [roomId])

  useEffect(() => {
    let frame = requestAnimationFrame(() => {
      setMainTab('messages')
      setDetailsOpen(false)
      if (roomId == null) {
        setChannelStarred(false)
      } else {
        try {
          const k = `slack_channel_star:${roomId}`
          setChannelStarred(window.localStorage.getItem(k) === '1')
        } catch {
          setChannelStarred(false)
        }
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [roomId])

  const toggleChannelStar = useCallback(() => {
    if (roomId == null) return
    setChannelStarred((s) => {
      const next = !s
      try {
        window.localStorage.setItem(`slack_channel_star:${roomId}`, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }, [roomId])

  const loadRooms = useCallback(async (email, options = {}) => {
    const { keepRoomSelection = true } = options
    if (!email) {
      setRooms([])
      return
    }
    try {
      setApiError(null)
      const data = await apiJson(`/api/collab/rooms/mine?email=${encodeURIComponent(email)}`)
      const list = data.rooms || []
      setRooms(list)
      setRoomId((prev) => {
        if (!keepRoomSelection) return null
        if (prev != null && list.some((r) => r.id === prev)) return prev
        return null
      })
    } catch {
      setApiError(
        'Could not reach the collaboration server. Run npm run dev so the API is available on port 8787.',
      )
      setRooms([])
    }
  }, [])

  const loadRoomDetail = useCallback(async (id, viewerEmail) => {
    if (!id || !viewerEmail) {
      setRoomDetail(null)
      return
    }
    try {
      setApiError(null)
      const data = await apiJson(`/api/collab/rooms/${id}?email=${encodeURIComponent(viewerEmail)}`)
      setRoomDetail(data)
    } catch (e) {
      setRoomDetail(null)
      if (e?.reason === 'not_a_member') {
        setRoomId(null)
      }
      const msg = errorMessage(e.reason)
      if (msg) setApiError(msg)
      else setApiError('Could not load this room.')
    }
  }, [])

  useEffect(() => {
    if (!open || !identity?.email) return
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) void loadRooms(identity.email, { keepRoomSelection: sessionView !== 'picker' })
    })
    return () => {
      cancelled = true
    }
  }, [open, identity?.email, loadRooms, sessionView])

  useEffect(() => {
    if (!identity?.email || roomId == null) return
    setLastCollabRoomId(identity.email, roomId)
  }, [identity?.email, roomId])

  useEffect(() => {
    if (!open || !roomId || !identity?.email) return
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) void loadRoomDetail(roomId, identity.email)
    })
    const t = window.setInterval(() => {
      if (!cancelled) void loadRoomDetail(roomId, identity.email)
    }, 2800)
    return () => {
      cancelled = true
      window.clearInterval(t)
    }
  }, [open, roomId, identity?.email, loadRoomDetail])

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') {
        if (detailsOpen) setDetailsOpen(false)
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, detailsOpen])

  useEffect(() => {
    if (!open || !listRef.current || mainTab !== 'messages') return
    if (pendingScrollMessageId != null) return
    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [open, mainTab, roomDetail?.messages?.length, pendingScrollMessageId])

  useEffect(() => {
    if (pendingScrollMessageId == null || !listRef.current) return
    const id = pendingScrollMessageId
    const frame = requestAnimationFrame(() => {
      const el = listRef.current?.querySelector(`[data-slack-msg-id="${id}"]`)
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        el.classList.add('slack-msg-highlight')
        window.setTimeout(() => el.classList.remove('slack-msg-highlight'), 2200)
      }
      setPendingScrollMessageId(null)
    })
    return () => cancelAnimationFrame(frame)
  }, [pendingScrollMessageId, mainTab, roomDetail?.messages])

  function onSetupSubmit(e) {
    e.preventDefault()
    const name = setupName.trim()
    const email = setupEmail.trim().toLowerCase()
    if (!name || !email) return
    saveCollabIdentity(name, email)
    setIdentity({ name, email, source: 'session' })
    setSessionView('picker')
    setRoomId(null)
    setPickerExpanded(false)
  }

  function enterChannel(id) {
    setRoomId(id)
    setSessionView('chat')
    setPickerExpanded(false)
  }

  function leaveToPicker() {
    setSessionView('picker')
    setRoomId(null)
    setRoomDetail(null)
    setDetailsOpen(false)
    setPickerExpanded(false)
    setDmPeer(null)
    setWorkspaceSearchQuery('')
    setWorkspaceSearchOpen(false)
    setJumpToQuery('')
  }

  function openSearchResultMessage(messageId) {
    setMainTab('messages')
    setWorkspaceSearchQuery('')
    setWorkspaceSearchOpen(false)
    setPendingScrollMessageId(messageId)
  }

  function openSearchResultDoc(messageId) {
    setMainTab('files')
    setWorkspaceSearchQuery('')
    setWorkspaceSearchOpen(false)
    setPendingScrollMessageId(null)
    queueMicrotask(() => {
      const el = document.querySelector(`[data-slack-file-msg-id="${messageId}"]`)
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
  }

  async function createRoom(e) {
    e.preventDefault()
    if (!identity) return
    const name = newRoomName.trim()
    if (!name) return
    try {
      setApiError(null)
      const data = await apiJson('/api/collab/rooms', {
        method: 'POST',
        body: JSON.stringify({
          name,
          creatorEmail: identity.email,
          creatorName: identity.name,
        }),
      })
      setNewRoomName('')
      setShowCreate(false)
      setSessionView('chat')
      if (data.room?.id) setRoomId(data.room.id)
      await loadRooms(identity.email)
    } catch {
      setApiError('Could not create group.')
    }
  }

  async function copyInviteLink() {
    const tok = roomDetail?.room?.invite_token
    if (!tok) return
    const url = `${getPublicAppOrigin()}/join/${tok}`
    try {
      await navigator.clipboard.writeText(url)
      setCopyDone(true)
      window.setTimeout(() => setCopyDone(false), 2000)
    } catch {
      setApiError('Could not copy—copy the link manually.')
    }
  }

  async function sendEmailInvite(e) {
    e?.preventDefault()
    if (!identity || !roomId) return
    const to = invitePeerEmail.trim().toLowerCase()
    if (!to) return
    setInviteBusy(true)
    setInviteNotice(null)
    try {
      const res = await fetch(`/api/collab/rooms/${roomId}/email-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviterEmail: identity.email,
          inviterName: identity.name,
          inviteeEmail: to,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.acceptUrl) {
          setInviteNotice(
            (data.message || 'Email could not be sent.') + ` Share manually: ${data.acceptUrl}`,
          )
          setInvitePeerEmail('')
        } else if (data.reason === 'already_member') {
          setInviteNotice('That address is already in this channel.')
        } else if (data.reason === 'room_full') {
          setInviteNotice('Channel is full (200 people).')
        } else {
          setInviteNotice(data.message || 'Could not send invitation.')
        }
        setInviteBusy(false)
        return
      }
      setInvitePeerEmail('')
      const extra = data.acceptUrl ? ` If email didn’t send: ${data.acceptUrl}` : ''
      setInviteNotice((data.message || 'Invitation sent.') + extra)
    } catch {
      setInviteNotice('Network error.')
    }
    setInviteBusy(false)
  }

  async function onPickFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !identity || !roomId) return
    setApiError(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('authorEmail', identity.email)
    fd.append('authorName', identity.name)
    const cap = composer.trim()
    if (cap) {
      fd.append('caption', cap)
      setComposer('')
    }
    try {
      const res = await fetch(`/api/collab/rooms/${roomId}/upload`, { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.reason === 'unsupported_file_type') {
          setApiError('Use an image, PDF, or Word document.')
        } else if (data.reason === 'file_too_large') {
          setApiError('File is too large (max 10 MB).')
        } else {
          setApiError('Upload failed.')
        }
        return
      }
      await loadRoomDetail(roomId, identity.email)
      await loadRooms(identity.email)
      setMainTab('messages')
    } catch {
      setApiError('Upload failed.')
    }
  }

  async function sendMessage(e) {
    e?.preventDefault()
    if (!identity || !roomId) return
    const body = composer.trim()
    if (!body) return
    try {
      setApiError(null)
      await apiJson(`/api/collab/rooms/${roomId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          authorEmail: identity.email,
          authorName: identity.name,
          body,
        }),
      })
      setComposer('')
      await loadRoomDetail(roomId, identity.email)
      await loadRooms(identity.email)
    } catch (err) {
      const msg = errorMessage(err.reason)
      setApiError(msg || 'Could not send message.')
    }
  }

  const messages = useMemo(() => roomDetail?.messages ?? [], [roomDetail])
  const members = useMemo(() => roomDetail?.members ?? [], [roomDetail])
  const roomName = roomDetail?.room?.name ?? ''
  const memberCount = members.length
  const inviteToken = roomDetail?.room?.invite_token
  const inviteUrl = inviteToken ? `${getPublicAppOrigin()}/join/${inviteToken}` : ''
  const showPhoneInviteHint = inviteLinksNeedLanSetup()

  const visibleMessages = useMemo(() => {
    if (!dmPeer || !identity?.email) return messages
    const me = identity.email.toLowerCase()
    const peer = String(dmPeer.email ?? '').toLowerCase()
    return messages.filter((m) => {
      const a = m.author_email?.toLowerCase()
      return a === me || a === peer
    })
  }, [messages, dmPeer, identity])

  const fileMessages = useMemo(() => visibleMessages.filter((m) => m.attachment_stored), [visibleMessages])
  const messageGroups = useMemo(() => groupMessagesByAuthor(visibleMessages), [visibleMessages])
  const activityFeedNewestFirst = useMemo(() => [...visibleMessages].reverse().slice(0, 40), [visibleMessages])

  const workspaceSearchHits = useMemo(() => {
    const q = workspaceSearchQuery.trim().toLowerCase()
    if (q.length < 2) return { textMessages: [], documents: [] }
    const textMessages = messages
      .filter(
        (m) =>
          normIncludes(m.body, q) || normIncludes(m.author_name, q) || normIncludes(m.author_email, q),
      )
      .slice(0, 12)
    const documents = messages
      .filter((m) => m.attachment_stored && normIncludes(m.attachment_original, q))
      .slice(0, 12)
    return { textMessages, documents }
  }, [messages, workspaceSearchQuery])

  const filteredRoomsForJump = useMemo(() => {
    const q = jumpToQuery.trim().toLowerCase()
    if (!q) return rooms
    return rooms.filter((r) => String(r.name ?? '').toLowerCase().includes(q))
  }, [rooms, jumpToQuery])
  const headerMembers = useMemo(() => members.slice(0, 4), [members])
  const dmMembers = useMemo(
    () => members.filter((m) => m.email?.toLowerCase() !== identity?.email?.toLowerCase()),
    [members, identity?.email],
  )

  function messageIsMine(email) {
    if (!identity) return false
    return email?.toLowerCase() === identity.email.toLowerCase()
  }

  const blankHome = identity && sessionView === 'chat' && rooms.length === 0 && roomId == null
  const pickRoom = identity && sessionView === 'chat' && rooms.length > 0 && roomId == null
  const visiblePickerRooms = pickerExpanded ? rooms : rooms.slice(0, PICKER_PAGE_SIZE)
  const hiddenPickerCount = Math.max(0, rooms.length - PICKER_PAGE_SIZE)
  const canPost = memberCount < MAX_MEMBERS

  const inviteDetailsSection = roomId ? (
    <div className="slack-drawer-inner">
      <h3 className="slack-drawer-title">Invite people</h3>
      <div className="slack-invite-label">Invite by email</div>
      <p className="slack-invite-hint">
        We send a message with Accept / Decline. Configure SMTP on the server for real email delivery.
      </p>
      <form className="slack-email-invite-form" onSubmit={sendEmailInvite}>
        <input
          className="slack-input slack-input--inline"
          type="email"
          placeholder="name@email.com"
          value={invitePeerEmail}
          onChange={(e) => setInvitePeerEmail(e.target.value)}
          aria-label="Invitee email"
        />
        <button type="submit" className="slack-btn slack-btn-secondary" disabled={inviteBusy || memberCount >= MAX_MEMBERS}>
          {inviteBusy ? 'Sending…' : 'Send'}
        </button>
      </form>
      {inviteNotice ? <p className="slack-invite-notice">{inviteNotice}</p> : null}

      <div className="slack-invite-label slack-invite-label--second">Or copy link</div>
      <p className="slack-invite-hint slack-invite-hint--muted">Anyone with the link can join until the channel is full.</p>
      {showPhoneInviteHint ? (
        <p className="slack-invite-hint slack-invite-hint--warn" role="note">
          <strong>Another device?</strong> Use your LAN URL from the terminal or set <code>VITE_PUBLIC_APP_URL</code> and
          allow TCP <strong>5173</strong> in the firewall.
        </p>
      ) : null}
      <div className="slack-invite-row">
        <input className="slack-invite-url" readOnly value={inviteUrl} aria-label="Invite URL" />
        <button type="button" className="slack-btn slack-btn-secondary" onClick={() => void copyInviteLink()}>
          {copyDone ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  ) : null

  if (!open) return null

  const ui = (
    <div className="slack-overlay" role="dialog" aria-modal="true" aria-labelledby="slack-room-title">
      <button type="button" className="slack-overlay-backdrop" onClick={onClose} aria-label="Close" />
      <div className="slack-shell">
        {!identity ? (
          <div className="slack-setup">
            <h2 className="slack-setup-title">Sign in to {WORKSPACE_NAME}</h2>
            <p className="slack-setup-desc">
              Choose how you appear. This can differ from your workSphere login (e.g. testing on a phone). Submitting
              overrides chat identity until you use “Use different identity”.
            </p>
            <form className="slack-setup-form" onSubmit={onSetupSubmit}>
              <label className="slack-label">
                Display name
                <input
                  className="slack-input"
                  value={setupName}
                  onChange={(e) => setSetupName(e.target.value)}
                  placeholder="Alex Chen"
                  required
                  autoFocus
                />
              </label>
              <label className="slack-label">
                Email
                <input
                  className="slack-input"
                  type="email"
                  value={setupEmail}
                  onChange={(e) => setSetupEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                />
              </label>
              <button className="slack-btn slack-btn-primary" type="submit">
                Continue to workspace
              </button>
            </form>
            <button type="button" className="slack-btn slack-btn-ghost slack-setup-close" onClick={onClose}>
              Cancel
            </button>
          </div>
        ) : (
          <>
            {sessionView === 'picker' ? (
              <div className="slack-picker-screen">
                <button type="button" className="slack-picker-close" onClick={onClose} aria-label="Close">
                  ×
                </button>
                <div className="slack-picker-inner">
                  <h1 className="slack-picker-title" id="slack-room-title">
                    Welcome back!
                  </h1>
                  <p className="slack-picker-subtitle">
                    Choose a channel below to get back to working with your team.
                  </p>
                  <p className="slack-picker-account">
                    <span className="slack-picker-account-label">Ready to launch ·</span>{' '}
                    <strong>{identity.email}</strong>
                  </p>
                  {apiError ? <div className="slack-banner slack-banner--picker">{apiError}</div> : null}
                  <div className="slack-picker-card">
                    {rooms.length === 0 ? (
                      <div className="slack-picker-empty">
                        <p className="slack-picker-empty-text">
                          You’re not in any channels yet. Join with an invite link or create your first channel.
                        </p>
                        <button type="button" className="slack-btn slack-btn-primary" onClick={() => setShowCreate(true)}>
                          Create a channel
                        </button>
                      </div>
                    ) : (
                      <>
                        <ul className="slack-picker-list" aria-label="Channels you’ve joined">
                          {visiblePickerRooms.map((r) => (
                            <li key={r.id}>
                              <button type="button" className="slack-picker-row" onClick={() => enterChannel(r.id)}>
                                <div
                                  className="slack-picker-logo"
                                  style={{ '--slack-picker-h': channelHue(r.id) }}
                                >
                                  {memberInitials(r.name, `${r.name}@local`).slice(0, 2)}
                                </div>
                                <div className="slack-picker-row-body">
                                  <div className="slack-picker-row-name">
                                    <span className="slack-picker-hash">#</span>
                                    {r.name}
                                  </div>
                                  <div className="slack-picker-row-meta">
                                    <span className="slack-picker-facepile">
                                      {(r.preview_members || []).map((m, i) => (
                                        <span
                                          key={`${r.id}-${m.email}-${i}`}
                                          className="slack-picker-face"
                                          style={{ zIndex: 4 - i }}
                                          title={m.name}
                                        >
                                          {memberInitials(m.name, m.email)}
                                        </span>
                                      ))}
                                    </span>
                                    <span className="slack-picker-member-count">
                                      {(r.member_count ?? 0).toLocaleString()} member
                                      {(r.member_count ?? 0) === 1 ? '' : 's'}
                                    </span>
                                  </div>
                                </div>
                                <span className="slack-picker-arrow" aria-hidden>
                                  <svg width="20" height="20" viewBox="0 0 24 24">
                                    <path
                                      fill="currentColor"
                                      d="M19 19H5V5h7V3H5a2 2 0 00-2 2v14c0 1.1.9 2 2 2h14a2 2 0 002-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"
                                    />
                                  </svg>
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                        {hiddenPickerCount > 0 && !pickerExpanded ? (
                          <button type="button" className="slack-picker-more" onClick={() => setPickerExpanded(true)}>
                            Show {hiddenPickerCount} more channel{hiddenPickerCount === 1 ? '' : 's'}{' '}
                            <span className="slack-picker-more-chev" aria-hidden>
                              ▾
                            </span>
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="slack-picker-add-channel"
                          onClick={() => setShowCreate(true)}
                        >
                          + Create channel
                        </button>
                      </>
                    )}
                  </div>
                  {identity.source === 'session' ? (
                    <button
                      type="button"
                      className="slack-picker-switch-account"
                      onClick={() => {
                        clearLastCollabRoomId(identity.email)
                        clearCollabIdentity()
                        setIdentity(null)
                        setSetupName('')
                        setSetupEmail('')
                        setRooms([])
                        setRoomId(null)
                        setRoomDetail(null)
                      }}
                    >
                      Switch account
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <>
                <div className="slack-app-layout">
              <header className="slack-topbar">
                <button type="button" className="slack-topbar-back" onClick={leaveToPicker}>
                  ← All channels
                </button>
                <div className="slack-topbar-search-outer">
                  <div className="slack-topbar-search-wrap">
                    <svg className="slack-topbar-search-svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                      <path
                        fill="currentColor"
                        d="M10 2a8 8 0 105.293 14.707l4.387 4.387 1.414-1.414-4.387-4.387A8 8 0 0010 2zm0 2a6 6 0 110 12 6 6 0 010-12z"
                      />
                    </svg>
                    <input
                      type="search"
                      className="slack-topbar-search"
                      placeholder={`Search messages & files in #${roomName || 'channel'}`}
                      value={workspaceSearchQuery}
                      onChange={(e) => {
                        setWorkspaceSearchQuery(e.target.value)
                        setWorkspaceSearchOpen(true)
                      }}
                      onFocus={() => {
                        window.clearTimeout(searchBlurTimerRef.current)
                        setWorkspaceSearchOpen(true)
                      }}
                      onBlur={() => {
                        searchBlurTimerRef.current = window.setTimeout(() => setWorkspaceSearchOpen(false), 220)
                      }}
                      aria-label="Search messages and documents in this channel"
                      autoComplete="off"
                    />
                  </div>
                  {workspaceSearchOpen && workspaceSearchQuery.trim().length >= 2 ? (
                    <div
                      className="slack-search-dropdown"
                      role="listbox"
                      aria-label="Search results"
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {workspaceSearchHits.textMessages.length === 0 && workspaceSearchHits.documents.length === 0 ? (
                        <div className="slack-search-empty">No matches for that search.</div>
                      ) : (
                        <>
                          {workspaceSearchHits.textMessages.length > 0 ? (
                            <div className="slack-search-group">
                              <div className="slack-search-group-label">Messages</div>
                              <ul className="slack-search-hit-list">
                                {workspaceSearchHits.textMessages.map((m) => (
                                  <li key={m.id}>
                                    <button
                                      type="button"
                                      className="slack-search-hit"
                                      onClick={() => openSearchResultMessage(m.id)}
                                    >
                                      <span className="slack-search-hit-meta">
                                        {m.author_name} · {formatMsgTime(m.created_at)}
                                      </span>
                                      <span className="slack-search-hit-snippet">
                                        {String(m.body || '').slice(0, 100)}
                                        {String(m.body || '').length > 100 ? '…' : ''}
                                      </span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          {workspaceSearchHits.documents.length > 0 ? (
                            <div className="slack-search-group">
                              <div className="slack-search-group-label">Documents & files</div>
                              <ul className="slack-search-hit-list">
                                {workspaceSearchHits.documents.map((m) => (
                                  <li key={m.id}>
                                    <button
                                      type="button"
                                      className="slack-search-hit"
                                      onClick={() => openSearchResultDoc(m.id)}
                                    >
                                      <span className="slack-search-hit-meta">File · {formatMsgTime(m.created_at)}</span>
                                      <span className="slack-search-hit-snippet">{m.attachment_original || 'Attachment'}</span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
                <div className="slack-topbar-end">
                  <button type="button" className="slack-topbar-icon-btn" aria-label="History" title="History">
                    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
                      <path
                        fill="currentColor"
                        d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"
                      />
                    </svg>
                  </button>
                  <div className="slack-topbar-avatar" title={identity.name}>
                    {memberInitials(identity.name, identity.email)}
                  </div>
                  <button type="button" className="slack-topbar-close" onClick={onClose} aria-label="Close workspace">
                    ×
                  </button>
                </div>
              </header>

              <div className="slack-body-row">
                <nav className="slack-activity-bar" aria-label="Workspace switcher">
                  <button
                    type="button"
                    className={`slack-act-btn${mainTab !== 'activity' && mainTab !== 'files' ? ' is-active' : ''}`}
                    title="Home"
                    aria-label="Home"
                    aria-current={mainTab !== 'activity' && mainTab !== 'files' ? 'page' : undefined}
                    onClick={() => {
                      setDmPeer(null)
                      setMainTab('messages')
                    }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                      <path
                        fill="currentColor"
                        d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8h5z"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className={`slack-act-btn${dmPeer && mainTab === 'messages' ? ' is-active' : ''}`}
                    title="Direct messages"
                    aria-label="Direct messages"
                    onClick={() => {
                      setMainTab('messages')
                      queueMicrotask(() => dmSectionRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
                    }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                      <path
                        fill="currentColor"
                        d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className={`slack-act-btn${mainTab === 'activity' ? ' is-active' : ''}`}
                    title="Activity & invite"
                    aria-label="Activity and channel invite link"
                    onClick={() => {
                      if (roomId) {
                        setDmPeer(null)
                        setMainTab('activity')
                      }
                    }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                      <path
                        fill="currentColor"
                        d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className={`slack-act-btn${mainTab === 'files' ? ' is-active' : ''}`}
                    title="Files"
                    aria-label="Files"
                    onClick={() => {
                      if (roomId) {
                        setDmPeer(null)
                        setMainTab('files')
                      }
                    }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                      <path
                        fill="currentColor"
                        d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"
                      />
                    </svg>
                  </button>
                  <button type="button" className="slack-act-btn" title="More" aria-label="More">
                    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                      <path fill="currentColor" d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                    </svg>
                  </button>
                  <div className="slack-act-spacer" />
                  <button type="button" className="slack-act-btn slack-act-add" title="Add" aria-label="Add">
                    +
                  </button>
                </nav>

                <aside className="slack-sidebar-panel">
                  <div className="slack-ws-header">
                    <button type="button" className="slack-ws-name-btn">
                      <span className="slack-ws-name">{WORKSPACE_NAME}</span>
                      <span className="slack-ws-chev" aria-hidden>
                        ▾
                      </span>
                    </button>
                    <div className="slack-ws-header-actions">
                      <button type="button" className="slack-ws-icon-btn" aria-label="Workspace menu" title="Menu">
                        ⚙
                      </button>
                      <button type="button" className="slack-ws-icon-btn" aria-label="New message" title="New message">
                        ✎
                      </button>
                    </div>
                  </div>

                  <div className="slack-sidebar-jump">
                    <input
                      type="text"
                      className="slack-jump-input"
                      placeholder="Jump to a channel…"
                      value={jumpToQuery}
                      onChange={(e) => setJumpToQuery(e.target.value)}
                      aria-label="Filter channels"
                      autoComplete="off"
                    />
                  </div>

                  <div className="slack-sidebar-links">
                    <button type="button" className="slack-side-link">
                      Threads
                    </button>
                    <button type="button" className="slack-side-link">
                      Huddles
                    </button>
                    <button type="button" className="slack-side-link">
                      Directories
                    </button>
                  </div>

                  <div className="slack-side-scroll">
                    <div className="slack-side-section">
                      <button type="button" className="slack-side-section-head">
                        ⭐ Starred
                      </button>
                      <div className="slack-side-section-body slack-side-muted">Star important channels to pin them here.</div>
                    </div>

                    <div className="slack-side-section">
                      <div className="slack-side-section-head slack-side-section-head--row">
                        <button type="button" className="slack-side-section-toggle">
                          ▾ Channels
                        </button>
                        <button
                          type="button"
                          className="slack-side-add"
                          onClick={() => setShowCreate(true)}
                          aria-label="Create channel"
                        >
                          +
                        </button>
                      </div>
                      <ul className="slack-channel-list">
                        {rooms.length === 0 ? (
                          <li className="slack-side-muted slack-channel-empty">No channels yet</li>
                        ) : filteredRoomsForJump.length === 0 ? (
                          <li className="slack-side-muted slack-channel-empty">No channels match “{jumpToQuery.trim()}”</li>
                        ) : (
                          filteredRoomsForJump.map((r) => (
                            <li key={r.id}>
                              <button
                                type="button"
                                className={`slack-channel-row${r.id === roomId ? ' is-active' : ''}`}
                                onClick={() => {
                                  setDmPeer(null)
                                  setRoomId(r.id)
                                }}
                              >
                                <span className="slack-channel-hash">#</span>
                                <span className="slack-channel-label">{r.name}</span>
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>

                    <div className="slack-side-section" ref={dmSectionRef}>
                      <button type="button" className="slack-side-section-head slack-side-section-toggle">
                        ▾ Direct messages
                      </button>
                      <ul className="slack-dm-list">
                        {dmMembers.length === 0 ? (
                          <li className="slack-side-muted">
                            You’re the only member — invite others to this channel to message them here.
                          </li>
                        ) : (
                          dmMembers.map((m) => (
                            <li key={m.email}>
                              <button
                                type="button"
                                className={`slack-dm-row slack-dm-row--btn${dmPeer?.email?.toLowerCase() === m.email?.toLowerCase() ? ' is-active' : ''}`}
                                onClick={() => {
                                  setDmPeer({ email: m.email, name: m.name })
                                  setMainTab('messages')
                                  setWorkspaceSearchQuery('')
                                  setWorkspaceSearchOpen(false)
                                }}
                              >
                                <span className="slack-dm-avatar">{memberInitials(m.name, m.email)}</span>
                                <span className="slack-dm-name">{m.name}</span>
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>

                    <div className="slack-side-section">
                      <button type="button" className="slack-side-section-head slack-side-section-toggle">
                        ▾ Apps
                      </button>
                      <p className="slack-side-muted slack-apps-hint">Add tools from the directory (preview)</p>
                    </div>
                  </div>

                  <div className="slack-sidebar-user">
                    <div className="slack-sidebar-user-avatar">{memberInitials(identity.name, identity.email)}</div>
                    <div className="slack-sidebar-user-meta">
                      <div className="slack-sidebar-user-name">{identity.name}</div>
                      <div className="slack-sidebar-user-email">{identity.email}</div>
                    </div>
                    {identity.source === 'session' ? (
                      <button
                        type="button"
                        className="slack-sidebar-switch"
                        onClick={() => {
                          clearLastCollabRoomId(identity.email)
                          clearCollabIdentity()
                          setIdentity(null)
                          setSetupName('')
                          setSetupEmail('')
                          setRooms([])
                          setRoomId(null)
                          setRoomDetail(null)
                          setSessionView('picker')
                          setPickerExpanded(false)
                          setDmPeer(null)
                          setWorkspaceSearchQuery('')
                          setWorkspaceSearchOpen(false)
                          setJumpToQuery('')
                        }}
                      >
                        Switch account
                      </button>
                    ) : null}
                  </div>
                </aside>

                <div className="slack-main">
                  {blankHome ? (
                    <div className="slack-blank">
                      <button type="button" className="slack-close slack-close--floating" onClick={onClose} aria-label="Close">
                        ×
                      </button>
                      <div className="slack-blank-inner">
                        <h2 className="slack-blank-title" id="slack-room-title">
                          Welcome to your workspace
                        </h2>
                        <p className="slack-blank-desc">
                          Create channels for each project or team. Up to {MAX_MEMBERS} people per channel—switch anytime
                          from the sidebar.
                        </p>
                        <button type="button" className="slack-btn slack-btn-primary slack-blank-cta" onClick={() => setShowCreate(true)}>
                          Create a channel
                        </button>
                      </div>
                    </div>
                  ) : pickRoom ? (
                    <div className="slack-blank">
                      <button type="button" className="slack-close slack-close--floating" onClick={onClose} aria-label="Close">
                        ×
                      </button>
                      <div className="slack-blank-inner">
                        <h2 className="slack-blank-title" id="slack-room-title">
                          Select a channel
                        </h2>
                        <p className="slack-blank-desc">Pick a channel under Channels in the sidebar, or create a new one.</p>
                        <button type="button" className="slack-btn slack-btn-primary slack-blank-cta" onClick={() => setShowCreate(true)}>
                          Create channel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="slack-main-column">
                      <header className="slack-channel-header">
                        <div className="slack-channel-header-text">
                          <h2 className="slack-channel-title" id="slack-room-title">
                            {dmPeer ? (
                              <>
                                <span className="slack-dm-title-prefix">DM</span>
                                {dmPeer.name}
                                <button
                                  type="button"
                                  className="slack-dm-end-btn"
                                  onClick={() => setDmPeer(null)}
                                  aria-label="End focused direct message view"
                                >
                                  ×
                                </button>
                              </>
                            ) : (
                              <>
                                <span className="slack-channel-hash-lg">#</span>
                                {roomName || '…'}
                                <button
                                  type="button"
                                  className={`slack-channel-star${channelStarred ? ' is-on' : ''}`}
                                  onClick={toggleChannelStar}
                                  aria-label={channelStarred ? 'Unstar channel' : 'Star channel'}
                                  title="Star"
                                >
                                  ★
                                </button>
                              </>
                            )}
                          </h2>
                          <p className="slack-channel-topic">
                            {dmPeer ? (
                              <>
                                Conversation with <strong>{dmPeer.name}</strong> in <strong>#{roomName}</strong> — new
                                messages still go to everyone in the channel.
                              </>
                            ) : (
                              <>
                                {memberCount} member{memberCount === 1 ? '' : 's'} · Team conversation · max {MAX_MEMBERS}{' '}
                                people
                              </>
                            )}
                          </p>
                        </div>
                        <div className="slack-channel-header-actions">
                          <div className="slack-header-facepile" aria-hidden>
                            {headerMembers.map((m) => (
                              <span key={m.email} className="slack-header-face" title={m.name}>
                                {memberInitials(m.name, m.email)}
                              </span>
                            ))}
                          </div>
                          <span className="slack-header-count">{memberCount}</span>
                          <button type="button" className="slack-header-tool" aria-label="Notifications" title="Notifications">
                            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
                              <path
                                fill="currentColor"
                                d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"
                              />
                            </svg>
                          </button>
                          <button type="button" className="slack-header-tool" aria-label="Search in channel" title="Search">
                            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
                              <path
                                fill="currentColor"
                                d="M10 2a8 8 0 105.293 14.707l4.387 4.387 1.414-1.414-4.387-4.387A8 8 0 0010 2zm0 2a6 6 0 110 12 6 6 0 010-12z"
                              />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className={`slack-header-tool${detailsOpen ? ' is-active' : ''}`}
                            aria-label="Channel details"
                            title="Details"
                            onClick={() => setDetailsOpen((o) => !o)}
                          >
                            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
                              <path
                                fill="currentColor"
                                d="M11 17h2v-6h-2v6zm1-15C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM11 9h2V7h-2v2z"
                              />
                            </svg>
                          </button>
                        </div>
                      </header>

                      <div className="slack-channel-tabs" role="tablist" aria-label="Channel views">
                        <button
                          type="button"
                          role="tab"
                          aria-selected={mainTab === 'messages'}
                          className={`slack-tab${mainTab === 'messages' ? ' is-active' : ''}`}
                          onClick={() => setMainTab('messages')}
                        >
                          Messages
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={mainTab === 'activity'}
                          className={`slack-tab${mainTab === 'activity' ? ' is-active' : ''}`}
                          onClick={() => setMainTab('activity')}
                        >
                          Activity
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={mainTab === 'canvas'}
                          className={`slack-tab${mainTab === 'canvas' ? ' is-active' : ''}`}
                          onClick={() => setMainTab('canvas')}
                        >
                          Canvas
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={mainTab === 'files'}
                          className={`slack-tab${mainTab === 'files' ? ' is-active' : ''}`}
                          onClick={() => setMainTab('files')}
                        >
                          Files
                        </button>
                      </div>

                      {apiError ? <div className="slack-banner slack-banner--main">{apiError}</div> : null}

                      {mainTab === 'messages' ? (
                        <>
                          <div className="slack-msgs slack-msgs--slacklike" ref={listRef}>
                            {visibleMessages.length === 0 ? (
                              <p className="slack-empty">
                                {dmPeer ? (
                                  <>
                                    No messages between you and <strong>{dmPeer.name}</strong> yet. Say hello below —
                                    still posts to <strong>#{roomName}</strong> for everyone.
                                  </>
                                ) : (
                                  <>
                                    No messages yet. Say hello—everyone in <strong>#{roomName}</strong> will see it.
                                  </>
                                )}
                              </p>
                            ) : (
                              messageGroups.map((g) => (
                                <div key={g.rows[0].id} className="slack-thread-group">
                                  <div className="slack-thread-avatar" aria-hidden="true">
                                    {memberInitials(g.author_name, g.author_email)}
                                  </div>
                                  <div className="slack-thread-body-col">
                                    <div className="slack-thread-headline">
                                      <strong className="slack-thread-author">{g.author_name}</strong>
                                      <time className="slack-thread-time" dateTime={new Date(g.rows[0].created_at).toISOString()}>
                                        {formatMsgTime(g.rows[0].created_at)}
                                      </time>
                                    </div>
                                    {g.rows.map((m) => {
                                      const outgoing = messageIsMine(m.author_email)
                                      const fileHref =
                                        m.attachment_stored && identity
                                          ? `/api/collab/rooms/${roomId}/messages/${m.id}/file?email=${encodeURIComponent(identity.email)}`
                                          : null
                                      const isImage = Boolean(m.attachment_mime?.startsWith('image/'))
                                      return (
                                        <div
                                          key={m.id}
                                          data-slack-msg-id={m.id}
                                          className={`slack-thread-msg${outgoing ? ' slack-thread-msg--self' : ''}`}
                                        >
                                          {fileHref ? (
                                            <div className="slack-msg-attachment">
                                              {isImage ? (
                                                <a href={fileHref} target="_blank" rel="noreferrer" className="slack-msg-img-wrap">
                                                  <img src={fileHref} alt={m.attachment_original || 'Attachment'} className="slack-msg-img" />
                                                </a>
                                              ) : null}
                                              <a className="slack-msg-file-link" href={fileHref} target="_blank" rel="noreferrer">
                                                📎 {m.attachment_original || 'Download file'}
                                              </a>
                                            </div>
                                          ) : null}
                                          {m.body ? <div className="slack-thread-text">{m.body}</div> : null}
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>

                          {canPost ? (
                            <div className="slack-composer-slack">
                              <div className="slack-composer-toolbar" aria-hidden="true">
                                <span className="slack-fmt-btn">B</span>
                                <span className="slack-fmt-btn">I</span>
                                <span className="slack-fmt-btn">U̲</span>
                                <span className="slack-fmt-btn slack-fmt-sep">Link</span>
                                <span className="slack-fmt-btn">≡</span>
                                <span className="slack-fmt-btn">•</span>
                                <span className="slack-fmt-btn">123</span>
                                <span className="slack-fmt-btn">&lt;/&gt;</span>
                              </div>
                              <form className="slack-composer-inner" onSubmit={sendMessage}>
                                <input
                                  ref={fileInputRef}
                                  type="file"
                                  className="slack-file-input"
                                  accept="image/*,.pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                  aria-hidden="true"
                                  tabIndex={-1}
                                  onChange={(e) => void onPickFile(e)}
                                />
                                <button
                                  type="button"
                                  className="slack-attach-slack"
                                  aria-label="Attach file"
                                  title="Image, PDF, or Word (max 10 MB)"
                                  onClick={() => fileInputRef.current?.click()}
                                >
                                  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
                                    <path
                                      fill="currentColor"
                                      d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S5 2.79 5 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"
                                    />
                                  </svg>
                                </button>
                                <textarea
                                  className="slack-composer-textarea"
                                  rows={1}
                                  placeholder={
                                    dmPeer
                                      ? `Message ${dmPeer.name} (everyone in #${roomName} will see it)`
                                      : `Message #${roomName || 'channel'}`
                                  }
                                  value={composer}
                                  onChange={(e) => setComposer(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault()
                                      void sendMessage(e)
                                    }
                                  }}
                                  aria-label="Message"
                                />
                                <button className="slack-send-slack" type="submit" aria-label="Send">
                                  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                                    <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                                  </svg>
                                </button>
                              </form>
                            </div>
                          ) : (
                            <div className="slack-composer-restricted">
                              Only certain people can post when the channel is full ({MAX_MEMBERS} members). Share an invite
                              from channel details to add teammates in a new channel.
                            </div>
                          )}
                        </>
                      ) : null}

                      {mainTab === 'activity' ? (
                        <div className="slack-activity-pane">
                          <section className="slack-activity-section" aria-labelledby="slack-activity-invite-heading">
                            <h3 id="slack-activity-invite-heading" className="slack-activity-section-title">
                              Channel invite link
                            </h3>
                            <p className="slack-activity-section-desc">
                              Share this link so others can join <strong>#{roomName}</strong> (until the channel reaches{' '}
                              {MAX_MEMBERS} people).
                            </p>
                            {showPhoneInviteHint ? (
                              <p className="slack-invite-hint slack-invite-hint--warn" role="note">
                                <strong>Phone or another device?</strong> Set <code>VITE_PUBLIC_APP_URL</code> to your LAN
                                URL and copy the link again so it opens on that device.
                              </p>
                            ) : null}
                            <div className="slack-invite-row slack-invite-row--activity">
                              <input className="slack-invite-url" readOnly value={inviteUrl} aria-label="Channel invite URL" />
                              <button type="button" className="slack-btn slack-btn-secondary" onClick={() => void copyInviteLink()}>
                                {copyDone ? 'Copied!' : 'Copy link'}
                              </button>
                            </div>
                            <button type="button" className="slack-activity-open-details" onClick={() => setDetailsOpen(true)}>
                              Email invites & more in channel details →
                            </button>
                          </section>
                          <section className="slack-activity-section" aria-labelledby="slack-activity-feed-heading">
                            <h3 id="slack-activity-feed-heading" className="slack-activity-section-title">
                              Recent messages
                            </h3>
                            {activityFeedNewestFirst.length === 0 ? (
                              <p className="slack-activity-empty">No messages yet. Switch to the Messages tab to start the thread.</p>
                            ) : (
                              <ul className="slack-activity-feed-list">
                                {activityFeedNewestFirst.map((m) => {
                                  const snippet = [m.body, m.attachment_original].filter(Boolean).join(' · ').trim()
                                  const short = snippet.length > 140 ? `${snippet.slice(0, 137)}…` : snippet || '(attachment)'
                                  return (
                                    <li key={m.id} className="slack-activity-feed-item">
                                      <time className="slack-activity-feed-time" dateTime={new Date(m.created_at).toISOString()}>
                                        {formatMsgTime(m.created_at)}
                                      </time>
                                      <div className="slack-activity-feed-body">
                                        <span className="slack-activity-feed-author">{m.author_name}</span>
                                        <span className="slack-activity-feed-snippet">{short}</span>
                                      </div>
                                    </li>
                                  )
                                })}
                              </ul>
                            )}
                          </section>
                        </div>
                      ) : null}

                      {mainTab === 'canvas' ? (
                        <div className="slack-canvas-pane">
                          <div className="slack-canvas-card">
                            <h3 className="slack-canvas-title">Canvas</h3>
                            <p className="slack-canvas-desc">
                              Link a shared doc to this channel. In workSphere this is a preview—use Messages and Files for
                              live collaboration today.
                            </p>
                            <button type="button" className="slack-btn slack-btn-secondary" disabled>
                              Create canvas (coming soon)
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {mainTab === 'files' ? (
                        <div className="slack-files-pane">
                          {fileMessages.length === 0 ? (
                            <p className="slack-files-empty">No files shared in this channel yet. Attach one from Messages.</p>
                          ) : (
                            <ul className="slack-files-list">
                              {fileMessages.map((m) => {
                                const href =
                                  identity && roomId
                                    ? `/api/collab/rooms/${roomId}/messages/${m.id}/file?email=${encodeURIComponent(identity.email)}`
                                    : null
                                return (
                                  <li key={m.id} className="slack-files-row" data-slack-file-msg-id={m.id}>
                                    <span className="slack-files-icon" aria-hidden>
                                      📄
                                    </span>
                                    <div className="slack-files-meta">
                                      <a className="slack-files-name" href={href || '#'} target="_blank" rel="noreferrer">
                                        {m.attachment_original || 'File'}
                                      </a>
                                      <div className="slack-files-sub">
                                        {m.author_name} · {formatMsgTime(m.created_at)}
                                      </div>
                                    </div>
                                  </li>
                                )
                              })}
                            </ul>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {detailsOpen && roomId ? (
              <div className="slack-drawer-layer">
                <button type="button" className="slack-drawer-scrim" aria-label="Close details" onClick={() => setDetailsOpen(false)} />
                <aside className="slack-drawer-panel" aria-label="Channel details">
                  <div className="slack-drawer-header">
                    <h2 className="slack-drawer-h2">About #{roomName}</h2>
                    <button type="button" className="slack-drawer-x" onClick={() => setDetailsOpen(false)} aria-label="Close">
                      ×
                    </button>
                  </div>
                  {inviteDetailsSection}
                </aside>
              </div>
            ) : null}
              </>
            )}

            {showCreate ? (
              <div className="slack-modal" role="presentation">
                <div className="slack-modal-card">
                  <h3 className="slack-modal-title">Create a channel</h3>
                  <p className="slack-modal-desc">
                    Channels are where your team discusses a topic. Each has its own members, messages, and invite link (max{' '}
                    {MAX_MEMBERS} people).
                  </p>
                  <form onSubmit={createRoom}>
                    <input
                      className="slack-input"
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      placeholder="e.g. general, sprint-42"
                      required
                      autoFocus
                    />
                    <div className="slack-modal-actions">
                      <button type="button" className="slack-btn slack-btn-ghost" onClick={() => setShowCreate(false)}>
                        Cancel
                      </button>
                      <button type="submit" className="slack-btn slack-btn-primary">
                        Create channel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )

  return createPortal(ui, document.body)
}
