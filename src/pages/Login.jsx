import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { setCurrentUser } from '../utils/auth.js'
import workSphereLogo from '../assets/worksphere-logo.png'

function WorkSphereLogo() {
  return (
    <div className="login-logo" aria-label="workSphere">
      <span className="login-logo-mark login-logo-mark--img" aria-hidden="true">
        <img className="login-logo-img" src={workSphereLogo} alt="" />
      </span>
      <span className="login-logo-text">workSphere</span>
    </div>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const justRegistered = searchParams.get('registered') === '1'
  const signupEmail = searchParams.get('email') ?? ''

  const [email, setEmail] = useState(signupEmail)
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [status, setStatus] = useState('idle')
  const [showRegisteredBanner] = useState(justRegistered)

  useEffect(() => {
    if (!justRegistered) return
    const next = new URLSearchParams(searchParams)
    next.delete('registered')
    next.delete('email')
    setSearchParams(next, { replace: true })
  }, [justRegistered, searchParams, setSearchParams])

  const canContinue = useMemo(
    () => email.trim().length > 0 && password.length > 0,
    [email, password],
  )

  async function onSubmit(e) {
    e.preventDefault()
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      setStatus('missing')
      return
    }

    try {
      const r = await fetch('/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok || !data.ok) {
        if (data.reason === 'invalid_credentials') setStatus('invalid')
        else if (data.reason === 'password_not_set') setStatus('no_password')
        else if (data.reason === 'missing_fields') setStatus('missing')
        else setStatus('server')
        return
      }

      setCurrentUser(data.user, { remember })
      setStatus('idle')
      navigate('/')
    } catch {
      setStatus('network')
    }
  }

  return (
    <main className="login">
      <div className="login-illustration left" aria-hidden="true">
        <div className="illus-scene">
          <div className="illus-card"></div>
          <div className="illus-floor"></div>
          <div className="illus-people"></div>
        </div>
      </div>

      <section className="login-card" aria-label="Sign in">
        <WorkSphereLogo />
        <h1 className="login-title">Log in to continue</h1>

        {showRegisteredBanner ? (
          <div className="signup-success" role="status">
            Account saved. Sign in with your email and password to access workSphere.
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="login-form">
          <label className="login-label">
            Email<span aria-hidden="true">*</span>
            <input
              className="login-input"
              type="email"
              name="email"
              autoComplete="username"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setStatus('idle')
              }}
              required
            />
          </label>

          <label className="login-label">
            Password<span aria-hidden="true">*</span>
            <input
              className="login-input"
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setStatus('idle')
              }}
              required
            />
          </label>

          <label className="login-remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Remember me <span className="login-info" aria-hidden="true">i</span>
          </label>

          {status === 'missing' ? (
            <div className="signup-alert" role="alert">
              Enter both email and password.
            </div>
          ) : null}

          {status === 'invalid' ? (
            <div className="signup-alert" role="alert">
              Invalid email or password. Try again or <Link to="/signup">sign up</Link>.
            </div>
          ) : null}

          {status === 'no_password' ? (
            <div className="signup-alert" role="alert">
              This email has no password set yet. Use <Link to="/signup">Sign up</Link> with the same
              email to create a password, or use a different account.
            </div>
          ) : null}

          {status === 'server' ? (
            <div className="signup-alert" role="alert">
              Something went wrong on the server. Restart with <code className="login-code">npm run dev</code>{' '}
              (starts the API and the site together) and try again.
            </div>
          ) : null}

          {status === 'network' ? (
            <div className="signup-alert" role="alert">
              Cannot reach the API (is it running on port 8787?). Run{' '}
              <code className="login-code">npm run dev</code> — it starts both the server and Vite.
            </div>
          ) : null}

          <button className="login-continue" type="submit" disabled={!canContinue}>
            Continue
          </button>
        </form>

        <div className="signup-bottom">
          New user? <Link to="/signup">Sign up</Link>
        </div>
      </section>

      <div className="login-illustration right" aria-hidden="true">
        <div className="illus-scene">
          <div className="illus-card"></div>
          <div className="illus-floor"></div>
          <div className="illus-people alt"></div>
        </div>
      </div>
    </main>
  )
}
