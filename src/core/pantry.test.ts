import { describe, expect, it } from 'vitest'
import {
  amountAlreadyOnList,
  amountToBuy,
  groupPantry,
  isBelowTarget,
  pantryAddition,
  pantryAdditions,
  pantryShortfall,
  stepAmount,
} from './pantry'
import type { GroceryItem, IngredientCategory, PantryItem } from './types'

const pantry = (over: Partial<PantryItem>): PantryItem => ({
  id: 'rijst',
  updatedAt: 1000,
  deleted: 0,
  deviceId: 'pc',
  name: 'Rijst',
  nameLower: 'rijst',
  ingredientId: null,
  categoryId: 'pasta-rijst',
  current: 1,
  target: 3,
  unit: 'kg',
  ...over,
})

const line = (over: Partial<GroceryItem>): GroceryItem => ({
  id: 'lijn',
  updatedAt: 1000,
  deleted: 0,
  deviceId: 'pc',
  name: 'Rijst',
  nameLower: 'rijst',
  ingredientId: null,
  amount: 2,
  unit: 'kg',
  categoryId: 'pasta-rijst',
  checked: 0,
  sources: [],
  ...over,
})

const category = (id: string, sortOrder: number): IngredientCategory => ({
  id,
  name: id,
  sortOrder,
  updatedAt: 1,
  deleted: 0,
  deviceId: 'pc',
})

describe('voorraadtekort', () => {
  it('is streefniveau min huidige voorraad', () => {
    expect(pantryShortfall({ current: 1, target: 3 })).toBe(2)
    expect(isBelowTarget({ current: 1, target: 3 })).toBe(true)
  })

  it('is nooit negatief', () => {
    expect(pantryShortfall({ current: 5, target: 3 })).toBe(0)
    expect(pantryShortfall({ current: 3, target: 3 })).toBe(0)
    expect(isBelowTarget({ current: 3, target: 3 })).toBe(false)
  })

  it('negeert zwevende-kommaruis', () => {
    expect(pantryShortfall({ current: 0.1 + 0.2, target: 0.3 })).toBe(0)
  })
})

describe('wat al op de lijst staat', () => {
  it('telt eerder doorgeduwde tekorten mee, ook in een andere eenheid', () => {
    const rijst = pantry({})
    const lijst = [
      line({
        sources: [{ kind: 'pantry', pantryItemId: 'rijst', amount: 500, unit: 'g', at: 1 }],
      }),
    ]
    expect(amountAlreadyOnList(rijst, lijst)).toBe(0.5)
    expect(amountToBuy(rijst, lijst)).toBe(1.5)
  })

  it('telt afgevinkte regels mee, want die liggen al in de kar', () => {
    const lijst = [
      line({
        checked: 1,
        sources: [{ kind: 'pantry', pantryItemId: 'rijst', amount: 2, unit: 'kg', at: 1 }],
      }),
    ]
    expect(amountToBuy(pantry({}), lijst)).toBe(0)
  })

  it('negeert verwijderde regels, recepten en andere voorraaditems', () => {
    const lijst = [
      line({
        deleted: 1,
        sources: [{ kind: 'pantry', pantryItemId: 'rijst', amount: 2, unit: 'kg', at: 1 }],
      }),
      line({ sources: [{ kind: 'recipe', recipeId: 'r', amount: 1, unit: 'kg', at: 1 }] }),
      line({
        sources: [{ kind: 'pantry', pantryItemId: 'pasta', amount: 1, unit: 'kg', at: 1 }],
      }),
    ]
    expect(amountToBuy(pantry({}), lijst)).toBe(2)
  })
})

describe('toevoeging voor de lijst', () => {
  it('rijst 1 van 3 kg wordt 2 kg met een voorraadbron', () => {
    const addition = pantryAddition(pantry({}), [], 42)
    expect(addition).toMatchObject({
      name: 'Rijst',
      amount: 2,
      unit: 'kg',
      categoryId: 'pasta-rijst',
      source: { kind: 'pantry', pantryItemId: 'rijst', amount: 2, unit: 'kg', at: 42 },
    })
  })

  it('geeft niets terug als er genoeg is', () => {
    expect(pantryAddition(pantry({ current: 3 }), [], 1)).toBeNull()
  })

  it('neemt bij "alle tekorten" alleen wat ontbreekt', () => {
    const additions = pantryAdditions(
      [
        pantry({}),
        pantry({ id: 'melk', name: 'Melk', nameLower: 'melk', current: 6, target: 6, unit: 'l' }),
        pantry({ id: 'eieren', name: 'Eieren', nameLower: 'eieren', current: 2, target: 10, unit: 'st' }),
      ],
      [],
      1,
    )
    expect(additions.map((a) => [a.name, a.amount, a.unit])).toEqual([
      ['Rijst', 2, 'kg'],
      ['Eieren', 8, 'st'],
    ])
  })
})

describe('stappen', () => {
  it('gaat per 100 g, per halve kilo en per stuk', () => {
    expect(stepAmount(200, 'g', 1)).toBe(300)
    expect(stepAmount(1, 'kg', 1)).toBe(1.5)
    expect(stepAmount(3, 'st', -1)).toBe(2)
  })

  it('zakt nooit onder nul', () => {
    expect(stepAmount(50, 'g', -1)).toBe(0)
    expect(stepAmount(0, 'st', -1)).toBe(0)
  })

  it('houdt zwevende-kommaruis weg', () => {
    expect(stepAmount(0.1, 'kg', 1)).toBe(0.6)
  })
})

describe('groeperen', () => {
  it('volgt de standaardvolgorde van de afdelingen, en sorteert op naam', () => {
    const sections = groupPantry(
      [
        pantry({ id: 'a', name: 'Rijst', nameLower: 'rijst', categoryId: 'droog' }),
        pantry({ id: 'b', name: 'Appels', nameLower: 'appels', categoryId: 'fruit' }),
        pantry({ id: 'c', name: 'Bloem', nameLower: 'bloem', categoryId: 'droog' }),
      ],
      [category('fruit', 1), category('droog', 2)],
    )
    expect(sections.map((s) => s.categoryId)).toEqual(['fruit', 'droog'])
    expect(sections[1]!.items.map((i) => i.name)).toEqual(['Bloem', 'Rijst'])
  })
})
