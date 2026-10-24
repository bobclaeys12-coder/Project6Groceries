import Dexie, { type Table } from 'dexie'
import type {
  CatalogIngredient,
  GroceryItem,
  IngredientCategory,
  PantryItem,
  Recipe,
  RecipeCategory,
  Shop,
} from '../core/types'

export interface MetaRow {
  key: string
  value: unknown
}

/**
 * De lokale database. Alles blijft op dit toestel; sync kopieert records
 * expliciet van en naar een ander toestel.
 *
 * Over versies: voeg nooit een store toe aan een bestaande `version(n)`, maar
 * zet er een `version(n+1)` naast met de volledige nieuwe schemadefinitie en
 * desnoods een `.upgrade()` om bestaande records om te zetten. Dexie draait die
 * upgrades in volgorde op toestellen die nog op een oudere versie staan.
 */
export class GroceryDb extends Dexie {
  meta!: Table<MetaRow, string>
  recipeCategories!: Table<RecipeCategory, string>
  ingredientCategories!: Table<IngredientCategory, string>
  ingredients!: Table<CatalogIngredient, string>
  recipes!: Table<Recipe, string>
  groceryItems!: Table<GroceryItem, string>
  shops!: Table<Shop, string>
  pantryItems!: Table<PantryItem, string>

  constructor() {
    super('project6groceries')

    this.version(1).stores({
      meta: 'key',
      recipeCategories: 'id, sortOrder, updatedAt, deleted',
      ingredientCategories: 'id, sortOrder, updatedAt, deleted',
      ingredients: 'id, nameLower, categoryId, updatedAt, deleted',
      recipes: 'id, categoryId, nameLower, updatedAt, deleted',
      groceryItems: 'id, checked, categoryId, updatedAt, deleted',
      shops: 'id, sortOrder, updatedAt, deleted',
      pantryItems: 'id, categoryId, updatedAt, deleted',
    })
  }
}

export const db = new GroceryDb()

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key)
  return row?.value as T | undefined
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value })
}
