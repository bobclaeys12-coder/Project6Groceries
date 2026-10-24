import { createRecord, deleteRecord, getRecord, listRecords, updateRecord } from './repo'
import { bumpIngredientUsage, ensureCatalogIngredient } from './ingredients'
import { newId, normalizeName } from '../core/ids'
import type { Id, Recipe, RecipeIngredient } from '../core/types'
import { BASE_PORTIONS } from '../core/scaling'

export interface RecipeDraft {
  id?: Id
  name: string
  categoryId: Id
  notes: string
  photo: Blob | null
  ingredients: RecipeIngredient[]
  steps: string[]
}

export function emptyRecipeDraft(categoryId: Id): RecipeDraft {
  return {
    name: '',
    categoryId,
    notes: '',
    photo: null,
    ingredients: [newIngredientLine(categoryId)],
    steps: [''],
  }
}

export function newIngredientLine(categoryId: Id): RecipeIngredient {
  return {
    lineId: newId(),
    ingredientId: null,
    name: '',
    amount: null,
    unit: 'g',
    categoryId,
  }
}

/**
 * Bewaart een recept en zorgt ondertussen dat elk gebruikt ingrediënt in de
 * catalogus staat. Zo groeit de autocomplete mee met wat je echt kookt.
 */
export async function saveRecipe(draft: RecipeDraft): Promise<Recipe> {
  const lines: RecipeIngredient[] = []

  for (const line of draft.ingredients) {
    const name = line.name.trim()
    if (!name) continue

    const catalogItem = await ensureCatalogIngredient(name, line.categoryId, line.unit)
    await bumpIngredientUsage(catalogItem.id)

    lines.push({
      ...line,
      name,
      ingredientId: catalogItem.id,
      // Geen afdeling gekozen? Dan die uit de catalogus, als die er een kent.
      categoryId: line.categoryId || catalogItem.categoryId,
    })
  }

  const steps = draft.steps.map((s) => s.trim()).filter(Boolean)
  const name = draft.name.trim()

  const fields = {
    name,
    nameLower: normalizeName(name),
    categoryId: draft.categoryId,
    notes: draft.notes.trim(),
    photo: draft.photo,
    basePortions: BASE_PORTIONS,
    ingredients: lines,
    steps,
  }

  if (draft.id) {
    const updated = await updateRecord('recipes', draft.id, fields)
    if (updated) return updated
  }
  return createRecord('recipes', fields)
}

export async function deleteRecipe(id: Id): Promise<void> {
  await deleteRecord('recipes', id)
}

export async function duplicateRecipe(id: Id): Promise<Recipe | undefined> {
  const original = await getRecord('recipes', id)
  if (!original) return undefined
  return createRecord('recipes', {
    name: `${original.name} (kopie)`,
    nameLower: normalizeName(`${original.name} (kopie)`),
    categoryId: original.categoryId,
    notes: original.notes,
    photo: original.photo,
    basePortions: original.basePortions,
    ingredients: original.ingredients.map((line) => ({ ...line, lineId: newId() })),
    steps: [...original.steps],
  })
}

export async function countRecipesPerCategory(): Promise<Map<Id, number>> {
  const recipes = await listRecords('recipes')
  const counts = new Map<Id, number>()
  for (const recipe of recipes) {
    counts.set(recipe.categoryId, (counts.get(recipe.categoryId) ?? 0) + 1)
  }
  return counts
}
