import { describe, expect, it } from 'vitest'
import type { RecipeIngredient } from './types'
import {
  formatAmount,
  formatNumber,
  parseAmount,
  presentAmount,
  roundForDisplay,
  scaleAmount,
  scaleIngredient,
} from './scaling'

const ing = (over: Partial<RecipeIngredient>): RecipeIngredient => ({
  lineId: 'l1',
  ingredientId: null,
  name: 'test',
  amount: 100,
  unit: 'g',
  categoryId: 'c1',
  ...over,
})

describe('herschalen', () => {
  it('schaalt evenredig vanaf 4 personen', () => {
    expect(scaleAmount(400, 4, 8)).toBe(800)
    expect(scaleAmount(400, 4, 2)).toBe(200)
    expect(scaleAmount(400, 4, 1)).toBe(100)
    expect(scaleAmount(400, 4, 12)).toBe(1200)
  })

  it('laat regels zonder hoeveelheid met rust', () => {
    expect(scaleAmount(null, 4, 8)).toBeNull()
  })

  it('levert nooit NaN of een deling door nul', () => {
    expect(scaleAmount(100, 0, 4)).toBeNull()
    expect(scaleAmount(Number.NaN, 4, 8)).toBeNull()
  })
})

describe('afronden', () => {
  it('gebruikt grotere stappen bij grotere hoeveelheden', () => {
    expect(roundForDisplay(3.3, 'g')).toBe(3.5) // < 5   -> stap 0,5
    expect(roundForDisplay(17.4, 'g')).toBe(17) // < 20  -> stap 1
    expect(roundForDisplay(62, 'g')).toBe(60) // < 100 -> stap 5
    expect(roundForDisplay(237, 'g')).toBe(240) // < 500 -> stap 10
    expect(roundForDisplay(640, 'g')).toBe(650) // >=500 -> stap 25
  })

  it('rondt stuks en lepels naar bruikbare breuken', () => {
    expect(roundForDisplay(1.3, 'st')).toBe(1.5)
    expect(roundForDisplay(5.25, 'st')).toBe(5)
    expect(roundForDisplay(1.1, 'el')).toBe(1)
    expect(roundForDisplay(1.6, 'el')).toBe(1.5)
    expect(roundForDisplay(3.3, 'el')).toBe(3.5)
    expect(roundForDisplay(0.6, 'teen')).toBe(0.5)
  })

  it('rondt een bestaande hoeveelheid nooit weg naar nul', () => {
    expect(roundForDisplay(0.1, 'g')).toBe(0.5)
    expect(roundForDisplay(0.05, 'tl')).toBe(0.25)
  })

  it('kiest de prettigste eenheid', () => {
    expect(presentAmount(0.4, 'kg')).toEqual({ amount: 400, unit: 'g' })
    expect(presentAmount(1500, 'g')).toEqual({ amount: 1.5, unit: 'kg' })
    expect(presentAmount(250, 'ml')).toEqual({ amount: 250, unit: 'ml' })
  })

  it('stapt mee naar boven als afronden over de grens duwt', () => {
    // 990 g rondt af naar 1000 g, en hoort dan als 1 kg te verschijnen.
    expect(presentAmount(990, 'g')).toEqual({ amount: 1, unit: 'kg' })
  })
})

describe('weergave', () => {
  it('schrijft breuken als breuk en de rest met een komma', () => {
    expect(formatNumber(0.5)).toBe('½')
    expect(formatNumber(1.5)).toBe('1½')
    expect(formatNumber(2.75)).toBe('2¾')
    expect(formatNumber(0.25)).toBe('¼')
    expect(formatNumber(350)).toBe('350')
    expect(formatNumber(1.35)).toBe('1,35')
  })

  it('toont niets als er geen hoeveelheid is', () => {
    expect(formatAmount(null, 'snuf')).toBe('')
    expect(formatAmount(1.5, 'el')).toBe('1½ el')
    expect(formatAmount(350, 'g')).toBe('350 g')
  })
})

describe('receptregel herschalen', () => {
  it('bewaart de exacte waarde naast de afgeronde weergave', () => {
    const scaled = scaleIngredient(ing({ amount: 500, unit: 'g' }), 7)
    // 500 g voor 4 personen -> 875 g voor 7 personen
    expect(scaled.exactAmount).toBe(875)
    expect(scaled.displayAmount).toBe(875)
    expect(scaled.displayUnit).toBe('g')
  })

  it('schakelt over naar kg zodra dat prettiger leest', () => {
    const scaled = scaleIngredient(ing({ amount: 600, unit: 'g' }), 12)
    expect(scaled.exactAmount).toBe(1800)
    expect(scaled.displayAmount).toBe(1.8)
    expect(scaled.displayUnit).toBe('kg')
  })

  it('houdt de onafgeronde waarde apart van wat je ziet', () => {
    const scaled = scaleIngredient(ing({ amount: 3, unit: 'st' }), 7)
    expect(scaled.exactAmount).toBe(5.25)
    expect(scaled.displayAmount).toBe(5)
  })
})

describe('hoeveelheid inlezen', () => {
  it('leest komma en punt als decimaalteken', () => {
    expect(parseAmount('1,5')).toBe(1.5)
    expect(parseAmount('1.5')).toBe(1.5)
    expect(parseAmount('350')).toBe(350)
  })

  it('leest breuken zoals mensen ze schrijven', () => {
    expect(parseAmount('1/2')).toBe(0.5)
    expect(parseAmount('1 1/2')).toBe(1.5)
    expect(parseAmount('3/4')).toBe(0.75)
  })

  it('leest de breuktekens terug die we zelf tonen', () => {
    expect(parseAmount('½')).toBe(0.5)
    expect(parseAmount('1½')).toBe(1.5)
    expect(parseAmount('2¾')).toBe(2.75)
    // Wat formatNumber uitspuwt, moet parseAmount weer kunnen inlezen.
    expect(parseAmount(formatNumber(1.25))).toBe(1.25)
    expect(parseAmount(formatNumber(2.5))).toBe(2.5)
  })

  it('geeft niets terug bij leeg of onzin', () => {
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('   ')).toBeNull()
    expect(parseAmount('veel')).toBeNull()
    expect(parseAmount('-5')).toBeNull()
    expect(parseAmount('1/0')).toBeNull()
  })
})
