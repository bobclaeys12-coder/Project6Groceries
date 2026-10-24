import type { GroceryItem, Id, IngredientCategory, Shop } from './types'

export interface GrocerySection {
  categoryId: Id
  name: string
  items: GroceryItem[]
  /** Deze afdeling heeft nog geen plaats in de looproute van de gekozen winkel. */
  unplaced: boolean
}

export interface SortedGroceryList {
  sections: GrocerySection[]
  /** Afgevinkte items, altijd onderaan en los van de afdelingen. */
  checked: GroceryItem[]
}

const UNKNOWN_CATEGORY = 'Zonder afdeling'

/**
 * Zet de boodschappenlijst in de volgorde waarin je door de winkel loopt.
 *
 * - Met een winkel gekozen: de afdelingen volgen de looproute van die winkel.
 *   Afdelingen die daar nog geen plaats in hebben, komen achteraan en worden
 *   gemarkeerd, zodat je ze makkelijk kunt gaan instellen.
 * - Zonder winkel: de standaardvolgorde van de afdelingen.
 * - Afgevinkte items staan altijd onderaan, ongeacht hun afdeling.
 */
export function sortGroceryList(
  items: GroceryItem[],
  categories: IngredientCategory[],
  shop: Shop | null,
): SortedGroceryList {
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  const routePosition = new Map<Id, number>()
  if (shop) {
    shop.categoryOrder.forEach((categoryId, index) => routePosition.set(categoryId, index))
  }

  const byCategory = new Map<Id, GroceryItem[]>()
  const checked: GroceryItem[] = []

  for (const item of items) {
    if (item.checked === 1) {
      checked.push(item)
      continue
    }
    const bucket = byCategory.get(item.categoryId)
    if (bucket) bucket.push(item)
    else byCategory.set(item.categoryId, [item])
  }

  const byName = (a: GroceryItem, b: GroceryItem) => a.nameLower.localeCompare(b.nameLower)

  const sections: GrocerySection[] = [...byCategory.entries()].map(([categoryId, sectionItems]) => ({
    categoryId,
    name: categoryById.get(categoryId)?.name ?? UNKNOWN_CATEGORY,
    items: sectionItems.sort(byName),
    // Zonder (geldige) afdeling is niet "nog te plaatsen": daar valt in een
    // winkel niets te plaatsen. Die sectie komt los helemaal onderaan.
    unplaced: shop !== null && categoryById.has(categoryId) && !routePosition.has(categoryId),
  }))

  sections.sort((a, b) => {
    const aKnown = categoryById.has(a.categoryId)
    const bKnown = categoryById.has(b.categoryId)
    if (aKnown !== bKnown) return aKnown ? -1 : 1

    // Afdelingen zonder plaats in de route belanden achteraan.
    if (a.unplaced !== b.unplaced) return a.unplaced ? 1 : -1

    if (shop && !a.unplaced && !b.unplaced) {
      return (routePosition.get(a.categoryId) ?? 0) - (routePosition.get(b.categoryId) ?? 0)
    }

    const orderA = categoryById.get(a.categoryId)?.sortOrder ?? Number.MAX_SAFE_INTEGER
    const orderB = categoryById.get(b.categoryId)?.sortOrder ?? Number.MAX_SAFE_INTEGER
    if (orderA !== orderB) return orderA - orderB
    return a.name.localeCompare(b.name)
  })

  return { sections, checked: checked.sort(byName) }
}

/** Alle afdelingen die in deze winkel nog geen plaats hebben gekregen. */
export function unplacedCategories(
  categories: IngredientCategory[],
  shop: Shop,
): IngredientCategory[] {
  const placed = new Set(shop.categoryOrder)
  return categories.filter((category) => !placed.has(category.id))
}

/**
 * De looproute opgeschoond: afdelingen die niet meer bestaan vallen weg.
 * Handig na een synchronisatie waarin een ander toestel een afdeling verwijderde.
 */
export function cleanRoute(shop: Shop, categories: IngredientCategory[]): Id[] {
  const known = new Set(categories.map((category) => category.id))
  return shop.categoryOrder.filter((categoryId) => known.has(categoryId))
}
