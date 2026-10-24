import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageHeader } from '../components/AppLayout'
import IngredientPicker from '../components/IngredientPicker'
import UnitSelect from '../components/UnitSelect'
import { useLocalPreference } from '../hooks/useLocalPreference'
import {
  useGroceryItems,
  useIngredientCatalog,
  useIngredientCategories,
  useShops,
} from '../hooks/useData'
import {
  addManualGroceryItem,
  clearCheckedItems,
  removeGroceryItem,
  toggleGroceryItem,
  uncheckAll,
  updateGroceryItem,
} from '../db/grocery'
import { describeSources } from '../core/grocery'
import { sortGroceryList } from '../core/sorting'
import { formatAmount, formatNumber, parseAmount, presentAmount } from '../core/scaling'
import type { GroceryItem, Id, Unit } from '../core/types'

export default function GroceryList() {
  usePageHeader('Boodschappenlijst')

  const items = useGroceryItems()
  const categories = useIngredientCategories()
  const catalog = useIngredientCatalog()
  const shops = useShops()

  const [shopId, setShopId] = useLocalPreference('selectedShop', '')
  const [editingId, setEditingId] = useState<Id | null>(null)

  // Nieuwe regel
  const [name, setName] = useState('')
  const [ingredientId, setIngredientId] = useState<Id | null>(null)
  const [amountText, setAmountText] = useState('')
  const [unit, setUnit] = useState<Unit>('st')
  const [categoryId, setCategoryId] = useState<Id>('')
  const [error, setError] = useState<string | null>(null)

  const shop = shops.find((s) => s.id === shopId) ?? null
  const defaultCategory = categories[0]?.id ?? ''
  const activeCategory = categoryId || defaultCategory

  const sorted = useMemo(
    () => sortGroceryList(items, categories, shop),
    [items, categories, shop],
  )

  const openCount = items.filter((item) => item.checked === 0).length

  const add = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (amountText.trim() && parseAmount(amountText) === null) {
      setError('Die hoeveelheid begrijp ik niet. Probeer bv. 500 of 1,5.')
      return
    }
    setError(null)
    await addManualGroceryItem({
      name: trimmed,
      ingredientId,
      amount: parseAmount(amountText),
      unit,
      categoryId: activeCategory,
    })
    setName('')
    setIngredientId(null)
    setAmountText('')
  }

  return (
    <div className="stack">
      <div className="card stack stack--tight" style={{ padding: '0.75rem' }}>
        <div className="row">
          <IngredientPicker
            value={name}
            catalog={catalog}
            placeholder="Wat heb je nodig?"
            onChange={(value) => {
              setName(value)
              setIngredientId(null)
            }}
            onPick={(item) => {
              setName(item.name)
              setIngredientId(item.id)
              setCategoryId(item.categoryId)
              setUnit(item.defaultUnit)
            }}
            onSubmit={add}
          />
        </div>
        <div className="row">
          <input
            className="input"
            style={{ maxWidth: '5.5rem' }}
            value={amountText}
            placeholder="Aantal"
            inputMode="decimal"
            aria-label="Hoeveelheid"
            onChange={(event) => setAmountText(event.target.value)}
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
            disabled={!name.trim()}
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

      {shops.length > 0 && (
        <div className="row">
          <label htmlFor="shop" className="small muted" style={{ whiteSpace: 'nowrap' }}>
            Winkel
          </label>
          <select
            id="shop"
            className="select"
            value={shopId}
            onChange={(event) => setShopId(event.target.value)}
          >
            <option value="">Geen winkel gekozen</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {shop && (
            <Link
              to={`/winkels/${shop.id}`}
              className="btn btn--small btn--ghost"
              style={{ whiteSpace: 'nowrap' }}
            >
              Route
            </Link>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <div className="card empty">
          <div className="empty__icon" aria-hidden="true">
            🛒
          </div>
          <p>Je lijst is leeg.</p>
          <p className="small">
            Voeg hierboven iets toe, of zet de ingrediënten van een recept erop.
          </p>
          <Link className="btn btn--primary" to="/recepten">
            Naar de recepten
          </Link>
        </div>
      ) : (
        <>
          {openCount === 0 && sorted.checked.length > 0 && (
            <div className="card empty" style={{ padding: '1.25rem' }}>
              <p style={{ marginBottom: 0 }}>Alles afgevinkt. 🎉</p>
            </div>
          )}

          {sorted.sections.map((section) => (
            <section key={section.categoryId}>
              <h2 className="section-title">
                {section.name}
                {section.unplaced && shop && (
                  <Link
                    to={`/winkels/${shop.id}`}
                    className="badge badge--amber"
                    title="Nog geen plaats in deze winkel — tik om de looproute in te stellen"
                  >
                    nog te plaatsen
                  </Link>
                )}
                <span className="spacer" />
                <span className="muted">{section.items.length}</span>
              </h2>
              <ul className="list">
                {section.items.map((item) => (
                  <GroceryRow
                    key={item.id}
                    item={item}
                    categories={categories}
                    editing={editingId === item.id}
                    onEdit={() => setEditingId(editingId === item.id ? null : item.id)}
                    onDoneEditing={() => setEditingId(null)}
                  />
                ))}
              </ul>
            </section>
          ))}

          {sorted.checked.length > 0 && (
            <section>
              <h2 className="section-title">
                In de kar
                <span className="spacer" />
                <span className="muted">{sorted.checked.length}</span>
              </h2>
              <ul className="list">
                {sorted.checked.map((item) => (
                  <GroceryRow
                    key={item.id}
                    item={item}
                    categories={categories}
                    editing={editingId === item.id}
                    onEdit={() => setEditingId(editingId === item.id ? null : item.id)}
                    onDoneEditing={() => setEditingId(null)}
                  />
                ))}
              </ul>
              <div className="row row--wrap" style={{ marginTop: '0.6rem' }}>
                <button
                  type="button"
                  className="btn btn--small btn--danger"
                  onClick={() => void clearCheckedItems()}
                >
                  🗑 Verwijder afgevinkte ({sorted.checked.length})
                </button>
                <button
                  type="button"
                  className="btn btn--small btn--ghost"
                  onClick={() => void uncheckAll()}
                >
                  Alles terugzetten
                </button>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

interface RowProps {
  item: GroceryItem
  categories: { id: Id; name: string }[]
  editing: boolean
  onEdit: () => void
  onDoneEditing: () => void
}

function GroceryRow({ item, categories, editing, onEdit, onDoneEditing }: RowProps) {
  const shown = presentAmount(item.amount, item.unit)
  const sourceText = describeSources(item.sources)

  const [amountText, setAmountText] = useState(
    item.amount === null ? '' : formatNumber(item.amount),
  )
  const [unit, setUnit] = useState<Unit>(item.unit)
  const [categoryId, setCategoryId] = useState<Id>(item.categoryId)

  const save = async () => {
    await updateGroceryItem(item.id, {
      amount: parseAmount(amountText),
      unit,
      categoryId,
    })
    onDoneEditing()
  }

  return (
    <li className={item.checked === 1 ? 'is-checked' : ''}>
      <div className="grocery-item">
        <button
          type="button"
          className={`grocery-item__check ${item.checked === 1 ? 'is-on' : ''}`}
          onClick={() => void toggleGroceryItem(item.id)}
          aria-pressed={item.checked === 1}
          aria-label={item.checked === 1 ? `${item.name} terugzetten` : `${item.name} afvinken`}
        >
          {item.checked === 1 ? '✓' : ''}
        </button>

        <div className="list-item__body">
          <div className="grocery-item__title">
            {shown.amount !== null && (
              <span className="grocery-item__amount">
                {formatAmount(shown.amount, shown.unit)}
              </span>
            )}
            <span>{item.name}</span>
          </div>
          {sourceText && <div className="list-item__sub">{sourceText}</div>}
        </div>

        <button
          type="button"
          className="btn btn--small btn--ghost btn--icon"
          onClick={onEdit}
          aria-label={`${item.name} aanpassen`}
          aria-expanded={editing}
        >
          ✏️
        </button>
      </div>

      {editing && (
        <div className="stack stack--tight" style={{ padding: '0.75rem', background: 'var(--surface-sunken)' }}>
          <div className="row row--wrap">
            <input
              className="input"
              style={{ maxWidth: '5.5rem' }}
              value={amountText}
              inputMode="decimal"
              placeholder="Aantal"
              aria-label="Hoeveelheid"
              onChange={(event) => setAmountText(event.target.value)}
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
          <div className="row row--wrap">
            <button type="button" className="btn btn--small btn--primary" onClick={save}>
              Bewaar
            </button>
            <button type="button" className="btn btn--small btn--ghost" onClick={onDoneEditing}>
              Annuleer
            </button>
            <span className="spacer" />
            <button
              type="button"
              className="btn btn--small btn--danger"
              onClick={() => void removeGroceryItem(item.id)}
            >
              🗑 Verwijder
            </button>
          </div>
        </div>
      )}
    </li>
  )
}
