import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchApi, parseApiJson } from '../utils/apiFetch.js'
import { useApiReady } from '../utils/useApiReady.js'
import AuthServiceBanner, { AuthServiceError } from '../components/AuthServiceBanner.jsx'
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
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const { state: apiState, recheck } = useApiReady()

  const canContinue = useMemo(
    () =>
      name.trim().length > 0 &&
      email.trim().length > 0 &&
      password.length >= MIN_PASSWORD_LEN &&
      confirmPassword.length > 0 &&
      apiState !== 'misconfigured' &&
      !submitting,
    [name, email, password, confirmPassword, apiState, submitting],
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
    if (apiState === 'misconfigured') {
      setStatus('service')
      return
    }

    setSubmitting(true)
    setStatus('idle')

    try {
      if (apiState !== 'ready') {
        const ok = await recheck()
        if (!ok) {
          setStatus('service')
          setSubmitting(false)
          return
        }
      }

      const r = await fetchApi(
        '/api/signup',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        },
        { attempts: 3, delayMs: 2000 },
      )
      const data = await parseApiJson(r)

      if (!r.ok || !data.ok) {
        if (data.reason === 'exists') setStatus('exists')
        else if (data.reason === 'weak_password') setStatus('weak')
        else if (data.reason === 'missing_fields') setStatus('invalid')
        else if (data.reason === 'server_error') setStatus('server')
        else setStatus('server')
        setSubmitting(false)
        return
      }

      const qs = new URLSearchParams()
      qs.set('registered', '1')
      qs.set('email', data.user.email)
      navigate(`/login?${qs.toString()}`, { replace: true })
    } catch (err) {
      if (err?.code === 'api_not_configured' || err?.code === 'invalid_api_response') {
        setStatus('service')
      } else {
        setStatus('network')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const formDisabled = apiState === 'misconfigured'

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

        <AuthServiceBanner apiState={apiState} onRetry={() => void recheck()} />

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
              disabled={formDisabled}
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
              disabled={formDisabled}
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
              disabled={formDisabled}
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
              disabled={formDisabled}
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

          <AuthServiceError status={status} onRetry={() => void recheck()} />

          <button
            className="login-continue"
            type="submit"
            disabled={!canContinue || apiState === 'checking'}
          >
            {submitting ? 'Creating account…' : apiState === 'checking' ? 'Connecting…' : 'Sign up'}
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
