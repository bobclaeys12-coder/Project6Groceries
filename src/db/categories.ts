import { db } from './db'
import { createRecord, deleteRecord, listRecords, nextSortOrder, updateRecord } from './repo'
import type { Id, IngredientCategory, RecipeCategory, SyncedTable } from '../core/types'

/* ------------------------------------------------------------ aanmaken */

export async function addIngredientCategory(name: string): Promise<IngredientCategory> {
  return createRecord('ingredientCategories', {
    name: name.trim(),
    sortOrder: await nextSortOrder('ingredientCategories'),
  })
}

export async function addRecipeCategory(name: string): Promise<RecipeCategory> {
  return createRecord('recipeCategories', {
    name: name.trim(),
    sortOrder: await nextSortOrder('recipeCategories'),
  })
}

export async function renameCategory(
  table: 'ingredientCategories' | 'recipeCategories',
  id: Id,
  name: string,
): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) return
  await updateRecord(table, id, { name: trimmed })
}

/* ------------------------------------------------------------ volgorde */

/**
 * Verplaatst een categorie een plaats op of neer door de sorteernummers met
 * de buur te wisselen. Beide records worden geschreven, dus beide krijgen een
 * nieuwe updatedAt en de volgorde synchroniseert correct mee.
 */
export async function moveCategory(
  table: 'ingredientCategories' | 'recipeCategories',
  id: Id,
  direction: -1 | 1,
): Promise<void> {
  const all = (await listRecords(table)).sort((a, b) => a.sortOrder - b.sortOrder)
  const index = all.findIndex((c) => c.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= all.length) return

  const current = all[index]!
  const neighbour = all[target]!
  await updateRecord(table, current.id, { sortOrder: neighbour.sortOrder })
  await updateRecord(table, neighbour.id, { sortOrder: current.sortOrder })
}

/* ---------------------------------------------------------- verwijderen */

export interface CategoryUsage {
  ingredients: number
  recipes: number
  groceryItems: number
  pantryItems: number
  total: number
}

/** Telt alles wat naar deze ingrediëntcategorie verwijst. */
export async function countIngredientCategoryUsage(categoryId: Id): Promise<CategoryUsage> {
  const [ingredients, recipes, groceryItems, pantryItems] = await Promise.all([
    listRecords('ingredients'),
    listRecords('recipes'),
    listRecords('groceryItems'),
    listRecords('pantryItems'),
  ])
  const usage: CategoryUsage = {
    ingredients: ingredients.filter((i) => i.categoryId === categoryId).length,
    recipes: recipes.filter((r) => r.ingredients.some((l) => l.categoryId === categoryId)).length,
    groceryItems: groceryItems.filter((g) => g.categoryId === categoryId).length,
    pantryItems: pantryItems.filter((p) => p.categoryId === categoryId).length,
    total: 0,
  }
  usage.total = usage.ingredients + usage.recipes + usage.groceryItems + usage.pantryItems
  return usage
}

/**
 * Verwijdert een ingrediëntcategorie en verhuist alles wat ernaar verwees.
 *
 * Zonder verhuizing zouden ingrediënten naar een categorie wijzen die niet
 * meer bestaat; die vallen dan uit elke groepering weg en zijn in de winkel
 * nergens meer te vinden. Daarom is `moveToId` verplicht zodra er iets naar
 * de categorie verwijst.
 */
export async function deleteIngredientCategory(categoryId: Id, moveToId: Id | null): Promise<void> {
  const usage = await countIngredientCategoryUsage(categoryId)

  if (usage.total > 0) {
    if (!moveToId) {
      throw new Error('Kies eerst een afdeling om de bestaande items naartoe te verplaatsen.')
    }
    await reassignIngredientCategory(categoryId, moveToId)
  }

  // De looproute van elke winkel verliest deze afdeling.
  for (const shop of await listRecords('shops')) {
    if (shop.categoryOrder.includes(categoryId)) {
      await updateRecord('shops', shop.id, {
        categoryOrder: shop.categoryOrder.filter((c) => c !== categoryId),
      })
    }
  }

  await deleteRecord('ingredientCategories', categoryId)
}

async function reassignIngredientCategory(fromId: Id, toId: Id): Promise<void> {
  for (const ingredient of await listRecords('ingredients')) {
    if (ingredient.categoryId === fromId) {
      await updateRecord('ingredients', ingredient.id, { categoryId: toId })
    }
  }
  for (const item of await listRecords('groceryItems')) {
    if (item.categoryId === fromId) {
      await updateRecord('groceryItems', item.id, { categoryId: toId })
    }
  }
  for (const item of await listRecords('pantryItems')) {
    if (item.categoryId === fromId) {
      await updateRecord('pantryItems', item.id, { categoryId: toId })
    }
  }
  for (const recipe of await listRecords('recipes')) {
    if (recipe.ingredients.some((line) => line.categoryId === fromId)) {
      await updateRecord('recipes', recipe.id, {
        ingredients: recipe.ingredients.map((line) =>
          line.categoryId === fromId ? { ...line, categoryId: toId } : line,
        ),
      })
    }
  }
}

export async function countRecipesInCategory(categoryId: Id): Promise<number> {
  const recipes = await listRecords('recipes')
  return recipes.filter((r) => r.categoryId === categoryId).length
}

/** Verwijdert een receptcategorie; recepten erin verhuizen mee. */
export async function deleteRecipeCategory(categoryId: Id, moveToId: Id | null): Promise<void> {
  const recipes = (await listRecords('recipes')).filter((r) => r.categoryId === categoryId)

  if (recipes.length > 0) {
    if (!moveToId) {
      throw new Error('Kies eerst een categorie om de recepten naartoe te verplaatsen.')
    }
    for (const recipe of recipes) {
      await updateRecord('recipes', recipe.id, { categoryId: moveToId })
    }
  }

  await deleteRecord('recipeCategories', categoryId)
}

/** Aantal niet-verwijderde records in een tabel; voor de tellers op Start. */
export async function countRecords(table: SyncedTable): Promise<number> {
  return (db[table] as unknown as { where(i: string): { equals(v: number): { count(): Promise<number> } } })
    .where('deleted')
    .equals(0)
    .count()
}
