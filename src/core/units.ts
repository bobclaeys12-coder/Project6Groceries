import type { Unit } from './types'

/**
 * Eenheden en hun onderlinge omrekenbaarheid.
 *
 * Alleen massa (g/kg) en volume (ml/l) zijn onderling omrekenbaar. Elke andere
 * eenheid vormt haar eigen dimensie: een teentje knoflook is geen stuk, en een
 * eetlepel is geen theelepel in de zin dat we er stilzwijgend mee mogen rekenen.
 * Twee hoeveelheden mogen alleen samengeteld worden binnen dezelfde dimensie.
 */
export type Dimension =
  | 'massa'
  | 'volume'
  | 'stuk'
  | 'el'
  | 'tl'
  | 'snuf'
  | 'teen'
  | 'bussel'
  | 'blik'
  | 'pak'

interface UnitInfo {
  /** korte weergave naast een hoeveelheid */
  label: string
  /** volledige naam in keuzelijsten */
  longLabel: string
  dimension: Dimension
  /** hoeveel basiseenheden één van deze eenheid is */
  factor: number
}

export const UNIT_INFO: Record<Unit, UnitInfo> = {
  g: { label: 'g', longLabel: 'gram (g)', dimension: 'massa', factor: 1 },
  kg: { label: 'kg', longLabel: 'kilogram (kg)', dimension: 'massa', factor: 1000 },
  ml: { label: 'ml', longLabel: 'milliliter (ml)', dimension: 'volume', factor: 1 },
  l: { label: 'l', longLabel: 'liter (l)', dimension: 'volume', factor: 1000 },
  st: { label: 'st', longLabel: 'stuk', dimension: 'stuk', factor: 1 },
  el: { label: 'el', longLabel: 'eetlepel (el)', dimension: 'el', factor: 1 },
  tl: { label: 'tl', longLabel: 'theelepel (tl)', dimension: 'tl', factor: 1 },
  snuf: { label: 'snuf', longLabel: 'snuifje', dimension: 'snuf', factor: 1 },
  teen: { label: 'teen', longLabel: 'teentje', dimension: 'teen', factor: 1 },
  bussel: { label: 'bussel', longLabel: 'bussel', dimension: 'bussel', factor: 1 },
  blik: { label: 'blik', longLabel: 'blik', dimension: 'blik', factor: 1 },
  pak: { label: 'pak', longLabel: 'pak', dimension: 'pak', factor: 1 },
}

/** Volgorde in keuzelijsten: meest gebruikte eerst. */
export const UNITS: Unit[] = [
  'g',
  'kg',
  'ml',
  'l',
  'st',
  'el',
  'tl',
  'snuf',
  'teen',
  'bussel',
  'blik',
  'pak',
]

/** De eenheid waarin een dimensie intern gerekend wordt. */
const BASE_UNIT: Record<Dimension, Unit> = {
  massa: 'g',
  volume: 'ml',
  stuk: 'st',
  el: 'el',
  tl: 'tl',
  snuf: 'snuf',
  teen: 'teen',
  bussel: 'bussel',
  blik: 'blik',
  pak: 'pak',
}

export function dimensionOf(unit: Unit): Dimension {
  return UNIT_INFO[unit].dimension
}

export function unitLabel(unit: Unit): string {
  return UNIT_INFO[unit].label
}

/** Mogen twee hoeveelheden met deze eenheden opgeteld worden? */
export function canMerge(a: Unit, b: Unit): boolean {
  return dimensionOf(a) === dimensionOf(b)
}

export interface BaseAmount {
  value: number
  dimension: Dimension
}

export function toBase(amount: number, unit: Unit): BaseAmount {
  return { value: amount * UNIT_INFO[unit].factor, dimension: dimensionOf(unit) }
}

/**
 * Terug naar een prettige eenheid: 1500 g wordt 1,5 kg, 800 g blijft 800 g.
 * Alleen massa en volume hebben een grotere eenheid om naar te schalen.
 */
export function fromBase({ value, dimension }: BaseAmount): { amount: number; unit: Unit } {
  if (dimension === 'massa' && Math.abs(value) >= 1000) {
    return { amount: value / 1000, unit: 'kg' }
  }
  if (dimension === 'volume' && Math.abs(value) >= 1000) {
    return { amount: value / 1000, unit: 'l' }
  }
  return { amount: value, unit: BASE_UNIT[dimension] }
}

/**
 * Telt twee hoeveelheden op. Geeft null terug als de eenheden niet verenigbaar
 * zijn — de oproeper beslist dan om er twee aparte regels van te maken.
 */
export function addAmounts(
  a: { amount: number | null; unit: Unit },
  b: { amount: number | null; unit: Unit },
): { amount: number | null; unit: Unit } | null {
  if (!canMerge(a.unit, b.unit)) return null
  // Een regel zonder hoeveelheid ("peper") blijft zonder hoeveelheid.
  if (a.amount === null && b.amount === null) return { amount: null, unit: a.unit }
  const total = toBase(a.amount ?? 0, a.unit).value + toBase(b.amount ?? 0, b.unit).value
  return fromBase({ value: total, dimension: dimensionOf(a.unit) })
}
