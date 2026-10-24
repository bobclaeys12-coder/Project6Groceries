import { Link } from 'react-router-dom'
import { useObjectUrl } from '../hooks/useObjectUrl'
import type { Recipe } from '../core/types'

interface Props {
  recipe: Recipe
  /** bv. de categorienaam, als die niet uit de context blijkt */
  subtitle?: string
}

export default function RecipeRow({ recipe, subtitle }: Props) {
  const photoUrl = useObjectUrl(recipe.photo)

  const parts = [
    `${recipe.ingredients.length} ingrediënten`,
    recipe.steps.length > 0 ? `${recipe.steps.length} stappen` : null,
  ].filter(Boolean)

  return (
    <Link className="list-item" to={`/recept/${recipe.id}`}>
      {photoUrl ? (
        <img className="recipe-photo recipe-photo--small" src={photoUrl} alt="" />
      ) : (
        <div className="recipe-photo recipe-photo--small" aria-hidden="true" />
      )}
      <div className="list-item__body">
        <div className="list-item__title">{recipe.name}</div>
        <div className="list-item__sub">{subtitle ?? parts.join(' · ')}</div>
      </div>
      <span className="chevron" aria-hidden="true">
        ›
      </span>
    </Link>
  )
}
