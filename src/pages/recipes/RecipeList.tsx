import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePageHeader } from '../../components/AppLayout'
import RecipeRow from '../../components/RecipeRow'
import { useRecipeCategories, useRecipes } from '../../hooks/useData'
import { normalizeName } from '../../core/ids'

export default function RecipeList() {
  const { categoryId } = useParams<{ categoryId: string }>()
  const categories = useRecipeCategories()
  const recipes = useRecipes()
  const [query, setQuery] = useState('')

  const category = categories.find((c) => c.id === categoryId)
  usePageHeader(category?.name ?? 'Recepten')

  const search = normalizeName(query)

  const shown = useMemo(() => {
    const inCategory = recipes.filter((recipe) => recipe.categoryId === categoryId)
    if (!search) return inCategory
    return inCategory.filter(
      (recipe) =>
        recipe.nameLower.includes(search) ||
        recipe.ingredients.some((line) => normalizeName(line.name).includes(search)),
    )
  }, [recipes, categoryId, search])

  if (categories.length > 0 && !category) {
    return (
      <div className="card empty">
        <div className="empty__icon" aria-hidden="true">
          🧭
        </div>
        <p>Deze categorie bestaat niet meer.</p>
        <Link className="btn btn--primary" to="/recepten">
          Terug naar de categorieën
        </Link>
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="row">
        <div className="search" style={{ flex: 1 }}>
          <input
            className="input"
            type="search"
            placeholder={`Zoek in ${category?.name ?? 'deze categorie'}`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Zoek een recept"
          />
        </div>
        <Link className="btn btn--primary" to={`/recept/nieuw?categorie=${categoryId}`}>
          <span aria-hidden="true">＋</span> Nieuw
        </Link>
      </div>

      {shown.length === 0 ? (
        <div className="card empty">
          <div className="empty__icon" aria-hidden="true">
            {search ? '🔍' : '📖'}
          </div>
          <p>
            {search
              ? `Geen recept gevonden voor “${query}”.`
              : 'Nog geen recepten in deze categorie.'}
          </p>
          {!search && (
            <Link className="btn btn--primary" to={`/recept/nieuw?categorie=${categoryId}`}>
              Eerste recept toevoegen
            </Link>
          )}
        </div>
      ) : (
        <ul className="list">
          {shown.map((recipe) => (
            <li key={recipe.id}>
              <RecipeRow recipe={recipe} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
