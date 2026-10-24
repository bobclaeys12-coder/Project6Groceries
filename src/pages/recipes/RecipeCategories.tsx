import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageHeader } from '../../components/AppLayout'
import RecipeRow from '../../components/RecipeRow'
import { useRecipeCategories, useRecipes } from '../../hooks/useData'
import { normalizeName } from '../../core/ids'

export default function RecipeCategories() {
  usePageHeader('Recepten')

  const categories = useRecipeCategories()
  const recipes = useRecipes()
  const [query, setQuery] = useState('')

  const search = normalizeName(query)

  /**
   * Zoeken kijkt ook in de ingrediënten, zodat "witloof" je de gerechten
   * oplevert waar witloof in zit en niet alleen het recept dat zo heet.
   */
  const matches = useMemo(() => {
    if (!search) return []
    return recipes.filter(
      (recipe) =>
        recipe.nameLower.includes(search) ||
        recipe.ingredients.some((line) => normalizeName(line.name).includes(search)),
    )
  }, [recipes, search])

  const countByCategory = useMemo(() => {
    const counts = new Map<string, number>()
    for (const recipe of recipes) {
      counts.set(recipe.categoryId, (counts.get(recipe.categoryId) ?? 0) + 1)
    }
    return counts
  }, [recipes])

  const categoryNames = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  )

  return (
    <div className="stack">
      <div className="row">
        <div className="search" style={{ flex: 1 }}>
          <input
            className="input"
            type="search"
            placeholder="Zoek op recept of ingrediënt"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Zoek een recept"
          />
        </div>
        <Link className="btn btn--primary" to="/recept/nieuw">
          <span aria-hidden="true">＋</span> Nieuw
        </Link>
      </div>

      {search ? (
        matches.length > 0 ? (
          <>
            <h2 className="section-title">
              {matches.length} {matches.length === 1 ? 'resultaat' : 'resultaten'}
            </h2>
            <ul className="list">
              {matches.map((recipe) => (
                <li key={recipe.id}>
                  <RecipeRow
                    recipe={recipe}
                    subtitle={categoryNames.get(recipe.categoryId) ?? 'Zonder categorie'}
                  />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="card empty">
            <div className="empty__icon" aria-hidden="true">
              🔍
            </div>
            <p style={{ marginBottom: 0 }}>Geen recept gevonden voor “{query}”.</p>
          </div>
        )
      ) : (
        <>
          <h2 className="section-title">Categorieën</h2>
          <ul className="list">
            {categories.map((category) => {
              const count = countByCategory.get(category.id) ?? 0
              return (
                <li key={category.id}>
                  <Link className="list-item" to={`/recepten/${category.id}`}>
                    <div className="list-item__body">
                      <div className="list-item__title">{category.name}</div>
                      <div className="list-item__sub">
                        {count === 0
                          ? 'Nog geen recepten'
                          : `${count} ${count === 1 ? 'recept' : 'recepten'}`}
                      </div>
                    </div>
                    <span className="chevron" aria-hidden="true">
                      ›
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>

          <p className="tiny muted">
            Categorieën toevoegen of hernoemen doe je bij Instellingen.
          </p>
        </>
      )}
    </div>
  )
}
