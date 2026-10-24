import { Link } from 'react-router-dom'
import { usePageHeader } from '../components/AppLayout'
import {
  useGroceryItems,
  usePantryItems,
  useRecipes,
  useShops,
} from '../hooks/useData'

export default function Home() {
  usePageHeader('Recepten & Boodschappen')

  const recipes = useRecipes()
  const grocery = useGroceryItems()
  const pantry = usePantryItems()
  const shops = useShops()

  const toBuy = grocery.filter((g) => g.checked === 0).length
  const shortages = pantry.filter((p) => p.current < p.target).length

  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

  return (
    <div className="stack">
      <div className="tiles">
        <Link className="tile" to="/recepten">
          <span className="tile__icon" aria-hidden="true">
            📖
          </span>
          <span className="tile__title">Recepten</span>
          <span className="tile__sub">{plural(recipes.length, 'recept', 'recepten')}</span>
        </Link>

        <Link className="tile" to="/lijst">
          <span className="tile__icon" aria-hidden="true">
            🛒
          </span>
          <span className="tile__title">Boodschappenlijst</span>
          <span className="tile__sub">
            {toBuy === 0 ? 'Niets te kopen' : plural(toBuy, 'item te kopen', 'items te kopen')}
          </span>
        </Link>

        <Link className="tile" to="/winkels">
          <span className="tile__icon" aria-hidden="true">
            🏬
          </span>
          <span className="tile__title">Winkels</span>
          <span className="tile__sub">
            {shops.length === 0
              ? 'Nog geen winkel ingesteld'
              : plural(shops.length, 'winkel', 'winkels')}
          </span>
        </Link>

        <Link className="tile" to="/voorraad">
          <span className="tile__icon" aria-hidden="true">
            🧺
          </span>
          <span className="tile__title">Voorraad</span>
          <span className="tile__sub">
            {pantry.length === 0
              ? 'Nog niets in voorraad'
              : shortages > 0
                ? `${plural(shortages, 'tekort', 'tekorten')}`
                : 'Alles op peil'}
          </span>
        </Link>

        <Link className="tile" to="/sync">
          <span className="tile__icon" aria-hidden="true">
            🔄
          </span>
          <span className="tile__title">Synchroniseren</span>
          <span className="tile__sub">Met een ander toestel</span>
        </Link>

        <Link className="tile" to="/instellingen">
          <span className="tile__icon" aria-hidden="true">
            ⚙️
          </span>
          <span className="tile__title">Instellingen</span>
          <span className="tile__sub">Categorieën en gegevens</span>
        </Link>
      </div>

      <p className="tiny muted" style={{ marginTop: '1rem' }}>
        Alles staat lokaal op dit toestel en werkt zonder internet. Gebruik
        Synchroniseren om je gegevens met een ander toestel gelijk te zetten.
      </p>
    </div>
  )
}
