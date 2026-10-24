import { describe, expect, it } from 'vitest'
import { addAmounts, canMerge, fromBase, toBase } from './units'

describe('eenheden', () => {
  it('rekent binnen massa en volume om', () => {
    expect(toBase(1.5, 'kg')).toEqual({ value: 1500, dimension: 'massa' })
    expect(toBase(0.25, 'l')).toEqual({ value: 250, dimension: 'volume' })
  })

  it('kiest de prettigste eenheid terug', () => {
    expect(fromBase({ value: 1500, dimension: 'massa' })).toEqual({ amount: 1.5, unit: 'kg' })
    expect(fromBase({ value: 800, dimension: 'massa' })).toEqual({ amount: 800, unit: 'g' })
    expect(fromBase({ value: 250, dimension: 'volume' })).toEqual({ amount: 250, unit: 'ml' })
  })

  it('staat alleen optellen toe binnen dezelfde dimensie', () => {
    expect(canMerge('g', 'kg')).toBe(true)
    expect(canMerge('ml', 'l')).toBe(true)
    expect(canMerge('g', 'ml')).toBe(false)
    expect(canMerge('st', 'g')).toBe(false)
    // Een eetlepel is geen theelepel: niet stilzwijgend omrekenen.
    expect(canMerge('el', 'tl')).toBe(false)
    expect(canMerge('teen', 'st')).toBe(false)
  })

  it('telt verenigbare hoeveelheden op', () => {
    expect(addAmounts({ amount: 200, unit: 'g' }, { amount: 0.3, unit: 'kg' })).toEqual({
      amount: 500,
      unit: 'g',
    })
    expect(addAmounts({ amount: 600, unit: 'ml' }, { amount: 0.5, unit: 'l' })).toEqual({
      amount: 1.1,
      unit: 'l',
    })
  })

  it('weigert onverenigbare eenheden', () => {
    expect(addAmounts({ amount: 2, unit: 'st' }, { amount: 400, unit: 'g' })).toBeNull()
  })

  it('houdt regels zonder hoeveelheid zonder hoeveelheid', () => {
    expect(addAmounts({ amount: null, unit: 'snuf' }, { amount: null, unit: 'snuf' })).toEqual({
      amount: null,
      unit: 'snuf',
    })
  })
})
