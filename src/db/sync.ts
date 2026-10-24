import { db } from './db'
import { deviceId, deviceName } from './device'
import { readDataset, writeMerged } from './repo'
import { cleanShopRoutes } from './shops'
import { mergeDatasets } from '../core/sync/merge'
import type { MergeCounts } from '../core/sync/merge'
import { decodeEnvelope, encodeDataset } from '../core/sync/serialize'
import { SYNCED_TABLES } from '../core/types'
import type { Dataset } from '../core/types'

/** De volledige lokale gegevens, klaar om te versturen of te downloaden. */
export async function exportText(): Promise<string> {
  const envelope = await encodeDataset(await readDataset(), {
    deviceId: deviceId(),
    deviceName: deviceName(),
    now: Date.now(),
  })
  return JSON.stringify(envelope)
}

/**
 * Voegt gegevens van een ander toestel samen met die van dit toestel. Wordt
 * zowel door de sync als door een import gebruikt.
 *
 * Alles wordt in één transactie geschreven: valt de app halverwege weg, dan
 * blijft de database zoals hij was in plaats van half samengevoegd.
 */
export async function applyRemoteDataset(remote: Partial<Dataset>): Promise<MergeCounts> {
  const tables = SYNCED_TABLES.map((name) => db[name])
  return db.transaction('rw', tables, async () => {
    const merge = mergeDatasets(await readDataset(), remote)
    for (const table of SYNCED_TABLES) {
      const records = merge.toWrite[table]
      if (records) await writeMerged(table, records)
    }
    // Een afdeling die op het andere toestel verdween, kan nog in de
    // looproute van een winkel hier staan.
    await cleanShopRoutes()
    return merge.counts
  })
}

export interface ImportResult {
  counts: MergeCounts
  deviceName?: string
  exportedAt: number
  skipped: number
}

/** Leest een exportbestand in. Gooit een ImportError met uitleg bij een fout bestand. */
export async function importText(text: string): Promise<ImportResult> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = null
  }
  const decoded = decodeEnvelope(parsed)
  const counts = await applyRemoteDataset(decoded.dataset)
  return {
    counts,
    ...(decoded.deviceName ? { deviceName: decoded.deviceName } : {}),
    exportedAt: decoded.exportedAt,
    skipped: decoded.skipped,
  }
}
