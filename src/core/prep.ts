import { scaleIngredients } from './scaling'
import type { GroceryAddition } from './grocery'
import type { Id, Recipe, Unit } from './types'

/**
 * "Klaarmaken voor de boodschappenlijst": een tijdelijke, aangepaste versie
 * van de ingrediëntenlijst van een recept. Het recept zelf verandert nooit;
 * dit bestaat alleen zolang je aan het klaarmaken bent.
 */

/** Wat je per receptregel aanpaste. Een regel zonder keuze staat aangevinkt. */
export interface PrepChoice {
  checked: boolean
  /**
   * De hoeveelheid zoals je ze intypte, in de getoonde eenheid. Null of
   * ontbrekend betekent: niet aangeraakt, gebruik de exacte geschaalde
   * hoeveelheid (zo stapelt er geen afrondfout op).
   */
  amount?: number | null
  edited?: boolean
}

/** Een ingrediënt dat je er alleen voor deze keer bij zet. */
export interface PrepExtra {
  name: string
  ingredientId: Id | null
  amount: number | null
  unit: Unit
  categoryId: Id
}

/**
 * Zet het klaargemaakte recept om in toevoegingen voor de lijst. Uitgevinkte
 * regels vallen weg; aangepaste hoeveelheden gaan mee in de getoonde eenheid;
 * extra ingrediënten krijgen dezelfde receptbron, zodat je op de lijst ziet
 * voor welk recept ze er staan.
 */
export function buildPrepAdditions(
  recipe: Recipe,
  portions: number,
  choices: Record<string, PrepChoice>,
  extras: PrepExtra[],
  at: number,
): GroceryAddition[] {
  const source = (amount: number | null, unit: Unit) => ({
    kind: 'recipe' as const,
    recipeId: recipe.id,
    recipeName: recipe.name,
    portions,
    amount,
    unit,
    at,
  })

  const fromRecipe: GroceryAddition[] = []
  for (const line of scaleIngredients(recipe.ingredients, portions, recipe.basePortions)) {
    const choice = choices[line.lineId]
    if (choice && !choice.checked) continue

    const edited = choice?.edited === true
    const amount = edited ? (choice.amount ?? null) : line.exactAmount
    const unit = edited ? line.displayUnit : line.unit

    fromRecipe.push({
      name: line.name,
      ingredientId: line.ingredientId,
      amount,
      unit,
      categoryId: line.categoryId,
      source: source(amount, unit),
    })
  }

  const fromExtras: GroceryAddition[] = extras
    .filter((extra) => extra.name.trim())
    .map((extra) => ({
      name: extra.name.trim(),
      ingredientId: extra.ingredientId,
      amount: extra.amount,
      unit: extra.unit,
      categoryId: extra.categoryId,
      source: source(extra.amount, extra.unit),
    }))

  return [...fromRecipe, ...fromExtras]
}
