import { createRecord, deleteRecord, getRecord, listRecords, updateRecord } from './repo'
import { normalizeName } from '../core/ids'
import { planGroceryAdditions } from '../core/grocery'
import type { GroceryAddition } from '../core/grocery'
import { scaleIngredients } from '../core/scaling'
import type { GroceryItem, Id, Recipe, Unit } from '../core/types'

export interface AddResult {
  added: number
  merged: number
}

/**
 * Voert een toevoeging uit volgens het plan uit core/grocery.
 * De beslissing wat waar bij hoort zit daar; hier staat alleen het schrijven.
 */
export async function addToGroceryList(additions: GroceryAddition[]): Promise<AddResult> {
  if (additions.length === 0) return { added: 0, merged: 0 }

  const existing = await listRecords('groceryItems')
  const plan = planGroceryAdditions(existing, additions)

  for (const update of plan.updates) {
    await updateRecord('groceryItems', update.id, {
      amount: update.amount,
      unit: update.unit,
      sources: update.sources,
    })
  }
  for (const creation of plan.creations) {
    await createRecord('groceryItems', creation)
  }

  return { added: plan.added, merged: plan.merged }
}

/**
 * Zet de ingrediënten van een recept op de lijst, voor het gekozen aantal
 * personen.
 *
 * Let op de exacte hoeveelheid: we sturen `exactAmount` mee en niet wat er op
 * het scherm staat. Zou je de afgeronde waarde gebruiken, dan stapelt de
 * afrondfout zich op zodra je hetzelfde recept twee keer toevoegt.
 */
export async function addRecipeToGroceryList(
  recipe: Recipe,
  portions: number,
): Promise<AddResult> {
  const at = Date.now()
  const scaled = scaleIngredients(recipe.ingredients, portions, recipe.basePortions)

  const additions: GroceryAddition[] = scaled.map((line) => ({
    name: line.name,
    ingredientId: line.ingredientId,
    amount: line.exactAmount,
    unit: line.unit,
    categoryId: line.categoryId,
    source: {
      kind: 'recipe',
      recipeId: recipe.id,
      recipeName: recipe.name,
      portions,
      amount: line.exactAmount,
      unit: line.unit,
      at,
    },
  }))

  return addToGroceryList(additions)
}

export async function addManualGroceryItem(input: {
  name: string
  ingredientId: Id | null
  amount: number | null
  unit: Unit
  categoryId: Id
}): Promise<AddResult> {
  return addToGroceryList([
    {
      name: input.name,
      ingredientId: input.ingredientId,
      amount: input.amount,
      unit: input.unit,
      categoryId: input.categoryId,
      source: {
        kind: 'manual',
        amount: input.amount,
        unit: input.unit,
        at: Date.now(),
      },
    },
  ])
}

export async function toggleGroceryItem(id: Id): Promise<void> {
  const item = await getRecord('groceryItems', id)
  if (!item) return
  await updateRecord('groceryItems', id, { checked: item.checked === 1 ? 0 : 1 })
}

export async function updateGroceryItem(
  id: Id,
  changes: Partial<Pick<GroceryItem, 'name' | 'amount' | 'unit' | 'categoryId'>>,
): Promise<void> {
  const patch: Partial<GroceryItem> = { ...changes }
  if (changes.name !== undefined) {
    patch.name = changes.name.trim()
    patch.nameLower = normalizeName(changes.name)
  }
  await updateRecord('groceryItems', id, patch)
}

export async function removeGroceryItem(id: Id): Promise<void> {
  await deleteRecord('groceryItems', id)
}

/** Ruimt de afgevinkte regels op. Geeft terug hoeveel er weg zijn. */
export async function clearCheckedItems(): Promise<number> {
  const checked = (await listRecords('groceryItems')).filter((item) => item.checked === 1)
  for (const item of checked) {
    await deleteRecord('groceryItems', item.id)
  }
  return checked.length
}

/** Vinkt alles weer af als nog te kopen. */
export async function uncheckAll(): Promise<void> {
  const checked = (await listRecords('groceryItems')).filter((item) => item.checked === 1)
  for (const item of checked) {
    await updateRecord('groceryItems', item.id, { checked: 0 })
  }
}
