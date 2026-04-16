import { Link } from 'react-router-dom'
import Everything from './Everything.jsx'

export default function AllFeatures() {
  return (
    <main id="main" className="all-features-main">
      <div className="container">
        <div className="all-features-toolbar">
          <Link className="all-features-back" to="/">
            ← Back to home
          </Link>
        </div>
        <Everything variant="page" />
      </div>
    </main>
  )
}
