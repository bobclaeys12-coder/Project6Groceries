import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { initDatabase, ingredientCategoryId } from './init'
import { getRecord, listRecords, readDataset } from './repo'
import { addShop, setCategoryOrder } from './shops'
import { exportText, importText } from './sync'
import { encodeDataset, EXPORT_FORMAT, ImportError } from '../core/sync/serialize'
import type { Dataset } from '../core/types'

const FRUIT = ingredientCategoryId('fruit')
const BROOD = ingredientCategoryId('brood')

/** Een export zoals een ander toestel die zou maken. */
async function remoteExport(dataset: Partial<Dataset>): Promise<string> {
  return JSON.stringify(await encodeDataset(dataset, { deviceId: 'tel', now: Date.now() }))
}

describe('sync met de database', () => {
  beforeEach(async () => {
    if (db.isOpen()) db.close()
    await db.delete()
    await initDatabase()
  })

  it('een export opnieuw importeren verandert niets', async () => {
    const result = await importText(await exportText())
    expect(result.counts).toEqual({ added: 0, updated: 0, deleted: 0 })
  })

  it('neemt een nieuwere versie en een verwijdering van het andere toestel over', async () => {
    const recipes = await listRecords('recipes')
    const [first, second] = recipes
    const later = Date.now() + 1000

    const text = await remoteExport({
      recipes: [
        { ...first!, name: 'Hernoemd op de telefoon', updatedAt: later, deviceId: 'tel' },
        { ...second!, deleted: 1, updatedAt: later, deviceId: 'tel' },
      ],
    })
    const result = await importText(text)

    expect(result.counts).toEqual({ added: 0, updated: 1, deleted: 1 })
    expect((await getRecord('recipes', first!.id))?.name).toBe('Hernoemd op de telefoon')
    expect(await getRecord('recipes', second!.id)).toBeUndefined()
    // Het samengevoegde record houdt de stempel van het andere toestel.
    expect((await db.recipes.get(first!.id))?.deviceId).toBe('tel')
  })

  it('negeert oudere versies van het andere toestel', async () => {
    const recipe = (await listRecords('recipes'))[0]!
    const text = await remoteExport({
      recipes: [{ ...recipe, name: 'Oud', updatedAt: recipe.updatedAt - 1, deviceId: 'tel' }],
    })
    await importText(text)
    expect((await getRecord('recipes', recipe.id))?.name).toBe(recipe.name)
  })

  it('ruimt winkelroutes op als het andere toestel een afdeling verwijderde', async () => {
    const shop = (await addShop('Colruyt'))!
    await setCategoryOrder(shop.id, [FRUIT, BROOD])
    const fruit = (await getRecord('ingredientCategories', FRUIT))!

    await importText(
      await remoteExport({
        ingredientCategories: [{ ...fruit, deleted: 1, updatedAt: Date.now() + 1000, deviceId: 'tel' }],
      }),
    )

    expect((await getRecord('shops', shop.id))?.categoryOrder).toEqual([BROOD])
  })

  it('weigert een bestand dat geen export is, zonder iets te veranderen', async () => {
    const before = JSON.stringify(await readDataset())
    await expect(importText('dit is geen json')).rejects.toThrow(ImportError)
    await expect(importText(JSON.stringify({ format: EXPORT_FORMAT, schemaVersion: 42, tables: {} }))).rejects.toThrow(/v42/)
    expect(JSON.stringify(await readDataset())).toBe(before)
  })
})
