import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageHeader } from '../components/AppLayout'
import IngredientPicker from '../components/IngredientPicker'
import UnitSelect from '../components/UnitSelect'
import {
  useGroceryItems,
  useIngredientCatalog,
  useIngredientCategories,
  usePantryItems,
} from '../hooks/useData'
import {
  addPantryItem,
  pushAllShortfalls,
  pushShortfall,
  removePantryItem,
  stepPantryItem,
  updatePantryItem,
} from '../db/pantry'
import { amountAlreadyOnList, amountToBuy, groupPantry, isBelowTarget } from '../core/pantry'
import { formatAmount, formatNumber, parseAmount, presentAmount } from '../core/scaling'
import type { GroceryItem, Id, IngredientCategory, PantryItem, Unit } from '../core/types'

/** Exacte hoeveelheid, netjes afgerond voor op het scherm. */
function show(amount: number, unit: Unit): string {
  const shown = presentAmount(amount, unit)
  return formatAmount(shown.amount, shown.unit)
}

export default function Pantry() {
  usePageHeader('Voorraad')

  const items = usePantryItems()
  const groceryItems = useGroceryItems()
  const categories = useIngredientCategories()
  const catalog = useIngredientCatalog()

  const [message, setMessage] = useState<string | null>(null)

  const sections = useMemo(() => groupPantry(items, categories), [items, categories])
  const low = items.filter(isBelowTarget)
  const toPush = low.filter((item) => amountToBuy(item, groceryItems) > 0)

  const pushAll = async () => {
    const result = await pushAllShortfalls()
    const total = result.added + result.merged
    setMessage(
      total === 0
        ? 'Alle tekorten stonden al op de lijst.'
        : `${total} ${total === 1 ? 'tekort' : 'tekorten'} op de lijst gezet.`,
    )
  }

  const pushOne = async (item: PantryItem) => {
    const amount = amountToBuy(item, groceryItems)
    await pushShortfall(item.id)
    setMessage(`${item.name}: ${show(amount, item.unit)} op de lijst gezet.`)
  }

  return (
    <div className="stack">
      <AddPantryForm catalog={catalog} categories={categories} />

      {message && (
        <div className="notice notice--ok" role="status">
          <div>{message}</div>
          <Link className="btn btn--small" to="/lijst">
            Naar de lijst
          </Link>
          <button
            type="button"
            className="btn btn--small btn--ghost btn--icon"
            onClick={() => setMessage(null)}
            aria-label="Melding sluiten"
          >
            ✕
          </button>
        </div>
      )}

      {low.length > 0 && (
        <div className="notice notice--warn">
          <div>
            <strong>
              {low.length} {low.length === 1 ? 'item' : 'items'} onder het streefniveau
            </strong>
            {toPush.length === 0 && <div className="small">Alles staat al op de lijst.</div>}
          </div>
          {toPush.length > 0 && (
            <button type="button" className="btn btn--primary" onClick={pushAll}>
              Alle tekorten toevoegen ({toPush.length})
            </button>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <div className="card empty">
          <div className="empty__icon" aria-hidden="true">
            🧺
          </div>
          <p>Je voorraad is nog leeg.</p>
          <p className="small">
            Voeg hierboven toe wat je altijd in huis wilt hebben, met hoeveel je nu hebt en
            hoeveel je wilt hebben.
          </p>
        </div>
      ) : (
        sections.map((section) => (
          <section key={section.categoryId}>
            <h2 className="section-title">
              {section.name}
              <span className="spacer" />
              <span className="muted">{section.items.length}</span>
            </h2>
            <ul className="list">
              {section.items.map((item) => (
                <PantryRow
                  key={item.id}
                  item={item}
                  groceryItems={groceryItems}
                  categories={categories}
                  onPush={() => void pushOne(item)}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}

/* -------------------------------------------------------------- toevoegen */

function AddPantryForm({
  catalog,
  categories,
}: {
  catalog: ReturnType<typeof useIngredientCatalog>
  categories: IngredientCategory[]
}) {
  const [name, setName] = useState('')
  const [ingredientId, setIngredientId] = useState<Id | null>(null)
  const [currentText, setCurrentText] = useState('')
  const [targetText, setTargetText] = useState('')
  const [unit, setUnit] = useState<Unit>('st')
  const [categoryId, setCategoryId] = useState<Id>('')
  const [error, setError] = useState<string | null>(null)

  const activeCategory = categoryId || categories[0]?.id || ''

  const add = async () => {
    if (!name.trim()) return
    const current = currentText.trim() ? parseAmount(currentText) : 0
    const target = parseAmount(targetText)
    if (current === null || target === null) {
      setError('Vul een streefniveau in, en eventueel hoeveel je nu hebt. Bv. 3 of 1,5.')
      return
    }
    try {
      await addPantryItem({ name, ingredientId, categoryId: activeCategory, current, target, unit })
      setName('')
      setIngredientId(null)
      setCurrentText('')
      setTargetText('')
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Toevoegen is niet gelukt.')
    }
  }

  return (
    <div className="card stack stack--tight" style={{ padding: '0.75rem' }}>
      <IngredientPicker
        value={name}
        catalog={catalog}
        placeholder="Wat wil je in huis hebben?"
        onChange={(value) => {
          setName(value)
          setIngredientId(null)
        }}
        onPick={(picked) => {
          setName(picked.name)
          setIngredientId(picked.id)
          setCategoryId(picked.categoryId)
          setUnit(picked.defaultUnit)
        }}
        onSubmit={add}
      />
      <div className="row row--wrap">
        <input
          className="input"
          style={{ maxWidth: '5.5rem' }}
          value={currentText}
          placeholder="Nu"
          inputMode="decimal"
          aria-label="Hoeveel je nu hebt"
          onChange={(event) => setCurrentText(event.target.value)}
        />
        <span className="muted small">van</span>
        <input
          className="input"
          style={{ maxWidth: '5.5rem' }}
          value={targetText}
          placeholder="Streef"
          inputMode="decimal"
          aria-label="Streefniveau"
          onChange={(event) => setTargetText(event.target.value)}
        />
        <UnitSelect value={unit} onChange={setUnit} />
        <select
          className="select"
          value={activeCategory}
          aria-label="Afdeling"
          onChange={(event) => setCategoryId(event.target.value)}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn--primary"
          onClick={add}
          disabled={!name.trim() || !targetText.trim()}
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
  )
}

/* ------------------------------------------------------------------ regel */

interface RowProps {
  item: PantryItem
  groceryItems: GroceryItem[]
  categories: IngredientCategory[]
  onPush: () => void
}

function PantryRow({ item, groceryItems, categories, onPush }: RowProps) {
  const [editing, setEditing] = useState(false)

  const low = isBelowTarget(item)
  const onList = amountAlreadyOnList(item, groceryItems)
  const toBuy = amountToBuy(item, groceryItems)

  if (editing) {
    return (
      <li>
        <PantryEditor item={item} categories={categories} onDone={() => setEditing(false)} />
      </li>
    )
  }

  return (
    <li className={low ? 'pantry-item is-low' : 'pantry-item'}>
      <div className="pantry-item__body">
        <div className="list-item__title">{item.name}</div>
        <div className="list-item__sub">
          streef {formatAmount(item.target, item.unit)}
          {toBuy > 0 && (
            <>
              {' '}
              <span className="badge badge--amber">tekort {show(toBuy, item.unit)}</span>
            </>
          )}
          {onList > 0 && (
            <>
              {' '}
              <span className="badge badge--green">op de lijst {show(onList, item.unit)}</span>
            </>
          )}
        </div>
      </div>

      <div className="pantry-item__stepper">
        <button
          type="button"
          className="pantry-item__step"
          onClick={() => void stepPantryItem(item.id, -1)}
          disabled={item.current <= 0}
          aria-label={`${item.name} minder`}
        >
          −
        </button>
        <span className="pantry-item__value" aria-live="polite">
          {formatNumber(item.current)}
          <span className="small muted"> {item.unit}</span>
        </span>
        <button
          type="button"
          className="pantry-item__step"
          onClick={() => void stepPantryItem(item.id, 1)}
          aria-label={`${item.name} meer`}
        >
          +
        </button>
      </div>

      <button
        type="button"
        className="btn btn--small btn--ghost btn--icon"
        onClick={onPush}
        disabled={toBuy === 0}
        aria-label={`Tekort van ${item.name} op de lijst zetten`}
        title={toBuy === 0 ? 'Niets bij te kopen' : 'Tekort op de lijst zetten'}
      >
        🛒
      </button>
      <button
        type="button"
        className="btn btn--small btn--ghost btn--icon"
        onClick={() => setEditing(true)}
        aria-label={`${item.name} aanpassen`}
        title="Aanpassen"
      >
        ✏️
      </button>
    </li>
  )
}

/* ------------------------------------------------------------- aanpassen */

function PantryEditor({
  item,
  categories,
  onDone,
}: {
  item: PantryItem
  categories: IngredientCategory[]
  onDone: () => void
}) {
  const [name, setName] = useState(item.name)
  const [currentText, setCurrentText] = useState(formatNumber(item.current))
  const [targetText, setTargetText] = useState(formatNumber(item.target))
  const [unit, setUnit] = useState<Unit>(item.unit)
  const [categoryId, setCategoryId] = useState<Id>(item.categoryId)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    const current = parseAmount(currentText)
    const target = parseAmount(targetText)
    if (current === null || target === null) {
      setError('Die hoeveelheid begrijp ik niet. Probeer bv. 3 of 1,5.')
      return
    }
    await updatePantryItem(item.id, { name, current, target, unit, categoryId })
    onDone()
  }

  return (
    <div className="stack stack--tight" style={{ padding: '0.75rem 0.9rem' }}>
      <input
        className="input"
        value={name}
        aria-label="Naam"
        onChange={(event) => setName(event.target.value)}
      />
      <div className="row row--wrap">
        <input
          className="input"
          style={{ maxWidth: '5.5rem' }}
          value={currentText}
          inputMode="decimal"
          aria-label="Hoeveel je nu hebt"
          onChange={(event) => setCurrentText(event.target.value)}
        />
        <span className="muted small">van</span>
        <input
          className="input"
          style={{ maxWidth: '5.5rem' }}
          value={targetText}
          inputMode="decimal"
          aria-label="Streefniveau"
          onChange={(event) => setTargetText(event.target.value)}
        />
        <UnitSelect value={unit} onChange={setUnit} />
        <select
          className="select"
          value={categoryId}
          aria-label="Afdeling"
          onChange={(event) => setCategoryId(event.target.value)}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p className="small" style={{ color: 'var(--red)', margin: 0 }}>
          {error}
        </p>
      )}
      {confirmDelete ? (
        <div className="row">
          <span className="small">{item.name} uit je voorraad halen?</span>
          <span className="spacer" />
          <button
            type="button"
            className="btn btn--small btn--danger"
            onClick={() => void removePantryItem(item.id)}
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
          <button type="button" className="btn btn--small btn--ghost" onClick={onDone}>
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
  )
}
