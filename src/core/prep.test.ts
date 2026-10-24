import { describe, expect, it } from 'vitest'
import { buildPrepAdditions } from './prep'
import type { Recipe } from './types'

const recipe: Recipe = {
  id: 'r1',
  updatedAt: 1,
  deleted: 0,
  deviceId: 'pc',
  name: 'Stoverij',
  nameLower: 'stoverij',
  categoryId: 'c',
  notes: '',
  photo: null,
  basePortions: 4,
  ingredients: [
    { lineId: 'vlees', ingredientId: 'i-vlees', name: 'Rundvlees', amount: 1000, unit: 'g', categoryId: 'vlees' },
    { lineId: 'ui', ingredientId: 'i-ui', name: 'Ui', amount: 3, unit: 'st', categoryId: 'groenten' },
    { lineId: 'bier', ingredientId: null, name: 'Bruin bier', amount: 330, unit: 'ml', categoryId: 'drank' },
  ],
  steps: [],
}

describe('klaarmaken voor de boodschappenlijst', () => {
  it('neemt zonder aanpassingen alles exact over, zoals vroeger', () => {
    const additions = buildPrepAdditions(recipe, 6, {}, [], 1)
    expect(additions.map((a) => [a.name, a.amount, a.unit])).toEqual([
      ['Rundvlees', 1500, 'g'],
      ['Ui', 4.5, 'st'],
      ['Bruin bier', 495, 'ml'],
    ])
    expect(additions[0]!.source).toMatchObject({ kind: 'recipe', recipeName: 'Stoverij', portions: 6 })
  })

  it('laat uitgevinkte regels weg', () => {
    const additions = buildPrepAdditions(recipe, 4, { ui: { checked: false } }, [], 1)
    expect(additions.map((a) => a.name)).toEqual(['Rundvlees', 'Bruin bier'])
  })

  it('gebruikt een aangepaste hoeveelheid in de getoonde eenheid', () => {
    // 1500 g wordt als 1,5 kg getoond; je typt dus 2 voor 2 kg.
    const additions = buildPrepAdditions(
      recipe,
      6,
      { vlees: { checked: true, edited: true, amount: 2 }, ui: { checked: true, edited: true, amount: null } },
      [],
      1,
    )
    expect(additions[0]).toMatchObject({ amount: 2, unit: 'kg' })
    expect(additions[0]!.source).toMatchObject({ amount: 2, unit: 'kg' })
    expect(additions[1]).toMatchObject({ amount: null, unit: 'st' })
  })

  it('voegt extra ingrediënten toe met dezelfde receptbron, en negeert lege', () => {
    const additions = buildPrepAdditions(
      recipe,
      4,
      {},
      [
        { name: ' Frieten ', ingredientId: null, amount: 1, unit: 'kg', categoryId: 'diepvries' },
        { name: '  ', ingredientId: null, amount: 1, unit: 'st', categoryId: '' },
      ],
      7,
    )
    expect(additions).toHaveLength(4)
    expect(additions[3]).toMatchObject({
      name: 'Frieten',
      amount: 1,
      unit: 'kg',
      categoryId: 'diepvries',
      source: { kind: 'recipe', recipeId: 'r1', recipeName: 'Stoverij', portions: 4, at: 7 },
    })
  })

  it('verandert het recept zelf niet', () => {
    const before = JSON.stringify(recipe)
    buildPrepAdditions(recipe, 2, { vlees: { checked: false }, ui: { checked: true, edited: true, amount: 9 } }, [], 1)
    expect(JSON.stringify(recipe)).toBe(before)
  })
})
