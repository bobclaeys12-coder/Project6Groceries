import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePageHeader } from '../../components/AppLayout'
import { useObjectUrl } from '../../hooks/useObjectUrl'
import PrepareForList from './PrepareForList'
import { useIngredientCategories, useRecipe, useRecipeCategories } from '../../hooks/useData'
import { orderRecipeLines, RECIPE_LINE_GROUPS, recipeLineGroup } from '../../core/ingredients'
import type { RecipeLineGroup } from '../../core/ingredients'
import {
  BASE_PORTIONS,
  MAX_PORTIONS,
  MIN_PORTIONS,
  formatAmount,
  scaleIngredients,
} from '../../core/scaling'

const PRESETS = [2, 4, 6, 8]

const GROUP_TITLES: Record<RecipeLineGroup, string | null> = {
  regular: null,
  basic: 'Basis',
  optional: 'Optioneel',
}

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>()
  const recipe = useRecipe(id)
  const categories = useRecipeCategories()
  const ingredientCategories = useIngredientCategories()
  const [portions, setPortions] = useState(BASE_PORTIONS)
  const [addResult, setAddResult] = useState<{ added: number; merged: number } | null>(null)
  // Pas na "Klaarmaken" kun je iets op de lijst zetten.
  const [preparing, setPreparing] = useState(false)

  usePageHeader(recipe?.name ?? 'Recept')
  const photoUrl = useObjectUrl(recipe?.photo)

  // Gewoon → basis → optioneel, altijd bij het tonen berekend.
  const scaled = useMemo(
    () =>
      recipe
        ? orderRecipeLines(
            scaleIngredients(recipe.ingredients, portions, recipe.basePortions),
            ingredientCategories,
          )
        : [],
    [recipe, portions, ingredientCategories],
  )

  if (recipe === undefined) {
    return <p className="muted">Bezig met laden…</p>
  }

  if (recipe === null) {
    return (
      <div className="card empty">
        <div className="empty__icon" aria-hidden="true">
          🧭
        </div>
        <p>Dit recept bestaat niet meer.</p>
        <Link className="btn btn--primary" to="/recepten">
          Terug naar de recepten
        </Link>
      </div>
    )
  }

  const categoryName = categories.find((c) => c.id === recipe.categoryId)?.name

  return (
    <div className="stack">
      {photoUrl && <img className="recipe-photo" src={photoUrl} alt={recipe.name} />}

      <div className="row row--wrap">
        {categoryName && <span className="badge badge--green">{categoryName}</span>}
        <span className="badge">{recipe.ingredients.length} ingrediënten</span>
        <span className="spacer" />
        <Link className="btn btn--small" to={`/recept/${recipe.id}/bewerken`}>
          ✏️ Bewerk
        </Link>
      </div>

      {recipe.notes && <p className="small muted">{recipe.notes}</p>}

      <div className="card portions">
        <div className="portions__value">
          <b>{portions}</b>
          <span>{portions === 1 ? 'persoon' : 'personen'}</span>
          <span className="spacer" />
          {portions !== BASE_PORTIONS && (
            <button
              type="button"
              className="btn btn--small btn--ghost"
              onClick={() => setPortions(BASE_PORTIONS)}
            >
              Terug naar {BASE_PORTIONS}
            </button>
          )}
        </div>

        <input
          type="range"
          min={MIN_PORTIONS}
          max={MAX_PORTIONS}
          step={1}
          value={portions}
          onChange={(event) => setPortions(Number(event.target.value))}
          aria-label="Aantal personen"
        />

        <div className="portions__presets">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={`portions__preset ${portions === preset ? 'is-active' : ''}`}
              onClick={() => setPortions(preset)}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {!preparing && (
        <button
          type="button"
          className="btn btn--primary btn--block"
          onClick={() => {
            setAddResult(null)
            setPreparing(true)
          }}
          disabled={recipe.ingredients.length === 0}
        >
          📝 Klaarmaken voor boodschappenlijst
        </button>
      )}

      {addResult && (
        <div className="notice notice--ok">
          <div>
            {addResult.added > 0 && (
              <>
                <b>{addResult.added}</b> {addResult.added === 1 ? 'regel' : 'regels'} toegevoegd
              </>
            )}
            {addResult.added > 0 && addResult.merged > 0 && ', '}
            {addResult.merged > 0 && (
              <>
                <b>{addResult.merged}</b> samengeteld met wat er al stond
              </>
            )}
            {addResult.added === 0 && addResult.merged === 0 && 'Er was niets toe te voegen.'}
          </div>
          <Link className="btn btn--small" to="/lijst">
            Bekijk lijst
          </Link>
        </div>
      )}

      <h2 className="section-title">Ingrediënten</h2>
      {preparing ? (
        <PrepareForList
          recipe={recipe}
          portions={portions}
          scaled={scaled}
          onSent={(result) => {
            setAddResult(result)
            setPreparing(false)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          onCancel={() => setPreparing(false)}
        />
      ) : (
        RECIPE_LINE_GROUPS.map((group) => {
          const groupLines = scaled.filter(
            (line) => recipeLineGroup(line, ingredientCategories) === group,
          )
          if (groupLines.length === 0) return null
          const title = GROUP_TITLES[group]
          return (
            <section key={group} className="stack stack--tight">
              {title && <h3 className="section-title">{title}</h3>}
              <ul className="list">
                {groupLines.map((line) => (
                  <li key={line.lineId}>
                    <div className="ingredient-line">
                      <span className="ingredient-line__amount">
                        {formatAmount(line.displayAmount, line.displayUnit)}
                      </span>
                      <span className="ingredient-line__name">
                        {line.name}
                        {line.note && (
                          <span className="ingredient-line__note"> — {line.note}</span>
                        )}
                      </span>
                      {group === 'optional' && (
                        <span className="badge badge--amber">optioneel</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )
        })
      )}
      <p className="tiny muted">
        Ingevoerd voor {recipe.basePortions} personen; hoeveelheden schalen mee en worden
        afgerond op iets wat je kunt afwegen.
      </p>

      {recipe.steps.length > 0 && (
        <>
          <h2 className="section-title">Bereiding</h2>
          <ol className="steps">
            {recipe.steps.map((step, index) => (
              <li key={index}>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  )
}
