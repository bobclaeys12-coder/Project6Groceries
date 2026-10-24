import { useEffect, useState } from 'react'
import { usePageHeader } from '../components/AppLayout'
import CategoryManager from '../components/CategoryManager'
import {
  useIngredientCatalog,
  useIngredientCategories,
  useRecipeCategories,
  useRecipes,
} from '../hooks/useData'
import { deviceName, setDeviceName } from '../db/device'
import { resetDatabase } from '../db/init'
import { SCHEMA_VERSION } from '../core/types'

type Tab = 'afdelingen' | 'receptcategorieen' | 'gegevens'

export default function Settings() {
  usePageHeader('Instellingen')

  const [tab, setTab] = useState<Tab>('afdelingen')
  const ingredientCategories = useIngredientCategories()
  const recipeCategories = useRecipeCategories()
  const ingredients = useIngredientCatalog()
  const recipes = useRecipes()

  const [name, setName] = useState('')
  const [savedName, setSavedName] = useState('')
  const [resetting, setResetting] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  useEffect(() => {
    const current = deviceName()
    setName(current)
    setSavedName(current)
  }, [])

  const saveName = async () => {
    await setDeviceName(name)
    setSavedName(deviceName())
  }

  const doReset = async () => {
    setResetting(true)
    try {
      await resetDatabase()
      window.location.reload()
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="stack">
      <div className="row row--wrap" role="tablist">
        {(
          [
            ['afdelingen', 'Afdelingen'],
            ['receptcategorieen', 'Receptcategorieën'],
            ['gegevens', 'Gegevens'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`btn btn--small ${tab === key ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'afdelingen' && (
        <CategoryManager
          kind="ingredient"
          categories={ingredientCategories}
          hint="De afdelingen van de winkel. De volgorde hier geldt als standaard; per winkel kun je een eigen looproute instellen."
        />
      )}

      {tab === 'receptcategorieen' && (
        <CategoryManager
          kind="recipe"
          categories={recipeCategories}
          hint="De indeling van je receptenboek. De volgorde bepaalt hoe ze op de receptenpagina staan."
        />
      )}

      {tab === 'gegevens' && (
        <div className="stack">
          <section className="stack stack--tight">
            <h2 className="section-title">Naam van dit toestel</h2>
            <p className="small muted" style={{ margin: 0 }}>
              Deze naam zie je op het andere toestel tijdens het synchroniseren.
            </p>
            <div className="row">
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-label="Naam van dit toestel"
              />
              <button
                type="button"
                className="btn btn--primary"
                onClick={saveName}
                disabled={!name.trim() || name === savedName}
              >
                Bewaar
              </button>
            </div>
          </section>

          <section className="stack stack--tight">
            <h2 className="section-title">Wat staat er op dit toestel</h2>
            <ul className="list">
              <li className="list-item">
                <span className="list-item__body">Recepten</span>
                <span className="badge">{recipes.length}</span>
              </li>
              <li className="list-item">
                <span className="list-item__body">Ingrediënten in de catalogus</span>
                <span className="badge">{ingredients.length}</span>
              </li>
              <li className="list-item">
                <span className="list-item__body">Afdelingen</span>
                <span className="badge">{ingredientCategories.length}</span>
              </li>
              <li className="list-item">
                <span className="list-item__body">Receptcategorieën</span>
                <span className="badge">{recipeCategories.length}</span>
              </li>
              <li className="list-item">
                <span className="list-item__body">Gegevensversie</span>
                <span className="badge">v{SCHEMA_VERSION}</span>
              </li>
            </ul>
          </section>

          <section className="stack stack--tight">
            <h2 className="section-title">Alles wissen</h2>
            <p className="small muted" style={{ margin: 0 }}>
              Verwijdert alle gegevens op dit toestel en zet de voorbeelden terug. Dit kan niet
              ongedaan gemaakt worden, en het verwijdert niets op je andere toestellen — bij de
              volgende synchronisatie komt hun versie gewoon terug.
            </p>
            {confirmReset ? (
              <div className="row row--wrap">
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={doReset}
                  disabled={resetting}
                >
                  {resetting ? 'Bezig…' : 'Ja, wis alles'}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setConfirmReset(false)}
                >
                  Annuleer
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => setConfirmReset(true)}
              >
                Alles wissen en opnieuw beginnen
              </button>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
