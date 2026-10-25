import { normalizeName } from './ids'
import type { CatalogIngredient, Id, IngredientCategory } from './types'

/**
 * Een ingrediënt zonder afdeling heeft als categoryId de lege string. Dat is
 * de standaard voor iets nieuws dat je intypt zonder een afdeling te kiezen,
 * zodat je het later in Instellingen → Ingrediënten snel terugvindt en
 * juist zet. Op de lijst komt het onder "Zonder afdeling", helemaal onderaan.
 */
export const NO_CATEGORY = ''

/** Heeft dit id een afdeling die (nog) bestaat? */
export function hasCategory(categoryId: Id, categories: IngredientCategory[]): boolean {
  return categoryId !== NO_CATEGORY && categories.some((c) => c.id === categoryId)
}

/** Hoort dit ingrediënt in een basisafdeling (kruiden, olie, …)? */
export function isBasicCategory(categoryId: Id, categories: IngredientCategory[]): boolean {
  return categories.some((c) => c.id === categoryId && c.basic === 1)
}

/**
 * De drie groepen van een ingrediëntenlijst, in deze volgorde: gewone
 * ingrediënten, dan die uit een basisafdeling, dan de optionele. Optioneel
 * wint: een optioneel kruid staat bij de optionele.
 */
export type RecipeLineGroup = 'regular' | 'basic' | 'optional'

export const RECIPE_LINE_GROUPS: RecipeLineGroup[] = ['regular', 'basic', 'optional']

export function recipeLineGroup(
  line: { categoryId: Id; optional?: 0 | 1 },
  categories: IngredientCategory[],
): RecipeLineGroup {
  if (line.optional === 1) return 'optional'
  return isBasicCategory(line.categoryId, categories) ? 'basic' : 'regular'
}

/**
 * Zet de regels per groep (gewoon → basis → optioneel). Binnen een groep
 * blijft je eigen volgorde staan. De groep wordt bij het tonen berekend, niet
 * bewaard: maak je een afdeling later "basis", dan schuift alles vanzelf mee.
 */
export function orderRecipeLines<T extends { categoryId: Id; optional?: 0 | 1 }>(
  lines: T[],
  categories: IngredientCategory[],
): T[] {
  return RECIPE_LINE_GROUPS.flatMap((group) =>
    lines.filter((line) => recipeLineGroup(line, categories) === group),
  )
}

/** Het catalogusitem met exact deze naam (hoofdletters en spaties tellen niet). */
export function findCatalogMatch(
  catalog: CatalogIngredient[],
  name: string,
): CatalogIngredient | undefined {
  const lower = normalizeName(name)
  if (!lower) return undefined
  return catalog.find((item) => item.nameLower === lower)
}

export type IngredientSort = 'naam' | 'afdeling'
export type IngredientFilter = 'alle' | 'zonder-afdeling' | 'zelf-toegevoegd'

export interface IngredientQuery {
  search: string
  filter: IngredientFilter
  sort: IngredientSort
}

/**
 * De ingrediëntenlijst in Instellingen. Sorteren op afdeling zet alles zonder
 * (geldige) afdeling bovenaan, dan de afdelingen in hun standaardvolgorde;
 * binnen een afdeling op naam.
 */
export function queryIngredients(
  items: CatalogIngredient[],
  categories: IngredientCategory[],
  query: IngredientQuery,
): CatalogIngredient[] {
  const search = normalizeName(query.search)
  const order = new Map(categories.map((c) => [c.id, c.sortOrder]))

  const filtered = items.filter((item) => {
    if (search && !item.nameLower.includes(search)) return false
    if (query.filter === 'zonder-afdeling') return !hasCategory(item.categoryId, categories)
    if (query.filter === 'zelf-toegevoegd') return item.isSeed === 0
    return true
  })

  const byName = (a: CatalogIngredient, b: CatalogIngredient) =>
    a.nameLower.localeCompare(b.nameLower)

  if (query.sort === 'naam') return filtered.sort(byName)

  // Zonder afdeling krijgt -1, zodat die bovenaan staan.
  const rank = (item: CatalogIngredient) => order.get(item.categoryId) ?? -1
  return filtered.sort((a, b) => rank(a) - rank(b) || byName(a, b))
}

/** Aantal ingrediënten zonder (geldige) afdeling; voor de teller op de filterknop. */
export function countWithoutCategory(
  items: CatalogIngredient[],
  categories: IngredientCategory[],
): number {
  return items.filter((item) => !hasCategory(item.categoryId, categories)).length
}
