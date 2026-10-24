import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { initDatabase, ingredientCategoryId } from './init'
import { listRecords } from './repo'
import {
  addManualGroceryItem,
  addRecipeToGroceryList,
  clearCheckedItems,
  toggleGroceryItem,
  uncheckAll,
  updateGroceryItem,
} from './grocery'
import { presentAmount } from '../core/scaling'
import type { Recipe } from '../core/types'

const GROENTEN = ingredientCategoryId('groenten')

async function recipeNamed(name: string): Promise<Recipe> {
  const found = (await listRecords('recipes')).find((r) => r.name === name)
  if (!found) throw new Error(`Voorbeeldrecept "${name}" niet gevonden`)
  return found
}

const amountOf = async (name: string) =>
  (await listRecords('groceryItems')).find((i) => i.nameLower === name.toLowerCase())

describe('boodschappenlijst vullen', () => {
  beforeEach(async () => {
    if (db.isOpen()) db.close()
    await db.delete()
    await initDatabase()
  })

  it('zet alle ingrediënten van een recept op de lijst', async () => {
    const bolognese = await recipeNamed('Spaghetti bolognese')
    const result = await addRecipeToGroceryList(bolognese, 4)

    expect(result.added).toBe(bolognese.ingredients.length)
    expect(result.merged).toBe(0)
    expect((await listRecords('groceryItems')).length).toBe(bolognese.ingredients.length)

    const gehakt = await amountOf('gemengd gehakt')
    expect(gehakt?.amount).toBe(500)
    expect(gehakt?.unit).toBe('g')
  })

  it('schaalt mee met het gekozen aantal personen', async () => {
    const bolognese = await recipeNamed('Spaghetti bolognese')
    await addRecipeToGroceryList(bolognese, 8)

    // Een losse toevoeging bewaart de eenheid van het recept; de weergave
    // maakt er alsnog 1 kg van.
    const gehakt = await amountOf('gemengd gehakt')
    expect(gehakt?.amount).toBe(1000)
    expect(gehakt?.unit).toBe('g')
    expect(presentAmount(gehakt!.amount, gehakt!.unit)).toEqual({ amount: 1, unit: 'kg' })
  })

  it('telt op in plaats van te verdubbelen bij hetzelfde recept', async () => {
    const bolognese = await recipeNamed('Spaghetti bolognese')
    await addRecipeToGroceryList(bolognese, 4)
    const second = await addRecipeToGroceryList(bolognese, 4)

    expect(second.added).toBe(0)
    expect(second.merged).toBe(bolognese.ingredients.length)
    expect((await listRecords('groceryItems')).length).toBe(bolognese.ingredients.length)

    // 500 g + 500 g telt op tot 1000 g, wat als 1 kg opgeslagen en getoond wordt.
    const gehakt = await amountOf('gemengd gehakt')
    expect(gehakt?.amount).toBe(1)
    expect(gehakt?.unit).toBe('kg')
  })

  it('telt gram en kilo van twee verschillende recepten bij elkaar', async () => {
    // Bolognese heeft 500 g gehakt voor 4; tomatensoep 250 g.
    await addRecipeToGroceryList(await recipeNamed('Spaghetti bolognese'), 4)
    await addRecipeToGroceryList(await recipeNamed('Tomatensoep met balletjes'), 4)

    const gehakt = await amountOf('gemengd gehakt')
    expect(gehakt?.amount).toBe(750)
    expect(gehakt?.unit).toBe('g')
    expect(gehakt?.sources).toHaveLength(2)
  })

  /**
   * De reden dat de lijst de exacte hoeveelheid bewaart en niet wat op het
   * scherm staat: anders stapelt de afrondfout op.
   */
  it('stapelt geen afrondfouten op bij herhaald toevoegen', async () => {
    const soep = await recipeNamed('Tomatensoep met balletjes')
    // 1 ei voor 4 personen wordt 1,75 voor 7 - op het scherm afgerond naar 2.
    const scaledDisplay = presentAmount(1.75, 'st')
    expect(scaledDisplay.amount).toBe(2)

    await addRecipeToGroceryList(soep, 7)
    await addRecipeToGroceryList(soep, 7)

    const eieren = await amountOf('eieren')
    // 1,75 + 1,75 = 3,5 en niet 2 + 2 = 4.
    expect(eieren?.amount).toBe(3.5)
  })

  it('voegt een handmatig item toe en voegt het samen met een bestaand', async () => {
    await addManualGroceryItem({
      name: 'Tomaten',
      ingredientId: null,
      amount: 500,
      unit: 'g',
      categoryId: GROENTEN,
    })
    const second = await addManualGroceryItem({
      name: 'tomaten',
      ingredientId: null,
      amount: 0.5,
      unit: 'kg',
      categoryId: GROENTEN,
    })

    expect(second.merged).toBe(1)
    const tomaten = await amountOf('tomaten')
    expect(tomaten?.amount).toBe(1)
    expect(tomaten?.unit).toBe('kg')
  })

  it('maakt een nieuwe regel in plaats van iets uit de kar opnieuw te kopen', async () => {
    await addManualGroceryItem({
      name: 'Melk',
      ingredientId: null,
      amount: 1,
      unit: 'l',
      categoryId: GROENTEN,
    })
    const melk = (await listRecords('groceryItems'))[0]!
    await toggleGroceryItem(melk.id)

    const result = await addManualGroceryItem({
      name: 'Melk',
      ingredientId: null,
      amount: 2,
      unit: 'l',
      categoryId: GROENTEN,
    })

    expect(result.added).toBe(1)
    const all = await listRecords('groceryItems')
    expect(all).toHaveLength(2)
    expect(all.find((i) => i.checked === 1)?.amount).toBe(1)
    expect(all.find((i) => i.checked === 0)?.amount).toBe(2)
  })

  it('vinkt af en weer terug', async () => {
    await addManualGroceryItem({
      name: 'Brood',
      ingredientId: null,
      amount: 1,
      unit: 'st',
      categoryId: GROENTEN,
    })
    const brood = (await listRecords('groceryItems'))[0]!

    await toggleGroceryItem(brood.id)
    expect((await listRecords('groceryItems'))[0]!.checked).toBe(1)

    await toggleGroceryItem(brood.id)
    expect((await listRecords('groceryItems'))[0]!.checked).toBe(0)
  })

  it('ruimt afgevinkte regels op als tombstone', async () => {
    await addRecipeToGroceryList(await recipeNamed('Spaghetti bolognese'), 4)
    const items = await listRecords('groceryItems')
    await toggleGroceryItem(items[0]!.id)
    await toggleGroceryItem(items[1]!.id)

    const removed = await clearCheckedItems()
    expect(removed).toBe(2)
    expect((await listRecords('groceryItems')).length).toBe(items.length - 2)

    // Blijft als tombstone bestaan, anders komt het bij de sync weer terug.
    expect((await db.groceryItems.get(items[0]!.id))?.deleted).toBe(1)
  })

  it('zet alles in een keer terug op de lijst', async () => {
    await addRecipeToGroceryList(await recipeNamed('Spaghetti bolognese'), 4)
    for (const item of await listRecords('groceryItems')) {
      await toggleGroceryItem(item.id)
    }
    await uncheckAll()
    expect((await listRecords('groceryItems')).every((i) => i.checked === 0)).toBe(true)
  })

  it('past een regel aan en houdt de zoeknaam gelijk', async () => {
    await addManualGroceryItem({
      name: 'Prei',
      ingredientId: null,
      amount: 2,
      unit: 'st',
      categoryId: GROENTEN,
    })
    const prei = (await listRecords('groceryItems'))[0]!

    await updateGroceryItem(prei.id, { name: '  Préi  ', amount: 3, unit: 'st' })

    const updated = (await listRecords('groceryItems'))[0]!
    expect(updated.name).toBe('Préi')
    expect(updated.nameLower).toBe('prei')
    expect(updated.amount).toBe(3)
  })
})
