import { db, getMeta, setMeta } from './db'
import { initDevice } from './device'
import { normalizeName, seedId, slugify } from '../core/ids'
import { SCHEMA_VERSION, SEED_VERSION } from '../core/types'
import type {
  CatalogIngredient,
  IngredientCategory,
  Recipe,
  RecipeCategory,
  RecipeIngredient,
  Unit,
} from '../core/types'
import { INGREDIENT_CATEGORIES, RECIPE_CATEGORIES } from './seed/categories'
import { INGREDIENTS_BY_CATEGORY } from './seed/ingredients'
import { EXAMPLE_RECIPES } from './seed/recipes'

export const ingredientCategoryId = (slug: string) => seedId('ingcat', slug)
export const recipeCategoryId = (slug: string) => seedId('reccat', slug)
export const ingredientId = (name: string) => seedId('ing', slugify(name))

/**
 * Seed-records krijgen een vaste, uiterst oude stempel in plaats van het
 * moment waarop dit toestel startte. Anders lijkt de onaangeroerde seed van
 * een toestel dat later bijkomt "nieuwer" en overschrijft die bij de eerste
 * sync alles wat je op je andere toestellen al aanpaste. Nu wint elke echte
 * wijziging, en zijn twee onaangeroerde kopieën gewoon gelijk.
 */
export const SEED_UPDATED_AT = 1
export const SEED_DEVICE_ID = 'seed'

/**
 * Start de database op: openen, toestel-identiteit laden, en eenmalig de
 * seed-gegevens plaatsen.
 */
export async function initDatabase(): Promise<void> {
  await db.open()
  await initDevice()
  await setMeta('schemaVersion', SCHEMA_VERSION)
  await seedIfNeeded()
}

/**
 * Zet ontbrekende seed-records neer.
 *
 * Belangrijk: records waarvan het id al bestaat worden niet aangeraakt, ook
 * niet als ze een tombstone zijn. Wie een categorie of ingrediënt bewust
 * verwijdert, krijgt die niet terug bij de volgende app-update. Omdat
 * seed-ids afleidbaar zijn (seed:ing:bloem), kan een latere SEED_VERSION
 * gerust nieuwe items toevoegen zonder duplicaten te maken.
 */
async function seedIfNeeded(): Promise<void> {
  const current = (await getMeta<number>('seedVersion')) ?? 0
  if (current >= SEED_VERSION) return

  const base = { updatedAt: SEED_UPDATED_AT, deleted: 0 as const, deviceId: SEED_DEVICE_ID }

  // ---- ingrediëntcategorieën -------------------------------------------
  const unitByCategorySlug = new Map<string, Unit>()
  const ingredientCategories: IngredientCategory[] = INGREDIENT_CATEGORIES.map((cat, index) => {
    unitByCategorySlug.set(cat.slug, cat.defaultUnit)
    return { ...base, id: ingredientCategoryId(cat.slug), name: cat.name, sortOrder: index + 1 }
  })

  // ---- receptcategorieën -----------------------------------------------
  const recipeCategories: RecipeCategory[] = RECIPE_CATEGORIES.map((cat, index) => ({
    ...base,
    id: recipeCategoryId(cat.slug),
    name: cat.name,
    sortOrder: index + 1,
  }))

  // ---- ingrediëntencatalogus -------------------------------------------
  const ingredients: CatalogIngredient[] = []
  for (const [categorySlug, entries] of Object.entries(INGREDIENTS_BY_CATEGORY)) {
    const fallbackUnit = unitByCategorySlug.get(categorySlug) ?? 'g'
    for (const entry of entries) {
      const [rawName, rawUnit] = entry.split('|')
      const name = (rawName ?? '').trim()
      if (!name) continue
      ingredients.push({
        ...base,
        id: ingredientId(name),
        name,
        nameLower: normalizeName(name),
        categoryId: ingredientCategoryId(categorySlug),
        defaultUnit: (rawUnit as Unit) || fallbackUnit,
        usageCount: 0,
        isSeed: 1,
      })
    }
  }

  // ---- voorbeeldrecepten ------------------------------------------------
  const recipes: Recipe[] = EXAMPLE_RECIPES.map((seed) => {
    // Vaste ids, zodat een onaangeroerd voorbeeldrecept op elk toestel
    // byte voor byte gelijk is.
    const lines: RecipeIngredient[] = seed.ingredients.map((line, index) => ({
      lineId: seedId('line', `${seed.slug}-${index + 1}`),
      ingredientId: ingredientId(line.name),
      name: line.name,
      amount: line.amount,
      unit: line.unit,
      categoryId: ingredientCategoryId(line.category),
      ...(line.note ? { note: line.note } : {}),
    }))
    return {
      ...base,
      id: seedId('recipe', seed.slug),
      name: seed.name,
      nameLower: normalizeName(seed.name),
      categoryId: recipeCategoryId(seed.category),
      notes: seed.notes,
      photo: null,
      basePortions: 4,
      ingredients: lines,
      steps: seed.steps,
    }
  })

  await db.transaction(
    'rw',
    db.ingredientCategories,
    db.recipeCategories,
    db.ingredients,
    db.recipes,
    db.meta,
    async () => {
      await putMissing(db.ingredientCategories, ingredientCategories)
      await putMissing(db.recipeCategories, recipeCategories)
      await putMissing(db.ingredients, ingredients)
      await putMissing(db.recipes, recipes)
      await db.meta.put({ key: 'seedVersion', value: SEED_VERSION })
    },
  )
}

/** Voegt alleen records toe waarvan het id nog helemaal niet voorkomt. */
async function putMissing<T extends { id: string }>(
  table: { bulkGet(keys: string[]): Promise<(T | undefined)[]>; bulkPut(items: T[]): Promise<unknown> },
  records: T[],
): Promise<number> {
  if (records.length === 0) return 0
  const existing = await table.bulkGet(records.map((r) => r.id))
  const missing = records.filter((_, i) => existing[i] === undefined)
  if (missing.length > 0) await table.bulkPut(missing)
  return missing.length
}

/**
 * Wist alle lokale gegevens en zet de seed opnieuw. Alleen bedoeld voor de
 * knop in Instellingen; dit is niet terug te draaien en synchroniseert niet
 * als verwijdering naar je andere toestellen.
 */
export async function resetDatabase(): Promise<void> {
  await db.delete()
  await db.open()
  await initDevice()
  await setMeta('schemaVersion', SCHEMA_VERSION)
  await setMeta('seedVersion', 0)
  await seedIfNeeded()
}
