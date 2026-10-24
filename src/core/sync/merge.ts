import { SYNCED_TABLES } from '../types'
import type { Dataset, SyncedRecord, SyncedTable } from '../types'

/**
 * Welke van twee versies van hetzelfde record wint.
 *
 * De nieuwste updatedAt wint. Bij exact dezelfde milliseconde beslist het
 * hoogste deviceId; omdat beide toestellen die regel volgen, komen ze zonder
 * extra overleg tot hetzelfde resultaat. Een verwijdering is gewoon een record
 * met deleted: 1 en wint of verliest dus op tijd, net als elke andere wijziging.
 */
export function remoteWins(local: SyncedRecord, remote: SyncedRecord): boolean {
  if (remote.updatedAt !== local.updatedAt) return remote.updatedAt > local.updatedAt
  return remote.deviceId > local.deviceId
}

export interface MergeCounts {
  /** nieuw op dit toestel */
  added: number
  /** bestond al, nu overschreven door een nieuwere versie */
  updated: number
  /** hier verwijderd omdat het andere toestel het verwijderde */
  deleted: number
}

export interface TableMerge<T> {
  /** alleen wat op dit toestel geschreven moet worden */
  toWrite: T[]
  counts: MergeCounts
}

export const emptyCounts = (): MergeCounts => ({ added: 0, updated: 0, deleted: 0 })

export function addCounts(a: MergeCounts, b: MergeCounts): MergeCounts {
  return { added: a.added + b.added, updated: a.updated + b.updated, deleted: a.deleted + b.deleted }
}

/**
 * Voegt de records van het andere toestel samen met de eigen records.
 * Geeft alleen terug wat hier moet veranderen; wat lokaal al nieuwer of gelijk
 * is, blijft onaangeroerd. Het hele record wordt overgenomen, ook velden die
 * deze app-versie niet kent, zodat een nieuwere versie niets verliest.
 */
export function mergeRecords<T extends SyncedRecord>(local: T[], remote: T[]): TableMerge<T> {
  const localById = new Map(local.map((record) => [record.id, record]))
  // Mocht het andere toestel hetzelfde id twee keer sturen, dan telt de winnaar.
  const remoteById = new Map<string, T>()
  for (const record of remote) {
    const seen = remoteById.get(record.id)
    if (!seen || remoteWins(seen, record)) remoteById.set(record.id, record)
  }

  const toWrite: T[] = []
  const counts = emptyCounts()

  for (const incoming of remoteById.values()) {
    const existing = localById.get(incoming.id)

    if (!existing) {
      // Ook een tombstone van iets dat we nooit hadden bewaren we, anders
      // komt het record later via een derde toestel alsnog terug.
      toWrite.push(incoming)
      if (incoming.deleted === 0) counts.added++
      continue
    }

    if (!remoteWins(existing, incoming)) continue
    toWrite.push(incoming)

    if (incoming.deleted === 1 && existing.deleted === 0) counts.deleted++
    else if (incoming.deleted === 0 && existing.deleted === 1) counts.added++
    else if (incoming.deleted === 0) counts.updated++
  }

  return { toWrite, counts }
}

export interface DatasetMerge {
  toWrite: Partial<Dataset>
  counts: MergeCounts
}

/**
 * Hetzelfde voor alle tabellen tegelijk. Tabellen die het andere toestel niet
 * meestuurt, of die deze versie niet kent, worden overgeslagen.
 */
export function mergeDatasets(local: Dataset, remote: Partial<Dataset>): DatasetMerge {
  const toWrite: Partial<Dataset> = {}
  let counts = emptyCounts()

  for (const table of SYNCED_TABLES) {
    const incoming = remote[table]
    if (!incoming || incoming.length === 0) continue
    const result = mergeTable(table, local, incoming)
    if (result.toWrite.length > 0) (toWrite as Record<SyncedTable, unknown>)[table] = result.toWrite
    counts = addCounts(counts, result.counts)
  }

  return { toWrite, counts }
}

function mergeTable<K extends SyncedTable>(
  table: K,
  local: Dataset,
  incoming: Dataset[K],
): TableMerge<Dataset[K][number]> {
  return mergeRecords<Dataset[K][number]>(local[table] ?? [], incoming)
}

/** Past een merge toe op een dataset in het geheugen; voor tests en simulaties. */
export function applyMerge(local: Dataset, merge: DatasetMerge): Dataset {
  const result = { ...local }
  for (const table of SYNCED_TABLES) {
    const writes = merge.toWrite[table] as SyncedRecord[] | undefined
    if (!writes) continue
    const byId = new Map((local[table] as SyncedRecord[]).map((r) => [r.id, r]))
    for (const record of writes) byId.set(record.id, record)
    ;(result as Record<SyncedTable, SyncedRecord[]>)[table] = [...byId.values()]
  }
  return result
}
