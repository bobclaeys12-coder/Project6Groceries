import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { initDatabase } from './db/init'

const container = document.getElementById('root')
if (!container) throw new Error('Geen #root element gevonden in index.html')
const root = createRoot(container)

root.render(<div className="boot">Bezig met laden…</div>)

/**
 * De database moet open zijn voordat er iets getekend wordt: elke pagina leest
 * er meteen uit, en het toestel-id dat de sync nodig heeft komt er ook vandaan.
 */
initDatabase()
  .then(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
    void registerServiceWorker()
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    root.render(
      <div className="boot">
        <div className="boot__error">
          <h2>De app kon niet starten</h2>
          <p>De lokale database ging niet open.</p>
          <p className="small">
            Dit gebeurt vooral in privénavigatie of wanneer de browser opslag blokkeert. Probeer
            een gewoon venster, of sta site-gegevens toe voor deze pagina.
          </p>
          <p className="tiny muted" style={{ marginBottom: 0 }}>
            {message}
          </p>
        </div>
      </div>,
    )
  })

async function registerServiceWorker(): Promise<void> {
  if (!import.meta.env.PROD) return
  try {
    const { registerSW } = await import('virtual:pwa-register')
    registerSW({ immediate: true })
  } catch {
    // Geen service worker is vervelend maar niet fataal: de app werkt verder,
    // alleen offline opstarten valt dan weg.
  }
}
