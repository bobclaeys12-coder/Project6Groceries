import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import Home from './pages/Home'
import RecipeCategories from './pages/recipes/RecipeCategories'
import RecipeList from './pages/recipes/RecipeList'
import RecipeDetail from './pages/recipes/RecipeDetail'
import RecipeEditor from './pages/recipes/RecipeEditor'
import GroceryList from './pages/GroceryList'
import ShopList from './pages/shops/ShopList'
import Pantry from './pages/Pantry'
import Settings from './pages/Settings'
import NotFound from './pages/NotFound'

// De sync trekt PeerJS en de QR-bibliotheken mee; die laden pas als je de
// pagina opent, zodat de rest van de app sneller start. De service worker
// bewaart ze toch, dus offline openen blijft werken.
const Sync = lazy(() => import('./pages/Sync'))
// Idem voor de winkelpagina: slepen en de plattegrond hoeven niet bij het opstarten.
const ShopRouteEditor = lazy(() => import('./pages/shops/ShopRouteEditor'))

/**
 * HashRouter in plaats van BrowserRouter: op GitHub Pages staat de app onder
 * /Project6Groceries/ en is er geen server die onbekende paden naar index.html
 * stuurt. Met een hash-route lost de browser alles zelf op, ook wanneer de app
 * als geinstalleerde PWA start.
 */
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/recepten" element={<RecipeCategories />} />
          <Route path="/recepten/:categoryId" element={<RecipeList />} />
          <Route path="/recept/nieuw" element={<RecipeEditor />} />
          <Route path="/recept/:id" element={<RecipeDetail />} />
          <Route path="/recept/:id/bewerken" element={<RecipeEditor />} />
          <Route path="/lijst" element={<GroceryList />} />
          <Route path="/winkels" element={<ShopList />} />
          <Route
            path="/winkels/:shopId"
            element={
              <Suspense fallback={<p className="small muted">Laden…</p>}>
                <ShopRouteEditor />
              </Suspense>
            }
          />
          <Route path="/voorraad" element={<Pantry />} />
          <Route
            path="/sync"
            element={
              <Suspense fallback={<p className="small muted">Laden…</p>}>
                <Sync />
              </Suspense>
            }
          />
          <Route path="/instellingen" element={<Settings />} />
          <Route path="/index.html" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
