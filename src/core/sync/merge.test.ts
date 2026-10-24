import { describe, expect, it } from 'vitest'
import { applyMerge, mergeDatasets, mergeRecords, remoteWins } from './merge'
import type { Dataset, RecipeCategory } from '../types'

const cat = (id: string, over: Partial<RecipeCategory> = {}): RecipeCategory => ({
  id,
  name: id,
  sortOrder: 1,
  updatedAt: 1000,
  deleted: 0,
  deviceId: 'pc',
  ...over,
})

const emptyDataset = (): Dataset => ({
  recipeCategories: [],
  ingredientCategories: [],
  ingredients: [],
  recipes: [],
  groceryItems: [],
  shops: [],
  pantryItems: [],
})

describe('wie wint', () => {
  it('de nieuwste wint, in beide richtingen', () => {
    expect(remoteWins(cat('a', { updatedAt: 1 }), cat('a', { updatedAt: 2 }))).toBe(true)
    expect(remoteWins(cat('a', { updatedAt: 2 }), cat('a', { updatedAt: 1 }))).toBe(false)
  })

  it('bij gelijke tijd beslist het deviceId, en beide kanten zijn het eens', () => {
    const pc = cat('a', { deviceId: 'pc', name: 'pc' })
    const tel = cat('a', { deviceId: 'tel', name: 'tel' })
    // Op de pc is tel "remote", op de telefoon is pc "remote".
    expect(remoteWins(pc, tel)).toBe(true)
    expect(remoteWins(tel, pc)).toBe(false)
  })

  it('een identiek record wint niet, dus er wordt niets geschreven', () => {
    expect(mergeRecords([cat('a')], [cat('a')]).toWrite).toEqual([])
  })
})

describe('records samenvoegen', () => {
  it('neemt nieuwe records over en telt ze', () => {
    const result = mergeRecords([cat('a')], [cat('a'), cat('b')])
    expect(result.toWrite.map((r) => r.id)).toEqual(['b'])
    expect(result.counts).toEqual({ added: 1, updated: 0, deleted: 0 })
  })

  it('een verwijdering wint van een oudere wijziging', () => {
    const result = mergeRecords(
      [cat('a', { updatedAt: 100, name: 'oud' })],
      [cat('a', { updatedAt: 200, deleted: 1 })],
    )
    expect(result.toWrite[0]!.deleted).toBe(1)
    expect(result.counts.deleted).toBe(1)
  })

  it('een oudere verwijdering verliest van een nieuwere wijziging', () => {
    const result = mergeRecords(
      [cat('a', { updatedAt: 300, name: 'nieuw' })],
      [cat('a', { updatedAt: 200, deleted: 1 })],
    )
    expect(result.toWrite).toEqual([])
  })

  it('bewaart een tombstone van iets dat hier nooit bestond, zonder het te tellen', () => {
    const result = mergeRecords([], [cat('weg', { deleted: 1 })])
    expect(result.toWrite).toHaveLength(1)
    expect(result.counts).toEqual({ added: 0, updated: 0, deleted: 0 })
  })

  it('telt een teruggezet record als toegevoegd', () => {
    const result = mergeRecords(
      [cat('a', { updatedAt: 1, deleted: 1 })],
      [cat('a', { updatedAt: 2, deleted: 0 })],
    )
    expect(result.counts).toEqual({ added: 1, updated: 0, deleted: 0 })
  })

  it('kiest bij een dubbel id van de andere kant de winnaar', () => {
    const result = mergeRecords([], [cat('a', { updatedAt: 2, name: 'twee' }), cat('a', { updatedAt: 1 })])
    expect(result.toWrite).toEqual([cat('a', { updatedAt: 2, name: 'twee' })])
  })

  it('laat velden die deze versie niet kent intact', () => {
    const future = { ...cat('a', { updatedAt: 9999 }), kleur: 'rood' } as RecipeCategory
    const result = mergeRecords([cat('a')], [future])
    expect((result.toWrite[0] as unknown as { kleur: string }).kleur).toBe('rood')
  })
})

describe('twee toestellen', () => {
  it('komen na een sync in beide richtingen op exact dezelfde gegevens uit', () => {
    const pc = emptyDataset()
    const tel = emptyDataset()
    pc.recipeCategories = [
      cat('soep', { updatedAt: 10, name: 'Soepen (pc)' }),
      cat('pasta', { updatedAt: 50, deleted: 1 }),
      cat('gelijk', { updatedAt: 70, deviceId: 'pc', name: 'pc-versie' }),
      cat('alleen-pc'),
    ]
    tel.recipeCategories = [
      cat('soep', { updatedAt: 20, deviceId: 'tel', name: 'Soepen (tel)' }),
      cat('pasta', { updatedAt: 40, deviceId: 'tel', name: 'Pasta oud' }),
      cat('gelijk', { updatedAt: 70, deviceId: 'tel', name: 'tel-versie' }),
      cat('alleen-tel', { deviceId: 'tel' }),
    ]

    const pcAfter = applyMerge(pc, mergeDatasets(pc, tel))
    const telAfter = applyMerge(tel, mergeDatasets(tel, pc))

    const sorted = (d: Dataset) =>
      JSON.stringify([...d.recipeCategories].sort((a, b) => a.id.localeCompare(b.id)))
    expect(sorted(pcAfter)).toBe(sorted(telAfter))

    const byId = new Map(pcAfter.recipeCategories.map((r) => [r.id, r]))
    expect(byId.get('soep')!.name).toBe('Soepen (tel)')
    expect(byId.get('pasta')!.deleted).toBe(1)
    expect(byId.get('gelijk')!.name).toBe('tel-versie')
    expect(byId.size).toBe(5)
  })

  it('een tweede sync verandert niets meer', () => {
    const pc = emptyDataset()
    const tel = emptyDataset()
    pc.recipeCategories = [cat('a', { updatedAt: 5 })]
    tel.recipeCategories = [cat('b', { deviceId: 'tel' })]
    const pcAfter = applyMerge(pc, mergeDatasets(pc, tel))
    const telAfter = applyMerge(tel, mergeDatasets(tel, pc))
    expect(mergeDatasets(pcAfter, telAfter).toWrite).toEqual({})
  })

  it('slaat tabellen over die het andere toestel niet meestuurt', () => {
    const local = emptyDataset()
    local.shops = []
    const result = mergeDatasets(local, { recipeCategories: [cat('x')] })
    expect(Object.keys(result.toWrite)).toEqual(['recipeCategories'])
  })
})
