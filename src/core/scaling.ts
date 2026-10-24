import type { RecipeIngredient, Unit } from './types'
import { dimensionOf, fromBase, toBase, unitLabel } from './units'

/** Recepten worden altijd voor 4 personen ingevoerd en bewaard. */
export const BASE_PORTIONS = 4
export const MIN_PORTIONS = 1
export const MAX_PORTIONS = 12

/** Ruwe herschaling, zonder afronding. */
export function scaleAmount(
  amount: number | null,
  fromPortions: number,
  toPortions: number,
): number | null {
  if (amount === null) return null
  if (!Number.isFinite(amount) || fromPortions <= 0) return null
  return (amount * toPortions) / fromPortions
}

/**
 * Afrondstappen per eenheid. Niemand weegt 237 g bloem af; 240 g wel.
 * De stap groeit mee met de hoeveelheid, zodat kleine hoeveelheden precies
 * blijven en grote hoeveelheden leesbaar worden.
 */
function stepFor(amount: number, unit: Unit): number {
  const v = Math.abs(amount)
  switch (unit) {
    case 'g':
    case 'ml':
      if (v < 5) return 0.5
      if (v < 20) return 1
      if (v < 100) return 5
      if (v < 500) return 10
      return 25
    case 'kg':
    case 'l':
      return 0.05
    case 'st':
    case 'blik':
    case 'pak':
      return v < 2 ? 0.5 : 1
    case 'el':
    case 'tl':
      return v < 2 ? 0.25 : 0.5
    case 'snuf':
    case 'teen':
    case 'bussel':
      return 0.5
  }
}

/** Rondt af binnen de gegeven eenheid, zonder van eenheid te wisselen. */
export function roundForDisplay(amount: number, unit: Unit): number {
  if (!Number.isFinite(amount)) return 0
  if (amount === 0) return 0
  const step = stepFor(amount, unit)
  const rounded = Math.round(amount / step) * step
  // Een hoeveelheid die er is, mag nooit naar 0 afgerond worden.
  const safe = rounded === 0 ? Math.sign(amount) * step : rounded
  // Drijvendekomma-ruis wegpoetsen: 0.30000000000000004 -> 0.3
  return Number(safe.toFixed(4))
}

/**
 * Kiest de prettigste eenheid én rondt af. 0,4 kg wordt 400 g, 1500 g wordt
 * 1,5 kg. Dit is wat de UI toont; wat we opslaan blijft de exacte waarde.
 */
export function presentAmount(
  amount: number | null,
  unit: Unit,
): { amount: number | null; unit: Unit } {
  if (amount === null) return { amount: null, unit }
  if (!Number.isFinite(amount)) return { amount: null, unit }

  const normalized = fromBase(toBase(amount, unit))
  let out = { amount: roundForDisplay(normalized.amount, normalized.unit), unit: normalized.unit }

  // Afronden kan over een grens duwen: 990 g -> 1000 g -> 1 kg.
  if ((out.unit === 'g' || out.unit === 'ml') && Math.abs(out.amount) >= 1000) {
    const bumped = fromBase({ value: out.amount, dimension: dimensionOf(out.unit) })
    out = { amount: roundForDisplay(bumped.amount, bumped.unit), unit: bumped.unit }
  }
  return out
}

const FRACTIONS: Record<string, string> = {
  '0.25': '¼',
  '0.5': '½',
  '0.75': '¾',
}

/** Nederlandse notatie: komma als decimaalteken, breuken waar dat natuurlijk leest. */
export function formatNumber(value: number): string {
  const rounded = Number(value.toFixed(2))
  const sign = rounded < 0 ? '-' : ''
  const abs = Math.abs(rounded)
  const whole = Math.floor(abs)
  const frac = Number((abs - whole).toFixed(2))

  const glyph = FRACTIONS[String(frac)]
  if (glyph) return `${sign}${whole === 0 ? '' : whole}${glyph}`
  if (frac === 0) return `${sign}${whole}`
  return `${sign}${abs.toFixed(2).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',')}`
}

/** "350 g", "1½ el", of "" als er geen hoeveelheid is. */
export function formatAmount(amount: number | null, unit: Unit): string {
  if (amount === null) return ''
  return `${formatNumber(amount)} ${unitLabel(unit)}`
}

export interface ScaledIngredient extends RecipeIngredient {
  /** afgeronde hoeveelheid zoals getoond */
  displayAmount: number | null
  displayUnit: Unit
  /** exacte, niet-afgeronde waarde — dit gaat naar de boodschappenlijst */
  exactAmount: number | null
}

/**
 * Herschaalt één receptregel naar het gekozen aantal personen.
 *
 * Let op: de boodschappenlijst krijgt `exactAmount`, niet de afgeronde waarde.
 * Anders stapelt de afrondfout op zodra je hetzelfde recept twee keer toevoegt.
 */
export function scaleIngredient(
  ingredient: RecipeIngredient,
  toPortions: number,
  fromPortions: number = BASE_PORTIONS,
): ScaledIngredient {
  const exact = scaleAmount(ingredient.amount, fromPortions, toPortions)
  const shown = presentAmount(exact, ingredient.unit)
  return {
    ...ingredient,
    exactAmount: exact,
    displayAmount: shown.amount,
    displayUnit: shown.unit,
  }
}

export function scaleIngredients(
  ingredients: RecipeIngredient[],
  toPortions: number,
  fromPortions: number = BASE_PORTIONS,
): ScaledIngredient[] {
  return ingredients.map((i) => scaleIngredient(i, toPortions, fromPortions))
}

const FRACTION_GLYPHS: Record<string, number> = {
  '½': 0.5,
  '¼': 0.25,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
}

/**
 * Leest een hoeveelheid zoals een mens ze intypt: "1,5" met komma, "1 1/2" of
 * "1½". Geeft null terug voor leeg of onzin, zodat een regel zonder
 * hoeveelheid (peper, zout) gewoon leeg mag blijven.
 */
export function parseAmount(input: string): number | null {
  const text = input.trim().replace(/\s+/g, ' ')
  if (!text) return null

  const glyph = text.match(/^(\d+)?\s*([¼½¾⅓⅔])$/)
  if (glyph) {
    const whole = glyph[1] ? Number(glyph[1]) : 0
    return whole + (FRACTION_GLYPHS[glyph[2]!] ?? 0)
  }

  const fraction = text.match(/^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/)
  if (fraction) {
    const denominator = Number(fraction[3])
    if (!denominator) return null
    return (fraction[1] ? Number(fraction[1]) : 0) + Number(fraction[2]) / denominator
  }

  const value = Number(text.replace(',', '.'))
  if (!Number.isFinite(value) || value < 0) return null
  return value
}
