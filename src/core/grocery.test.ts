import { describe, expect, it } from 'vitest'
import { describeSources, planGroceryAdditions } from './grocery'
import type { GroceryAddition } from './grocery'
import type { GroceryItem, GrocerySource, Unit } from './types'

let counter = 0

const item = (over: Partial<GroceryItem>): GroceryItem => ({
  id: `item-${++counter}`,
  updatedAt: 1000,
  deleted: 0,
  deviceId: 'pc',
  name: 'Tomaten',
  nameLower: 'tomaten',
  ingredientId: null,
  amount: 200,
  unit: 'g',
  categoryId: 'groenten',
  checked: 0,
  sources: [],
  ...over,
})

const manualSource = (amount: number | null, unit: Unit): GrocerySource => ({
  kind: 'manual',
  amount,
  unit,
  at: 2000,
})

const recipeSource = (name: string, portions: number, amount: number, unit: Unit): GrocerySource => ({
  kind: 'recipe',
  recipeId: `r-${name}`,
  recipeName: name,
  portions,
  amount,
  unit,
  at: 2000,
})

const addition = (over: Partial<GroceryAddition>): GroceryAddition => ({
  name: 'Tomaten',
  ingredientId: null,
  amount: 300,
  unit: 'g',
  categoryId: 'groenten',
  source: manualSource(300, 'g'),
  ...over,
})

describe('toevoegen aan de boodschappenlijst', () => {
  it('telt hoeveelheden op bij een regel die er al staat', () => {
    const plan = planGroceryAdditions([item({ amount: 200, unit: 'g' })], [addition({ amount: 300 })])

    expect(plan.creations).toEqual([])
    expect(plan.updates).toHaveLength(1)
    expect(plan.updates[0]!.amount).toBe(500)
    expect(plan.updates[0]!.unit).toBe('g')
    expect(plan.merged).toBe(1)
    expect(plan.added).toBe(0)
  })

  it('rekent gram en kilogram naar elkaar om', () => {
    const plan = planGroceryAdditions(
      [item({ amount: 200, unit: 'g' })],
      [addition({ amount: 0.3, unit: 'kg' })],
    )
    expect(plan.updates[0]!.amount).toBe(500)
    expect(plan.updates[0]!.unit).toBe('g')
  })

  it('schakelt naar de grotere eenheid zodra dat prettiger leest', () => {
    const plan = planGroceryAdditions(
      [item({ name: 'Melk', nameLower: 'melk', amount: 600, unit: 'ml' })],
      [addition({ name: 'Melk', amount: 0.5, unit: 'l' })],
    )
    expect(plan.updates[0]!.amount).toBe(1.1)
    expect(plan.updates[0]!.unit).toBe('l')
  })

  it('houdt onverenigbare eenheden uit elkaar', () => {
    const plan = planGroceryAdditions(
      [item({ amount: 2, unit: 'st' })],
      [addition({ amount: 400, unit: 'g' })],
    )
    // Hoeveel weegt een tomaat? Dat weten we niet, dus twee regels.
    expect(plan.updates).toEqual([])
    expect(plan.creations).toHaveLength(1)
    expect(plan.creations[0]!.amount).toBe(400)
    expect(plan.added).toBe(1)
  })

  it('herkent hetzelfde ingrediënt via zijn catalogus-id', () => {
    const plan = planGroceryAdditions(
      [item({ name: 'Tomaten', nameLower: 'tomaten', ingredientId: 'ing-1' })],
      [addition({ name: 'tomaat', ingredientId: 'ing-1', amount: 100 })],
    )
    expect(plan.updates).toHaveLength(1)
    expect(plan.updates[0]!.amount).toBe(300)
  })

  it('herkent hetzelfde ingrediënt op naam, ongeacht hoofdletters en accenten', () => {
    const plan = planGroceryAdditions(
      [item({ name: 'Crème fraîche', nameLower: 'creme fraiche', amount: 100 })],
      [addition({ name: '  CRÈME FRAÎCHE ', amount: 100 })],
    )
    expect(plan.updates).toHaveLength(1)
    expect(plan.updates[0]!.amount).toBe(200)
  })

  /**
   * Dit is de regel die voorkomt dat je iets twee keer koopt: wat al afgevinkt
   * is, ligt in de kar en blijft met rust.
   */
  it('voegt niet samen met een afgevinkte regel maar maakt een nieuwe', () => {
    const plan = planGroceryAdditions(
      [item({ amount: 500, unit: 'g', checked: 1 })],
      [addition({ amount: 300 })],
    )
    expect(plan.updates).toEqual([])
    expect(plan.creations).toHaveLength(1)
    expect(plan.creations[0]!.amount).toBe(300)
    expect(plan.creations[0]!.checked).toBe(0)
  })

  it('kiest de niet-afgevinkte regel als er van beide een is', () => {
    const plan = planGroceryAdditions(
      [
        item({ amount: 500, unit: 'g', checked: 1 }),
        item({ amount: 100, unit: 'g', checked: 0 }),
      ],
      [addition({ amount: 300 })],
    )
    expect(plan.creations).toEqual([])
    expect(plan.updates[0]!.amount).toBe(400)
  })

  it('voegt twee toevoegingen uit dezelfde ronde ook samen', () => {
    const plan = planGroceryAdditions(
      [],
      [addition({ amount: 200 }), addition({ amount: 300 })],
    )
    expect(plan.creations).toHaveLength(1)
    expect(plan.creations[0]!.amount).toBe(500)
    expect(plan.added).toBe(1)
    expect(plan.merged).toBe(0)
  })

  it('verzamelt waar elke hoeveelheid vandaan komt', () => {
    const plan = planGroceryAdditions(
      [item({ amount: 200, sources: [manualSource(200, 'g')] })],
      [addition({ amount: 300, source: recipeSource('Bolognese', 6, 300, 'g') })],
    )
    expect(plan.updates[0]!.sources).toHaveLength(2)
    expect(plan.updates[0]!.sources[1]!.recipeName).toBe('Bolognese')
  })

  it('laat een regel zonder hoeveelheid zonder hoeveelheid', () => {
    const plan = planGroceryAdditions(
      [item({ name: 'Peper', nameLower: 'peper', amount: null, unit: 'snuf' })],
      [addition({ name: 'Peper', amount: null, unit: 'snuf' })],
    )
    expect(plan.updates[0]!.amount).toBeNull()
  })

  it('telt een hoeveelheid op bij een regel die er nog geen had', () => {
    const plan = planGroceryAdditions(
      [item({ name: 'Zout', nameLower: 'zout', amount: null, unit: 'snuf' })],
      [addition({ name: 'Zout', amount: 1, unit: 'snuf' })],
    )
    expect(plan.updates[0]!.amount).toBe(1)
  })

  it('negeert toevoegingen zonder naam', () => {
    const plan = planGroceryAdditions([], [addition({ name: '   ' })])
    expect(plan.creations).toEqual([])
    expect(plan.added).toBe(0)
  })

  it('raakt regels die niets met de toevoeging te maken hebben niet aan', () => {
    const plan = planGroceryAdditions(
      [item({ name: 'Brood', nameLower: 'brood' }), item({ name: 'Melk', nameLower: 'melk' })],
      [addition({ name: 'Tomaten' })],
    )
    expect(plan.updates).toEqual([])
    expect(plan.creations).toHaveLength(1)
  })
})

describe('herkomst omschrijven', () => {
  it('noemt het recept met het aantal personen', () => {
    expect(describeSources([recipeSource('Bolognese', 6, 300, 'g')])).toBe('Bolognese (6 p.)')
  })

  it('noemt elk recept maar een keer', () => {
    expect(
      describeSources([recipeSource('Bolognese', 4, 100, 'g'), recipeSource('Bolognese', 4, 200, 'g')]),
    ).toBe('Bolognese (4 p.)')
  })

  it('combineert recept, voorraad en handmatig', () => {
    expect(
      describeSources([
        recipeSource('Stoverij', 4, 100, 'g'),
        { kind: 'pantry', amount: 2, unit: 'kg', at: 1 },
        manualSource(1, 'st'),
      ]),
    ).toBe('Stoverij (4 p.) · voorraad · zelf toegevoegd')
  })

  it('zegt niets als er niets te zeggen valt', () => {
    expect(describeSources([])).toBe('')
  })
})
