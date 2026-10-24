import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { initDatabase, ingredientCategoryId } from './init'
import { createRecord, getRecord, listRecords } from './repo'
import {
  addCategoriesToRoute,
  addCategoryToRoute,
  addShop,
  cleanShopRoutes,
  deleteShop,
  moveInRoute,
  removeFromRoute,
  renameShop,
  setCategoryOrder,
  setShopLayout,
} from './shops'
import { sortGroceryList } from '../core/sorting'
import { deleteIngredientCategory } from './categories'

const WIJN = ingredientCategoryId('wijn-bier')
const KOFFIE = ingredientCategoryId('koffie-thee')
const VLEES = ingredientCategoryId('vlees')
const BROOD = ingredientCategoryId('brood')
const FRUIT = ingredientCategoryId('fruit')

async function shop(id: string) {
  const found = await getRecord('shops', id)
  if (!found) throw new Error('winkel niet gevonden')
  return found
}

describe('winkels en looproutes', () => {
  beforeEach(async () => {
    if (db.isOpen()) db.close()
    await db.delete()
    await initDatabase()
  })

  it('maakt een winkel met een lege route en negeert een lege naam', async () => {
    const colruyt = await addShop('  Colruyt Leuven ')
    expect(colruyt?.name).toBe('Colruyt Leuven')
    expect(colruyt?.categoryOrder).toEqual([])
    expect(await addShop('   ')).toBeUndefined()
    expect(await listRecords('shops')).toHaveLength(1)
  })

  it('zet nieuwe winkels achteraan', async () => {
    const a = (await addShop('Colruyt'))!
    const b = (await addShop('Delhaize'))!
    expect(b.sortOrder).toBeGreaterThan(a.sortOrder)
  })

  it('bewaart de looproute bij het hernoemen', async () => {
    const colruyt = (await addShop('Colruyt'))!
    await setCategoryOrder(colruyt.id, [WIJN, KOFFIE, VLEES, BROOD])
    await renameShop(colruyt.id, 'Colruyt Leuven')

    const after = await shop(colruyt.id)
    expect(after.name).toBe('Colruyt Leuven')
    expect(after.categoryOrder).toEqual([WIJN, KOFFIE, VLEES, BROOD])
  })

  it('negeert een lege nieuwe naam', async () => {
    const colruyt = (await addShop('Colruyt'))!
    await renameShop(colruyt.id, '  ')
    expect((await shop(colruyt.id)).name).toBe('Colruyt')
  })

  it('laat bij verwijderen een tombstone achter', async () => {
    const colruyt = (await addShop('Colruyt'))!
    await deleteShop(colruyt.id)

    expect(await getRecord('shops', colruyt.id)).toBeUndefined()
    const raw = await db.shops.get(colruyt.id)
    expect(raw?.deleted).toBe(1)
    expect(raw?.updatedAt).toBeGreaterThanOrEqual(colruyt.updatedAt)
  })

  it('laat dubbels uit de route vallen', async () => {
    const colruyt = (await addShop('Colruyt'))!
    await setCategoryOrder(colruyt.id, [WIJN, KOFFIE, WIJN])
    expect((await shop(colruyt.id)).categoryOrder).toEqual([WIJN, KOFFIE])
  })

  it('voegt afdelingen achteraan toe, maar nooit twee keer', async () => {
    const colruyt = (await addShop('Colruyt'))!
    await addCategoryToRoute(colruyt.id, WIJN)
    await addCategoryToRoute(colruyt.id, KOFFIE)
    await addCategoryToRoute(colruyt.id, WIJN)
    await addCategoriesToRoute(colruyt.id, [KOFFIE, VLEES, BROOD])
    expect((await shop(colruyt.id)).categoryOrder).toEqual([WIJN, KOFFIE, VLEES, BROOD])
  })

  it('haalt een afdeling uit de route', async () => {
    const colruyt = (await addShop('Colruyt'))!
    await setCategoryOrder(colruyt.id, [WIJN, KOFFIE, VLEES])
    await removeFromRoute(colruyt.id, KOFFIE)
    expect((await shop(colruyt.id)).categoryOrder).toEqual([WIJN, VLEES])
  })

  it('schuift een afdeling op en neer, en blijft binnen de grenzen', async () => {
    const colruyt = (await addShop('Colruyt'))!
    await setCategoryOrder(colruyt.id, [WIJN, KOFFIE, VLEES])

    await moveInRoute(colruyt.id, VLEES, -1)
    expect((await shop(colruyt.id)).categoryOrder).toEqual([WIJN, VLEES, KOFFIE])

    await moveInRoute(colruyt.id, WIJN, -1)
    await moveInRoute(colruyt.id, KOFFIE, 1)
    expect((await shop(colruyt.id)).categoryOrder).toEqual([WIJN, VLEES, KOFFIE])
  })

  it('ruimt na een sync afdelingen op die een ander toestel verwijderde', async () => {
    const colruyt = (await addShop('Colruyt'))!
    const delhaize = (await addShop('Delhaize'))!
    await setCategoryOrder(colruyt.id, [WIJN, KOFFIE, BROOD])
    await setCategoryOrder(delhaize.id, [FRUIT, BROOD])

    // Zo komt het binnen via de sync: de afdeling is een tombstone, maar de
    // route van deze winkel verwijst er nog naar.
    const koffie = (await db.ingredientCategories.get(KOFFIE))!
    await db.ingredientCategories.put({ ...koffie, deleted: 1 })
    const delhaizeBefore = await shop(delhaize.id)

    expect(await cleanShopRoutes()).toBe(1)
    expect((await shop(colruyt.id)).categoryOrder).toEqual([WIJN, BROOD])
    // Een winkel die niet verandert, krijgt geen nieuwe stempel.
    expect((await shop(delhaize.id)).updatedAt).toBe(delhaizeBefore.updatedAt)
  })

  it('verwijderen van een afdeling haalt haar uit de route', async () => {
    const colruyt = (await addShop('Colruyt'))!
    await setCategoryOrder(colruyt.id, [WIJN, KOFFIE, BROOD])
    await deleteIngredientCategory(KOFFIE, WIJN)
    expect((await shop(colruyt.id)).categoryOrder).toEqual([WIJN, BROOD])
  })

  it('dezelfde lijst volgt de route van de gekozen winkel', async () => {
    const colruyt = (await addShop('Colruyt Leuven'))!
    const delhaize = (await addShop('Delhaize Heverlee'))!
    await setCategoryOrder(colruyt.id, [WIJN, KOFFIE, VLEES, BROOD])
    await setCategoryOrder(delhaize.id, [FRUIT, BROOD, VLEES])

    for (const [name, categoryId] of [
      ['Brood', BROOD],
      ['Gehakt', VLEES],
      ['Appels', FRUIT],
      ['Rode wijn', WIJN],
    ] as const) {
      await createRecord('groceryItems', {
        name,
        nameLower: name.toLowerCase(),
        ingredientId: null,
        amount: 1,
        unit: 'st',
        categoryId,
        checked: 0,
        sources: [],
      })
    }

    const items = await listRecords('groceryItems')
    const categories = await listRecords('ingredientCategories')
    const order = async (id: string) =>
      sortGroceryList(items, categories, await shop(id)).sections.map((s) => s.categoryId)

    expect(await order(colruyt.id)).toEqual([WIJN, VLEES, BROOD, FRUIT])
    expect(await order(delhaize.id)).toEqual([FRUIT, BROOD, VLEES, WIJN])
  })
})

describe('plattegrond', () => {
  beforeEach(async () => {
    if (db.isOpen()) db.close()
    await db.delete()
    await initDatabase()
  })

  const LAYOUT = {
    floor: [{ x: 0, y: 0, w: 10, h: 8 }],
    areas: [
      { id: 'z1', kind: 'department' as const, categoryId: FRUIT, rect: { x: 0, y: 0, w: 2, h: 2 } },
      { id: 'z2', kind: 'department' as const, categoryId: BROOD, rect: { x: 3, y: 0, w: 2, h: 2 } },
      { id: 'z3', kind: 'entry' as const, rect: { x: 0, y: 7, w: 1, h: 1 } },
    ],
  }

  it('bewaart de plattegrond en laat de looproute met rust', async () => {
    const shopRecord = (await addShop('Colruyt'))!
    await setCategoryOrder(shopRecord.id, [FRUIT, BROOD])
    await setShopLayout(shopRecord.id, LAYOUT)
    const after = await shop(shopRecord.id)
    expect(after.layout).toEqual(LAYOUT)
    expect(after.categoryOrder).toEqual([FRUIT, BROOD])
  })

  it('een verwijderde afdeling verdwijnt ook van de plattegrond; ingang en kassa blijven', async () => {
    const shopRecord = (await addShop('Colruyt'))!
    await setShopLayout(shopRecord.id, LAYOUT)
    await deleteIngredientCategory(FRUIT, BROOD)
    expect((await shop(shopRecord.id)).layout!.areas.map((a) => a.id)).toEqual(['z2', 'z3'])
  })

  it('ruimt na een sync zones op van een afdeling die een ander toestel verwijderde', async () => {
    const shopRecord = (await addShop('Colruyt'))!
    await setShopLayout(shopRecord.id, LAYOUT)
    const fruit = (await db.ingredientCategories.get(FRUIT))!
    await db.ingredientCategories.put({ ...fruit, deleted: 1 })

    expect(await cleanShopRoutes()).toBe(1)
    expect((await shop(shopRecord.id)).layout!.areas.map((a) => a.id)).toEqual(['z2', 'z3'])
  })
})
