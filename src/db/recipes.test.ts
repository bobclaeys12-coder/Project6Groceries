import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { initDatabase, ingredientCategoryId, ingredientId } from './init'
import { deleteRecipe, ensureCatalogIngredient, newIngredientLine, saveRecipe } from './recipes'
import { deleteRecord, getRecord, listRecords } from './repo'
import { normalizeName } from '../core/ids'
import type { RecipeIngredient } from '../core/types'

const GROENTEN = ingredientCategoryId('groenten')
const KAAS = ingredientCategoryId('kaas')
const PASTAS = 'seed:reccat:pastas'

const line = (over: Partial<RecipeIngredient>): RecipeIngredient => ({
  ...newIngredientLine(GROENTEN),
  ...over,
})

describe('recepten bewaren', () => {
  beforeEach(async () => {
    if (db.isOpen()) db.close()
    await db.delete()
    await initDatabase()
  })

  it('bewaart een nieuw recept met zijn regels en stappen', async () => {
    const saved = await saveRecipe({
      name: '  Pasta pesto  ',
      categoryId: PASTAS,
      notes: ' snel klaar ',
      photo: null,
      ingredients: [line({ name: 'Spaghetti', amount: 400, unit: 'g' })],
      steps: ['Kook de pasta', '  ', 'Roer de pesto erdoor'],
    })

    expect(saved.name).toBe('Pasta pesto')
    expect(saved.nameLower).toBe('pasta pesto')
    expect(saved.notes).toBe('snel klaar')
    expect(saved.basePortions).toBe(4)
    // Lege stappen vallen weg, de rest houdt zijn volgorde.
    expect(saved.steps).toEqual(['Kook de pasta', 'Roer de pesto erdoor'])
  })

  it('laat regels zonder naam weg', async () => {
    const saved = await saveRecipe({
      name: 'Test',
      categoryId: PASTAS,
      notes: '',
      photo: null,
      ingredients: [
        line({ name: 'Ui', amount: 1, unit: 'st' }),
        line({ name: '   ', amount: 3, unit: 'g' }),
      ],
      steps: [],
    })
    expect(saved.ingredients.map((l) => l.name)).toEqual(['Ui'])
  })

  it('koppelt een bekend ingrediënt aan de catalogus en telt het gebruik op', async () => {
    const before = await getRecord('ingredients', ingredientId('Wortelen'))
    expect(before?.usageCount).toBe(0)

    const saved = await saveRecipe({
      name: 'Wortelsoep',
      categoryId: PASTAS,
      notes: '',
      photo: null,
      ingredients: [line({ name: 'Wortelen', amount: 500, unit: 'g' })],
      steps: [],
    })

    expect(saved.ingredients[0]!.ingredientId).toBe(ingredientId('Wortelen'))
    const after = await getRecord('ingredients', ingredientId('Wortelen'))
    expect(after?.usageCount).toBe(1)
  })

  it('zet een onbekend ingrediënt in de catalogus, in de gekozen afdeling', async () => {
    const countBefore = (await listRecords('ingredients')).length

    const saved = await saveRecipe({
      name: 'Kaastaart',
      categoryId: PASTAS,
      notes: '',
      photo: null,
      ingredients: [
        line({ name: 'Hoeve-plattekaas', amount: 300, unit: 'g', categoryId: KAAS }),
      ],
      steps: [],
    })

    const catalog = await listRecords('ingredients')
    expect(catalog.length).toBe(countBefore + 1)

    const added = catalog.find((i) => i.nameLower === normalizeName('Hoeve-plattekaas'))!
    expect(added.categoryId).toBe(KAAS)
    expect(added.defaultUnit).toBe('g')
    expect(added.isSeed).toBe(0)
    expect(saved.ingredients[0]!.ingredientId).toBe(added.id)
  })

  it('maakt geen dubbels bij hetzelfde ingrediënt in twee recepten', async () => {
    const draft = {
      categoryId: PASTAS,
      notes: '',
      photo: null,
      steps: [],
      ingredients: [line({ name: 'Zelfgemaakte pesto', amount: 2, unit: 'el', categoryId: KAAS })],
    }
    await saveRecipe({ ...draft, name: 'Recept een' })
    await saveRecipe({ ...draft, name: 'Recept twee' })

    const matches = (await listRecords('ingredients')).filter(
      (i) => i.nameLower === normalizeName('Zelfgemaakte pesto'),
    )
    expect(matches.length).toBe(1)
    expect(matches[0]!.usageCount).toBe(2)
  })

  it('wekt een verwijderd catalogusitem weer tot leven in plaats van te dupliceren', async () => {
    const witloof = ingredientId('Witloof')
    await deleteRecord('ingredients', witloof)

    const revived = await ensureCatalogIngredient('Witloof', GROENTEN, 'st')

    expect(revived.id).toBe(witloof)
    expect(revived.deleted).toBe(0)
    const matches = (await listRecords('ingredients')).filter((i) => i.nameLower === 'witloof')
    expect(matches.length).toBe(1)
  })

  it('bewerkt een bestaand recept op dezelfde id', async () => {
    const first = await saveRecipe({
      name: 'Eerste naam',
      categoryId: PASTAS,
      notes: '',
      photo: null,
      ingredients: [line({ name: 'Ui', amount: 1, unit: 'st' })],
      steps: ['Stap een'],
    })

    const second = await saveRecipe({
      id: first.id,
      name: 'Tweede naam',
      categoryId: PASTAS,
      notes: '',
      photo: null,
      ingredients: [line({ name: 'Ui', amount: 2, unit: 'st' })],
      steps: ['Stap een', 'Stap twee'],
    })

    expect(second.id).toBe(first.id)
    expect(second.name).toBe('Tweede naam')
    expect(second.ingredients[0]!.amount).toBe(2)
    expect(second.updatedAt).toBeGreaterThanOrEqual(first.updatedAt)
    expect((await listRecords('recipes')).filter((r) => r.id === first.id).length).toBe(1)
  })

  it('laat een verwijderd recept als tombstone achter', async () => {
    const saved = await saveRecipe({
      name: 'Weg hiermee',
      categoryId: PASTAS,
      notes: '',
      photo: null,
      ingredients: [],
      steps: [],
    })

    await deleteRecipe(saved.id)

    expect(await getRecord('recipes', saved.id)).toBeUndefined()
    const raw = await db.recipes.get(saved.id)
    expect(raw?.deleted).toBe(1)
  })
})
