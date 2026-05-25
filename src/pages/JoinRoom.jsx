import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fetchApi, fetchApiJson } from '../utils/apiFetch.js'
import { getCurrentUser } from '../utils/auth.js'
import { loadCollabIdentity, saveCollabIdentity } from '../utils/collabIdentity.js'

function initialJoinSetupName() {
  if (loadCollabIdentity()) return ''
  const u = getCurrentUser()
  return u?.name ?? ''
}

function initialJoinSetupEmail() {
  if (loadCollabIdentity()) return ''
  const u = getCurrentUser()
  return u?.email ?? ''
}

export default function JoinRoom() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [preview, setPreview] = useState(null)
  const [previewError, setPreviewError] = useState(null)
  const [serverOk, setServerOk] = useState(null)
  const [identity, setIdentity] = useState(() => loadCollabIdentity())
  const [setupName, setSetupName] = useState(initialJoinSetupName)
  const [setupEmail, setSetupEmail] = useState(initialJoinSetupEmail)
  const [joinError, setJoinError] = useState(null)
  const [joining, setJoining] = useState(false)

  const checkServer = useCallback(async () => {
    try {
      const res = await fetchApi('/api/health')
      setServerOk(res.ok)
      return res.ok
    } catch {
      setServerOk(false)
      return false
    }
  }, [])

  const loadPreview = useCallback(async () => {
    if (!token) return
    const online = await checkServer()
    if (!online) {
      setPreviewError(
        'Cannot reach the workSphere server. The person who shared this link must keep npm run dev running on their computer, and your phone must use the same Wi‑Fi.',
      )
      setPreview(null)
      return
    }
    try {
      setPreviewError(null)
      const data = await fetchApiJson(`/api/collab/invite/${encodeURIComponent(token)}`)
      setPreview(data)
    } catch (err) {
      if (err?.reason === 'invalid_invite' || err?.status === 404) {
        setPreviewError('This invite link is invalid or expired.')
      } else {
        setPreviewError('Could not load this invite. Tap “Try again” below.')
      }
      setPreview(null)
    }
  }, [token, checkServer])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) void loadPreview()
    })
    return () => {
      cancelled = true
    }
  }, [loadPreview])

  function onSetupSubmit(e) {
    e.preventDefault()
    const name = setupName.trim()
    const email = setupEmail.trim().toLowerCase()
    if (!name || !email) return
    saveCollabIdentity(name, email)
    setIdentity({ name, email, source: 'session' })
  }

  function onUseDifferentEmail() {
    const prev = identity
    setIdentity(null)
    setSetupName(prev?.name ?? '')
    setSetupEmail('')
    setJoinError(null)
  }

  async function onJoin() {
    if (!identity || !token) return
    if (preview?.full) return
    setJoining(true)
    setJoinError(null)
    try {
      const online = await checkServer()
      if (!online) {
        setJoinError('Could not reach the server. Check your connection and try again.')
        setJoining(false)
        return
      }
      const data = await fetchApiJson('/api/collab/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          email: identity.email,
          name: identity.name,
        }),
      })
      const roomId = data.roomId
      if (roomId) {
        navigate(`/?slack_room=${roomId}`, { replace: true })
      } else {
        navigate('/?slack=picker', { replace: true })
      }
    } catch (err) {
      if (err?.reason === 'room_full') {
        const cap = Number.isFinite(Number(err.memberLimit)) ? err.memberLimit : 200
        setJoinError(`This channel is full (${cap} people max).`)
      } else if (err?.reason === 'invalid_invite') {
        setJoinError('This invite link is no longer valid.')
      } else {
        setJoinError('Could not join. Check Wi‑Fi and try again.')
      }
    }
    setJoining(false)
  }

  return (
    <main id="main" className="join-room-page">
      <div className="join-room-card">
        <Link className="join-room-back" to="/">
          ← Back to workSphere
        </Link>
        <h1 className="join-room-title">Join a channel</h1>
        <p className="join-room-wifi-hint">
          Use the <strong>same Wi‑Fi</strong> as the computer running workSphere. Open this exact link on your phone or
          laptop.
        </p>
        {previewError ? (
          <div className="join-room-error-block">
            <p className="join-room-error">{previewError}</p>
            <button type="button" className="slack-btn slack-btn-secondary join-room-retry" onClick={() => void loadPreview()}>
              Try again
            </button>
          </div>
        ) : null}
        {preview && !previewError ? (
          <>
            <p className="join-room-lead">
              You’ve been invited to <strong>#{preview.name}</strong>
            </p>
            <p className="join-room-meta">
              {preview.memberCount} member{preview.memberCount === 1 ? '' : 's'} · max{' '}
              {Number.isFinite(Number(preview.memberLimit)) ? preview.memberLimit : 200}
            </p>
            {preview.full ? (
              <p className="join-room-error">This channel is full. Ask the host to create a new one.</p>
            ) : null}
          </>
        ) : null}

        {!identity ? (
          <form className="join-room-form" onSubmit={onSetupSubmit}>
            <p className="join-room-form-intro">Enter your name and email to join this channel.</p>
            <label className="slack-label">
              Your name
              <input
                className="slack-input join-room-input"
                value={setupName}
                onChange={(e) => setSetupName(e.target.value)}
                placeholder="Alex"
                required
                autoFocus
              />
            </label>
            <label className="slack-label">
              Email
              <input
                className="slack-input join-room-input"
                type="email"
                value={setupEmail}
                onChange={(e) => setSetupEmail(e.target.value)}
                placeholder="you@email.com"
                required
              />
            </label>
            <button type="submit" className="slack-btn slack-btn-primary join-room-btn" disabled={serverOk === false}>
              Continue
            </button>
          </form>
        ) : (
          <div className="join-room-actions">
            <p className="join-room-as">
              Joining as <strong>{identity.name}</strong> ({identity.email})
            </p>
            <p className="join-room-change-row">
              <button type="button" className="join-room-change-email" onClick={onUseDifferentEmail}>
                Use a different email
              </button>
            </p>
            {joinError ? <p className="join-room-error">{joinError}</p> : null}
            <div className="join-room-btn-row">
              <button
                type="button"
                className="slack-btn slack-btn-primary join-room-btn join-room-btn--half"
                disabled={!preview || preview.full || joining || serverOk === false}
                onClick={() => void onJoin()}
              >
                {joining ? 'Joining…' : 'Join channel'}
              </button>
              <button
                type="button"
                className="slack-btn slack-btn-ghost join-room-btn join-room-btn--half"
                disabled={joining}
                onClick={() => navigate('/', { replace: true })}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
