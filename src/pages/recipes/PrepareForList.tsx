import { useState } from 'react'
import IngredientPicker from '../../components/IngredientPicker'
import UnitSelect from '../../components/UnitSelect'
import AfdelingSelect from '../../components/AfdelingSelect'
import { useIngredientCatalog, useIngredientCategories } from '../../hooks/useData'
import { addPreparedRecipeToGroceryList, type AddResult } from '../../db/grocery'
import { newId } from '../../core/ids'
import { findCatalogMatch, isBasicCategory, NO_CATEGORY } from '../../core/ingredients'
import { formatNumber, parseAmount } from '../../core/scaling'
import { unitLabel } from '../../core/units'
import type { PrepChoice, PrepExtra } from '../../core/prep'
import type { ScaledIngredient } from '../../core/scaling'
import type { Id, Recipe, Unit } from '../../core/types'

interface LineState {
  checked: boolean
  /** undefined = niet aangeraakt; dan gaat de exacte geschaalde hoeveelheid mee */
  amountText?: string
}

interface ExtraRow {
  key: string
  name: string
  ingredientId: Id | null
  amountText: string
  unit: Unit
  categoryId: Id
}

interface Props {
  recipe: Recipe
  portions: number
  scaled: ScaledIngredient[]
  onSent: (result: AddResult) => void
  onCancel: () => void
}

const emptyExtra = (): ExtraRow => ({
  key: newId(),
  name: '',
  ingredientId: null,
  amountText: '',
  unit: 'st',
  categoryId: NO_CATEGORY,
})

/**
 * De ingrediënten van een recept, klaar om aan te passen voor deze ene keer:
 * afvinken wat je niet nodig hebt, hoeveelheden aanpassen en extra's
 * toevoegen. Wat je hier doet, raakt het recept zelf nooit.
 */
export default function PrepareForList({ recipe, portions, scaled, onSent, onCancel }: Props) {
  const catalog = useIngredientCatalog()
  const categories = useIngredientCategories()

  const [lines, setLines] = useState<Record<string, LineState>>({})
  const [extras, setExtras] = useState<ExtraRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Ingrediënten uit een basisafdeling (kruiden, olie, …) heb je meestal in
  // huis; die staan standaard uitgevinkt, maar je kunt ze gewoon aanvinken.
  const basicLines = new Set(
    scaled.filter((line) => isBasicCategory(line.categoryId, categories)).map((l) => l.lineId),
  )
  const lineState = (lineId: string): LineState =>
    lines[lineId] ?? { checked: !basicLines.has(lineId) }
  const setLine = (lineId: string, changes: Partial<LineState>) =>
    setLines((current) => ({ ...current, [lineId]: { ...lineState(lineId), ...changes } }))

  const setExtra = (key: string, changes: Partial<ExtraRow>) =>
    setExtras((current) => current.map((row) => (row.key === key ? { ...row, ...changes } : row)))

  const checkedCount =
    scaled.filter((line) => lineState(line.lineId).checked).length +
    extras.filter((row) => row.name.trim()).length

  const send = async () => {
    const choices: Record<string, PrepChoice> = {}
    for (const line of scaled) {
      const state = lineState(line.lineId)
      const edited = state.amountText !== undefined
      if (edited && state.amountText!.trim() && parseAmount(state.amountText!) === null) {
        setError(`De hoeveelheid bij "${line.name}" begrijp ik niet. Probeer bv. 250 of 1,5.`)
        return
      }
      choices[line.lineId] = {
        checked: state.checked,
        edited,
        amount: edited ? parseAmount(state.amountText!) : null,
      }
    }

    const prepExtras: PrepExtra[] = []
    for (const row of extras) {
      if (!row.name.trim()) continue
      if (row.amountText.trim() && parseAmount(row.amountText) === null) {
        setError(`De hoeveelheid bij "${row.name}" begrijp ik niet. Probeer bv. 250 of 1,5.`)
        return
      }
      prepExtras.push({
        name: row.name,
        ingredientId: row.ingredientId,
        amount: parseAmount(row.amountText),
        unit: row.unit,
        categoryId: row.categoryId,
      })
    }

    setBusy(true)
    setError(null)
    try {
      onSent(await addPreparedRecipeToGroceryList(recipe, portions, choices, prepExtras))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <p className="small muted" style={{ margin: 0 }}>
        Vink uit wat je al in huis hebt, pas hoeveelheden aan en voeg toe wat je er deze keer
        bij wilt. Ingrediënten uit een basisafdeling staan al uitgevinkt. Het recept zelf
        blijft zoals het is.
      </p>

      <ul className="list prep">
        {scaled.map((line) => {
          const state = lineState(line.lineId)
          const shownText =
            state.amountText ??
            (line.displayAmount === null ? '' : formatNumber(line.displayAmount))
          return (
            <li key={line.lineId} className={state.checked ? undefined : 'is-unchecked'}>
              <label className="prep__row">
                <input
                  type="checkbox"
                  className="prep__check"
                  checked={state.checked}
                  onChange={(event) => setLine(line.lineId, { checked: event.target.checked })}
                />
                <input
                  className="input prep__amount"
                  value={shownText}
                  inputMode="decimal"
                  aria-label={`Hoeveelheid ${line.name}`}
                  disabled={!state.checked}
                  onChange={(event) => setLine(line.lineId, { amountText: event.target.value })}
                />
                <span className="prep__unit">{unitLabel(line.displayUnit)}</span>
                <span className="prep__name">
                  {line.name}
                  {line.note && <span className="ingredient-line__note"> — {line.note}</span>}
                </span>
                {basicLines.has(line.lineId) && (
                  <span className="badge" title="Uit een basisafdeling: standaard uitgevinkt">
                    basis
                  </span>
                )}
              </label>
            </li>
          )
        })}
      </ul>

      {extras.length > 0 && (
        <section className="stack stack--tight">
          <h3 className="section-title">Extra voor deze keer</h3>
          {extras.map((row) => (
            <div key={row.key} className="card stack stack--tight" style={{ padding: '0.6rem' }}>
              <IngredientPicker
                value={row.name}
                catalog={catalog}
                placeholder="Extra ingrediënt"
                onChange={(value) => {
                  const match = findCatalogMatch(catalog, value)
                  setExtra(
                    row.key,
                    match
                      ? { name: value, ingredientId: match.id, categoryId: match.categoryId }
                      : { name: value, ingredientId: null },
                  )
                }}
                onPick={(item) =>
                  setExtra(row.key, {
                    name: item.name,
                    ingredientId: item.id,
                    categoryId: item.categoryId,
                    unit: item.defaultUnit,
                  })
                }
              />
              <div className="row row--wrap">
                <input
                  className="input"
                  style={{ maxWidth: '5.5rem' }}
                  value={row.amountText}
                  placeholder="Aantal"
                  inputMode="decimal"
                  aria-label="Hoeveelheid"
                  onChange={(event) => setExtra(row.key, { amountText: event.target.value })}
                />
                <UnitSelect value={row.unit} onChange={(unit) => setExtra(row.key, { unit })} />
                <AfdelingSelect
                  value={row.categoryId}
                  categories={categories}
                  onChange={(categoryId) => setExtra(row.key, { categoryId })}
                />
                <button
                  type="button"
                  className="btn btn--small btn--ghost btn--icon"
                  onClick={() => setExtras((current) => current.filter((r) => r.key !== row.key))}
                  aria-label="Extra ingrediënt weghalen"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <button
        type="button"
        className="btn btn--ghost"
        onClick={() => setExtras((current) => [...current, emptyExtra()])}
      >
        + Extra ingrediënt
      </button>

      {error && (
        <p className="small" style={{ color: 'var(--red)', margin: 0 }}>
          {error}
        </p>
      )}

      <button
        type="button"
        className="btn btn--primary btn--block"
        onClick={send}
        disabled={busy || checkedCount === 0}
      >
        🛒 Zet op boodschappenlijst ({portions} {portions === 1 ? 'persoon' : 'personen'})
      </button>
      <button type="button" className="btn btn--ghost btn--block" onClick={onCancel}>
        Annuleer
      </button>
    </div>
  )
}
