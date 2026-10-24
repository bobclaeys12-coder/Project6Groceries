import { normalizeName } from './ids'
import type { CatalogIngredient, Id, IngredientCategory, LayoutArea, Rect, ShopLayout } from './types'

/**
 * De plattegrond van een winkel, op een rooster van vakjes. Alles is in
 * hele vakjes, zodat rechthoeken netjes op elkaar aansluiten en de buitenrand
 * van overlappende rechthoeken exact te berekenen valt.
 */
export const GRID_WIDTH = 36
export const GRID_HEIGHT = 24

export const emptyLayout = (): ShopLayout => ({ floor: [], areas: [] })

export interface Cell {
  x: number
  y: number
}

/** Rechthoek tussen twee aangetikte vakjes, beide inbegrepen, binnen het rooster. */
export function rectFromCells(a: Cell, b: Cell): Rect {
  const clampX = (v: number) => Math.min(GRID_WIDTH - 1, Math.max(0, v))
  const clampY = (v: number) => Math.min(GRID_HEIGHT - 1, Math.max(0, v))
  const x1 = clampX(Math.min(a.x, b.x))
  const x2 = clampX(Math.max(a.x, b.x))
  const y1 = clampY(Math.min(a.y, b.y))
  const y2 = clampY(Math.max(a.y, b.y))
  return { x: x1, y: y1, w: x2 - x1 + 1, h: y2 - y1 + 1 }
}

export function containsCell(rect: Rect, cell: Cell): boolean {
  return cell.x >= rect.x && cell.x < rect.x + rect.w && cell.y >= rect.y && cell.y < rect.y + rect.h
}

/* ------------------------------------------------------------ buitenrand */

export interface Segment {
  x1: number
  y1: number
  x2: number
  y2: number
}

/**
 * De buitenrand van een verzameling rechthoeken, als lijnstukken. Een rand
 * tussen twee vakjes telt alleen als precies één van beide bedekt is; zo
 * verdwijnen de randen binnenin waar rechthoeken overlappen of aansluiten.
 * Aaneensluitende stukjes op dezelfde lijn worden samengevoegd.
 */
export function outlineSegments(rects: Rect[]): Segment[] {
  if (rects.length === 0) return []
  const covered = new Set<string>()
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const r of rects) {
    for (let x = r.x; x < r.x + r.w; x++) {
      for (let y = r.y; y < r.y + r.h; y++) covered.add(`${x},${y}`)
    }
    minX = Math.min(minX, r.x)
    minY = Math.min(minY, r.y)
    maxX = Math.max(maxX, r.x + r.w)
    maxY = Math.max(maxY, r.y + r.h)
  }
  const isCovered = (x: number, y: number) => covered.has(`${x},${y}`)
  const segments: Segment[] = []

  // Horizontale randen: tussen rij y-1 en rij y.
  for (let y = minY; y <= maxY; y++) {
    let start: number | null = null
    for (let x = minX; x <= maxX; x++) {
      const edge = x < maxX && isCovered(x, y - 1) !== isCovered(x, y)
      if (edge && start === null) start = x
      if (!edge && start !== null) {
        segments.push({ x1: start, y1: y, x2: x, y2: y })
        start = null
      }
    }
  }

  // Verticale randen: tussen kolom x-1 en kolom x.
  for (let x = minX; x <= maxX; x++) {
    let start: number | null = null
    for (let y = minY; y <= maxY; y++) {
      const edge = y < maxY && isCovered(x - 1, y) !== isCovered(x, y)
      if (edge && start === null) start = y
      if (!edge && start !== null) {
        segments.push({ x1: x, y1: start, x2: x, y2: y })
        start = null
      }
    }
  }

  return segments
}

/** Kleinste rechthoek rond vloer en zones, met wat marge; voor de weergave. */
export function layoutBounds(layout: ShopLayout, margin = 1): Rect {
  const rects = [...layout.floor, ...layout.areas.map((a) => a.rect)]
  if (rects.length === 0) return { x: 0, y: 0, w: GRID_WIDTH, h: GRID_HEIGHT }
  const minX = Math.min(...rects.map((r) => r.x))
  const minY = Math.min(...rects.map((r) => r.y))
  const maxX = Math.max(...rects.map((r) => r.x + r.w))
  const maxY = Math.max(...rects.map((r) => r.y + r.h))
  return {
    x: minX - margin,
    y: minY - margin,
    w: maxX - minX + 2 * margin,
    h: maxY - minY + 2 * margin,
  }
}

/* --------------------------------------------------------------- aanpassen */

/** Wat onder een vakje ligt: de bovenste zone, anders een vloerstuk. */
export type Hit = { kind: 'area'; id: Id } | { kind: 'floor'; index: number } | null

export function hitTest(layout: ShopLayout, cell: Cell): Hit {
  // De laatst getekende zone ligt bovenop.
  for (let i = layout.areas.length - 1; i >= 0; i--) {
    const area = layout.areas[i]!
    if (containsCell(area.rect, cell)) return { kind: 'area', id: area.id }
  }
  for (let i = layout.floor.length - 1; i >= 0; i--) {
    if (containsCell(layout.floor[i]!, cell)) return { kind: 'floor', index: i }
  }
  return null
}

export function addFloor(layout: ShopLayout, rect: Rect): ShopLayout {
  return { ...layout, floor: [...layout.floor, rect] }
}

export function addArea(layout: ShopLayout, area: LayoutArea): ShopLayout {
  return { ...layout, areas: [...layout.areas, area] }
}

export function removeHit(layout: ShopLayout, hit: Hit): ShopLayout {
  if (!hit) return layout
  if (hit.kind === 'area') return { ...layout, areas: layout.areas.filter((a) => a.id !== hit.id) }
  return { ...layout, floor: layout.floor.filter((_, i) => i !== hit.index) }
}

export function updateArea(layout: ShopLayout, id: Id, changes: Partial<LayoutArea>): ShopLayout {
  return {
    ...layout,
    areas: layout.areas.map((a) => (a.id === id ? { ...a, ...changes, id } : a)),
  }
}

/* ------------------------------------------------------------------ kleur */

/**
 * Zachte, onderling goed te onderscheiden kleuren. Een afdeling krijgt haar
 * kleur via haar plaats in de standaardvolgorde, zodat ze in elke winkel
 * dezelfde kleur heeft.
 */
export const AREA_PALETTE: { fill: string; stroke: string }[] = [
  { fill: '#cfe8cf', stroke: '#3f7d3f' },
  { fill: '#fde2b8', stroke: '#b26b00' },
  { fill: '#cfe0f7', stroke: '#2f5f9e' },
  { fill: '#f6cfd6', stroke: '#a33a52' },
  { fill: '#e2d6f3', stroke: '#6a4a9c' },
  { fill: '#fff1a8', stroke: '#8a7400' },
  { fill: '#c9ecec', stroke: '#2a7a7a' },
  { fill: '#f3d3bd', stroke: '#9a5527' },
  { fill: '#dbe7c2', stroke: '#5f7a26' },
  { fill: '#f2d0ef', stroke: '#8d3c86' },
  { fill: '#d6dbe3', stroke: '#4a5668' },
  { fill: '#f9d5b5', stroke: '#a85a14' },
]

export function areaColour(categoryId: Id, categories: IngredientCategory[]) {
  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder)
  const index = sorted.findIndex((c) => c.id === categoryId)
  return AREA_PALETTE[(index < 0 ? 0 : index) % AREA_PALETTE.length]!
}

/** Naam die op een zone staat. */
export function areaLabel(area: LayoutArea, categories: IngredientCategory[]): string {
  if (area.kind === 'entry') return 'Ingang'
  if (area.kind === 'register') return 'Kassa'
  return categories.find((c) => c.id === area.categoryId)?.name ?? 'Onbekende afdeling'
}

/* ------------------------------------------------------------------ zoeken */

export interface LayoutSearchResult {
  /** afdelingen die bij de zoekterm horen */
  categoryIds: Id[]
  /** uitleg per gevonden afdeling, bv. "Prei → Groenten" */
  lines: { text: string; categoryId: Id; onMap: boolean }[]
}

/**
 * Zoekt een afdeling op naam, of een product: dan telt de afdeling van dat
 * product in de ingrediëntenlijst. Zo vind je ook "waar ligt de tahin?".
 */
export function searchLayout(
  query: string,
  layout: ShopLayout,
  categories: IngredientCategory[],
  catalog: CatalogIngredient[],
  maxProducts = 5,
): LayoutSearchResult {
  const q = normalizeName(query)
  if (!q) return { categoryIds: [], lines: [] }

  const onMap = new Set(
    layout.areas.filter((a) => a.kind === 'department').map((a) => a.categoryId),
  )
  const byId = new Map(categories.map((c) => [c.id, c]))
  const lines: LayoutSearchResult['lines'] = []
  const ids = new Set<Id>()

  for (const category of categories) {
    if (normalizeName(category.name).includes(q)) {
      ids.add(category.id)
      lines.push({ text: category.name, categoryId: category.id, onMap: onMap.has(category.id) })
    }
  }

  const products = catalog
    .filter((item) => item.nameLower.includes(q) && byId.has(item.categoryId))
    .sort((a, b) => {
      const aStarts = a.nameLower.startsWith(q) ? 0 : 1
      const bStarts = b.nameLower.startsWith(q) ? 0 : 1
      return aStarts - bStarts || a.nameLower.localeCompare(b.nameLower)
    })
    .slice(0, maxProducts)

  for (const item of products) {
    const category = byId.get(item.categoryId)!
    ids.add(category.id)
    lines.push({
      text: `${item.name} → ${category.name}`,
      categoryId: category.id,
      onMap: onMap.has(category.id),
    })
  }

  return { categoryIds: [...ids], lines }
}
