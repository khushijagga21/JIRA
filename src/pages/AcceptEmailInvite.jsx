import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'

const IDENTITY_KEY = 'slack_collab_identity'

function saveSlackIdentity(name, email) {
  window.sessionStorage.setItem(
    IDENTITY_KEY,
    JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase() }),
  )
}

export default function AcceptEmailInvite() {
  const { token } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const intentDecline = searchParams.get('decline') === '1'

  const [preview, setPreview] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [displayName, setDisplayName] = useState('')
  const [actionError, setActionError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [declinedDone, setDeclinedDone] = useState(false)

  const loadPreview = useCallback(async () => {
    if (!token) return
    try {
      setLoadError(null)
      const res = await fetch(`/api/collab/email-invite/${encodeURIComponent(token)}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setLoadError(
          data.reason === 'invalid_invite' ? 'This invitation is invalid or no longer active.' : 'Could not load invitation.',
        )
        setPreview(null)
        return
      }
      setPreview(data)
    } catch {
      setLoadError('Could not reach the server. Use npm run dev.')
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

  async function onAccept(e) {
    e.preventDefault()
    if (!preview || preview.status !== 'pending' || preview.roomFull) return
    const name = displayName.trim()
    if (!name) return
    setBusy(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/collab/email-invite/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: name }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.reason === 'room_full') {
          setActionError('This room is full (200 people max).')
        } else if (data.reason === 'invite_closed') {
          setActionError('This invitation was already used or closed.')
        } else {
          setActionError('Could not accept invitation.')
        }
        setBusy(false)
        return
      }
      saveSlackIdentity(name, data.joinedAsEmail || preview.inviteeEmail)
      navigate('/?slack=picker', { replace: true })
    } catch {
      setActionError('Network error.')
    }
    setBusy(false)
  }

  async function onDecline() {
    setBusy(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/collab/email-invite/${encodeURIComponent(token)}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        setActionError('Could not record decline.')
        setBusy(false)
        return
      }
      setDeclinedDone(true)
    } catch {
      setActionError('Network error.')
    }
    setBusy(false)
  }

  return (
    <main id="main" className="join-room-page accept-email-page">
      <div className="join-room-card">
        <Link className="join-room-back" to="/">
          ← Back to workSphere
        </Link>
        <h1 className="join-room-title">workSphere invitation</h1>

        {loadError ? <p className="join-room-error">{loadError}</p> : null}

        {declinedDone ? (
          <p className="join-room-lead">You’ve declined. You won’t be added to the room.</p>
        ) : null}

        {preview && !loadError && !declinedDone ? (
          <>
            {preview.status !== 'pending' ? (
              <p className="join-room-error">
                {preview.status === 'accepted'
                  ? 'This invitation was already accepted.'
                  : 'This invitation was declined or is no longer valid.'}
              </p>
            ) : preview.roomFull ? (
              <p className="join-room-error">This room is full (200 people). You can’t join right now.</p>
            ) : (
              <>
                <p className="join-room-lead">
                  <strong>{preview.inviterName}</strong> invited you to <strong>#{preview.roomName}</strong>.
                </p>
                <p className="join-room-meta">
                  Sent to <strong>{preview.inviteeEmail}</strong>. You join only if you accept—ignore or decline to stay out.
                </p>

                {intentDecline ? (
                  <div className="accept-email-actions">
                    <p className="join-room-form-intro">Decline this invitation?</p>
                    {actionError ? <p className="join-room-error">{actionError}</p> : null}
                    <button
                      type="button"
                      className="slack-btn slack-btn-ghost join-room-btn"
                      disabled={busy}
                      onClick={() => void onDecline()}
                    >
                      {busy ? 'Working…' : 'Yes, decline'}
                    </button>
                    <Link className="accept-email-switch" to={`/invite/email/${token}`}>
                      I want to accept instead
                    </Link>
                  </div>
                ) : (
                  <form className="join-room-form" onSubmit={onAccept}>
                    <label className="slack-label">
                      Your name in the room
                      <input
                        className="slack-input"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="e.g. Alex Chen"
                        required
                        autoFocus
                      />
                    </label>
                    {actionError ? <p className="join-room-error">{actionError}</p> : null}
                    <div className="accept-email-row">
                      <button
                        type="button"
                        className="slack-btn slack-btn-ghost"
                        disabled={busy}
                        onClick={() => void onDecline()}
                      >
                        Decline
                      </button>
                      <button type="submit" className="slack-btn slack-btn-primary" disabled={busy}>
                        {busy ? '…' : 'Accept & join'}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </>
        ) : null}
      </div>
    </main>
  )
}
