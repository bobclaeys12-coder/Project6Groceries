import type { Table } from 'dexie'
import { db } from './db'
import { deviceId } from './device'
import { newId } from '../core/ids'
import type { Dataset, Id, SyncedTable, TableTypes } from '../core/types'
import { SYNCED_TABLES } from '../core/types'

type Rec<K extends SyncedTable> = TableTypes[K]

function tableOf<K extends SyncedTable>(name: K): Table<Rec<K>, string> {
  return db[name] as unknown as Table<Rec<K>, string>
}

/** Velden die de repository zelf invult. */
export type NewRecord<K extends SyncedTable> = Omit<
  Rec<K>,
  'id' | 'updatedAt' | 'deleted' | 'deviceId'
> & { id?: Id }

/**
 * Elke schrijfactie loopt via deze helpers, zodat updatedAt en deviceId altijd
 * meeveranderen. Dat is precies wat de merge bij sync nodig heeft; een record
 * dat rechtstreeks via db.table.put() geschreven wordt, mist die stempel en
 * kan bij sync ten onrechte verliezen van een oudere versie.
 */
export async function createRecord<K extends SyncedTable>(
  name: K,
  fields: NewRecord<K>,
): Promise<Rec<K>> {
  const record = {
    ...fields,
    id: fields.id ?? newId(),
    updatedAt: Date.now(),
    deleted: 0,
    deviceId: deviceId(),
  } as Rec<K>
  await tableOf(name).put(record)
  return record
}

export async function updateRecord<K extends SyncedTable>(
  name: K,
  id: Id,
  changes: Partial<Rec<K>>,
): Promise<Rec<K> | undefined> {
  const existing = await tableOf(name).get(id)
  if (!existing) return undefined
  const updated = {
    ...existing,
    ...changes,
    id,
    updatedAt: Date.now(),
    deviceId: deviceId(),
  } as Rec<K>
  await tableOf(name).put(updated)
  return updated
}

/**
 * Zacht verwijderen. Het record blijft bestaan als tombstone, anders zou het
 * bij de volgende sync gewoon terugkomen vanaf het andere toestel.
 */
export async function deleteRecord<K extends SyncedTable>(name: K, id: Id): Promise<void> {
  await updateRecord(name, id, { deleted: 1 } as Partial<Rec<K>>)
}

export async function restoreRecord<K extends SyncedTable>(name: K, id: Id): Promise<void> {
  await updateRecord(name, id, { deleted: 0 } as Partial<Rec<K>>)
}

/** Alles wat niet verwijderd is. */
export async function listRecords<K extends SyncedTable>(name: K): Promise<Rec<K>[]> {
  return tableOf(name).where('deleted').equals(0).toArray()
}

export async function getRecord<K extends SyncedTable>(
  name: K,
  id: Id,
): Promise<Rec<K> | undefined> {
  const found = await tableOf(name).get(id)
  if (!found || found.deleted === 1) return undefined
  return found
}

/** Volgend vrij sorteernummer, zodat nieuwe items achteraan belanden. */
export async function nextSortOrder<K extends SyncedTable>(name: K): Promise<number> {
  const all = (await tableOf(name).toArray()) as Array<{ sortOrder?: number }>
  return all.reduce((max, r) => Math.max(max, r.sortOrder ?? 0), 0) + 1
}

/**
 * Volledige momentopname, inclusief tombstones. Dit is wat over de sync gaat
 * en wat in de JSON-export belandt.
 */
export async function readDataset(): Promise<Dataset> {
  const entries = await Promise.all(
    SYNCED_TABLES.map(async (name) => [name, await tableOf(name).toArray()] as const),
  )
  return Object.fromEntries(entries) as Dataset
}

/** Schrijft samengevoegde records terug, zonder updatedAt/deviceId aan te raken. */
export async function writeMerged<K extends SyncedTable>(
  name: K,
  records: Rec<K>[],
): Promise<void> {
  if (records.length === 0) return
  await tableOf(name).bulkPut(records)
}
