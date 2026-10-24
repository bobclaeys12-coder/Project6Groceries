import { useMemo, useState } from 'react'
import AfdelingSelect from './AfdelingSelect'
import UnitSelect from './UnitSelect'
import {
  addIngredient,
  deleteIngredient,
  renameIngredient,
  setIngredientCategory,
  setIngredientUnit,
} from '../db/ingredients'
import {
  countWithoutCategory,
  hasCategory,
  NO_CATEGORY,
  queryIngredients,
  type IngredientFilter,
  type IngredientSort,
} from '../core/ingredients'
import { unitLabel } from '../core/units'
import type { CatalogIngredient, Id, IngredientCategory, Unit } from '../core/types'

const PAGE_SIZE = 50

interface Props {
  ingredients: CatalogIngredient[]
  categories: IngredientCategory[]
}

/**
 * Alle ingrediënten: uit de voorbeelden, uit je recepten, je voorraad en je
 * lijst. Vooral bedoeld om de afdeling juist te zetten, zodat je die bij het
 * hergebruiken niet telkens opnieuw moet kiezen.
 */
export default function IngredientManager({ ingredients, categories }: Props) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<IngredientFilter>('alle')
  const [sort, setSort] = useState<IngredientSort>('naam')
  const [limit, setLimit] = useState(PAGE_SIZE)

  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState<Id>(NO_CATEGORY)
  const [newUnit, setNewUnit] = useState<Unit>('st')
  const [error, setError] = useState<string | null>(null)

  const shown = useMemo(
    () => queryIngredients([...ingredients], categories, { search, filter, sort }),
    [ingredients, categories, search, filter, sort],
  )
  const withoutCount = countWithoutCategory(ingredients, categories)
  const ownCount = ingredients.filter((i) => i.isSeed === 0).length

  const add = async () => {
    try {
      await addIngredient(newName, newCategory, newUnit)
      setNewName('')
      setNewCategory(NO_CATEGORY)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Toevoegen is niet gelukt.')
    }
  }

  const FILTERS: [IngredientFilter, string][] = [
    ['alle', `Alle (${ingredients.length})`],
    ['zonder-afdeling', `Zonder afdeling (${withoutCount})`],
    ['zelf-toegevoegd', `Zelf toegevoegd (${ownCount})`],
  ]

  return (
    <section className="stack">
      <p className="small muted" style={{ margin: 0 }}>
        Alle ingrediënten uit je recepten, voorraad en lijst. De afdeling die je hier kiest,
        wordt voortaan automatisch ingevuld, en ook doorgevoerd in je recepten, je voorraad en
        wat nog op de lijst staat.
      </p>

      <div className="card stack stack--tight" style={{ padding: '0.75rem' }}>
        <strong className="small">Nieuw ingrediënt</strong>
        <input
          className="input"
          placeholder="Naam"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void add()
          }}
          aria-label="Naam van het nieuwe ingrediënt"
        />
        <div className="row row--wrap">
          <AfdelingSelect value={newCategory} categories={categories} onChange={setNewCategory} />
          <UnitSelect value={newUnit} onChange={setNewUnit} ariaLabel="Gebruikelijke eenheid" />
          <button
            type="button"
            className="btn btn--primary"
            onClick={add}
            disabled={!newName.trim()}
          >
            Voeg toe
          </button>
        </div>
        {error && (
          <p className="small" style={{ color: 'var(--red)', margin: 0 }}>
            {error}
          </p>
        )}
      </div>

      <input
        className="input search"
        type="search"
        placeholder="Zoek een ingrediënt"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          setLimit(PAGE_SIZE)
        }}
        aria-label="Zoek een ingrediënt"
      />

      <div className="row row--wrap" role="group" aria-label="Filter">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            className={`btn btn--small ${filter === key ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => {
              setFilter(key)
              setLimit(PAGE_SIZE)
            }}
          >
            {label}
          </button>
        ))}
        <span className="spacer" />
        <select
          className="select"
          style={{ width: 'auto' }}
          value={sort}
          aria-label="Sorteren"
          onChange={(e) => setSort(e.target.value as IngredientSort)}
        >
          <option value="naam">Op naam</option>
          <option value="afdeling">Op afdeling (zonder eerst)</option>
        </select>
      </div>

      {shown.length === 0 ? (
        <div className="card empty" style={{ padding: '1.25rem' }}>
          <p style={{ margin: 0 }}>
            {filter === 'zonder-afdeling' && !search
              ? 'Elk ingrediënt heeft een afdeling. 🎉'
              : 'Geen ingrediënten gevonden.'}
          </p>
        </div>
      ) : (
        <ul className="list">
          {shown.slice(0, limit).map((ingredient) => (
            <IngredientRow
              key={ingredient.id}
              ingredient={ingredient}
              categories={categories}
            />
          ))}
        </ul>
      )}

      {shown.length > limit && (
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => setLimit((current) => current + PAGE_SIZE)}
        >
          Toon meer ({shown.length - limit} resterend)
        </button>
      )}
    </section>
  )
}

function IngredientRow({
  ingredient,
  categories,
}: {
  ingredient: CatalogIngredient
  categories: IngredientCategory[]
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(ingredient.name)
  const [unit, setUnit] = useState<Unit>(ingredient.defaultUnit)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const missing = !hasCategory(ingredient.categoryId, categories)

  const save = async () => {
    try {
      if (name.trim() !== ingredient.name) await renameIngredient(ingredient.id, name)
      if (unit !== ingredient.defaultUnit) await setIngredientUnit(ingredient.id, unit)
      setEditing(false)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bewaren is niet gelukt.')
    }
  }

  return (
    <li className={missing ? 'ingredient-row is-missing' : 'ingredient-row'}>
      <div className="list-item">
        <div className="list-item__body">
          <div className="list-item__title">{ingredient.name}</div>
          <div className="list-item__sub">
            {unitLabel(ingredient.defaultUnit)}
            {ingredient.isSeed === 0 && ' · zelf toegevoegd'}
          </div>
        </div>
        <AfdelingSelect
          className="ingredient-row__afdeling"
          value={ingredient.categoryId}
          categories={categories}
          onChange={(categoryId) => void setIngredientCategory(ingredient.id, categoryId)}
          ariaLabel={`Afdeling van ${ingredient.name}`}
        />
        <button
          type="button"
          className="btn btn--small btn--ghost btn--icon"
          onClick={() => {
            setName(ingredient.name)
            setUnit(ingredient.defaultUnit)
            setEditing(!editing)
          }}
          aria-label={`${ingredient.name} aanpassen`}
          aria-expanded={editing}
        >
          ✏️
        </button>
      </div>

      {editing && (
        <div
          className="stack stack--tight"
          style={{ padding: '0.75rem', background: 'var(--surface-sunken)' }}
        >
          <div className="row row--wrap">
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Naam"
            />
            <UnitSelect value={unit} onChange={setUnit} ariaLabel="Gebruikelijke eenheid" />
          </div>
          {error && (
            <p className="small" style={{ color: 'var(--red)', margin: 0 }}>
              {error}
            </p>
          )}
          {confirmDelete ? (
            <div className="row row--wrap">
              <span className="small">
                Uit de lijst halen? Recepten, voorraad en boodschappenlijst houden het gewoon.
              </span>
              <button
                type="button"
                className="btn btn--small btn--danger"
                onClick={() => void deleteIngredient(ingredient.id)}
              >
                Verwijder
              </button>
              <button
                type="button"
                className="btn btn--small btn--ghost"
                onClick={() => setConfirmDelete(false)}
              >
                Annuleer
              </button>
            </div>
          ) : (
            <div className="row">
              <button type="button" className="btn btn--small btn--primary" onClick={save}>
                Bewaar
              </button>
              <button
                type="button"
                className="btn btn--small btn--ghost"
                onClick={() => setEditing(false)}
              >
                Annuleer
              </button>
              <span className="spacer" />
              <button
                type="button"
                className="btn btn--small btn--ghost"
                onClick={() => setConfirmDelete(true)}
              >
                🗑 Verwijder
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  )
}
