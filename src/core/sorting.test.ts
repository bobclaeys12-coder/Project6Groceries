import { describe, expect, it } from 'vitest'
import { cleanRoute, sortGroceryList, unplacedCategories } from './sorting'
import type { GroceryItem, IngredientCategory, Shop } from './types'

let counter = 0

const category = (id: string, name: string, sortOrder: number): IngredientCategory => ({
  id,
  name,
  sortOrder,
  updatedAt: 1,
  deleted: 0,
  deviceId: 'pc',
})

const CATEGORIES = [
  category('groenten', 'Groenten', 1),
  category('fruit', 'Fruit', 2),
  category('vlees', 'Vlees', 3),
  category('brood', 'Brood', 4),
  category('wijn', 'Wijn & bier', 5),
  category('koffie', 'Koffie & thee', 6),
]

const item = (name: string, categoryId: string, checked: 0 | 1 = 0): GroceryItem => ({
  id: `i-${++counter}`,
  updatedAt: 1,
  deleted: 0,
  deviceId: 'pc',
  name,
  nameLower: name.toLowerCase(),
  ingredientId: null,
  amount: 1,
  unit: 'st',
  categoryId,
  checked,
  sources: [],
})

const shop = (name: string, categoryOrder: string[]): Shop => ({
  id: `shop-${name}`,
  updatedAt: 1,
  deleted: 0,
  deviceId: 'pc',
  name,
  sortOrder: 1,
  categoryOrder,
})

describe('boodschappenlijst sorteren', () => {
  it('groepeert op afdeling in de standaardvolgorde zonder winkel', () => {
    const list = sortGroceryList(
      [item('Brood', 'brood'), item('Appels', 'fruit'), item('Prei', 'groenten')],
      CATEGORIES,
      null,
    )
    expect(list.sections.map((s) => s.name)).toEqual(['Groenten', 'Fruit', 'Brood'])
  })

  it('volgt de looproute van de gekozen winkel', () => {
    // Deze Colruyt begint bij de wijn en eindigt bij het brood.
    const colruyt = shop('Colruyt Leuven', ['wijn', 'koffie', 'vlees', 'brood'])
    const list = sortGroceryList(
      [item('Brood', 'brood'), item('Koffie', 'koffie'), item('Gehakt', 'vlees'), item('Cava', 'wijn')],
      CATEGORIES,
      colruyt,
    )
    expect(list.sections.map((s) => s.name)).toEqual(['Wijn & bier', 'Koffie & thee', 'Vlees', 'Brood'])
  })

  it('geeft een andere winkel een andere volgorde voor dezelfde lijst', () => {
    const delhaize = shop('Delhaize Heverlee', ['fruit', 'groenten', 'brood'])
    const items = [item('Brood', 'brood'), item('Appels', 'fruit'), item('Prei', 'groenten')]
    const list = sortGroceryList(items, CATEGORIES, delhaize)
    expect(list.sections.map((s) => s.name)).toEqual(['Fruit', 'Groenten', 'Brood'])
  })

  it('zet afdelingen zonder plaats in de route achteraan en markeert ze', () => {
    const winkel = shop('Kleine winkel', ['brood'])
    const list = sortGroceryList(
      [item('Appels', 'fruit'), item('Brood', 'brood'), item('Prei', 'groenten')],
      CATEGORIES,
      winkel,
    )
    expect(list.sections.map((s) => s.name)).toEqual(['Brood', 'Groenten', 'Fruit'])
    expect(list.sections.map((s) => s.unplaced)).toEqual([false, true, true])
  })

  it('sorteert de nog niet geplaatste afdelingen onderling op standaardvolgorde', () => {
    const winkel = shop('Kleine winkel', [])
    const list = sortGroceryList(
      [item('Cava', 'wijn'), item('Prei', 'groenten'), item('Appels', 'fruit')],
      CATEGORIES,
      winkel,
    )
    expect(list.sections.map((s) => s.name)).toEqual(['Groenten', 'Fruit', 'Wijn & bier'])
  })

  it('houdt afgevinkte items apart, onderaan', () => {
    const list = sortGroceryList(
      [item('Prei', 'groenten'), item('Appels', 'fruit', 1), item('Brood', 'brood', 1)],
      CATEGORIES,
      null,
    )
    expect(list.sections.map((s) => s.name)).toEqual(['Groenten'])
    expect(list.checked.map((i) => i.name)).toEqual(['Appels', 'Brood'])
  })

  it('sorteert binnen een afdeling op naam', () => {
    const list = sortGroceryList(
      [item('Witloof', 'groenten'), item('Appelsien', 'groenten'), item('prei', 'groenten')],
      CATEGORIES,
      null,
    )
    expect(list.sections[0]!.items.map((i) => i.name)).toEqual(['Appelsien', 'prei', 'Witloof'])
  })

  it('toont geen lege afdelingen', () => {
    const list = sortGroceryList([item('Prei', 'groenten')], CATEGORIES, null)
    expect(list.sections).toHaveLength(1)
  })

  it('laat een item met een onbekende afdeling niet verdwijnen', () => {
    const list = sortGroceryList([item('Iets', 'bestaat-niet')], CATEGORIES, null)
    expect(list.sections).toHaveLength(1)
    expect(list.sections[0]!.name).toBe('Zonder afdeling')
    expect(list.sections[0]!.items).toHaveLength(1)
  })
})

describe('looproute onderhouden', () => {
  it('somt op welke afdelingen nog geen plaats hebben', () => {
    const winkel = shop('Test', ['groenten', 'fruit'])
    expect(unplacedCategories(CATEGORIES, winkel).map((c) => c.name)).toEqual([
      'Vlees',
      'Brood',
      'Wijn & bier',
      'Koffie & thee',
    ])
  })

  it('haalt verdwenen afdelingen uit de route', () => {
    const winkel = shop('Test', ['groenten', 'weg-gesynchroniseerd', 'brood'])
    expect(cleanRoute(winkel, CATEGORIES)).toEqual(['groenten', 'brood'])
  })
})
