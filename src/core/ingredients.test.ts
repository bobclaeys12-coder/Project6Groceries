import { describe, expect, it } from 'vitest'
import {
  countWithoutCategory,
  findCatalogMatch,
  hasCategory,
  isBasicCategory,
  NO_CATEGORY,
  queryIngredients,
} from './ingredients'
import type { CatalogIngredient, IngredientCategory } from './types'

const cat = (id: string, sortOrder: number): IngredientCategory => ({
  id,
  name: id,
  sortOrder,
  updatedAt: 1,
  deleted: 0,
  deviceId: 'pc',
})

const CATEGORIES = [cat('groenten', 1), cat('vlees', 2)]

const ing = (name: string, categoryId: string, isSeed: 0 | 1 = 1): CatalogIngredient => ({
  id: name,
  name,
  nameLower: name.toLowerCase(),
  categoryId,
  defaultUnit: 'g',
  usageCount: 0,
  isSeed,
  updatedAt: 1,
  deleted: 0,
  deviceId: 'pc',
})

const CATALOG = [
  ing('Prei', 'groenten'),
  ing('Steak', 'vlees'),
  ing('Tahin', NO_CATEGORY, 0),
  ing('Andijvie', 'groenten'),
  ing('Yuzu', 'verwijderde-afdeling', 0),
]

describe('afdeling', () => {
  it('kent geen afdeling toe aan de lege string of een verdwenen afdeling', () => {
    expect(hasCategory('groenten', CATEGORIES)).toBe(true)
    expect(hasCategory(NO_CATEGORY, CATEGORIES)).toBe(false)
    expect(hasCategory('verwijderde-afdeling', CATEGORIES)).toBe(false)
    expect(countWithoutCategory(CATALOG, CATEGORIES)).toBe(2)
  })
})

describe('naam terugvinden', () => {
  it('vindt een exacte naam, los van hoofdletters en spaties', () => {
    expect(findCatalogMatch(CATALOG, '  prei ')?.id).toBe('Prei')
    expect(findCatalogMatch(CATALOG, 'Pre')).toBeUndefined()
    expect(findCatalogMatch(CATALOG, '')).toBeUndefined()
  })
})

describe('ingrediëntenlijst in Instellingen', () => {
  const run = (over: Partial<Parameters<typeof queryIngredients>[2]>) =>
    queryIngredients([...CATALOG], CATEGORIES, {
      search: '',
      filter: 'alle',
      sort: 'naam',
      ...over,
    }).map((i) => i.name)

  it('sorteert op naam', () => {
    expect(run({})).toEqual(['Andijvie', 'Prei', 'Steak', 'Tahin', 'Yuzu'])
  })

  it('zet bij sorteren op afdeling alles zonder afdeling bovenaan', () => {
    expect(run({ sort: 'afdeling' })).toEqual(['Tahin', 'Yuzu', 'Andijvie', 'Prei', 'Steak'])
  })

  it('filtert op zonder afdeling en op zelf toegevoegd', () => {
    expect(run({ filter: 'zonder-afdeling' })).toEqual(['Tahin', 'Yuzu'])
    expect(run({ filter: 'zelf-toegevoegd' })).toEqual(['Tahin', 'Yuzu'])
  })

  it('zoekt in de naam', () => {
    expect(run({ search: 'EI' })).toEqual(['Prei'])
  })
})

describe('basisafdeling', () => {
  it('herkent alleen afdelingen die als basis gemarkeerd zijn', () => {
    const categories = [{ ...cat('specerijen', 3), basic: 1 as const }, cat('groenten', 1)]
    expect(isBasicCategory('specerijen', categories)).toBe(true)
    expect(isBasicCategory('groenten', categories)).toBe(false)
    expect(isBasicCategory(NO_CATEGORY, categories)).toBe(false)
  })
})
