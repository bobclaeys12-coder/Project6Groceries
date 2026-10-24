import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { initDatabase, ingredientCategoryId, ingredientId } from './init'
import { getRecord, listRecords } from './repo'
import {
  addPantryItem,
  pushAllShortfalls,
  pushShortfall,
  removePantryItem,
  stepPantryItem,
  updatePantryItem,
} from './pantry'
import { addManualGroceryItem } from './grocery'
import { describeSources } from '../core/grocery'

const PASTA_RIJST = ingredientCategoryId('pasta-rijst')
const RIJST = ingredientId('Rijst')

async function addRijst(current = 1, target = 3) {
  return addPantryItem({
    name: 'Rijst',
    ingredientId: RIJST,
    categoryId: PASTA_RIJST,
    current,
    target,
    unit: 'kg',
  })
}

describe('voorraad', () => {
  beforeEach(async () => {
    if (db.isOpen()) db.close()
    await db.delete()
    await initDatabase()
  })

  it('zet het tekort op de lijst met een voorraadlabel', async () => {
    const rijst = await addRijst()
    expect(await pushShortfall(rijst.id)).toEqual({ added: 1, merged: 0 })

    const lijst = await listRecords('groceryItems')
    expect(lijst).toHaveLength(1)
    expect(lijst[0]).toMatchObject({ name: 'Rijst', amount: 2, unit: 'kg', categoryId: PASTA_RIJST })
    expect(describeSources(lijst[0]!.sources)).toBe('voorraad')
  })

  it('zet hetzelfde tekort geen tweede keer op de lijst', async () => {
    const rijst = await addRijst()
    await pushShortfall(rijst.id)
    expect(await pushShortfall(rijst.id)).toEqual({ added: 0, merged: 0 })
    expect((await listRecords('groceryItems'))[0]!.amount).toBe(2)
  })

  it('vult alleen het verschil aan als het streefniveau later stijgt', async () => {
    const rijst = await addRijst()
    await pushShortfall(rijst.id)
    await updatePantryItem(rijst.id, { target: 4 })
    expect(await pushShortfall(rijst.id)).toEqual({ added: 0, merged: 1 })

    const lijst = await listRecords('groceryItems')
    expect(lijst).toHaveLength(1)
    expect(lijst[0]!.amount).toBe(3)
  })

  it('voegt samen met wat er handmatig al op de lijst stond', async () => {
    await addManualGroceryItem({
      name: 'Rijst',
      ingredientId: RIJST,
      amount: 500,
      unit: 'g',
      categoryId: PASTA_RIJST,
    })
    const rijst = await addRijst()
    await pushShortfall(rijst.id)

    const lijst = await listRecords('groceryItems')
    expect(lijst).toHaveLength(1)
    expect(lijst[0]).toMatchObject({ amount: 2.5, unit: 'kg' })
    expect(describeSources(lijst[0]!.sources)).toBe('voorraad · zelf toegevoegd')
  })

  it('duwt alle tekorten tegelijk door', async () => {
    await addRijst()
    await addPantryItem({
      name: 'Eieren',
      ingredientId: null,
      categoryId: ingredientCategoryId('zuivel'),
      current: 12,
      target: 12,
      unit: 'st',
    })
    await addPantryItem({
      name: 'Bloem',
      ingredientId: null,
      categoryId: PASTA_RIJST,
      current: 0,
      target: 1,
      unit: 'kg',
    })

    expect(await pushAllShortfalls()).toEqual({ added: 2, merged: 0 })
    const names = (await listRecords('groceryItems')).map((g) => g.name).sort()
    expect(names).toEqual(['Bloem', 'Rijst'])
  })

  it('weigert hetzelfde ingrediënt twee keer', async () => {
    await addRijst()
    await expect(addRijst()).rejects.toThrow(/staat al in je voorraad/)
  })

  it('stapt op en neer zonder onder nul te gaan', async () => {
    const rijst = await addRijst(0.5, 3)
    await stepPantryItem(rijst.id, 1)
    expect((await getRecord('pantryItems', rijst.id))!.current).toBe(1)
    await stepPantryItem(rijst.id, -1)
    await stepPantryItem(rijst.id, -1)
    await stepPantryItem(rijst.id, -1)
    expect((await getRecord('pantryItems', rijst.id))!.current).toBe(0)
  })

  it('maakt negatieve of ongeldige hoeveelheden nul', async () => {
    const rijst = await addRijst()
    await updatePantryItem(rijst.id, { current: -2, target: Number.NaN })
    expect(await getRecord('pantryItems', rijst.id)).toMatchObject({ current: 0, target: 0 })
  })

  it('laat bij verwijderen een tombstone achter', async () => {
    const rijst = await addRijst()
    await removePantryItem(rijst.id)
    expect(await getRecord('pantryItems', rijst.id)).toBeUndefined()
    expect((await db.pantryItems.get(rijst.id))?.deleted).toBe(1)
  })
})
