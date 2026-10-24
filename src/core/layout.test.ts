import { describe, expect, it } from 'vitest'
import {
  addArea,
  addFloor,
  areaColour,
  emptyLayout,
  GRID_HEIGHT,
  GRID_WIDTH,
  hitTest,
  layoutBounds,
  outlineSegments,
  rectFromCells,
  removeHit,
  searchLayout,
  updateArea,
  type Segment,
} from './layout'
import type { CatalogIngredient, IngredientCategory, ShopLayout } from './types'

const cat = (id: string, name: string, sortOrder: number): IngredientCategory => ({
  id,
  name,
  sortOrder,
  updatedAt: 1,
  deleted: 0,
  deviceId: 'pc',
})

const CATEGORIES = [cat('groenten', 'Groenten', 1), cat('kaas', 'Kaas', 2), cat('sauzen', 'Sauzen', 3)]

const ing = (name: string, categoryId: string): CatalogIngredient => ({
  id: name,
  name,
  nameLower: name.toLowerCase(),
  categoryId,
  defaultUnit: 'st',
  usageCount: 0,
  isSeed: 1,
  updatedAt: 1,
  deleted: 0,
  deviceId: 'pc',
})

/** Totale lengte van de rand: makkelijk te controleren met de hand. */
const perimeter = (segments: Segment[]) =>
  segments.reduce((sum, s) => sum + Math.abs(s.x2 - s.x1) + Math.abs(s.y2 - s.y1), 0)

describe('rechthoek uit twee vakjes', () => {
  it('werkt in elke sleeprichting en neemt beide vakjes mee', () => {
    expect(rectFromCells({ x: 5, y: 2 }, { x: 2, y: 4 })).toEqual({ x: 2, y: 2, w: 4, h: 3 })
    expect(rectFromCells({ x: 3, y: 3 }, { x: 3, y: 3 })).toEqual({ x: 3, y: 3, w: 1, h: 1 })
  })

  it('blijft binnen het rooster', () => {
    expect(rectFromCells({ x: -4, y: -1 }, { x: 999, y: 999 })).toEqual({
      x: 0,
      y: 0,
      w: GRID_WIDTH,
      h: GRID_HEIGHT,
    })
  })
})

describe('buitenrand', () => {
  it('één rechthoek: vier zijden', () => {
    const segments = outlineSegments([{ x: 0, y: 0, w: 4, h: 2 }])
    expect(segments).toHaveLength(4)
    expect(perimeter(segments)).toBe(12)
  })

  it('twee overlappende rechthoeken: alleen de buitenrand van de L-vorm', () => {
    // 4×2 bovenaan en 2×4 links eronder, overlappend in de hoek: een L.
    const segments = outlineSegments([
      { x: 0, y: 0, w: 4, h: 2 },
      { x: 0, y: 0, w: 2, h: 4 },
    ])
    expect(segments).toHaveLength(6)
    expect(perimeter(segments)).toBe(16)
  })

  it('twee rechthoeken die tegen elkaar liggen: geen lijn ertussen', () => {
    const segments = outlineSegments([
      { x: 0, y: 0, w: 2, h: 2 },
      { x: 2, y: 0, w: 2, h: 2 },
    ])
    expect(segments).toHaveLength(4)
    expect(perimeter(segments)).toBe(12)
  })

  it('een gat in het midden krijgt ook een rand', () => {
    const ring = [
      { x: 0, y: 0, w: 3, h: 1 },
      { x: 0, y: 2, w: 3, h: 1 },
      { x: 0, y: 0, w: 1, h: 3 },
      { x: 2, y: 0, w: 1, h: 3 },
    ]
    expect(perimeter(outlineSegments(ring))).toBe(12 + 4)
  })

  it('niets getekend: geen rand', () => {
    expect(outlineSegments([])).toEqual([])
  })
})

describe('aanpassen', () => {
  const layout: ShopLayout = addArea(addFloor(emptyLayout(), { x: 0, y: 0, w: 10, h: 10 }), {
    id: 'a1',
    kind: 'department',
    categoryId: 'groenten',
    rect: { x: 1, y: 1, w: 3, h: 2 },
  })

  it('tikt eerst een zone aan, en anders de vloer', () => {
    expect(hitTest(layout, { x: 2, y: 1 })).toEqual({ kind: 'area', id: 'a1' })
    expect(hitTest(layout, { x: 8, y: 8 })).toEqual({ kind: 'floor', index: 0 })
    expect(hitTest(layout, { x: 20, y: 20 })).toBeNull()
  })

  it('de laatst getekende zone ligt bovenop', () => {
    const stacked = addArea(layout, { id: 'kassa', kind: 'register', rect: { x: 2, y: 1, w: 1, h: 1 } })
    expect(hitTest(stacked, { x: 2, y: 1 })).toEqual({ kind: 'area', id: 'kassa' })
  })

  it('verwijdert en wijzigt zonder het origineel te veranderen', () => {
    const before = JSON.stringify(layout)
    expect(removeHit(layout, { kind: 'area', id: 'a1' }).areas).toEqual([])
    expect(removeHit(layout, { kind: 'floor', index: 0 }).floor).toEqual([])
    expect(updateArea(layout, 'a1', { categoryId: 'kaas' }).areas[0]!.categoryId).toBe('kaas')
    expect(JSON.stringify(layout)).toBe(before)
  })

  it('snijdt de weergave bij tot wat er getekend is, met marge', () => {
    expect(layoutBounds(layout)).toEqual({ x: -1, y: -1, w: 12, h: 12 })
    expect(layoutBounds(emptyLayout())).toEqual({ x: 0, y: 0, w: GRID_WIDTH, h: GRID_HEIGHT })
  })
})

describe('kleuren', () => {
  it('geeft elke afdeling een vaste, verschillende kleur', () => {
    const colours = CATEGORIES.map((c) => areaColour(c.id, CATEGORIES).fill)
    expect(new Set(colours).size).toBe(CATEGORIES.length)
    // Onafhankelijk van de volgorde waarin de lijst binnenkomt.
    expect(areaColour('kaas', [...CATEGORIES].reverse())).toEqual(areaColour('kaas', CATEGORIES))
  })
})

describe('zoeken op de plattegrond', () => {
  const layout: ShopLayout = {
    floor: [{ x: 0, y: 0, w: 10, h: 10 }],
    areas: [{ id: 'a1', kind: 'department', categoryId: 'groenten', rect: { x: 0, y: 0, w: 2, h: 2 } }],
  }
  const catalog = [ing('Prei', 'groenten'), ing('Tahin', 'sauzen'), ing('Pecorino', 'kaas')]

  it('vindt een afdeling op naam', () => {
    const result = searchLayout('groen', layout, CATEGORIES, catalog)
    expect(result.categoryIds).toEqual(['groenten'])
    expect(result.lines).toEqual([{ text: 'Groenten', categoryId: 'groenten', onMap: true }])
  })

  it('vindt een product via zijn afdeling, en zegt of die op het plan staat', () => {
    const result = searchLayout('tahin', layout, CATEGORIES, catalog)
    expect(result.categoryIds).toEqual(['sauzen'])
    expect(result.lines).toEqual([{ text: 'Tahin → Sauzen', categoryId: 'sauzen', onMap: false }])
  })

  it('geeft niets bij een lege zoekterm', () => {
    expect(searchLayout('  ', layout, CATEGORIES, catalog).categoryIds).toEqual([])
  })
})
