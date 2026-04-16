import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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

const MIN_PASSWORD_LEN = 8

export default function Signup() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [status, setStatus] = useState('idle')
  const navigate = useNavigate()

  const canContinue = useMemo(
    () =>
      name.trim().length > 0 &&
      email.trim().length > 0 &&
      password.length >= MIN_PASSWORD_LEN &&
      confirmPassword.length > 0,
    [name, email, password, confirmPassword],
  )

  async function onSubmit(e) {
    e.preventDefault()
    const payload = {
      name: name.trim(),
      email: email.trim(),
      password,
    }
    if (!payload.name || !payload.email || !password) {
      setStatus('invalid')
      return
    }
    if (password.length < MIN_PASSWORD_LEN) {
      setStatus('weak')
      return
    }
    if (password !== confirmPassword) {
      setStatus('mismatch')
      return
    }

    try {
      const r = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok || !data.ok) {
        if (data.reason === 'exists') setStatus('exists')
        else if (data.reason === 'weak_password') setStatus('weak')
        else if (data.reason === 'missing_fields') setStatus('invalid')
        else if (data.reason === 'server_error') setStatus('server')
        else setStatus('server')
        return
      }

      const qs = new URLSearchParams()
      qs.set('registered', '1')
      qs.set('email', data.user.email)
      navigate(`/login?${qs.toString()}`, { replace: true })
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

      <section className="login-card" aria-label="Sign up">
        <WorkSphereLogo />
        <h1 className="login-title">Sign up to continue</h1>

        <form onSubmit={onSubmit} className="login-form">
          <label className="login-label">
            Name
            <input
              className="login-input"
              type="text"
              name="name"
              autoComplete="name"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setStatus('idle')
              }}
              required
            />
          </label>

          <label className="login-label">
            Email
            <input
              className="login-input"
              type="email"
              name="email"
              autoComplete="email"
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
            Password
            <input
              className="login-input"
              type="password"
              name="password"
              autoComplete="new-password"
              placeholder={`At least ${MIN_PASSWORD_LEN} characters`}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setStatus('idle')
              }}
              required
              minLength={MIN_PASSWORD_LEN}
            />
          </label>

          <label className="login-label">
            Confirm password
            <input
              className="login-input"
              type="password"
              name="confirm-password"
              autoComplete="new-password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                setStatus('idle')
              }}
              required
            />
          </label>

          <p className="signup-legal">
            By signing up, I accept the{' '}
            <a className="signup-link" href="#">
              workSphere Cloud Terms of Service
            </a>{' '}
            and acknowledge the{' '}
            <a className="signup-link" href="#">
              Privacy Policy
            </a>
            .
          </p>

          {status === 'exists' ? (
            <div className="signup-alert" role="alert">
              This user already exists. Please <Link to="/login">sign in</Link>.
            </div>
          ) : null}

          {status === 'invalid' ? (
            <div className="signup-alert" role="alert">
              Please enter a valid name, email, and password.
            </div>
          ) : null}

          {status === 'weak' ? (
            <div className="signup-alert" role="alert">
              Password must be at least {MIN_PASSWORD_LEN} characters.
            </div>
          ) : null}

          {status === 'mismatch' ? (
            <div className="signup-alert" role="alert">
              Passwords do not match.
            </div>
          ) : null}

          {status === 'server' ? (
            <div className="signup-alert" role="alert">
              Something went wrong on the server. Run <code className="login-code">npm run dev</code>{' '}
              (API + Vite) and try again.
            </div>
          ) : null}

          {status === 'network' ? (
            <div className="signup-alert" role="alert">
              Cannot reach the API. Run <code className="login-code">npm run dev</code> — it starts the
              server on port 8787 and Vite together.
            </div>
          ) : null}

          <button className="login-continue" type="submit" disabled={!canContinue}>
            Sign up
          </button>
        </form>

        <div className="signup-bottom">
          Already have a workSphere account? <Link to="/login">Log in</Link>
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
