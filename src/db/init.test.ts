import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, getMeta, setMeta } from './db'
import {
  initDatabase,
  ingredientCategoryId,
  ingredientId,
  SEED_DEVICE_ID,
  SEED_UPDATED_AT,
} from './init'
import { deleteRecord, listRecords, readDataset, updateRecord } from './repo'
import { mergeDatasets } from '../core/sync/merge'
import { INGREDIENT_CATEGORIES, RECIPE_CATEGORIES } from './seed/categories'
import { INGREDIENT_COUNT } from './seed/ingredients'
import { EXAMPLE_RECIPES } from './seed/recipes'

describe('database opstarten en vullen', () => {
  beforeEach(async () => {
    if (db.isOpen()) db.close()
    await db.delete()
    await initDatabase()
  })

  it('plaatst alle seed-gegevens', async () => {
    expect(await db.ingredientCategories.count()).toBe(INGREDIENT_CATEGORIES.length)
    expect(await db.recipeCategories.count()).toBe(RECIPE_CATEGORIES.length)
    expect(await db.ingredients.count()).toBe(INGREDIENT_COUNT)
    expect(await db.recipes.count()).toBe(EXAMPLE_RECIPES.length)
  })

  it('geeft dit toestel een blijvend id en een naam', async () => {
    const id = await getMeta<string>('deviceId')
    expect(id).toBeTruthy()
    expect(await getMeta<string>('deviceName')).toBeTruthy()

    await initDatabase()
    expect(await getMeta<string>('deviceId')).toBe(id)
  })

  it('verdubbelt niets bij een tweede start', async () => {
    await initDatabase()
    await initDatabase()
    expect(await db.ingredients.count()).toBe(INGREDIENT_COUNT)
    expect(await db.recipes.count()).toBe(EXAMPLE_RECIPES.length)
  })

  it('laat elk ingrediënt naar een bestaande afdeling wijzen', async () => {
    const categoryIds = new Set((await listRecords('ingredientCategories')).map((c) => c.id))
    const orphans = (await listRecords('ingredients')).filter(
      (i) => !categoryIds.has(i.categoryId),
    )
    expect(orphans.map((o) => o.name)).toEqual([])
  })

  it('koppelt elke receptregel aan een ingrediënt uit de catalogus', async () => {
    const known = new Set((await listRecords('ingredients')).map((i) => i.id))
    const unknown: string[] = []
    for (const recipe of await listRecords('recipes')) {
      for (const line of recipe.ingredients) {
        if (!line.ingredientId || !known.has(line.ingredientId)) unknown.push(line.name)
      }
    }
    expect(unknown).toEqual([])
  })

  it('zet de afdeling van een receptregel op een bestaande afdeling', async () => {
    const categoryIds = new Set((await listRecords('ingredientCategories')).map((c) => c.id))
    const bad: string[] = []
    for (const recipe of await listRecords('recipes')) {
      for (const line of recipe.ingredients) {
        if (!categoryIds.has(line.categoryId)) bad.push(`${recipe.name}: ${line.name}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('bewaart hoeveelheden voor 4 personen', async () => {
    for (const recipe of await listRecords('recipes')) {
      expect(recipe.basePortions).toBe(4)
    }
  })

  /**
   * Dit is de kern van het seed-versiemechanisme: een latere app-versie mag
   * nieuwe items toevoegen, maar nooit iets terugzetten dat jij weggegooid hebt.
   */
  it('zet een zelf verwijderd seed-item niet terug bij een nieuwe seedversie', async () => {
    const witloof = ingredientId('Witloof')
    await deleteRecord('ingredients', witloof)
    expect((await db.ingredients.get(witloof))?.deleted).toBe(1)

    // Doe alsof er een nieuwe app-versie met nieuwe seed-gegevens draait.
    await setMeta('seedVersion', 0)
    await initDatabase()

    expect((await db.ingredients.get(witloof))?.deleted).toBe(1)
  })

  it('vult ontbrekende seed-items wel aan', async () => {
    const appels = ingredientId('Appels')
    await db.ingredients.delete(appels)
    expect(await db.ingredients.get(appels)).toBeUndefined()

    await setMeta('seedVersion', 0)
    await initDatabase()

    const restored = await db.ingredients.get(appels)
    expect(restored?.name).toBe('Appels')
    expect(restored?.categoryId).toBe(ingredientCategoryId('fruit'))
  })

  it('stempelt seed-records met een vaste, oude stempel en geen tombstone', async () => {
    const ingredients = await db.ingredients.toArray()
    for (const record of ingredients.slice(0, 20)) {
      expect(record.updatedAt).toBe(SEED_UPDATED_AT)
      expect(record.deviceId).toBe(SEED_DEVICE_ID)
      expect(record.deleted).toBe(0)
    }
  })

  it('twee toestellen die apart starten, hebben exact dezelfde seed', async () => {
    const first = await readDataset()
    const firstDevice = await getMeta<string>('deviceId')

    // Een tweede toestel: andere database, ander toestel-id, later gestart.
    db.close()
    await db.delete()
    await new Promise((resolve) => setTimeout(resolve, 5))
    await initDatabase()
    expect(await getMeta<string>('deviceId')).not.toBe(firstDevice)

    const second = await readDataset()
    expect(JSON.stringify(second)).toBe(JSON.stringify(first))
    expect(mergeDatasets(second, first).counts).toEqual({ added: 0, updated: 0, deleted: 0 })
  })

  it('een echte wijziging wint altijd van de seed van een later toestel', async () => {
    const fresh = await readDataset()
    await updateRecord('ingredients', ingredientId('Appels'), { name: 'Elstar-appels' })
    const edited = await readDataset()

    // Het nieuwe toestel krijgt de wijziging; het oude toestel neemt niets over.
    expect(mergeDatasets(fresh, edited).counts.updated).toBe(1)
    expect(mergeDatasets(edited, fresh).counts).toEqual({ added: 0, updated: 0, deleted: 0 })
  })
})
