import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

const HeaderContext = createContext<((title: string) => void) | null>(null)

/**
 * Zet de titel in de balk bovenaan. Pagina's roepen dit aan in plaats van zelf
 * een koptekst te tekenen, zodat de balk overal even hoog blijft en netjes
 * blijft plakken.
 *
 * Bewust alleen een string: een ReactNode als knop zou bij elke render een
 * nieuw object zijn, waardoor het effect telkens opnieuw zou vuren. Knoppen
 * horen dus in de pagina zelf, waar ze ook een ruimere tapzone krijgen.
 */
export function usePageHeader(title: string): void {
  const setTitle = useContext(HeaderContext)
  useEffect(() => {
    setTitle?.(title)
  }, [setTitle, title])
}

const NAV_ITEMS = [
  { to: '/', icon: '🏠', label: 'Start', end: true },
  { to: '/recepten', icon: '📖', label: 'Recepten', end: false },
  { to: '/lijst', icon: '🛒', label: 'Lijst', end: false },
  { to: '/voorraad', icon: '🧺', label: 'Voorraad', end: false },
  { to: '/sync', icon: '🔄', label: 'Sync', end: false },
]

const SIDEBAR_ITEMS = [
  ...NAV_ITEMS.slice(0, 3),
  { to: '/winkels', icon: '🏬', label: 'Winkels', end: false },
  ...NAV_ITEMS.slice(3),
  { to: '/instellingen', icon: '⚙️', label: 'Instellingen', end: false },
]

export default function AppLayout() {
  const [title, setTitle] = useState('Recepten & Boodschappen')
  const location = useLocation()
  const navigate = useNavigate()

  const setTitleStable = useCallback((next: string) => setTitle(next), [])

  const isHome = location.pathname === '/'

  return (
    <HeaderContext.Provider value={setTitleStable}>
      <div className="app">
        <aside className="app__sidebar">
          <div className="app__brand">
            <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" />
            <span>Boodschappen</span>
          </div>
          <nav>
            {SIDEBAR_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end}>
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <div>
          <header className="app__header">
            {!isHome && (
              <button
                type="button"
                className="app__header-action"
                onClick={() => navigate(-1)}
                aria-label="Terug"
              >
                ←
              </button>
            )}
            <h1>{title}</h1>
          </header>

          <main className="app__main">
            <Outlet />
          </main>
        </div>

        <nav className="app__nav" aria-label="Hoofdnavigatie">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              <span className="app__nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </HeaderContext.Provider>
  )
}
