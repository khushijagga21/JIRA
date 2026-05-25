import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { getPublicAppOrigin } from '../utils/publicAppUrl.js'
import { useResolvedAppOrigin } from '../utils/useResolvedAppOrigin.js'
import workSphereLogo from '../assets/worksphere-logo.png'
import { fetchApi } from '../utils/apiFetch.js'
import { getCurrentUser } from '../utils/auth.js'
import { clearCollabIdentity, loadCollabIdentity, saveCollabIdentity } from '../utils/collabIdentity.js'
import { clearLastCollabRoomId, setLastCollabRoomId } from '../utils/collabLastRoom.js'
import {
  consumePendingChatShare,
  dataUrlToFile,
  peekPendingChatShare,
  clearPendingChatShare,
} from '../utils/whiteboardStore.js'
import {
  consumePendingTaskShare,
  peekPendingTaskShare,
  clearPendingTaskShare,
  formatTaskMessage,
} from '../utils/todoShare.js'
import WspChatHome from './WspChatHome.jsx'

const MEMBER_LIMIT_CAP = 200
const MEMBER_LIMIT_MIN = 2
const WORKSPACE_NAME = 'workSphere chat'
const PICKER_PAGE_SIZE = 5
const CONNECTION_ERROR_MSG =
  'Could not reach the workSphere API. Run the app with npm run dev locally, or set VITE_API_URL in Vercel to your deployed backend URL.'
const MESSAGE_EDIT_WINDOW_MS = 2 * 60 * 1000

function channelHue(roomId) {
  const hues = [268, 330, 196, 18, 204, 152, 310, 48]
  return hues[Number(roomId) % hues.length]
}

function isNetworkFailure(err) {
  return err instanceof TypeError || /failed to fetch|network/i.test(String(err?.message ?? ''))
}

async function apiJson(path, options) {
  let res
  try {
    res = await fetchApi(path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    })
  } catch (err) {
    const e = new Error('network_error')
    e.network = isNetworkFailure(err)
    throw e
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(String(data?.reason || res.statusText || 'request_failed'))
    err.reason = data?.reason
    if (data?.memberLimit != null) err.memberLimit = Number(data.memberLimit)
    throw err
  }
  return data
}

function errorMessage(reason, memberLimit) {
  const cap = Number.isFinite(memberLimit) ? memberLimit : MEMBER_LIMIT_CAP
  if (reason === 'room_full') return `This room is full (${cap} people max).`
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

function messageIsDeleted(m) {
  return Boolean(m.deleted_at)
}

function messageWasEdited(m) {
  return Boolean(m.updated_at && !m.deleted_at && Number(m.updated_at) > Number(m.created_at) + 500)
}

function canEditMessage(m, viewerEmail) {
  if (!viewerEmail || messageIsDeleted(m)) return false
  if (m.author_email?.toLowerCase() !== viewerEmail.toLowerCase()) return false
  if (!String(m.body ?? '').trim()) return false
  return Date.now() - Number(m.created_at) < MESSAGE_EDIT_WINDOW_MS
}

function canDeleteMessage(m, viewerEmail) {
  if (!viewerEmail || messageIsDeleted(m)) return false
  return m.author_email?.toLowerCase() === viewerEmail.toLowerCase()
}

function normIncludes(hay, needle) {
  const n = String(needle ?? '').trim().toLowerCase()
  if (!n) return true
  return String(hay ?? '').toLowerCase().includes(n)
}

function CollabInlineImage({ href, alt, imgClass }) {
  const [broken, setBroken] = useState(false)
  if (broken) {
    return (
      <div className="slack-msg-img-fallback">
        <span className="slack-msg-img-fallback-text">Preview unavailable.</span>{' '}
        <a href={href} target="_blank" rel="noreferrer" className="slack-msg-file-link">
          Open image
        </a>
      </div>
    )
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" className="slack-msg-img-wrap">
      <img
        src={href}
        alt={alt}
        className={imgClass}
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
      />
    </a>
  )
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
  const [newRoomMemberLimit, setNewRoomMemberLimit] = useState(MEMBER_LIMIT_CAP)
  const [createError, setCreateError] = useState(null)
  const [createBusy, setCreateBusy] = useState(false)
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
  const [topChannelSearchOpen, setTopChannelSearchOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const [channelsOpen, setChannelsOpen] = useState(true)
  const [dmsOpen, setDmsOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState(null)
  const [editDraft, setEditDraft] = useState('')
  const [openMessageMenuId, setOpenMessageMenuId] = useState(null)
  const [messageActionBusy, setMessageActionBusy] = useState(false)
  const [pendingShare, setPendingShare] = useState(null)
  const [pendingShareBusy, setPendingShareBusy] = useState(false)
  const [pendingTaskShare, setPendingTaskShare] = useState(null)
  const [pendingTaskShareBusy, setPendingTaskShareBusy] = useState(false)
  const [, setEditTick] = useState(0)
  const prevOpenRef = useRef(false)
  const listRef = useRef(null)
  const fileInputRef = useRef(null)
  const searchBlurTimerRef = useRef(null)
  const topSearchInputRef = useRef(null)
  const toastTimerRef = useRef(null)
  const resolvedOrigin = useResolvedAppOrigin()

  const showToast = useCallback((message) => {
    if (!message) return
    setToast(message)
    window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2800)
  }, [])

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
    if (!open) return
    document.documentElement.classList.add('slack-overlay-open')
    document.body.classList.add('slack-overlay-open')
    return () => {
      document.documentElement.classList.remove('slack-overlay-open')
      document.body.classList.remove('slack-overlay-open')
    }
  }, [open])

  useEffect(() => {
    if (!open) setMobileSidebarOpen(false)
  }, [open])

  useEffect(() => {
    function onResize() {
      if (window.matchMedia('(min-width: 721px)').matches) setMobileSidebarOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!open || identity) return
    const u = getCurrentUser()
    if (!u) return
    setSetupName((n) => n || u.name || '')
    setSetupEmail((e) => e || u.email || '')
  }, [open, identity])

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
      setTopChannelSearchOpen(false)
      setEditingMessageId(null)
      setEditDraft('')
      setOpenMessageMenuId(null)
    })
    return () => cancelAnimationFrame(frame)
  }, [roomId])

  useEffect(() => {
    if (openMessageMenuId == null) return
    function onDocPointerDown(e) {
      if (!e.target.closest('.slack-msg-menu-wrap')) setOpenMessageMenuId(null)
    }
    document.addEventListener('mousedown', onDocPointerDown)
    return () => document.removeEventListener('mousedown', onDocPointerDown)
  }, [openMessageMenuId])

  useEffect(() => {
    if (!topChannelSearchOpen) return
    queueMicrotask(() => topSearchInputRef.current?.focus())
  }, [topChannelSearchOpen])

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
    } catch (e) {
      setApiError(isNetworkFailure(e) || e?.network ? CONNECTION_ERROR_MSG : 'Could not load your channels.')
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
      const msg = errorMessage(e.reason, e.memberLimit)
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
        else if (topChannelSearchOpen) {
          setTopChannelSearchOpen(false)
          setWorkspaceSearchQuery('')
          setWorkspaceSearchOpen(false)
        } else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, detailsOpen, topChannelSearchOpen])

  useEffect(() => {
    if (!open || mainTab !== 'messages') return
    const t = window.setInterval(() => setEditTick((n) => n + 1), 10000)
    return () => window.clearInterval(t)
  }, [open, mainTab])

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
    setDmPeer(null)
    setApiError(null)
  }

  function selectChannel(id) {
    enterChannel(id)
    setMobileSidebarOpen(false)
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
    setTopChannelSearchOpen(false)
    setMobileSidebarOpen(false)
  }

  function openSearchResultMessage(messageId) {
    setMainTab('messages')
    setWorkspaceSearchQuery('')
    setWorkspaceSearchOpen(false)
    setTopChannelSearchOpen(false)
    setPendingScrollMessageId(messageId)
  }

  function openSearchResultDoc(messageId) {
    setMainTab('files')
    setWorkspaceSearchQuery('')
    setWorkspaceSearchOpen(false)
    setTopChannelSearchOpen(false)
    setPendingScrollMessageId(null)
    queueMicrotask(() => {
      const el = document.querySelector(`[data-slack-file-msg-id="${messageId}"]`)
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
  }

  function openCreateModal() {
    setCreateError(null)
    setNewRoomMemberLimit(MEMBER_LIMIT_CAP)
    setShowCreate(true)
  }

  async function createRoom(e) {
    e.preventDefault()
    if (!identity || createBusy) return
    const name = newRoomName.trim()
    if (!name) return
    setCreateBusy(true)
    setCreateError(null)
    setApiError(null)
    try {
      const data = await apiJson('/api/collab/rooms', {
        method: 'POST',
        body: JSON.stringify({
          name,
          creatorEmail: identity.email,
          creatorName: identity.name,
          memberLimit: Number(newRoomMemberLimit),
        }),
      })
      setNewRoomName('')
      setNewRoomMemberLimit(MEMBER_LIMIT_CAP)
      setShowCreate(false)
      setCreateError(null)
      setSessionView('chat')
      if (data.room?.id) setRoomId(data.room.id)
      await loadRooms(identity.email)
      showToast(`Channel “${name}” created`)
    } catch (e) {
      const msg =
        isNetworkFailure(e) || e?.network
          ? CONNECTION_ERROR_MSG
          : 'Could not create this channel. Try another name or check your connection.'
      setCreateError(msg)
    } finally {
      setCreateBusy(false)
    }
  }

  async function copyInviteLink() {
    const tok = roomDetail?.room?.invite_token
    if (!tok) {
      showToast('Invite link is not ready yet. Wait a moment and try again.')
      return
    }
    const base = inviteBaseUrl || getPublicAppOrigin()
    const url = `${base}/join/${tok}`
    try {
      await navigator.clipboard.writeText(url)
      setCopyDone(true)
      showToast('Invite link copied!')
      window.setTimeout(() => setCopyDone(false), 2000)
    } catch {
      showToast('Could not copy. Select the link and copy it manually.')
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
      const res = await fetchApi(`/api/collab/rooms/${roomId}/email-invite`, {
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
          const lim = Number(data.memberLimit) || MEMBER_LIMIT_CAP
          setInviteNotice(`Channel is full (${lim} people max).`)
        } else {
          setInviteNotice(data.message || 'Could not send invitation.')
        }
        setInviteBusy(false)
        return
      }
      setInvitePeerEmail('')
      const extra = data.acceptUrl ? ` If email didn’t send: ${data.acceptUrl}` : ''
      setInviteNotice((data.message || 'Invitation sent.') + extra)
      showToast('Invitation sent')
    } catch {
      setInviteNotice('Network error.')
    }
    setInviteBusy(false)
  }

  useEffect(() => {
    if (!open) {
      setPendingShare(null)
      setPendingTaskShare(null)
      return
    }
    const pending = peekPendingChatShare()
    if (pending?.dataUrl) setPendingShare(pending)
    const pendingTask = peekPendingTaskShare()
    if (pendingTask?.title) setPendingTaskShare(pendingTask)
  }, [open])

  async function sendPendingTaskToRoom() {
    if (!identity || !roomId || !pendingTaskShare?.title) return
    const body = formatTaskMessage(pendingTaskShare)
    if (!body.trim()) return
    setPendingTaskShareBusy(true)
    setApiError(null)
    try {
      await apiJson(`/api/collab/rooms/${roomId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          authorEmail: identity.email,
          authorName: identity.name,
          body,
        }),
      })
      consumePendingTaskShare()
      setPendingTaskShare(null)
      showToast('Task shared in the channel')
      await loadRoomDetail(roomId, identity.email)
      await loadRooms(identity.email)
      setMainTab('messages')
    } catch {
      setApiError('Could not share the task.')
    }
    setPendingTaskShareBusy(false)
  }

  function discardPendingTaskShare() {
    clearPendingTaskShare()
    setPendingTaskShare(null)
  }

  async function sendPendingShareToRoom() {
    if (!identity || !roomId || !pendingShare?.dataUrl) return
    const file = dataUrlToFile(
      pendingShare.dataUrl,
      `${(pendingShare.name || 'worksphere-drawing').replace(/[^a-z0-9-_]+/gi, '-').slice(0, 60) || 'worksphere-drawing'}.png`,
    )
    if (!file) {
      setApiError('Could not prepare the drawing for upload.')
      return
    }
    setPendingShareBusy(true)
    setApiError(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('authorEmail', identity.email)
    fd.append('authorName', identity.name)
    fd.append('caption', `🎨 Whiteboard: ${pendingShare.name || 'Untitled drawing'}`)
    try {
      const res = await fetchApi(`/api/collab/rooms/${roomId}/upload`, { method: 'POST', body: fd })
      if (!res.ok) {
        setApiError('Could not send the drawing.')
        setPendingShareBusy(false)
        return
      }
      consumePendingChatShare()
      setPendingShare(null)
      showToast('Drawing sent to the channel')
      await loadRoomDetail(roomId, identity.email)
      await loadRooms(identity.email)
      setMainTab('messages')
    } catch {
      setApiError('Could not send the drawing.')
    }
    setPendingShareBusy(false)
  }

  function discardPendingShare() {
    clearPendingChatShare()
    setPendingShare(null)
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
      const res = await fetchApi(`/api/collab/rooms/${roomId}/upload`, { method: 'POST', body: fd })
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
      const msg = errorMessage(err.reason, err.memberLimit)
      setApiError(msg || 'Could not send message.')
    }
  }

  function cancelEditMessage() {
    setEditingMessageId(null)
    setEditDraft('')
  }

  function startEditMessage(m) {
    setOpenMessageMenuId(null)
    setEditingMessageId(m.id)
    setEditDraft(String(m.body ?? ''))
    setApiError(null)
  }

  async function saveEditMessage() {
    if (!identity || !roomId || editingMessageId == null) return
    const body = editDraft.trim()
    if (!body) {
      setApiError('Message cannot be empty. Delete it instead if you want to remove it.')
      return
    }
    setMessageActionBusy(true)
    try {
      setApiError(null)
      await apiJson(`/api/collab/rooms/${roomId}/messages/${editingMessageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ authorEmail: identity.email, body }),
      })
      cancelEditMessage()
      showToast('Message updated')
      await loadRoomDetail(roomId, identity.email)
    } catch (err) {
      if (err?.reason === 'edit_window_expired') {
        setApiError('You can only edit a message within 2 minutes of sending it.')
        cancelEditMessage()
      } else {
        setApiError('Could not update this message.')
      }
    }
    setMessageActionBusy(false)
  }

  async function deleteMessage(m) {
    if (!identity || !roomId || messageIsDeleted(m)) return
    setOpenMessageMenuId(null)
    if (!window.confirm('Delete this message for everyone in the channel?')) return
    setMessageActionBusy(true)
    try {
      setApiError(null)
      await apiJson(`/api/collab/rooms/${roomId}/messages/${m.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ authorEmail: identity.email }),
      })
      if (editingMessageId === m.id) cancelEditMessage()
      showToast('Message deleted')
      await loadRoomDetail(roomId, identity.email)
    } catch {
      setApiError('Could not delete this message.')
    }
    setMessageActionBusy(false)
  }

  const messages = useMemo(() => roomDetail?.messages ?? [], [roomDetail])
  const members = useMemo(() => roomDetail?.members ?? [], [roomDetail])
  const roomName = roomDetail?.room?.name ?? ''
  const memberCount = members.length
  const roomMemberLimit = useMemo(() => {
    const raw = Number(roomDetail?.room?.member_limit)
    if (!Number.isFinite(raw)) return MEMBER_LIMIT_CAP
    return Math.min(MEMBER_LIMIT_CAP, Math.max(MEMBER_LIMIT_MIN, Math.round(raw)))
  }, [roomDetail?.room?.member_limit])
  const inviteToken = roomDetail?.room?.invite_token
  const inviteBaseUrl = useMemo(() => {
    if (resolvedOrigin.origin) return resolvedOrigin.origin
    if (resolvedOrigin.loading) return ''
    return getPublicAppOrigin()
  }, [resolvedOrigin.origin, resolvedOrigin.loading])
  const inviteUrl = inviteToken && inviteBaseUrl ? `${inviteBaseUrl}/join/${inviteToken}` : ''
  const showLocalhostInviteHint = useMemo(() => {
    if (!inviteBaseUrl) return false
    try {
      const h = new URL(inviteBaseUrl).hostname.toLowerCase()
      return h === 'localhost' || h === '127.0.0.1'
    } catch {
      return inviteBaseUrl.includes('localhost')
    }
  }, [inviteBaseUrl])

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
  const canPost = memberCount < roomMemberLimit

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
        <button type="submit" className="slack-btn slack-btn-secondary" disabled={inviteBusy || memberCount >= roomMemberLimit}>
          {inviteBusy ? 'Sending…' : 'Send'}
        </button>
      </form>
      {inviteNotice ? <p className="slack-invite-notice">{inviteNotice}</p> : null}

      <div className="slack-invite-label slack-invite-label--second">Or copy link</div>
      <p className="slack-invite-hint slack-invite-hint--muted">Anyone with the link can join until the channel is full.</p>
      {showLocalhostInviteHint ? (
        <p className="slack-invite-hint slack-invite-hint--warn" role="note">
          <strong>Phones need a public URL.</strong> Set <code>VITE_PUBLIC_APP_URL</code> or <code>VITE_WORKSPHERE_PUBLIC_URL</code>{' '}
          (or <code>WORKSPHERE_PUBLIC_URL</code> on the server) to your live workSphere domain, or open this app using the
          Wi‑Fi address shown in the terminal instead of localhost.
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
            <h2 className="slack-setup-title">Join workSphere chat</h2>
            <p className="slack-setup-desc">Enter your name and email. We use this to show who sent each message.</p>
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
                Continue
              </button>
            </form>
            <button type="button" className="slack-btn slack-btn-ghost slack-setup-close" onClick={onClose}>
              Cancel
            </button>
          </div>
        ) : (
          <>
            {sessionView === 'picker' ? (
              <WspChatHome
                identity={identity}
                rooms={rooms}
                visibleRooms={visiblePickerRooms}
                hiddenCount={hiddenPickerCount}
                pickerExpanded={pickerExpanded}
                apiError={apiError}
                showCreate={showCreate}
                maxMembers={MEMBER_LIMIT_CAP}
                channelHue={channelHue}
                memberInitials={memberInitials}
                onClose={onClose}
                onCreate={openCreateModal}
                onOpenRoom={enterChannel}
                onShowMore={() => setPickerExpanded(true)}
                onSwitchAccount={() => {
                  clearLastCollabRoomId(identity.email)
                  clearCollabIdentity()
                  setIdentity(null)
                  setSetupName('')
                  setSetupEmail('')
                  setRooms([])
                  setRoomId(null)
                  setRoomDetail(null)
                }}
              />
            ) : (
              <>
                <div className="slack-app-layout">
              <header className="slack-topbar">
                <button type="button" className="slack-topbar-back" onClick={leaveToPicker}>
                  <span className="slack-topbar-back-short" aria-hidden>
                    ←
                  </span>
                  <span className="slack-topbar-back-label">All channels</span>
                </button>
                <button
                  type="button"
                  className={`slack-topbar-channels-btn${mobileSidebarOpen ? ' is-active' : ''}`}
                  aria-label={mobileSidebarOpen ? 'Close channels menu' : 'Open channels menu'}
                  aria-expanded={mobileSidebarOpen ? 'true' : 'false'}
                  onClick={() => setMobileSidebarOpen((v) => !v)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                    <path
                      fill="currentColor"
                      d="M3 6h18v2H3V6zm0 5h12v2H3v-2zm0 5h18v2H3v-2z"
                    />
                  </svg>
                  <span className="slack-topbar-channels-label">Channels</span>
                </button>
                {!topChannelSearchOpen ? (
                  <>
                    <div className="slack-topbar-spacer" aria-hidden />
                    <button
                      type="button"
                      className={`slack-topbar-icon-btn${workspaceSearchQuery.trim() ? ' is-active' : ''}`}
                      aria-label="Search this channel"
                      title="Search messages and files"
                      onClick={() => setTopChannelSearchOpen(true)}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
                        <path
                          fill="currentColor"
                          d="M10 2a8 8 0 105.293 14.707l4.387 4.387 1.414-1.414-4.387-4.387A8 8 0 0010 2zm0 2a6 6 0 110 12 6 6 0 010-12z"
                        />
                      </svg>
                    </button>
                  </>
                ) : (
                  <div className="slack-topbar-search-outer slack-topbar-search-outer--expanded">
                    <div className="slack-topbar-search-wrap">
                      <svg className="slack-topbar-search-svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                        <path
                          fill="currentColor"
                          d="M10 2a8 8 0 105.293 14.707l4.387 4.387 1.414-1.414-4.387-4.387A8 8 0 0010 2zm0 2a6 6 0 110 12 6 6 0 010-12z"
                        />
                      </svg>
                      <input
                        ref={topSearchInputRef}
                        type="search"
                        className="slack-topbar-search"
                        placeholder={`Search in #${roomName || 'channel'}…`}
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
                        aria-label="Search messages and files in this channel"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        className="slack-topbar-search-dismiss"
                        aria-label="Close search"
                        onClick={() => {
                          setTopChannelSearchOpen(false)
                          setWorkspaceSearchQuery('')
                          setWorkspaceSearchOpen(false)
                        }}
                      >
                        ×
                      </button>
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
                                <div className="slack-search-group-label">Files</div>
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
                )}
                <div className="slack-topbar-end">
                  <div className="slack-topbar-avatar" title={identity.name}>
                    {memberInitials(identity.name, identity.email)}
                  </div>
                  <button type="button" className="slack-topbar-close" onClick={onClose} aria-label="Close workspace">
                    ×
                  </button>
                </div>
              </header>

              <div className="slack-body-row slack-body-row--studio">
                <button
                  type="button"
                  className={`slack-sidebar-backdrop${mobileSidebarOpen ? ' is-visible' : ''}`}
                  aria-label="Close channels menu"
                  tabIndex={mobileSidebarOpen ? 0 : -1}
                  onClick={() => setMobileSidebarOpen(false)}
                />
                <nav className="slack-icon-rail" aria-label="workSphere chat apps">
                  <Link className="slack-icon-rail-link" to="/" title="Home">
                    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                      <path
                        fill="currentColor"
                        d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8h5z"
                      />
                    </svg>
                  </Link>
                  <span className="slack-icon-rail-item is-active" title="Chats">
                    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                      <path
                        fill="currentColor"
                        d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"
                      />
                    </svg>
                  </span>
                  <Link className="slack-icon-rail-link" to="/teams/meet" title="Meet">
                    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                      <path
                        fill="currentColor"
                        d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"
                      />
                    </svg>
                  </Link>
                  <Link className="slack-icon-rail-link" to="/features" title="Features">
                    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                      <path
                        fill="currentColor"
                        d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"
                      />
                    </svg>
                  </Link>
                </nav>
                <aside className={`slack-sidebar-panel${mobileSidebarOpen ? ' is-open' : ''}`}>
                  <div className="slack-ws-header">
                    <div className="slack-ws-brand">
                      <img src={workSphereLogo} alt="" className="slack-ws-logo" width={32} height={32} />
                      <span className="slack-ws-name">{WORKSPACE_NAME}</span>
                    </div>
                  </div>

                  <div className="slack-sidebar-jump">
                    <input
                      type="text"
                      className="slack-jump-input"
                      placeholder="Find a channel…"
                      value={jumpToQuery}
                      onChange={(e) => setJumpToQuery(e.target.value)}
                      aria-label="Filter channels"
                      autoComplete="off"
                    />
                  </div>

                  <div className="slack-side-scroll">
                    <div className="slack-side-section">
                      <div className="slack-side-section-head slack-side-section-head--row">
                        <button
                          type="button"
                          className="slack-side-section-toggle"
                          aria-expanded={channelsOpen}
                          onClick={() => setChannelsOpen((o) => !o)}
                        >
                          {channelsOpen ? '▾' : '▸'} Channels
                        </button>
                        <button
                          type="button"
                          className="slack-side-add"
                          onClick={openCreateModal}
                          aria-label="Create channel"
                        >
                          +
                        </button>
                      </div>
                      {channelsOpen ? (
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
                                onClick={() => selectChannel(r.id)}
                              >
                                <span className="slack-channel-hash">#</span>
                                <span className="slack-channel-label">{r.name}</span>
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                      ) : null}
                    </div>

                    <div className="slack-side-section">
                      <button
                        type="button"
                        className="slack-side-section-head slack-side-section-toggle"
                        aria-expanded={dmsOpen}
                        onClick={() => setDmsOpen((o) => !o)}
                      >
                        {dmsOpen ? '▾' : '▸'} Teammates
                      </button>
                      {dmsOpen ? (
                      <ul className="slack-dm-list">
                        {dmMembers.length === 0 ? (
                          <li className="slack-side-muted">Invite teammates from the Invite tab to chat with them.</li>
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
                                  setTopChannelSearchOpen(false)
                                  setMobileSidebarOpen(false)
                                }}
                              >
                                <span className="slack-dm-avatar">{memberInitials(m.name, m.email)}</span>
                                <span className="slack-dm-name">{m.name}</span>
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                      ) : null}
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
                          setTopChannelSearchOpen(false)
                        }}
                      >
                        Use different account
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
                          Create channels for each project or team. Up to {MEMBER_LIMIT_CAP} people per channel—switch anytime
                          from the sidebar.
                        </p>
                        <button
                          type="button"
                          className="slack-btn slack-btn-primary slack-blank-cta"
                          onClick={openCreateModal}
                        >
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
                        <button
                          type="button"
                          className="slack-btn slack-btn-primary slack-blank-cta"
                          onClick={openCreateModal}
                        >
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
                                {memberCount} member{memberCount === 1 ? '' : 's'}
                                {memberCount < roomMemberLimit ? ` · up to ${roomMemberLimit} people` : ''}
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
                          <button
                            type="button"
                            className="slack-header-invite-btn"
                            onClick={() => setMainTab('activity')}
                          >
                            Invite
                          </button>
                          <button
                            type="button"
                            className={`slack-header-tool${detailsOpen ? ' is-active' : ''}`}
                            aria-label="More options"
                            title="More options"
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

                      <div className="slack-channel-tabs" role="tablist" aria-label="Channel">
                        <button
                          type="button"
                          role="tab"
                          aria-selected={mainTab === 'messages'}
                          className={`slack-tab${mainTab === 'messages' ? ' is-active' : ''}`}
                          onClick={() => setMainTab('messages')}
                        >
                          Chat
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={mainTab === 'activity'}
                          className={`slack-tab${mainTab === 'activity' ? ' is-active' : ''}`}
                          onClick={() => setMainTab('activity')}
                        >
                          Invite
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
                                      const deleted = messageIsDeleted(m)
                                      const edited = messageWasEdited(m)
                                      const showEdit = identity && canEditMessage(m, identity.email)
                                      const showDelete = identity && canDeleteMessage(m, identity.email)
                                      const isEditing = editingMessageId === m.id
                                      const fileHref =
                                        !deleted && m.attachment_stored && identity
                                          ? `/api/collab/rooms/${roomId}/messages/${m.id}/file?email=${encodeURIComponent(identity.email)}`
                                          : null
                                      const isImage = Boolean(m.attachment_mime?.startsWith('image/'))
                                      const menuOpen = openMessageMenuId === m.id
                                      const showMsgMenu = (showEdit || showDelete) && !deleted && !isEditing
                                      return (
                                        <div
                                          key={m.id}
                                          data-slack-msg-id={m.id}
                                          className={`slack-thread-msg${outgoing ? ' slack-thread-msg--self' : ''}${deleted ? ' slack-thread-msg--deleted' : ''}`}
                                        >
                                          {deleted ? (
                                            <p className="slack-thread-deleted">This message was deleted</p>
                                          ) : (
                                            <>
                                          {fileHref ? (
                                            <div className="slack-msg-attachment">
                                              {isImage ? (
                                                <CollabInlineImage
                                                  href={fileHref}
                                                  alt={m.attachment_original || 'Attachment'}
                                                  imgClass="slack-msg-img"
                                                />
                                              ) : null}
                                              <a className="slack-msg-file-link" href={fileHref} target="_blank" rel="noreferrer">
                                                📎 {m.attachment_original || 'Download file'}
                                              </a>
                                            </div>
                                          ) : null}
                                          {isEditing ? (
                                            <div className="slack-msg-edit">
                                              <textarea
                                                className="slack-msg-edit-input"
                                                rows={3}
                                                value={editDraft}
                                                onChange={(e) => setEditDraft(e.target.value)}
                                                disabled={messageActionBusy}
                                                aria-label="Edit message"
                                              />
                                              <div className="slack-msg-edit-actions">
                                                <button type="button" className="slack-msg-action-btn" disabled={messageActionBusy} onClick={() => void saveEditMessage()}>Save</button>
                                                <button type="button" className="slack-msg-action-btn slack-msg-action-btn--ghost" disabled={messageActionBusy} onClick={cancelEditMessage}>Cancel</button>
                                              </div>
                                            </div>
                                          ) : m.body ? (
                                            <div className="slack-thread-text">
                                              {m.body}
                                              {edited ? <span className="slack-msg-edited"> (edited)</span> : null}
                                            </div>
                                          ) : null}
                                          {showMsgMenu ? (
                                            <div
                                              className={`slack-msg-menu-wrap${menuOpen ? ' is-open' : ''}`}
                                            >
                                              <button
                                                type="button"
                                                className="slack-msg-menu-trigger"
                                                aria-label="Message options"
                                                aria-expanded={menuOpen}
                                                aria-haspopup="menu"
                                                disabled={messageActionBusy}
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  setOpenMessageMenuId((id) => (id === m.id ? null : m.id))
                                                }}
                                              >
                                                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                                                  <circle cx="8" cy="3" r="1.5" fill="currentColor" />
                                                  <circle cx="8" cy="8" r="1.5" fill="currentColor" />
                                                  <circle cx="8" cy="13" r="1.5" fill="currentColor" />
                                                </svg>
                                              </button>
                                              {menuOpen ? (
                                                <div className="slack-msg-menu" role="menu">
                                                  {showEdit ? (
                                                    <button
                                                      type="button"
                                                      className="slack-msg-menu-item"
                                                      role="menuitem"
                                                      disabled={messageActionBusy}
                                                      onClick={() => startEditMessage(m)}
                                                    >
                                                      Edit message
                                                    </button>
                                                  ) : null}
                                                  {showDelete ? (
                                                    <button
                                                      type="button"
                                                      className="slack-msg-menu-item slack-msg-menu-item--danger"
                                                      role="menuitem"
                                                      disabled={messageActionBusy}
                                                      onClick={() => void deleteMessage(m)}
                                                    >
                                                      Delete message
                                                    </button>
                                                  ) : null}
                                                </div>
                                              ) : null}
                                            </div>
                                          ) : null}
                                            </>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>

                          {pendingTaskShare && roomId && canPost ? (
                            <div className="slack-wb-share slack-wb-share--task" role="status">
                              <div
                                className={`slack-task-share-badge slack-task-share-badge--${pendingTaskShare.priority || 'med'}`}
                                aria-hidden
                              >
                                📋
                              </div>
                              <div className="slack-wb-share-text">
                                <strong>Share task in #{roomName || 'this channel'}?</strong>
                                <span>{pendingTaskShare.title}</span>
                              </div>
                              <div className="slack-wb-share-actions">
                                <button
                                  type="button"
                                  className="slack-wb-share-discard"
                                  onClick={discardPendingTaskShare}
                                  disabled={pendingTaskShareBusy}
                                >
                                  Discard
                                </button>
                                <button
                                  type="button"
                                  className="slack-wb-share-send"
                                  onClick={() => void sendPendingTaskToRoom()}
                                  disabled={pendingTaskShareBusy}
                                >
                                  {pendingTaskShareBusy ? 'Sending…' : 'Share task'}
                                </button>
                              </div>
                            </div>
                          ) : null}

                          {pendingShare && roomId && canPost ? (
                            <div className="slack-wb-share" role="status">
                              <div className="slack-wb-share-thumb">
                                <img src={pendingShare.dataUrl} alt={pendingShare.name || 'Whiteboard drawing'} />
                              </div>
                              <div className="slack-wb-share-text">
                                <strong>Send whiteboard drawing to #{roomName || 'this channel'}?</strong>
                                <span>{pendingShare.name || 'Untitled drawing'}</span>
                              </div>
                              <div className="slack-wb-share-actions">
                                <button
                                  type="button"
                                  className="slack-wb-share-discard"
                                  onClick={discardPendingShare}
                                  disabled={pendingShareBusy}
                                >
                                  Discard
                                </button>
                                <button
                                  type="button"
                                  className="slack-wb-share-send"
                                  onClick={() => void sendPendingShareToRoom()}
                                  disabled={pendingShareBusy}
                                >
                                  {pendingShareBusy ? 'Sending…' : 'Send drawing'}
                                </button>
                              </div>
                            </div>
                          ) : null}

                          {canPost ? (
                            <div className="slack-composer-slack">
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
                                <button
                                  className="slack-send-slack"
                                  type="submit"
                                  aria-label="Send"
                                >
                                  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                                    <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                                  </svg>
                                </button>
                              </form>
                            </div>
                          ) : (
                            <div className="slack-composer-restricted">
                              Only certain people can post when the channel is full ({roomMemberLimit} members). Share an invite
                              from channel details to add teammates in a new channel.
                            </div>
                          )}
                        </>
                      ) : null}

                      {mainTab === 'activity' ? (
                        <div className="slack-activity-pane">
                          <section className="slack-activity-section" aria-labelledby="slack-activity-invite-heading">
                            <h3 id="slack-activity-invite-heading" className="slack-activity-section-title">
                              Invite link
                            </h3>
                            <p className="slack-activity-section-desc">
                              Copy this link and send it to teammates. They can join <strong>#{roomName}</strong> with one
                              click.
                            </p>
                            {resolvedOrigin.source === 'lan' ? (
                              <p className="slack-invite-hint slack-invite-hint--ok" role="note">
                                This invite uses your PC’s Wi‑Fi address so teammates on the same network can open it on a
                                phone.
                              </p>
                            ) : null}
                            {showLocalhostInviteHint ? (
                              <p className="slack-invite-hint slack-invite-hint--warn" role="note">
                                <strong>Still on localhost?</strong> Set <code>VITE_WORKSPHERE_PUBLIC_URL</code> to your
                                deployed domain (e.g. <code>https://app.worksphere.com</code>) for links that work
                                everywhere.
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
              <div className="slack-modal" role="dialog" aria-labelledby="slack-create-title" aria-modal="true">
                <button
                  type="button"
                  className="slack-modal-backdrop"
                  aria-label="Close"
                  onClick={() => {
                    setShowCreate(false)
                    setCreateError(null)
                    setNewRoomMemberLimit(MEMBER_LIMIT_CAP)
                  }}
                />
                <div className="slack-modal-card">
                  <h3 id="slack-create-title" className="slack-modal-title">
                    New channel
                  </h3>
                  <p className="slack-modal-desc">Give your team a clear name (e.g. general or project-alpha).</p>
                  <form onSubmit={createRoom}>
                    <label className="slack-label slack-modal-label" htmlFor="slack-new-channel-name">
                      Channel name
                    </label>
                    <input
                      id="slack-new-channel-name"
                      className="slack-input slack-modal-input"
                      value={newRoomName}
                      onChange={(e) => {
                        setNewRoomName(e.target.value)
                        if (createError) setCreateError(null)
                      }}
                      placeholder="general"
                      required
                      autoFocus
                      disabled={createBusy}
                    />
                    <label className="slack-label slack-modal-label" htmlFor="slack-new-channel-limit">
                      Member limit
                    </label>
                    <input
                      id="slack-new-channel-limit"
                      className="slack-input slack-modal-input"
                      type="number"
                      min={MEMBER_LIMIT_MIN}
                      max={MEMBER_LIMIT_CAP}
                      step={1}
                      value={newRoomMemberLimit}
                      onChange={(e) => {
                        const n = e.target.valueAsNumber
                        if (Number.isNaN(n)) return
                        setNewRoomMemberLimit(Math.min(MEMBER_LIMIT_CAP, Math.max(MEMBER_LIMIT_MIN, Math.round(n))))
                        if (createError) setCreateError(null)
                      }}
                      aria-describedby="slack-new-channel-limit-hint"
                      disabled={createBusy}
                    />
                    <p id="slack-new-channel-limit-hint" className="slack-modal-hint">
                      Max people who can join this channel ({MEMBER_LIMIT_MIN}–{MEMBER_LIMIT_CAP}). Invites stop when the channel is full.
                    </p>
                    {createError ? <div className="slack-modal-error">{createError}</div> : null}
                    <div className="slack-modal-actions">
                      <button
                        type="button"
                        className="slack-btn slack-btn-ghost"
                        disabled={createBusy}
                        onClick={() => {
                          setShowCreate(false)
                          setCreateError(null)
                          setNewRoomMemberLimit(MEMBER_LIMIT_CAP)
                        }}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="slack-btn slack-btn-primary" disabled={createBusy}>
                        {createBusy ? 'Creating…' : 'Create'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : null}
          </>
        )}
        {toast ? (
          <div className="slack-toast" role="status" aria-live="polite">
            {toast}
          </div>
        ) : null}
      </div>
    </div>
  )

  return createPortal(ui, document.body)
}
