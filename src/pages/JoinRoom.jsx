import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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
  const [identity, setIdentity] = useState(() => loadCollabIdentity())
  const [setupName, setSetupName] = useState(initialJoinSetupName)
  const [setupEmail, setSetupEmail] = useState(initialJoinSetupEmail)
  const [joinError, setJoinError] = useState(null)
  const [joining, setJoining] = useState(false)

  const loadPreview = useCallback(async () => {
    if (!token) return
    try {
      setPreviewError(null)
      const res = await fetch(`/api/collab/invite/${encodeURIComponent(token)}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPreviewError(
          data.reason === 'invalid_invite' ? 'This invite link is invalid or expired.' : 'Could not load invite.',
        )
        setPreview(null)
        return
      }
      setPreview(data)
    } catch {
      setPreviewError('Could not reach the server. Use npm run dev.')
      setPreview(null)
    }
  }, [token])

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
      const res = await fetch('/api/collab/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          email: identity.email,
          name: identity.name,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.reason === 'room_full') {
          setJoinError('This room has reached the maximum of 200 people.')
        } else {
          setJoinError('Could not join this room.')
        }
        setJoining(false)
        return
      }
      navigate('/?slack=picker', { replace: true })
    } catch {
      setJoinError('Network error. Is the API running?')
    }
    setJoining(false)
  }

  return (
    <main id="main" className="join-room-page">
      <div className="join-room-card">
        <Link className="join-room-back" to="/">
          ← Back to workSphere
        </Link>
        <h1 className="join-room-title">Join a room</h1>
        {previewError ? <p className="join-room-error">{previewError}</p> : null}
        {preview && !previewError ? (
          <>
            <p className="join-room-lead">
              You’ve been invited to <strong>#{preview.name}</strong>
            </p>
            <p className="join-room-meta">
              {preview.memberCount} member{preview.memberCount === 1 ? '' : 's'} · max 200
            </p>
            {preview.full ? (
              <p className="join-room-error">This room is full. Ask the host for a new room.</p>
            ) : null}
          </>
        ) : null}

        {!identity ? (
          <form className="join-room-form" onSubmit={onSetupSubmit}>
            <p className="join-room-form-intro">
              Enter the name and email you want in this room. It can be{' '}
              <strong>different from your workSphere login</strong>—useful when testing on a phone with a second
              email. If you use workSphere on this device, we pre-fill from your account; change anything before
              continuing.
            </p>
            <label className="slack-label">
              Display name
              <input
                className="slack-input"
                value={setupName}
                onChange={(e) => setSetupName(e.target.value)}
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
                required
              />
            </label>
            <button type="submit" className="slack-btn slack-btn-primary join-room-btn">
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
                disabled={!preview || preview.full || joining}
                onClick={() => void onJoin()}
              >
                {joining ? 'Joining…' : 'Accept & join'}
              </button>
              <button
                type="button"
                className="slack-btn slack-btn-ghost join-room-btn join-room-btn--half"
                disabled={joining}
                onClick={() => navigate('/', { replace: true })}
              >
                Decline
              </button>
            </div>
            <p className="join-room-footnote">
              For invitations sent to your email, use the link in the message — you only join after you accept there.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
