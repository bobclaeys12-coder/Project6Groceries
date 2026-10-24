import { canMerge, toBase, UNIT_INFO } from './units'
import type { GroceryAddition } from './grocery'
import type { GroceryItem, Id, IngredientCategory, PantryItem, Unit } from './types'

/** Kleine marge tegen afrondfouten: 0,1 + 0,2 is niet exact 0,3. */
const EPSILON = 1e-9

/** Hoeveel er nog ontbreekt om het streefniveau te halen; nooit negatief. */
export function pantryShortfall(item: Pick<PantryItem, 'current' | 'target'>): number {
  const missing = item.target - item.current
  return missing > EPSILON ? missing : 0
}

export function isBelowTarget(item: Pick<PantryItem, 'current' | 'target'>): boolean {
  return pantryShortfall(item) > 0
}

/**
 * Hoeveel van dit voorraaditem er al op de boodschappenlijst staat omdat de
 * voorraad het eerder doorduwde, uitgedrukt in de eenheid van het voorraaditem.
 *
 * Ook afgevinkte regels tellen mee: die liggen al in de kar en zitten dus nog
 * niet in de voorraad. Zonder deze telling zou twee keer op de knop drukken
 * twee keer hetzelfde tekort op de lijst zetten.
 */
export function amountAlreadyOnList(item: PantryItem, groceryItems: GroceryItem[]): number {
  let base = 0
  for (const line of groceryItems) {
    if (line.deleted === 1) continue
    for (const source of line.sources) {
      if (source.kind !== 'pantry' || source.pantryItemId !== item.id) continue
      if (source.amount === null || !canMerge(source.unit, item.unit)) continue
      base += toBase(source.amount, source.unit).value
    }
  }
  return base / UNIT_INFO[item.unit].factor
}

/** Wat er nu nog op de lijst moet: het tekort min wat er al op staat. */
export function amountToBuy(item: PantryItem, groceryItems: GroceryItem[]): number {
  const missing = pantryShortfall(item) - amountAlreadyOnList(item, groceryItems)
  return missing > EPSILON ? missing : 0
}

/** De toevoeging voor de boodschappenlijst, of null als er niets meer nodig is. */
export function pantryAddition(
  item: PantryItem,
  groceryItems: GroceryItem[],
  at: number,
): GroceryAddition | null {
  const amount = amountToBuy(item, groceryItems)
  if (amount === 0) return null
  return {
    name: item.name,
    ingredientId: item.ingredientId,
    amount,
    unit: item.unit,
    categoryId: item.categoryId,
    source: { kind: 'pantry', pantryItemId: item.id, amount, unit: item.unit, at },
  }
}

/** Alle tekorten in een keer, voor de knop "alle tekorten toevoegen". */
export function pantryAdditions(
  items: PantryItem[],
  groceryItems: GroceryItem[],
  at: number,
): GroceryAddition[] {
  return items
    .map((item) => pantryAddition(item, groceryItems, at))
    .filter((addition): addition is GroceryAddition => addition !== null)
}

/**
 * Stapgrootte van de +/− knoppen. Rijst per gram tellen is onwerkbaar, dus
 * gram en milliliter gaan per 100, kilo en liter per halve.
 */
export function stepFor(unit: Unit): number {
  switch (unit) {
    case 'g':
    case 'ml':
      return 100
    case 'kg':
    case 'l':
      return 0.5
    default:
      return 1
  }
}

/** Een stap op of neer, nooit onder nul, en zonder zwevende-kommaruis. */
export function stepAmount(current: number, unit: Unit, direction: -1 | 1): number {
  const next = current + direction * stepFor(unit)
  return Math.max(0, Math.round(next * 1000) / 1000)
}

export interface PantrySection {
  categoryId: Id
  name: string
  items: PantryItem[]
}

/** Gegroepeerd per afdeling, in de standaardvolgorde van de afdelingen. */
export function groupPantry(
  items: PantryItem[],
  categories: IngredientCategory[],
): PantrySection[] {
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  const byCategory = new Map<Id, PantryItem[]>()
  for (const item of items) {
    const bucket = byCategory.get(item.categoryId)
    if (bucket) bucket.push(item)
    else byCategory.set(item.categoryId, [item])
  }

  return [...byCategory.entries()]
    .map(([categoryId, sectionItems]) => ({
      categoryId,
      name: categoryById.get(categoryId)?.name ?? 'Zonder afdeling',
      items: sectionItems.sort((a, b) => a.nameLower.localeCompare(b.nameLower)),
    }))
    .sort((a, b) => {
      const orderA = categoryById.get(a.categoryId)?.sortOrder ?? Number.MAX_SAFE_INTEGER
      const orderB = categoryById.get(b.categoryId)?.sortOrder ?? Number.MAX_SAFE_INTEGER
      return orderA !== orderB ? orderA - orderB : a.name.localeCompare(b.name)
    })
}
