import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { usePageHeader } from '../../components/AppLayout'
import IngredientPicker from '../../components/IngredientPicker'
import UnitSelect from '../../components/UnitSelect'
import AfdelingSelect from '../../components/AfdelingSelect'
import { useObjectUrl } from '../../hooks/useObjectUrl'
import {
  useIngredientCatalog,
  useIngredientCategories,
  useRecipe,
  useRecipeCategories,
} from '../../hooks/useData'
import { deleteRecipe, saveRecipe } from '../../db/recipes'
import { newId } from '../../core/ids'
import {
  findCatalogMatch,
  NO_CATEGORY,
  orderRecipeLines,
  RECIPE_LINE_GROUPS,
  recipeLineGroup,
  type RecipeLineGroup,
} from '../../core/ingredients'
import { BASE_PORTIONS, formatNumber, parseAmount } from '../../core/scaling'
import { downscaleImage, formatFileSize } from '../../core/photo'
import type { CatalogIngredient, Id, Unit } from '../../core/types'

/** Tijdens het typen houden we de hoeveelheid als tekst bij: "1," mag bestaan. */
interface EditorLine {
  lineId: string
  ingredientId: Id | null
  name: string
  amountText: string
  unit: Unit
  categoryId: Id
  optional: 0 | 1
}

/** Tussentitels in de editor; gewone ingrediënten hebben er geen nodig. */
const GROUP_TITLES: Record<RecipeLineGroup, string | null> = {
  regular: null,
  basic: 'Basis — standaard uitgevinkt bij klaarmaken',
  optional: 'Optioneel — standaard uitgevinkt bij klaarmaken',
}

const emptyLine = (categoryId: Id): EditorLine => ({
  lineId: newId(),
  ingredientId: null,
  name: '',
  amountText: '',
  unit: 'g',
  categoryId,
  optional: 0,
})

export default function RecipeEditor() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const isNew = !id
  const existing = useRecipe(id)
  const recipeCategories = useRecipeCategories()
  const ingredientCategories = useIngredientCategories()
  const catalog = useIngredientCatalog()

  usePageHeader(isNew ? 'Nieuw recept' : 'Recept bewerken')

  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState<Id>('')
  const [notes, setNotes] = useState('')
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [lines, setLines] = useState<EditorLine[]>([])
  const [steps, setSteps] = useState<string[]>([''])

  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const loadedFrom = useRef<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const photoUrl = useObjectUrl(photo)

  // Bestaand recept in het formulier zetten, precies één keer.
  useEffect(() => {
    if (isNew || !existing || loadedFrom.current === existing.id) return
    loadedFrom.current = existing.id
    setName(existing.name)
    setCategoryId(existing.categoryId)
    setNotes(existing.notes)
    setPhoto(existing.photo)
    setSteps(existing.steps.length > 0 ? existing.steps : [''])
    setLines(
      existing.ingredients.map((line) => ({
        lineId: line.lineId,
        ingredientId: line.ingredientId,
        name: line.name,
        amountText: line.amount === null ? '' : formatNumber(line.amount),
        unit: line.unit,
        categoryId: line.categoryId,
        optional: line.optional === 1 ? 1 : 0,
      })),
    )
  }, [existing, isNew])

  // Startwaarden voor een nieuw recept, zodra de categorieën geladen zijn.
  useEffect(() => {
    if (!isNew || recipeCategories.length === 0 || categoryId) return
    const requested = searchParams.get('categorie')
    const valid = recipeCategories.find((c) => c.id === requested)
    setCategoryId(valid?.id ?? recipeCategories[0]!.id)
  }, [isNew, recipeCategories, categoryId, searchParams])

  useEffect(() => {
    if (!isNew || lines.length > 0) return
    setLines([emptyLine(NO_CATEGORY)])
  }, [isNew, lines.length])

  const updateLine = (lineId: string, changes: Partial<EditorLine>) => {
    setLines((current) =>
      current.map((line) => (line.lineId === lineId ? { ...line, ...changes } : line)),
    )
  }

  const pickIngredient = (lineId: string, item: CatalogIngredient) => {
    // De catalogus weet in welke afdeling het hoort en welke eenheid gebruikelijk is.
    updateLine(lineId, {
      name: item.name,
      ingredientId: item.id,
      categoryId: item.categoryId,
      unit: item.defaultUnit,
    })
  }

  // Gewoon → basis → optioneel staat altijd vast; schuiven kan alleen binnen
  // een groep. Verandert de afdeling of het vinkje, dan verhuist de regel mee.
  const ordered = orderRecipeLines(lines, ingredientCategories)
  const groupOf = (line: EditorLine) => recipeLineGroup(line, ingredientCategories)

  const neighbour = (lineId: string, direction: -1 | 1) => {
    const index = ordered.findIndex((line) => line.lineId === lineId)
    const target = ordered[index + direction]
    return target && groupOf(target) === groupOf(ordered[index]!) ? index + direction : null
  }

  const moveLine = (lineId: string, direction: -1 | 1) => {
    const target = neighbour(lineId, direction)
    if (target === null) return
    const index = target - direction
    const next = [...ordered]
    next[index] = ordered[target]!
    next[target] = ordered[index]!
    setLines(next)
  }

  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= steps.length) return
    const next = [...steps]
    const moved = next[index]!
    next[index] = next[target]!
    next[target] = moved
    setSteps(next)
  }

  const choosePhoto = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    try {
      setPhoto(await downscaleImage(file))
    } catch {
      setError('Deze afbeelding kon niet verwerkt worden. Probeer een andere foto.')
    }
  }

  const save = async () => {
    if (!name.trim()) {
      setError('Geef het recept een naam.')
      return
    }
    if (!categoryId) {
      setError('Kies een categorie.')
      return
    }

    const named = ordered.filter((line) => line.name.trim())
    const badAmount = named.find(
      (line) => line.amountText.trim() !== '' && parseAmount(line.amountText) === null,
    )
    if (badAmount) {
      setError(`De hoeveelheid bij "${badAmount.name}" begrijp ik niet. Probeer bv. 250 of 1,5.`)
      return
    }

    setBusy(true)
    setError(null)
    try {
      const saved = await saveRecipe({
        ...(id ? { id } : {}),
        name,
        categoryId,
        notes,
        photo,
        ingredients: named.map((line) => ({
          lineId: line.lineId,
          ingredientId: line.ingredientId,
          name: line.name,
          amount: parseAmount(line.amountText),
          unit: line.unit,
          categoryId: line.categoryId,
          ...(line.optional === 1 ? { optional: 1 as const } : {}),
        })),
        steps,
      })
      navigate(`/recept/${saved.id}`, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bewaren is niet gelukt.')
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!id) return
    setBusy(true)
    await deleteRecipe(id)
    navigate('/recepten', { replace: true })
  }

  if (!isNew && existing === null) {
    return <p className="muted">Dit recept bestaat niet meer.</p>
  }

  return (
    <div className="stack">
      <div className="card stack" style={{ padding: '0.9rem' }}>
        <div className="field">
          <label htmlFor="recipe-name">Naam</label>
          <input
            id="recipe-name"
            className="input"
            value={name}
            placeholder="bv. Stoofvlees van oma"
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="recipe-category">Categorie</label>
          <select
            id="recipe-category"
            className="select"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            {recipeCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="recipe-notes">Notities</label>
          <textarea
            id="recipe-notes"
            className="textarea"
            value={notes}
            placeholder="Tips, herkomst, waar je op moet letten…"
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        <div className="field">
          <label>Foto</label>
          {photoUrl && <img className="recipe-photo" src={photoUrl} alt="" />}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              void choosePhoto(event.target.files?.[0])
              event.target.value = ''
            }}
          />
          <div className="row row--wrap">
            <button
              type="button"
              className="btn btn--small"
              onClick={() => fileInput.current?.click()}
            >
              {photo ? 'Andere foto' : 'Foto kiezen'}
            </button>
            {photo && (
              <>
                <button
                  type="button"
                  className="btn btn--small btn--danger"
                  onClick={() => setPhoto(null)}
                >
                  Verwijder foto
                </button>
                <span className="tiny muted">{formatFileSize(photo.size)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <h2 className="section-title">
        Ingrediënten
        <span className="muted" style={{ textTransform: 'none', letterSpacing: 0 }}>
          voor {BASE_PORTIONS} personen
        </span>
      </h2>

      {RECIPE_LINE_GROUPS.map((group) => {
        const groupLines = ordered.filter((line) => groupOf(line) === group)
        if (groupLines.length === 0) return null
        const title = GROUP_TITLES[group]
        return (
          <section key={group} className="stack stack--tight">
            {title && <h3 className="section-title">{title}</h3>}
            <ul className="list">
              {groupLines.map((line) => (
                <li key={line.lineId}>
                  <div className="editor-row">
                    <div className="editor-row__move">
                      <button
                        type="button"
                        className="btn btn--small btn--ghost btn--icon"
                        onClick={() => moveLine(line.lineId, -1)}
                        disabled={neighbour(line.lineId, -1) === null}
                        aria-label="Regel omhoog"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn btn--small btn--ghost btn--icon"
                        onClick={() => moveLine(line.lineId, 1)}
                        disabled={neighbour(line.lineId, 1) === null}
                        aria-label="Regel omlaag"
                      >
                        ↓
                      </button>
                    </div>
                    <div className="editor-row__name">
                      <IngredientPicker
                        value={line.name}
                        catalog={catalog}
                        onChange={(value) => {
                          // Volledig uitgetypt in plaats van aangetikt? Dan kent de
                          // catalogus de afdeling ook, en zolang er nog geen
                          // hoeveelheid staat ook de gebruikelijke eenheid.
                          const match = findCatalogMatch(catalog, value)
                          updateLine(
                            line.lineId,
                            match
                              ? {
                                  name: value,
                                  ingredientId: match.id,
                                  categoryId: match.categoryId,
                                  ...(line.amountText.trim() ? {} : { unit: match.defaultUnit }),
                                }
                              : { name: value, ingredientId: null },
                          )
                        }}
                        onPick={(item) => pickIngredient(line.lineId, item)}
                      />
                    </div>
                    <input
                      className="input editor-row__amount"
                      value={line.amountText}
                      placeholder="250"
                      inputMode="decimal"
                      aria-label="Hoeveelheid"
                      onChange={(event) =>
                        updateLine(line.lineId, { amountText: event.target.value })
                      }
                    />
                    <UnitSelect
                      className="editor-row__unit"
                      value={line.unit}
                      onChange={(unit) => updateLine(line.lineId, { unit })}
                    />
                    <AfdelingSelect
                      className="editor-row__category"
                      value={line.categoryId}
                      categories={ingredientCategories}
                      onChange={(categoryId) => updateLine(line.lineId, { categoryId })}
                    />
                    <label
                      className={`editor-row__optional ${line.optional === 1 ? 'is-on' : ''}`}
                      title="Optioneel: staat bij het klaarmaken standaard uitgevinkt"
                    >
                      <input
                        type="checkbox"
                        checked={line.optional === 1}
                        onChange={(event) =>
                          updateLine(line.lineId, { optional: event.target.checked ? 1 : 0 })
                        }
                      />
                      Optioneel
                    </label>
                    <button
                      type="button"
                      className="btn btn--small btn--ghost btn--icon editor-row__remove"
                      onClick={() =>
                        setLines((current) => current.filter((l) => l.lineId !== line.lineId))
                      }
                      aria-label={`${line.name || 'Regel'} verwijderen`}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )
      })}

      <button
        type="button"
        className="btn"
        onClick={() => setLines((current) => [...current, emptyLine(NO_CATEGORY)])}
      >
        ＋ Ingrediënt toevoegen
      </button>
      <p className="tiny muted" style={{ marginTop: '-0.25rem' }}>
        Typ je iets dat nog niet bestaat, dan verschijnt er “nieuw”. Kies de juiste afdeling; het
        ingrediënt wordt bij het bewaren aan de catalogus toegevoegd. Ingrediënten uit een
        basisafdeling en optionele ingrediënten schuiven vanzelf naar onder.
      </p>

      <h2 className="section-title">Bereiding</h2>
      <ul className="list">
        {steps.map((step, index) => (
          <li key={index}>
            <div className="step-row">
              <span className="step-row__number">{index + 1}</span>
              <textarea
                className="textarea"
                value={step}
                placeholder="Beschrijf deze stap…"
                onChange={(event) =>
                  setSteps((current) =>
                    current.map((s, i) => (i === index ? event.target.value : s)),
                  )
                }
              />
              <div className="stack stack--tight">
                <button
                  type="button"
                  className="btn btn--small btn--ghost btn--icon"
                  onClick={() => moveStep(index, -1)}
                  disabled={index === 0}
                  aria-label="Stap omhoog"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn btn--small btn--ghost btn--icon"
                  onClick={() => moveStep(index, 1)}
                  disabled={index === steps.length - 1}
                  aria-label="Stap omlaag"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn btn--small btn--ghost btn--icon"
                  onClick={() => setSteps((current) => current.filter((_, i) => i !== index))}
                  aria-label={`Stap ${index + 1} verwijderen`}
                >
                  ✕
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <button type="button" className="btn" onClick={() => setSteps((current) => [...current, ''])}>
        ＋ Stap toevoegen
      </button>

      {error && (
        <p className="small" style={{ color: 'var(--red)', margin: 0 }}>
          {error}
        </p>
      )}

      <div className="editor-actions">
        <button type="button" className="btn btn--primary" onClick={save} disabled={busy}>
          {busy ? 'Bezig…' : 'Bewaar recept'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => navigate(-1)}>
          Annuleer
        </button>
        <span className="spacer" />
        {!isNew &&
          (confirmDelete ? (
            <>
              <button type="button" className="btn btn--danger btn--small" onClick={remove}>
                Zeker weten?
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={() => setConfirmDelete(false)}
              >
                Nee
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn--danger btn--small"
              onClick={() => setConfirmDelete(true)}
            >
              🗑 Verwijder
            </button>
          ))}
      </div>
    </div>
  )
}
