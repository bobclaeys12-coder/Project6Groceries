/**
 * Alle datatypes die op schijf belanden én over sync gaan.
 *
 * SCHEMA_VERSION verhoog je zodra de vorm van een record verandert op een
 * manier die oudere app-versies niet aankunnen. Sync weigert dan te draaien
 * tussen toestellen met een verschillende versie, in plaats van data te slopen.
 */
export const SCHEMA_VERSION = 1

/** Verhoog dit als er nieuwe seed-gegevens bijkomen in een latere release. */
export const SEED_VERSION = 1

export type Id = string

/** Het omhulsel dat élk gesynchroniseerd record draagt. */
export interface SyncedRecord {
  id: Id
  /** epoch ms, wordt bij iedere schrijfactie opnieuw gezet */
  updatedAt: number
  /** tombstone: 0/1 in plaats van boolean, want IndexedDB indexeert geen booleans */
  deleted: 0 | 1
  /** welk toestel dit record het laatst schreef; tiebreaker bij gelijke updatedAt */
  deviceId: string
}

export type Unit =
  | 'g'
  | 'kg'
  | 'ml'
  | 'l'
  | 'st'
  | 'el'
  | 'tl'
  | 'snuf'
  | 'teen'
  | 'bussel'
  | 'blik'
  | 'pak'

export interface RecipeCategory extends SyncedRecord {
  name: string
  sortOrder: number
}

export interface IngredientCategory extends SyncedRecord {
  name: string
  sortOrder: number
}

/** Een item uit de ingrediëntencatalogus (voert de autocomplete). */
export interface CatalogIngredient extends SyncedRecord {
  name: string
  nameLower: string
  categoryId: Id
  defaultUnit: Unit
  /** hoe vaak zelf gebruikt; sorteert de suggesties */
  usageCount: number
  isSeed: 0 | 1
}

/** Ingrediëntregel binnen een recept. Ingebed, geen eigen tabel. */
export interface RecipeIngredient {
  /** stabiele sleutel voor React-lijsten en drag & drop */
  lineId: string
  ingredientId: Id | null
  name: string
  amount: number | null
  unit: Unit
  categoryId: Id
  note?: string
}

export interface Recipe extends SyncedRecord {
  name: string
  nameLower: string
  categoryId: Id
  notes: string
  /** verkleind tot max 1024px JPEG; gaat mee in sync en export */
  photo: Blob | null
  /** altijd 4: hoeveelheden worden voor 4 personen ingevoerd en bewaard */
  basePortions: number
  ingredients: RecipeIngredient[]
  steps: string[]
}

export type GrocerySourceKind = 'manual' | 'recipe' | 'pantry'

/** Waar een regel op de boodschappenlijst vandaan komt. */
export interface GrocerySource {
  kind: GrocerySourceKind
  recipeId?: Id
  recipeName?: string
  portions?: number
  /** bij kind 'pantry': welk voorraaditem dit tekort aanvulde */
  pantryItemId?: Id
  amount: number | null
  unit: Unit
  at: number
}

export interface GroceryItem extends SyncedRecord {
  name: string
  nameLower: string
  ingredientId: Id | null
  amount: number | null
  unit: Unit
  categoryId: Id
  checked: 0 | 1
  sources: GrocerySource[]
}

export interface Shop extends SyncedRecord {
  name: string
  sortOrder: number
  /** looproute: ingrediëntcategorieën in volgorde. Ontbrekende = nog te plaatsen. */
  categoryOrder: Id[]
}

export interface PantryItem extends SyncedRecord {
  name: string
  nameLower: string
  ingredientId: Id | null
  categoryId: Id
  current: number
  target: number
  unit: Unit
}

/** De tabellen die meegaan in sync en export, in afhankelijkheidsvolgorde. */
export const SYNCED_TABLES = [
  'recipeCategories',
  'ingredientCategories',
  'ingredients',
  'recipes',
  'groceryItems',
  'shops',
  'pantryItems',
] as const

export type SyncedTable = (typeof SYNCED_TABLES)[number]

export interface TableTypes {
  recipeCategories: RecipeCategory
  ingredientCategories: IngredientCategory
  ingredients: CatalogIngredient
  recipes: Recipe
  groceryItems: GroceryItem
  shops: Shop
  pantryItems: PantryItem
}

/** Een volledige momentopname van alle gesynchroniseerde tabellen. */
export type Dataset = {
  [K in SyncedTable]: TableTypes[K][]
}
