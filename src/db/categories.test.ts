import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { initDatabase, ingredientCategoryId, recipeCategoryId } from './init'
import { createRecord, getRecord, listRecords } from './repo'
import {
  deleteIngredientCategory,
  deleteRecipeCategory,
  moveCategory,
  renameCategory,
} from './categories'

const FRUIT = ingredientCategoryId('fruit')
const GROENTEN = ingredientCategoryId('groenten')
const SOEPEN = recipeCategoryId('soepen')
const PASTAS = recipeCategoryId('pastas')

describe('categorieën beheren', () => {
  beforeEach(async () => {
    if (db.isOpen()) db.close()
    await db.delete()
    await initDatabase()
  })

  it('hernoemt een categorie', async () => {
    await renameCategory('ingredientCategories', FRUIT, '  Vers fruit  ')
    expect((await getRecord('ingredientCategories', FRUIT))?.name).toBe('Vers fruit')
  })

  it('wisselt de volgorde met de buur', async () => {
    const before = (await listRecords('ingredientCategories')).sort(
      (a, b) => a.sortOrder - b.sortOrder,
    )
    const first = before[0]!
    const second = before[1]!

    await moveCategory('ingredientCategories', second.id, -1)

    const after = (await listRecords('ingredientCategories')).sort(
      (a, b) => a.sortOrder - b.sortOrder,
    )
    expect(after[0]!.id).toBe(second.id)
    expect(after[1]!.id).toBe(first.id)
  })

  it('weigert een afdeling te verwijderen zonder bestemming voor wat erin zit', async () => {
    await expect(deleteIngredientCategory(FRUIT, null)).rejects.toThrow(/Kies eerst/)
    expect(await getRecord('ingredientCategories', FRUIT)).toBeDefined()
  })

  it('verhuist ingrediënten, lijst, voorraad en receptregels mee', async () => {
    await createRecord('groceryItems', {
      name: 'Appels',
      nameLower: 'appels',
      ingredientId: null,
      amount: 4,
      unit: 'st',
      categoryId: FRUIT,
      checked: 0,
      sources: [],
    })
    await createRecord('pantryItems', {
      name: 'Bananen',
      nameLower: 'bananen',
      ingredientId: null,
      categoryId: FRUIT,
      current: 2,
      target: 6,
      unit: 'st',
    })
    await createRecord('recipes', {
      name: 'Fruitsla',
      nameLower: 'fruitsla',
      categoryId: SOEPEN,
      notes: '',
      photo: null,
      basePortions: 4,
      ingredients: [
        {
          lineId: 'a',
          ingredientId: null,
          name: 'Appels',
          amount: 2,
          unit: 'st',
          categoryId: FRUIT,
        },
        {
          lineId: 'b',
          ingredientId: null,
          name: 'Wortelen',
          amount: 100,
          unit: 'g',
          categoryId: GROENTEN,
        },
      ],
      steps: [],
    })

    await deleteIngredientCategory(FRUIT, GROENTEN)

    expect(await getRecord('ingredientCategories', FRUIT)).toBeUndefined()

    const leftBehind = [
      ...(await listRecords('ingredients')),
      ...(await listRecords('groceryItems')),
      ...(await listRecords('pantryItems')),
    ].filter((r) => r.categoryId === FRUIT)
    expect(leftBehind).toEqual([])

    const recipe = (await listRecords('recipes')).find((r) => r.name === 'Fruitsla')!
    expect(recipe.ingredients.map((l) => l.categoryId)).toEqual([GROENTEN, GROENTEN])
  })

  it('haalt de afdeling ook uit de looproute van elke winkel', async () => {
    await createRecord('shops', {
      name: 'Colruyt Leuven',
      sortOrder: 1,
      categoryOrder: [GROENTEN, FRUIT, ingredientCategoryId('brood')],
    })

    await deleteIngredientCategory(FRUIT, GROENTEN)

    const shop = (await listRecords('shops'))[0]!
    expect(shop.categoryOrder).not.toContain(FRUIT)
    expect(shop.categoryOrder).toEqual([GROENTEN, ingredientCategoryId('brood')])
  })

  it('verplaatst recepten naar de gekozen categorie bij het verwijderen', async () => {
    const inSoepen = (await listRecords('recipes')).filter((r) => r.categoryId === SOEPEN)
    expect(inSoepen.length).toBeGreaterThan(0)

    await deleteRecipeCategory(SOEPEN, PASTAS)

    expect(await getRecord('recipeCategories', SOEPEN)).toBeUndefined()
    for (const recipe of inSoepen) {
      expect((await getRecord('recipes', recipe.id))?.categoryId).toBe(PASTAS)
    }
  })

  it('verwijdert een lege categorie zonder bestemming', async () => {
    const leeg = await createRecord('recipeCategories', { name: 'Tijdelijk', sortOrder: 99 })
    await deleteRecipeCategory(leeg.id, null)
    expect(await getRecord('recipeCategories', leeg.id)).toBeUndefined()
  })

  it('laat een verwijderde categorie als tombstone achter, zodat sync de verwijdering meeneemt', async () => {
    const leeg = await createRecord('recipeCategories', { name: 'Tijdelijk', sortOrder: 99 })
    await deleteRecipeCategory(leeg.id, null)
    const raw = await db.recipeCategories.get(leeg.id)
    expect(raw?.deleted).toBe(1)
    expect(raw?.updatedAt).toBeGreaterThan(0)
  })
})
