import { Link } from 'react-router-dom'
import { usePageHeader } from '../components/AppLayout'

export default function NotFound() {
  usePageHeader('Pagina niet gevonden')
  return (
    <div className="card empty">
      <div className="empty__icon" aria-hidden="true">
        🧭
      </div>
      <h2 style={{ margin: '0.5rem 0 0.75rem', color: 'var(--text)' }}>
        Deze pagina bestaat niet
      </h2>
      <Link className="btn btn--primary" to="/">
        Terug naar start
      </Link>
    </div>
  )
}
