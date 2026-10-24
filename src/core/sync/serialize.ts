import { SCHEMA_VERSION, SYNCED_TABLES } from '../types'
import type { Dataset, SyncedRecord, SyncedTable } from '../types'

/**
 * Het formaat van een export, en tegelijk wat er over de sync gaat. Eén
 * omhulsel voor beide transporten, zodat een import exact dezelfde merge
 * doorloopt als een synchronisatie.
 */
export const EXPORT_FORMAT = 'project6groceries'

export interface ExportEnvelope {
  format: typeof EXPORT_FORMAT
  schemaVersion: number
  exportedAt: number
  deviceId: string
  deviceName?: string
  tables: Partial<Record<SyncedTable, unknown[]>>
}

/** Een Blob (receptfoto) kan niet in JSON; zo ziet hij er daar uit. */
interface EncodedBlob {
  $blob: string
  type: string
}

function isEncodedBlob(value: unknown): value is EncodedBlob {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as EncodedBlob).$blob === 'string' &&
    typeof (value as EncodedBlob).type === 'string'
  )
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  // In stukken, anders loopt String.fromCharCode bij grote foto's tegen de
  // limiet van het aantal functie-argumenten aan.
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

function base64ToBlob(data: string, type: string): Blob {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type })
}

async function encodeRecord(record: SyncedRecord): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    out[key] =
      value instanceof Blob
        ? ({ $blob: await blobToBase64(value), type: value.type } satisfies EncodedBlob)
        : value
  }
  return out
}

function decodeRecord(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    out[key] = isEncodedBlob(value) ? base64ToBlob(value.$blob, value.type) : value
  }
  return out
}

export async function encodeDataset(
  dataset: Partial<Dataset>,
  meta: { deviceId: string; deviceName?: string; now: number },
): Promise<ExportEnvelope> {
  const tables: ExportEnvelope['tables'] = {}
  for (const table of SYNCED_TABLES) {
    const records = dataset[table] as SyncedRecord[] | undefined
    if (!records) continue
    tables[table] = await Promise.all(records.map(encodeRecord))
  }
  return {
    format: EXPORT_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: meta.now,
    deviceId: meta.deviceId,
    ...(meta.deviceName ? { deviceName: meta.deviceName } : {}),
    tables,
  }
}

export class ImportError extends Error {}

/** Alleen records met een geldig omhulsel komen door; de rest wordt overgeslagen. */
function isValidRecord(value: unknown): value is Record<string, unknown> & SyncedRecord {
  if (typeof value !== 'object' || value === null) return false
  const r = value as Partial<SyncedRecord>
  return (
    typeof r.id === 'string' &&
    r.id.length > 0 &&
    typeof r.updatedAt === 'number' &&
    Number.isFinite(r.updatedAt) &&
    (r.deleted === 0 || r.deleted === 1) &&
    typeof r.deviceId === 'string'
  )
}

export interface DecodedEnvelope {
  dataset: Partial<Dataset>
  deviceId: string
  deviceName?: string
  exportedAt: number
  /** records die niet aan het omhulsel voldeden */
  skipped: number
}

/**
 * Leest een export (of een sync-bericht) terug in. Gooit een ImportError met
 * een Nederlandse uitleg als het bestand niet van deze app is of van een
 * andere gegevensversie.
 */
export function decodeEnvelope(input: unknown): DecodedEnvelope {
  if (typeof input !== 'object' || input === null) {
    throw new ImportError('Dit bestand bevat geen gegevens van deze app.')
  }
  const envelope = input as Partial<ExportEnvelope>
  if (envelope.format !== EXPORT_FORMAT) {
    throw new ImportError('Dit bestand komt niet van deze app.')
  }
  if (envelope.schemaVersion !== SCHEMA_VERSION) {
    throw new ImportError(
      `Dit bestand heeft gegevensversie v${String(envelope.schemaVersion)}, deze app v${SCHEMA_VERSION}. ` +
        'Werk eerst beide toestellen bij naar dezelfde versie van de app.',
    )
  }
  if (typeof envelope.tables !== 'object' || envelope.tables === null) {
    throw new ImportError('Dit bestand is onvolledig: er zitten geen tabellen in.')
  }

  const dataset: Partial<Dataset> = {}
  let skipped = 0
  for (const table of SYNCED_TABLES) {
    const raw = envelope.tables[table]
    if (!Array.isArray(raw)) continue
    const valid = raw.filter(isValidRecord)
    skipped += raw.length - valid.length
    ;(dataset as Record<SyncedTable, unknown[]>)[table] = valid.map(decodeRecord)
  }

  return {
    dataset,
    deviceId: typeof envelope.deviceId === 'string' ? envelope.deviceId : 'onbekend',
    ...(typeof envelope.deviceName === 'string' ? { deviceName: envelope.deviceName } : {}),
    exportedAt: typeof envelope.exportedAt === 'number' ? envelope.exportedAt : 0,
    skipped,
  }
}

/** Bestandsnaam voor een export, bv. boodschappen-2026-10-24.json. */
export function exportFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `boodschappen-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`
}
