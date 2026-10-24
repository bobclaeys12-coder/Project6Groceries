import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type {
  CatalogIngredient,
  GroceryItem,
  IngredientCategory,
  PantryItem,
  Recipe,
  RecipeCategory,
  Shop,
} from '../core/types'

/**
 * useLiveQuery hertekent automatisch zodra er iets in de database verandert,
 * ook wanneer die wijziging van de sync komt. Daardoor hoeft geen enkele
 * pagina zelf bij te houden of ze nog actueel is.
 */

const bySortOrder = <T extends { sortOrder: number }>(a: T, b: T) => a.sortOrder - b.sortOrder
const byName = <T extends { nameLower: string }>(a: T, b: T) => a.nameLower.localeCompare(b.nameLower)

export function useIngredientCategories(): IngredientCategory[] {
  return (
    useLiveQuery(
      async () =>
        (await db.ingredientCategories.where('deleted').equals(0).toArray()).sort(bySortOrder),
      [],
      [] as IngredientCategory[],
    ) ?? []
  )
}

export function useRecipeCategories(): RecipeCategory[] {
  return (
    useLiveQuery(
      async () =>
        (await db.recipeCategories.where('deleted').equals(0).toArray()).sort(bySortOrder),
      [],
      [] as RecipeCategory[],
    ) ?? []
  )
}

export function useRecipes(): Recipe[] {
  return (
    useLiveQuery(
      async () => (await db.recipes.where('deleted').equals(0).toArray()).sort(byName),
      [],
      [] as Recipe[],
    ) ?? []
  )
}

export function useRecipe(id: string | undefined): Recipe | undefined | null {
  // undefined = nog aan het laden, null = bestaat niet (of verwijderd)
  return useLiveQuery(
    async () => {
      if (!id) return null
      const found = await db.recipes.get(id)
      return !found || found.deleted === 1 ? null : found
    },
    [id],
    undefined,
  )
}

export function useIngredientCatalog(): CatalogIngredient[] {
  return (
    useLiveQuery(
      async () => (await db.ingredients.where('deleted').equals(0).toArray()).sort(byName),
      [],
      [] as CatalogIngredient[],
    ) ?? []
  )
}

export function useGroceryItems(): GroceryItem[] {
  return (
    useLiveQuery(
      async () => await db.groceryItems.where('deleted').equals(0).toArray(),
      [],
      [] as GroceryItem[],
    ) ?? []
  )
}

export function useShops(): Shop[] {
  return (
    useLiveQuery(
      async () => (await db.shops.where('deleted').equals(0).toArray()).sort(bySortOrder),
      [],
      [] as Shop[],
    ) ?? []
  )
}

export function useShop(id: string | undefined): Shop | undefined | null {
  // undefined = nog aan het laden, null = bestaat niet (of verwijderd)
  return useLiveQuery(
    async () => {
      if (!id) return null
      const found = await db.shops.get(id)
      return !found || found.deleted === 1 ? null : found
    },
    [id],
    undefined,
  )
}

export function usePantryItems(): PantryItem[] {
  return (
    useLiveQuery(
      async () => (await db.pantryItems.where('deleted').equals(0).toArray()).sort(byName),
      [],
      [] as PantryItem[],
    ) ?? []
  )
}

/** Handige opzoektabel voor het tonen van categorienamen. */
export function useCategoryNames(): Map<string, string> {
  const categories = useIngredientCategories()
  return new Map(categories.map((c) => [c.id, c.name]))
}
