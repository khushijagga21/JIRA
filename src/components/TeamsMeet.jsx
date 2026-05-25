import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMeetCamera } from '../hooks/useMeetCamera.js'
import { useMeetSession } from '../hooks/useMeetSession.js'
import { getCurrentUser } from '../utils/auth.js'
import MeetBackgroundPicker from './MeetBackgroundPicker.jsx'
import { preloadMeetSegmenter } from '../utils/meetSegmenter.js'
import {
  loadMeetDisplayName,
  parseMeetCode,
  randomMeetCode,
  sanitizeMeetCode,
  saveMeetDisplayName,
} from '../utils/meetCode.js'
import { meetBackgroundAllowedOnDevice } from '../utils/meetDevice.js'
import { buildMeetShareUrl, claimMeetHost, resolveMeetHostToken } from '../utils/meetHost.js'
import { useResolvedAppOrigin } from '../utils/useResolvedAppOrigin.js'

const MEET_REACTIONS = ['👍', '👏', '😂', '😮', '❤️', '🎉']

function MeetControlBar({
  micOn,
  camOn,
  onToggleMic,
  onToggleCam,
  onToggleChat,
  chatOpen,
  onToggleHand,
  handRaised,
  onToggleScreenShare,
  screenSharing,
  onReaction,
  onLeave,
  backgroundId,
  onBackgroundChange,
  bgLoading,
  effectsReady = true,
  showBackground = true,
  showLeave = true,
  showChat = true,
  showHand = true,
  showScreen = true,
  showReactions = true,
  dark = false,
}) {
  const [emojiOpen, setEmojiOpen] = useState(false)
  const emojiRef = useRef(null)

  useEffect(() => {
    if (!emojiOpen) return undefined
    function onDocClick(e) {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) setEmojiOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [emojiOpen])

  const ctl = dark ? 'meet-ctl meet-ctl--dark' : 'meet-ctl'

  return (
    <div className="meet-control-bar" role="toolbar" aria-label="Meeting controls">
      <button
        type="button"
        className={`${ctl} meet-ctl--round${micOn ? '' : ' is-off'}`}
        onClick={onToggleMic}
        title={micOn ? 'Turn off microphone' : 'Turn on microphone'}
        aria-label={micOn ? 'Turn off microphone' : 'Turn on microphone'}
        aria-pressed={micOn}
      >
        <span className="meet-ctl-icon" aria-hidden>
          {micOn ? '🎤' : '🔇'}
        </span>
      </button>

      <button
        type="button"
        className={`${ctl} meet-ctl--round${camOn ? '' : ' is-off'}`}
        onClick={onToggleCam}
        title={camOn ? 'Turn off camera' : 'Turn on camera'}
        aria-label={camOn ? 'Turn off camera' : 'Turn on camera'}
        aria-pressed={camOn}
        disabled={screenSharing}
      >
        <span className="meet-ctl-icon" aria-hidden>
          📷
        </span>
        {!camOn ? <span className="meet-ctl-slash" aria-hidden /> : null}
      </button>

      {showScreen && onToggleScreenShare ? (
        <button
          type="button"
          className={`${ctl} meet-ctl--round${screenSharing ? ' is-on' : ''}`}
          onClick={onToggleScreenShare}
          title={screenSharing ? 'Stop presenting' : 'Present screen'}
          aria-label={screenSharing ? 'Stop presenting' : 'Present screen'}
          aria-pressed={screenSharing}
        >
          <span className="meet-ctl-icon" aria-hidden>
            🖥️
          </span>
        </button>
      ) : null}

      {showBackground && onBackgroundChange ? (
        <MeetBackgroundPicker
          dark={dark}
          backgroundId={backgroundId}
          onChange={onBackgroundChange}
          loading={bgLoading}
          effectsReady={effectsReady}
        />
      ) : null}

      {showReactions && onReaction ? (
        <div className="meet-ctl-emoji-wrap" ref={emojiRef}>
          <button
            type="button"
            className={`${ctl} meet-ctl--round${emojiOpen ? ' is-on' : ''}`}
            onClick={() => setEmojiOpen((v) => !v)}
            title="Send a reaction"
            aria-label="Send a reaction"
            aria-expanded={emojiOpen}
          >
            <span className="meet-ctl-icon" aria-hidden>
              😊
            </span>
          </button>
          {emojiOpen ? (
            <div className="meet-emoji-picker" role="menu">
              {MEET_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="meet-emoji-btn"
                  role="menuitem"
                  onClick={() => {
                    onReaction(emoji)
                    setEmojiOpen(false)
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {showHand && onToggleHand ? (
        <button
          type="button"
          className={`${ctl} meet-ctl--round${handRaised ? ' is-on' : ''}`}
          onClick={onToggleHand}
          title={handRaised ? 'Lower hand' : 'Raise hand'}
          aria-label={handRaised ? 'Lower hand' : 'Raise hand'}
          aria-pressed={handRaised}
        >
          <span className="meet-ctl-icon" aria-hidden>
            ✋
          </span>
        </button>
      ) : null}

      {showChat && onToggleChat ? (
        <button
          type="button"
          className={`${ctl} meet-ctl--round meet-ctl--chat${chatOpen ? ' is-on' : ''}`}
          onClick={onToggleChat}
          title="Chat with everyone"
          aria-label="Chat with everyone"
          aria-pressed={chatOpen}
        >
          <span className="meet-ctl-icon" aria-hidden>
            💬
          </span>
        </button>
      ) : null}

      {showLeave && onLeave ? (
        <button
          type="button"
          className={`${ctl} meet-ctl--round meet-ctl--leave`}
          onClick={onLeave}
          title="Leave call"
          aria-label="Leave call"
        >
          <span className="meet-ctl-icon" aria-hidden>
            📞
          </span>
        </button>
      ) : null}
    </div>
  )
}

function MeetVideoTile({
  stream,
  name,
  label,
  muted,
  isLocal,
  micOn,
  camOn,
  handRaised,
  large,
  virtualBackground,
  isAdmin,
}) {
  const videoRef = useRef(null)
  const [aspectRatio, setAspectRatio] = useState(virtualBackground ? '16 / 9' : '4 / 3')

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    el.srcObject = stream || null
    void el.play().catch(() => {})

    function syncAspect() {
      if (virtualBackground) {
        setAspectRatio('16 / 9')
        return
      }
      if (el.videoWidth > 0 && el.videoHeight > 0) {
        setAspectRatio(`${el.videoWidth} / ${el.videoHeight}`)
      }
    }

    function onLoaded() {
      syncAspect()
      void el.play().catch(() => {})
    }

    el.addEventListener('loadedmetadata', onLoaded)
    el.addEventListener('resize', syncAspect)
    syncAspect()

    return () => {
      el.removeEventListener('loadedmetadata', onLoaded)
      el.removeEventListener('resize', syncAspect)
      if (el.srcObject === stream) el.srcObject = null
    }
  }, [stream, virtualBackground])

  const videoTracks = stream?.getVideoTracks?.() ?? []
  const hasVideoTrack = videoTracks.length > 0
  const showVideo = camOn && videoTracks.some((t) => t.enabled)
  const initial = (name || '?').slice(0, 1).toUpperCase()

  return (
    <div
      className={`meet-vtile${large ? ' meet-vtile--large' : ''}${!showVideo && !hasVideoTrack ? ' meet-vtile--avatar' : ''}${virtualBackground ? ' meet-vtile--vb' : ''}`}
      style={{ '--meet-vtile-ar': aspectRatio }}
    >
      {hasVideoTrack ? (
        <div className="meet-vtile-media meet-vtile-media--stack">
          <video
            ref={videoRef}
            className={`meet-vtile-video${isLocal ? ' meet-vtile-video--local' : ''}${virtualBackground ? ' meet-vtile-video--vb' : ''}`}
            style={{ opacity: showVideo ? 1 : 0, visibility: showVideo ? 'visible' : 'hidden' }}
            autoPlay
            playsInline
            muted={muted}
            aria-hidden={!showVideo}
          />
          {!showVideo ? (
            <div className="meet-vtile-avatar meet-vtile-avatar--cover" aria-hidden>
              {initial}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="meet-vtile-avatar" aria-hidden>
          {initial}
        </div>
      )}
      <div className="meet-vtile-footer">
        <span className="meet-vtile-name">
          {name}
          {isLocal ? ' (You)' : ''}
        </span>
        {!micOn ? <span className="meet-vtile-muted" aria-label="Microphone off">🔇</span> : null}
        {handRaised ? <span className="meet-vtile-hand" aria-label="Hand raised">✋</span> : null}
      </div>
      {label ? <span className="meet-vtile-badge">{label}</span> : null}
      {isAdmin ? <span className="meet-vtile-badge meet-vtile-badge--admin">Admin</span> : null}
    </div>
  )
}

function MeetLobby({ room, displayName, onNameChange, onJoin, onLeave, onReturnHome }) {
  const camera = useMeetCamera({ active: true, previewWithoutEffects: true })
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)

  useEffect(() => {
    const raw = camera.getRawStream()
    if (!raw) return
    setMicOn(raw.getAudioTracks()[0]?.enabled ?? true)
    const v = raw.getVideoTracks()[0]
    setCamOn(v ? v.enabled : false)
  }, [camera.displayStream])

  function toggleMic() {
    const raw = camera.getRawStream()
    const a = raw?.getAudioTracks()[0]
    if (a) {
      a.enabled = !a.enabled
      setMicOn(a.enabled)
    }
  }

  function toggleCam() {
    const raw = camera.getRawStream()
    const v = raw?.getVideoTracks()[0]
    if (v) {
      v.enabled = !v.enabled
      setCamOn(v.enabled)
    }
  }

  function handleJoin() {
    saveMeetDisplayName(displayName)
    const mediaStream = camera.releaseToHandoff()
    onJoin({ micOn, camOn, backgroundId: camera.backgroundId, mediaStream })
  }

  const previewError = camera.error
  const previewStream = camera.displayStream
  const hasVideoTrack = Boolean(previewStream?.getVideoTracks().length)
  const noCameraHint =
    !previewError && previewStream && !hasVideoTrack
      ? 'No camera for this preview. Click the lock or camera icon in the address bar and allow the camera, then reload the page if needed.'
      : null

  const trimmedName = (displayName || '').trim()
  const canJoin = trimmedName.length > 0

  return (
    <main className="meet-lobby meet-lobby--v2">
      <div className="meet-lobby-bg" aria-hidden>
        <div className="meet-lobby-bg-glow meet-lobby-bg-glow--a" />
        <div className="meet-lobby-bg-glow meet-lobby-bg-glow--b" />
        <div className="meet-lobby-bg-glow meet-lobby-bg-glow--c" />
      </div>

      <button
        type="button"
        className="meet-close-btn meet-close-btn--landing"
        onClick={onReturnHome}
        aria-label="Close meet and return to workSphere"
        title="Close meet"
      >
        ×
      </button>

      <div className="meet-lobby-shell">
        <button type="button" className="meet-lobby-back" onClick={onLeave}>
          ← Back to meet
        </button>

        <div className="meet-lobby-grid">
          <section className="meet-lobby-stage" aria-label="Camera preview">
            <div className="meet-lobby-stage-card">
              <MeetVideoTile
                stream={previewStream}
                name={displayName || 'You'}
                muted
                isLocal
                micOn={micOn}
                camOn={camOn}
                large
                virtualBackground={false}
              />
              <div className="meet-lobby-stage-status" aria-hidden>
                <span
                  className={`meet-lobby-status-pill${camOn ? ' is-on' : ' is-off'}`}
                >
                  <span aria-hidden>{camOn ? '📷' : '🚫'}</span>
                  {camOn ? 'Camera on' : 'Camera off'}
                </span>
                <span
                  className={`meet-lobby-status-pill${micOn ? ' is-on' : ' is-off'}`}
                >
                  <span aria-hidden>{micOn ? '🎤' : '🔇'}</span>
                  {micOn ? 'Mic on' : 'Mic off'}
                </span>
              </div>
            </div>

            <div className="meet-lobby-stage-bar">
              <MeetControlBar
                micOn={micOn}
                camOn={camOn}
                onToggleMic={toggleMic}
                onToggleCam={toggleCam}
                backgroundId={camera.backgroundId}
                onBackgroundChange={camera.setBackgroundId}
                bgLoading={camera.bgLoading}
                effectsReady={camera.effectsReady}
                showChat={false}
                showHand={false}
                showScreen={false}
                showReactions={false}
                showLeave={false}
                showBackground={meetBackgroundAllowedOnDevice()}
              />
            </div>

            {previewError ? <p className="meet-lobby-error">{previewError}</p> : null}
            {previewError ? (
              <button type="button" className="meet-lobby-retry" onClick={() => camera.retryOpen()}>
                Try camera again
              </button>
            ) : null}
            {noCameraHint ? <p className="meet-lobby-error meet-lobby-error--soft">{noCameraHint}</p> : null}
          </section>

          <aside className="meet-lobby-panel" aria-label="Join meeting">
            <span className="meet-hero-eyebrow meet-lobby-eyebrow">
              <span className="meet-hero-eyebrow-dot" aria-hidden /> Ready to join
            </span>
            <h1 className="meet-lobby-title meet-lobby-title--v2">
              You look <span className="meet-hero-title-accent">great!</span>
            </h1>
            <p className="meet-lobby-panel-lead">
              Take a moment to check your camera and mic. We&apos;ll drop you straight into the meeting when you&apos;re
              ready.
            </p>

            <div className="meet-lobby-code-card">
              <div className="meet-lobby-code-card-label">Meeting code</div>
              <div className="meet-lobby-code-card-value">{room}</div>
            </div>

            <label className="meet-lobby-label meet-lobby-label--v2">
              <span className="meet-lobby-label-text">Your display name</span>
              <input
                className="meet-lobby-input meet-lobby-input--v2"
                value={displayName}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="What should we call you?"
                maxLength={80}
                autoFocus
              />
            </label>

            <button
              type="button"
              className="meet-lobby-join meet-lobby-join--v2"
              onClick={handleJoin}
              disabled={!canJoin}
            >
              Join meeting
              <span className="meet-lobby-join-arrow" aria-hidden>→</span>
            </button>

            <p className="meet-lobby-panel-foot">
              By joining, you&apos;re sharing audio and video with everyone in this room.
            </p>
          </aside>
        </div>
      </div>
    </main>
  )
}

function MeetRoom({
  room,
  displayName,
  meetShareUrl,
  hostToken,
  initialMediaStream,
  initialMicOn,
  initialCamOn,
  initialBackground,
  onLeave,
  onReturnHome,
}) {
  const [chatOpen, setChatOpen] = useState(false)
  const [chatDraft, setChatDraft] = useState('')
  const [copied, setCopied] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const chatEndRef = useRef(null)

  const session = useMeetSession({
    roomId: room,
    displayName,
    hostToken,
    initialMediaStream,
    active: true,
    initialMicOn,
    initialCamOn,
    initialBackground,
  })

  const isJoining = session.status === 'connecting'

  const allTiles = [
    {
      key: 'local',
      stream: session.localStream,
      name: displayName || 'You',
      isLocal: true,
      micOn: session.micOn,
      camOn: session.camOn || session.screenSharing,
      handRaised: session.handRaised,
      isAdmin: session.isHost,
      label: session.screenSharing ? 'Presenting' : null,
      large: session.remotePeers.length === 0,
    },
    ...session.remotePeers.map((p) => ({
      key: p.peerId,
      stream: p.stream,
      name: p.name,
      isLocal: false,
      micOn: p.stream?.getAudioTracks()?.[0]?.enabled !== false,
      camOn: p.stream?.getVideoTracks()?.some((t) => t.enabled) ?? true,
      handRaised: Boolean(session.remoteHands[p.peerId]),
      isAdmin: p.isHost,
      label: null,
      large: false,
    })),
  ]

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [session.chatMessages])

  async function copyLink() {
    if (!meetShareUrl) return
    try {
      await navigator.clipboard.writeText(meetShareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  function handleLeave() {
    session.leave()
    onLeave()
  }

  function handleCloseMeetWindow() {
    session.leave()
    onLeave()
    onReturnHome()
  }

  function sendChat(e) {
    e.preventDefault()
    session.sendChat(chatDraft)
    setChatDraft('')
  }

  const participantCount = 1 + session.remotePeers.length

  return (
    <main className="meet-room">
      <header className="meet-room-top">
        <div className="meet-room-info">
          <span className="meet-room-code">{room}</span>
          {session.isHost ? <span className="meet-room-admin-pill">You are the admin</span> : null}
          <span className="meet-room-count">
            {participantCount} participant{participantCount === 1 ? '' : 's'}
          </span>
          {session.status === 'connecting' ? (
            <span className="meet-room-status">Connecting…</span>
          ) : null}
        </div>
        <div className="meet-room-top-actions">
          {session.isHost ? (
            <button
              type="button"
              className={`meet-ctl meet-ctl--ghost${adminOpen ? ' is-on' : ''}`}
              onClick={() => setAdminOpen((v) => !v)}
            >
              Admin
            </button>
          ) : null}
          <button type="button" className="meet-ctl meet-ctl--ghost" onClick={() => void copyLink()}>
            {copied ? 'Link copied' : 'Copy link'}
          </button>
          <button
            type="button"
            className="meet-close-btn meet-close-btn--room"
            onClick={handleCloseMeetWindow}
            aria-label="Close meet and return to workSphere"
            title="Close meet"
          >
            ×
          </button>
        </div>
      </header>

      {session.isHost && adminOpen && session.remotePeers.length > 0 ? (
        <div className="meet-admin-panel" aria-label="Admin controls">
          <p className="meet-admin-title">Manage participants</p>
          <ul className="meet-admin-list">
            {session.remotePeers.map((p) => (
              <li key={p.peerId} className="meet-admin-row">
                <span className="meet-admin-name">
                  {p.name}
                  {p.isHost ? ' (Admin)' : ''}
                </span>
                <span className="meet-admin-actions">
                  <button type="button" className="meet-admin-btn" onClick={() => session.muteParticipant(p.peerId)}>
                    Mute
                  </button>
                  <button
                    type="button"
                    className="meet-admin-btn meet-admin-btn--danger"
                    onClick={() => session.removeParticipant(p.peerId)}
                  >
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {session.error ? (
        <div className="meet-room-banner" role="alert">
          {session.error}
        </div>
      ) : null}

      <div className={`meet-room-body${chatOpen ? ' meet-room-body--chat' : ''}`}>
        <div className="meet-room-stage">
          {isJoining ? (
            <div className="meet-joining-overlay" aria-live="polite">
              <div className="meet-joining-overlay-inner">
                <p className="meet-joining-text">Joining…</p>
                <p className="meet-joining-hint">Use the controls below for mic, camera, chat, and more.</p>
                <button type="button" className="meet-joining-cancel" onClick={handleCloseMeetWindow}>
                  Cancel and leave
                </button>
              </div>
            </div>
          ) : null}

          {session.reactions.length > 0 ? (
            <div className="meet-reactions-layer" aria-hidden>
              {session.reactions.slice(-6).map((r) => (
                <span key={r.id} className="meet-reaction-bubble" title={r.name}>
                  {r.emoji}
                </span>
              ))}
            </div>
          ) : null}

          <div
            className={`meet-video-grid meet-video-grid--${Math.min(allTiles.length, 9)}`}
            aria-label="Meeting participants"
          >
            {allTiles.map((t) => (
              <MeetVideoTile
                key={t.key}
                stream={t.stream}
                name={t.name}
                label={t.label}
                muted={t.isLocal}
                isLocal={t.isLocal}
                micOn={t.micOn}
                camOn={t.camOn}
                handRaised={t.handRaised}
                isAdmin={t.isAdmin}
                large={t.large && allTiles.length === 1}
                virtualBackground={
                  t.isLocal && meetBackgroundAllowedOnDevice() && session.backgroundId && session.backgroundId !== 'none'
                }
              />
            ))}
          </div>
        </div>

        {chatOpen ? (
          <aside className="meet-chat" aria-label="Meeting chat">
            <div className="meet-chat-head">
              <div className="meet-chat-title">In-call messages</div>
              <button type="button" className="meet-chat-close" onClick={() => setChatOpen(false)} aria-label="Close chat">
                ×
              </button>
            </div>
            <div className="meet-chat-list">
              {session.chatMessages.length === 0 ? (
                <p className="meet-chat-empty">Messages are visible to everyone in the meeting.</p>
              ) : (
                session.chatMessages.map((m) => (
                  <div key={m.id} className="meet-msg">
                    <div className="meet-msg-who">{m.name}</div>
                    <div className="meet-msg-text">{m.text}</div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>
            <form className="meet-chat-compose" onSubmit={sendChat}>
              <input
                className="meet-chat-input"
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                placeholder="Send a message…"
                maxLength={2000}
              />
              <button type="submit" className="meet-chat-send" disabled={!chatDraft.trim()}>
                Send
              </button>
            </form>
          </aside>
        ) : null}
      </div>

      <footer className="meet-controls meet-controls--room">
        <MeetControlBar
          dark
          micOn={session.micOn}
          camOn={session.camOn}
          onToggleMic={session.toggleMic}
          onToggleCam={session.toggleCam}
          chatOpen={chatOpen}
          onToggleChat={() => setChatOpen((v) => !v)}
          handRaised={session.handRaised}
          onToggleHand={session.status === 'connected' ? session.toggleHand : undefined}
          screenSharing={session.screenSharing}
          onToggleScreenShare={
            session.localStream ? () => void session.toggleScreenShare() : undefined
          }
          onReaction={session.status === 'connected' ? session.sendReaction : undefined}
          backgroundId={session.backgroundId}
          onBackgroundChange={session.setBackgroundId}
          bgLoading={session.bgLoading}
          effectsReady={session.effectsReady}
          showBackground={meetBackgroundAllowedOnDevice()}
          onLeave={handleLeave}
        />
      </footer>
    </main>
  )
}

export default function TeamsMeet() {
  useEffect(() => {
    void preloadMeetSegmenter().catch(() => {})
  }, [])

  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const resolved = useResolvedAppOrigin()
  const room = sanitizeMeetCode(searchParams.get('room') || '')
  const [displayName, setDisplayName] = useState(() => {
    const user = getCurrentUser()
    return loadMeetDisplayName() || user?.name || ''
  })
  const [joinCode, setJoinCode] = useState('')
  const [inCall, setInCall] = useState(false)
  const [joinPrefs, setJoinPrefs] = useState({ micOn: true, camOn: true, backgroundId: 'none' })
  const [newMeetingOpen, setNewMeetingOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [scheduledLink, setScheduledLink] = useState(null)
  const [scheduleCopied, setScheduleCopied] = useState(false)
  const newMeetingRef = useRef(null)
  const mediaHandoffRef = useRef(null)

  const hostToken = useMemo(() => resolveMeetHostToken(room, searchParams), [room, searchParams])

  const meetShareBase = useMemo(() => {
    if (resolved.loading) return ''
    if (resolved.origin) return resolved.origin
    return typeof window !== 'undefined' ? window.location.origin : ''
  }, [resolved.loading, resolved.origin])

  const meetShareUrl = useMemo(() => {
    if (!room || !meetShareBase) return ''
    return buildMeetShareUrl(meetShareBase, room, hostToken)
  }, [room, meetShareBase, hostToken])

  const leaveRoom = useCallback(() => {
    const sp = new URLSearchParams(searchParams)
    sp.delete('room')
    setSearchParams(sp, { replace: true })
    setInCall(false)
    mediaHandoffRef.current = null
  }, [searchParams, setSearchParams])

  const returnHomeFromMeet = useCallback(() => {
    navigate('/', { replace: true })
  }, [navigate])

  useEffect(() => {
    if (!newMeetingOpen) return undefined
    function onDoc(e) {
      if (newMeetingRef.current && !newMeetingRef.current.contains(e.target)) {
        setNewMeetingOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [newMeetingOpen])

  useEffect(() => {
    if (!scheduleOpen) return undefined
    function onKey(e) {
      if (e.key === 'Escape') setScheduleOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [scheduleOpen])

  function startMeeting(code, existingHostToken) {
    saveMeetDisplayName(displayName)
    const roomCode = code || randomMeetCode()
    const token = existingHostToken || claimMeetHost(roomCode)
    const sp = new URLSearchParams(searchParams)
    sp.set('room', roomCode)
    sp.set('host', token)
    setSearchParams(sp, { replace: true })
    setNewMeetingOpen(false)
    setScheduleOpen(false)
  }

  function startInstantMeeting() {
    startMeeting()
  }

  function openScheduleMeeting() {
    setNewMeetingOpen(false)
    setScheduleOpen(true)
    setScheduledLink(null)
    setScheduleCopied(false)
    const d = new Date()
    d.setMinutes(d.getMinutes() + 30)
    setScheduleDate(d.toISOString().slice(0, 10))
    setScheduleTime(d.toTimeString().slice(0, 5))
  }

  function createScheduledMeeting() {
    const code = randomMeetCode()
    const token = claimMeetHost(code)
    const url = buildMeetShareUrl(meetShareBase || window.location.origin, code, token)
    let startsAt = null
    if (scheduleDate && scheduleTime) {
      startsAt = new Date(`${scheduleDate}T${scheduleTime}`)
    }
    setScheduledLink({ code, url, startsAt, hostToken: token })
  }

  async function copyScheduledLink() {
    if (!scheduledLink?.url) return
    try {
      await navigator.clipboard.writeText(scheduledLink.url)
      setScheduleCopied(true)
      window.setTimeout(() => setScheduleCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  function joinWithCode() {
    const trimmed = joinCode.trim()
    const code = parseMeetCode(trimmed)
    if (!code) return
    let hostFromPaste = ''
    try {
      const url = new URL(trimmed)
      hostFromPaste = url.searchParams.get('host')?.trim() || ''
    } catch {
      const hostMatch = trimmed.match(/[?&]host=([^&]+)/i)
      if (hostMatch) hostFromPaste = decodeURIComponent(hostMatch[1]).trim()
    }
    const sp = new URLSearchParams(searchParams)
    sp.set('room', code)
    if (hostFromPaste) sp.set('host', hostFromPaste)
    else sp.delete('host')
    setSearchParams(sp, { replace: true })
    setJoinCode('')
  }

  if (room && inCall) {
    return (
      <MeetRoom
        room={room}
        displayName={displayName}
        meetShareUrl={meetShareUrl}
        hostToken={hostToken}
        initialMediaStream={mediaHandoffRef.current}
        initialMicOn={joinPrefs.micOn}
        initialCamOn={joinPrefs.camOn}
        initialBackground={joinPrefs.backgroundId}
        onLeave={leaveRoom}
        onReturnHome={returnHomeFromMeet}
      />
    )
  }

  if (room) {
    return (
      <MeetLobby
        room={room}
        displayName={displayName}
        onNameChange={setDisplayName}
        onJoin={(prefs) => {
          mediaHandoffRef.current = prefs.mediaStream || null
          setJoinPrefs(prefs)
          setInCall(true)
        }}
        onLeave={leaveRoom}
        onReturnHome={() => {
          leaveRoom()
          returnHomeFromMeet()
        }}
      />
    )
  }

  return (
    <main className="meet-landing meet-landing-shell meet-landing--hero">
      <button
        type="button"
        className="meet-close-btn meet-close-btn--landing"
        onClick={returnHomeFromMeet}
        aria-label="Close meet and return to workSphere"
        title="Close meet"
      >
        ×
      </button>
      <div className="meet-landing-main">
        <div className="meet-landing-center meet-landing-center--hero">
          <div className="meet-hero-grid">
            <div className="meet-hero-text">
              <span className="meet-hero-eyebrow">
                <span className="meet-hero-eyebrow-dot" aria-hidden /> workSphere Meet
              </span>
              <h1 className="meet-landing-title meet-hero-title">
                Meet your team in <span className="meet-hero-title-accent">workSphere</span>
              </h1>
              <p className="meet-landing-subtitle meet-hero-subtitle">
                Host face-to-face conversations in seconds—create a room, share one link, and everyone arrives in the
                same place with chat, reactions, and screen share built in.
              </p>

              <div className="meet-landing-row meet-hero-row">
                <div className="meet-landing-new-wrap" ref={newMeetingRef}>
                  <button
                    type="button"
                    className="meet-landing-primary meet-landing-primary--menu meet-hero-primary"
                    onClick={() => setNewMeetingOpen((v) => !v)}
                    aria-expanded={newMeetingOpen}
                    aria-haspopup="menu"
                  >
                    <span className="meet-hero-primary-icon" aria-hidden>＋</span>
                    New meeting
                    <span className="meet-landing-caret" aria-hidden />
                  </button>
                  {newMeetingOpen ? (
                    <div className="meet-landing-menu" role="menu">
                      <button
                        type="button"
                        className="meet-landing-menuitem"
                        role="menuitem"
                        onClick={startInstantMeeting}
                      >
                        <span className="meet-landing-menuitem-title">Start an instant meeting</span>
                        <span className="meet-landing-menuitem-desc">Create a meeting and join right away</span>
                      </button>
                      <button
                        type="button"
                        className="meet-landing-menuitem"
                        role="menuitem"
                        onClick={openScheduleMeeting}
                      >
                        <span className="meet-landing-menuitem-title">Schedule meeting for later</span>
                        <span className="meet-landing-menuitem-desc">Get a link to share for a future time</span>
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="meet-landing-code meet-hero-code" aria-label="Join with code">
                  <span className="meet-hero-code-icon" aria-hidden>🔗</span>
                  <input
                    className="meet-landing-input"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    placeholder="Enter a code or link"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') joinWithCode()
                    }}
                  />
                  <button type="button" className="meet-landing-join" onClick={joinWithCode}>
                    Join
                  </button>
                </div>
              </div>

              <ul className="meet-hero-bullets" aria-label="What's included">
                <li className="meet-hero-bullet">
                  <span className="meet-hero-bullet-icon" aria-hidden>🎥</span>
                  <span>HD video with virtual backgrounds</span>
                </li>
                <li className="meet-hero-bullet">
                  <span className="meet-hero-bullet-icon" aria-hidden>💬</span>
                  <span>In-call chat, reactions &amp; raise hand</span>
                </li>
                <li className="meet-hero-bullet">
                  <span className="meet-hero-bullet-icon" aria-hidden>🖥️</span>
                  <span>One-click screen share for everyone</span>
                </li>
              </ul>
            </div>

            <aside className="meet-hero-visual" aria-hidden="true">
              <div className="meet-hero-card">
                <div className="meet-hero-card-top">
                  <span className="meet-hero-card-dot meet-hero-card-dot--r" />
                  <span className="meet-hero-card-dot meet-hero-card-dot--y" />
                  <span className="meet-hero-card-dot meet-hero-card-dot--g" />
                  <span className="meet-hero-card-title">workSphere · Team standup</span>
                  <span className="meet-hero-card-live">
                    <span className="meet-hero-card-live-dot" /> LIVE
                  </span>
                </div>
                <div className="meet-hero-card-stage">
                  <div className="meet-hero-tile meet-hero-tile--lg">
                    <span className="meet-hero-tile-avatar meet-hero-tile-avatar--a">A</span>
                    <span className="meet-hero-tile-name">Aarav (Host)</span>
                  </div>
                  <div className="meet-hero-tile">
                    <span className="meet-hero-tile-avatar meet-hero-tile-avatar--b">K</span>
                    <span className="meet-hero-tile-name">Khushi</span>
                  </div>
                  <div className="meet-hero-tile">
                    <span className="meet-hero-tile-avatar meet-hero-tile-avatar--c">M</span>
                    <span className="meet-hero-tile-name">Mira</span>
                  </div>
                  <div className="meet-hero-tile">
                    <span className="meet-hero-tile-avatar meet-hero-tile-avatar--d">S</span>
                    <span className="meet-hero-tile-name">Sam</span>
                  </div>
                </div>
                <div className="meet-hero-card-bar">
                  <span className="meet-hero-pill meet-hero-pill--on" title="Mic on">🎤</span>
                  <span className="meet-hero-pill" title="Camera">📷</span>
                  <span className="meet-hero-pill" title="Screen share">🖥️</span>
                  <span className="meet-hero-pill" title="Reactions">😊</span>
                  <span className="meet-hero-pill" title="Chat">💬</span>
                  <span className="meet-hero-pill meet-hero-pill--leave" title="Leave">📞</span>
                </div>
              </div>
              <div className="meet-hero-glow meet-hero-glow--a" />
              <div className="meet-hero-glow meet-hero-glow--b" />
            </aside>
          </div>

          <section className="meet-hero-features" aria-label="How meet works">
            <article className="meet-hero-feature">
              <span className="meet-hero-feature-icon meet-hero-feature-icon--blue" aria-hidden>＋</span>
              <h3 className="meet-hero-feature-title">Start instantly</h3>
              <p className="meet-hero-feature-desc">
                Spin up a room in one click and invite teammates with a single shareable link.
              </p>
            </article>
            <article className="meet-hero-feature">
              <span className="meet-hero-feature-icon meet-hero-feature-icon--violet" aria-hidden>📅</span>
              <h3 className="meet-hero-feature-title">Schedule ahead</h3>
              <p className="meet-hero-feature-desc">
                Pick a date and time, get a reusable link, and start when you’re ready.
              </p>
            </article>
            <article className="meet-hero-feature">
              <span className="meet-hero-feature-icon meet-hero-feature-icon--green" aria-hidden>🔗</span>
              <h3 className="meet-hero-feature-title">Join with a code</h3>
              <p className="meet-hero-feature-desc">
                Paste any meeting code or link and you’ll land straight in the right room.
              </p>
            </article>
          </section>

          <section className="meet-hero-strip" aria-label="Why workSphere Meet">
            <div className="meet-hero-strip-item">
              <span className="meet-hero-strip-icon">🚀</span>
              <div>
                <strong>No downloads</strong>
                <span>Joins straight from the browser.</span>
              </div>
            </div>
            <div className="meet-hero-strip-divider" aria-hidden />
            <div className="meet-hero-strip-item">
              <span className="meet-hero-strip-icon">🔒</span>
              <div>
                <strong>Private rooms</strong>
                <span>Only people with the link can join.</span>
              </div>
            </div>
            <div className="meet-hero-strip-divider" aria-hidden />
            <div className="meet-hero-strip-item">
              <span className="meet-hero-strip-icon">⚡</span>
              <div>
                <strong>Lightning quick</strong>
                <span>From idea to face-to-face in seconds.</span>
              </div>
            </div>
          </section>

          {scheduleOpen ? (
            <div
              className="meet-schedule-overlay"
              role="dialog"
              aria-modal="true"
              aria-labelledby="meet-schedule-title"
              onClick={(e) => {
                if (e.target === e.currentTarget) setScheduleOpen(false)
              }}
            >
              <div className="meet-schedule-modal">
                <div className="meet-schedule-head">
                  <div>
                    <span className="meet-hero-eyebrow">
                      <span className="meet-hero-eyebrow-dot" aria-hidden /> Schedule
                    </span>
                    <h2 id="meet-schedule-title" className="meet-schedule-title">
                      Schedule a meeting for <span className="meet-hero-title-accent">later</span>
                    </h2>
                    <p className="meet-schedule-sub">
                      Pick a date and time. We&apos;ll give you a reusable link to share with your team.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="meet-schedule-close"
                    onClick={() => setScheduleOpen(false)}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
              {!scheduledLink ? (
                <form
                  className="meet-landing-schedule-form"
                  onSubmit={(e) => {
                    e.preventDefault()
                    createScheduledMeeting()
                  }}
                >
                  <div className="meet-landing-schedule-fields">
                    <label className="meet-landing-label">
                      Date
                      <input
                        className="meet-landing-input--field"
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        required
                      />
                    </label>
                    <label className="meet-landing-label">
                      Time
                      <input
                        className="meet-landing-input--field"
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        required
                      />
                    </label>
                  </div>
                  <p className="meet-landing-schedule-hint">
                    You will get a meeting link to copy and share. Join when you are ready.
                  </p>
                  <div className="meet-landing-schedule-actions">
                    <button type="button" className="meet-landing-reset" onClick={() => setScheduleOpen(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="meet-landing-primary">
                      Create meeting link
                    </button>
                  </div>
                </form>
              ) : (
                <div className="meet-landing-schedule-result">
                  <p className="meet-landing-schedule-when">
                    {scheduledLink.startsAt && !Number.isNaN(scheduledLink.startsAt.getTime()) ? (
                      <>
                        Planned for{' '}
                        <strong>
                          {scheduledLink.startsAt.toLocaleString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </strong>
                      </>
                    ) : (
                      'Your meeting link is ready to share.'
                    )}
                  </p>
                  <div className="meet-landing-schedule-link-row">
                    <input className="meet-landing-input--field" readOnly value={scheduledLink.url} />
                    <button type="button" className="meet-landing-primary" onClick={() => void copyScheduledLink()}>
                      {scheduleCopied ? 'Copied' : 'Copy link'}
                    </button>
                  </div>
                  <p className="meet-landing-schedule-code">
                    Meeting code: <strong>{scheduledLink.code}</strong>
                  </p>
                  <div className="meet-landing-schedule-actions">
                    <button type="button" className="meet-landing-reset" onClick={() => setScheduleOpen(false)}>
                      Done
                    </button>
                    <button
                      type="button"
                      className="meet-landing-primary"
                      onClick={() => startMeeting(scheduledLink.code, scheduledLink.hostToken)}
                    >
                      Start meeting now
                    </button>
                  </div>
                </div>
              )}
              </div>
            </div>
          ) : null}

          <p className="meet-landing-foot">
            <Link to="/">← Back to workSphere</Link>
          </p>
        </div>
      </div>
    </main>
  )
}
