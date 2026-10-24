import { describe, expect, it } from 'vitest'
import { decodeEnvelope, encodeDataset, EXPORT_FORMAT, exportFileName, ImportError } from './serialize'
import { SCHEMA_VERSION } from '../types'
import type { Recipe } from '../types'

const recipe = (photo: Blob | null): Recipe => ({
  id: 'r1',
  updatedAt: 5,
  deleted: 0,
  deviceId: 'pc',
  name: 'Soep',
  nameLower: 'soep',
  categoryId: 'c',
  notes: '',
  photo,
  basePortions: 4,
  ingredients: [],
  steps: ['Koken'],
})

const meta = { deviceId: 'pc', deviceName: 'Windows-pc', now: 123 }

describe('export en import', () => {
  it('maakt een omhulsel met formaat en versie', async () => {
    const envelope = await encodeDataset({ recipes: [recipe(null)] }, meta)
    expect(envelope).toMatchObject({
      format: EXPORT_FORMAT,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: 123,
      deviceId: 'pc',
      deviceName: 'Windows-pc',
    })
  })

  it('neemt een foto mee door JSON heen, byte voor byte', async () => {
    const bytes = new Uint8Array(100_000).map((_, i) => (i * 7) % 256)
    const photo = new Blob([bytes], { type: 'image/jpeg' })

    const text = JSON.stringify(await encodeDataset({ recipes: [recipe(photo)] }, meta))
    const decoded = decodeEnvelope(JSON.parse(text))
    const back = decoded.dataset.recipes![0]!.photo!

    expect(back.type).toBe('image/jpeg')
    expect(new Uint8Array(await back.arrayBuffer())).toEqual(bytes)
  })

  it('laat een recept zonder foto zonder foto', async () => {
    const text = JSON.stringify(await encodeDataset({ recipes: [recipe(null)] }, meta))
    expect(decodeEnvelope(JSON.parse(text)).dataset.recipes![0]!.photo).toBeNull()
  })

  it('weigert een bestand van een andere app', () => {
    expect(() => decodeEnvelope({ format: 'iets-anders', tables: {} })).toThrow(ImportError)
    expect(() => decodeEnvelope(null)).toThrow(/geen gegevens/)
  })

  it('weigert een andere gegevensversie met uitleg', () => {
    expect(() =>
      decodeEnvelope({ format: EXPORT_FORMAT, schemaVersion: 99, tables: {} }),
    ).toThrow(/v99/)
  })

  it('slaat records zonder geldig omhulsel over en telt ze', () => {
    const decoded = decodeEnvelope({
      format: EXPORT_FORMAT,
      schemaVersion: SCHEMA_VERSION,
      deviceId: 'tel',
      exportedAt: 1,
      tables: {
        shops: [
          { id: 's1', updatedAt: 1, deleted: 0, deviceId: 'tel', name: 'Colruyt', categoryOrder: [] },
          { id: 's2', name: 'zonder stempel' },
          'rommel',
        ],
        onbekendeTabel: [{ id: 'x' }],
      },
    })
    expect(decoded.dataset.shops).toHaveLength(1)
    expect(decoded.skipped).toBe(2)
    expect(Object.keys(decoded.dataset)).toEqual(['shops'])
  })

  it('geeft het bestand een datum in de naam', () => {
    expect(exportFileName(new Date(2026, 9, 4))).toBe('boodschappen-2026-10-04.json')
  })
})
