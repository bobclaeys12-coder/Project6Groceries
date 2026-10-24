import { NO_CATEGORY } from '../core/ingredients'
import type { Id, IngredientCategory } from '../core/types'

interface Props {
  value: Id
  categories: IngredientCategory[]
  onChange: (categoryId: Id) => void
  className?: string
  ariaLabel?: string
}

/**
 * Keuzelijst voor de afdeling van een ingrediënt. "Zonder afdeling" staat er
 * altijd bij: dat is wat iets nieuws krijgt zolang je niets kiest, en ook wat
 * je ziet als de afdeling intussen verwijderd is.
 */
export default function AfdelingSelect({
  value,
  categories,
  onChange,
  className,
  ariaLabel = 'Afdeling',
}: Props) {
  const known = categories.some((c) => c.id === value)
  return (
    <select
      className={`select ${className ?? ''}`}
      value={known ? value : NO_CATEGORY}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value={NO_CATEGORY}>Zonder afdeling</option>
      {categories.map((category) => (
        <option key={category.id} value={category.id}>
          {category.name}
        </option>
      ))}
    </select>
  )
}
