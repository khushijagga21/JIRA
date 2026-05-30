import {
  getApiProblemMessage,
  getLocalDevHint,
  isProductionFrontend,
} from '../utils/apiStatus.js'

export default function AuthServiceBanner({ apiState, onRetry }) {
  if (apiState === 'checking') {
    return (
      <div className="signup-info" role="status">
        Connecting to workSphere…
      </div>
    )
  }
  if (apiState === 'ready') return null
  if (apiState === 'misconfigured') {
    return (
      <div className="signup-alert" role="alert">
        {getApiProblemMessage('misconfigured')}
        {!isProductionFrontend() ? <> {getLocalDevHint()}</> : null}
      </div>
    )
  }
  if (apiState === 'offline') {
    return (
      <div className="signup-alert" role="alert">
        {getApiProblemMessage('offline')}{' '}
        <button type="button" className="login-retry" onClick={onRetry}>
          Try again
        </button>
      </div>
    )
  }
  return null
}

export function AuthServiceError({ status, onRetry }) {
  if (status !== 'server' && status !== 'network' && status !== 'service') return null
  return (
    <div className="signup-alert" role="alert">
      {getApiProblemMessage(status === 'server' ? 'server' : 'offline')}
      {!isProductionFrontend() ? (
        <> {getLocalDevHint()}</>
      ) : (
        <>
          {' '}
          <button type="button" className="login-retry" onClick={onRetry}>
            Try again
          </button>
        </>
      )}
    </div>
  )
}
