import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { initDatabase, ingredientCategoryId, ingredientId } from './init'
import { createRecord, getRecord, listRecords } from './repo'
import {
  addIngredient,
  deleteIngredient,
  ensureCatalogIngredient,
  renameIngredient,
  setIngredientCategory,
} from './ingredients'
import { addManualGroceryItem, addPreparedRecipeToGroceryList } from './grocery'
import { addPantryItem } from './pantry'
import { saveRecipe } from './recipes'
import { NO_CATEGORY } from '../core/ingredients'

const GROENTEN = ingredientCategoryId('groenten')
const KRUIDEN = ingredientCategoryId('specerijen')
const WERELD = ingredientCategoryId('sauzen')

describe('ingrediënten beheren', () => {
  beforeEach(async () => {
    if (db.isOpen()) db.close()
    await db.delete()
    await initDatabase()
  })

  it('een nieuw ingetypt item zonder afdeling komt in de catalogus zonder afdeling', async () => {
    await addManualGroceryItem({ name: 'Tahin', ingredientId: null, amount: 1, unit: 'pak', categoryId: NO_CATEGORY })
    const tahin = (await listRecords('ingredients')).find((i) => i.name === 'Tahin')!
    expect(tahin.categoryId).toBe(NO_CATEGORY)
    const line = (await listRecords('groceryItems'))[0]!
    expect(line.ingredientId).toBe(tahin.id)
  })

  it('een gekend item zonder gekozen afdeling neemt de afdeling uit de catalogus', async () => {
    await addManualGroceryItem({ name: 'prei', ingredientId: null, amount: 2, unit: 'st', categoryId: NO_CATEGORY })
    const line = (await listRecords('groceryItems'))[0]!
    expect(line.categoryId).toBe(GROENTEN)
    expect(line.ingredientId).toBe(ingredientId('Prei'))
  })

  it('een voorraaditem komt ook in de catalogus', async () => {
    await addPantryItem({ name: 'Sumak', ingredientId: null, categoryId: KRUIDEN, current: 0, target: 1, unit: 'pak' })
    const sumak = (await listRecords('ingredients')).find((i) => i.name === 'Sumak')
    expect(sumak?.categoryId).toBe(KRUIDEN)
    expect((await listRecords('pantryItems'))[0]!.ingredientId).toBe(sumak!.id)
  })

  it('de catalogus onthoudt een afdeling zodra je er later een kiest', async () => {
    const tahin = await ensureCatalogIngredient('Tahin', NO_CATEGORY, 'pak')
    await ensureCatalogIngredient('Tahin', WERELD, 'pak')
    expect((await getRecord('ingredients', tahin.id))?.categoryId).toBe(WERELD)
    // Een latere toevoeging zonder afdeling wist ze niet weer.
    await ensureCatalogIngredient('Tahin', NO_CATEGORY, 'pak')
    expect((await getRecord('ingredients', tahin.id))?.categoryId).toBe(WERELD)
  })

  it('een recept zonder gekozen afdeling neemt de afdeling uit de catalogus', async () => {
    const recipe = await saveRecipe({
      name: 'Test',
      categoryId: 'c',
      notes: '',
      photo: null,
      steps: [],
      ingredients: [
        { lineId: 'a', ingredientId: null, name: 'Prei', amount: 1, unit: 'st', categoryId: NO_CATEGORY },
      ],
    })
    expect(recipe.ingredients[0]!.categoryId).toBe(GROENTEN)
  })

  it('een nieuwe afdeling trekt door naar recepten, open lijstregels en voorraad', async () => {
    const tahin = await ensureCatalogIngredient('Tahin', NO_CATEGORY, 'pak')
    const recipe = await saveRecipe({
      name: 'Hummus',
      categoryId: 'c',
      notes: '',
      photo: null,
      steps: [],
      ingredients: [
        { lineId: 'a', ingredientId: tahin.id, name: 'Tahin', amount: 1, unit: 'pak', categoryId: NO_CATEGORY },
        { lineId: 'b', ingredientId: null, name: 'Kikkererwten', amount: 1, unit: 'blik', categoryId: GROENTEN },
      ],
    })
    await addManualGroceryItem({ name: 'Tahin', ingredientId: tahin.id, amount: 1, unit: 'pak', categoryId: NO_CATEGORY })
    const inCart = await createRecord('groceryItems', {
      name: 'Tahin', nameLower: 'tahin', ingredientId: tahin.id, amount: 1, unit: 'pak',
      categoryId: NO_CATEGORY, checked: 1, sources: [],
    })
    await addPantryItem({ name: 'Tahin', ingredientId: tahin.id, categoryId: NO_CATEGORY, current: 0, target: 1, unit: 'pak' })

    await setIngredientCategory(tahin.id, WERELD)

    expect((await getRecord('ingredients', tahin.id))?.categoryId).toBe(WERELD)
    const lines = (await getRecord('recipes', recipe.id))!.ingredients
    expect(lines.map((l) => l.categoryId)).toEqual([WERELD, GROENTEN])
    const open = (await listRecords('groceryItems')).find((g) => g.checked === 0)!
    expect(open.categoryId).toBe(WERELD)
    expect((await getRecord('groceryItems', inCart.id))?.categoryId).toBe(NO_CATEGORY)
    expect((await listRecords('pantryItems'))[0]!.categoryId).toBe(WERELD)
  })

  it('weigert een naam die al bestaat, bij toevoegen en hernoemen', async () => {
    await expect(addIngredient(' prei ', GROENTEN, 'st')).rejects.toThrow(/staat al/)
    const tahin = await addIngredient('Tahin', WERELD, 'pak')
    await expect(renameIngredient(tahin.id, 'PREI')).rejects.toThrow(/staat al/)
    await renameIngredient(tahin.id, 'Tahini')
    expect((await getRecord('ingredients', tahin.id))?.nameLower).toBe('tahini')
  })

  it('verwijderen haalt het uit de catalogus, maar laat recepten met rust', async () => {
    const recipe = (await listRecords('recipes')).find((r) => r.ingredients.some((l) => l.ingredientId))!
    const line = recipe.ingredients.find((l) => l.ingredientId)!
    await deleteIngredient(line.ingredientId!)
    expect(await getRecord('ingredients', line.ingredientId!)).toBeUndefined()
    expect((await getRecord('recipes', recipe.id))!.ingredients).toEqual(recipe.ingredients)
  })
})

describe('klaargemaakt recept op de lijst', () => {
  beforeEach(async () => {
    if (db.isOpen()) db.close()
    await db.delete()
    await initDatabase()
  })

  it('zet alleen de keuze op de lijst, met extra ingrediënt, zonder het recept te wijzigen', async () => {
    const recipe = (await listRecords('recipes')).find((r) => r.ingredients.length >= 2)!
    const before = JSON.stringify(await db.recipes.get(recipe.id))
    const [first, second] = recipe.ingredients

    const result = await addPreparedRecipeToGroceryList(
      recipe,
      4,
      { [first!.lineId]: { checked: false } },
      [{ name: 'Tahin', ingredientId: null, amount: 1, unit: 'pak', categoryId: NO_CATEGORY }],
    )

    const names = (await listRecords('groceryItems')).map((g) => g.name)
    expect(names).not.toContain(first!.name)
    expect(names).toContain(second!.name)
    expect(names).toContain('Tahin')
    expect(result.added).toBe(recipe.ingredients.length)
    expect(JSON.stringify(await db.recipes.get(recipe.id))).toBe(before)
    expect((await listRecords('ingredients')).some((i) => i.name === 'Tahin')).toBe(true)
  })
})
