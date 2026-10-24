import { SCHEMA_VERSION } from '../types'
import type { MergeCounts } from './merge'

/**
 * Het gesprek tussen twee toestellen. Beide kanten doen exact hetzelfde:
 *
 * 1. HELLO sturen met protocol- en gegevensversie; bij een verschil stoppen.
 * 2. Na de HELLO van de ander de eigen gegevens sturen, in stukken.
 * 3. Na de gegevens van de ander samenvoegen en DONE sturen met de aantallen.
 *
 * Klaar is pas klaar als je zelf hebt samengevoegd én de DONE van de ander
 * binnen is. Omdat de merge aan beide kanten dezelfde regels volgt, eindigen
 * ze met dezelfde gegevens.
 */
export const PROTOCOL_VERSION = 1

export type SyncMessage =
  | {
      t: 'hello'
      protocol: number
      schema: number
      deviceId: string
      deviceName: string
    }
  | { t: 'chunk'; index: number; total: number; data: string }
  | { t: 'done'; counts: MergeCounts }
  | { t: 'error'; message: string }

export function helloMessage(deviceId: string, deviceName: string): SyncMessage {
  return { t: 'hello', protocol: PROTOCOL_VERSION, schema: SCHEMA_VERSION, deviceId, deviceName }
}

/** Een Nederlandse foutmelding als de andere kant niet compatibel is, anders null. */
export function checkHello(message: Extract<SyncMessage, { t: 'hello' }>): string | null {
  if (message.protocol !== PROTOCOL_VERSION || message.schema !== SCHEMA_VERSION) {
    return (
      `${message.deviceName} draait een andere versie van de app ` +
      `(gegevens v${message.schema}, hier v${SCHEMA_VERSION}). ` +
      'Werk beide toestellen bij en probeer opnieuw.'
    )
  }
  return null
}

export function isSyncMessage(value: unknown): value is SyncMessage {
  if (typeof value !== 'object' || value === null) return false
  const t = (value as { t?: unknown }).t
  return t === 'hello' || t === 'chunk' || t === 'done' || t === 'error'
}

/* ------------------------------------------------------------- stukken */

/**
 * PeerJS weigert over een JSON-kanaal elk bericht vanaf 16 300 bytes, omdat
 * sommige browsers grotere berichten afkappen. Een export met foto's is al
 * snel enkele megabytes, dus gaat hij in stukken.
 *
 * Let op: de grens geldt voor het hele bericht in bytes, niet voor het aantal
 * tekens. De gegevens zijn zelf JSON, dus elk aanhalingsteken wordt nog eens
 * ontsnapt, en een é telt voor twee bytes. Daarom meten we elk stuk na.
 */
export const MAX_MESSAGE_BYTES = 15_000
const START_CHUNK_CHARS = 8_000

const encoder = new TextEncoder()

export function messageBytes(message: SyncMessage): number {
  return encoder.encode(JSON.stringify(message)).byteLength
}

export function chunkText(text: string, maxBytes: number = MAX_MESSAGE_BYTES): SyncMessage[] {
  const pieces: string[] = []
  let position = 0
  while (position < text.length) {
    let size = Math.min(START_CHUNK_CHARS, text.length - position)
    // Ruim gemeten met een groot volgnummer, zodat het echte bericht er zeker onder blijft.
    while (
      size > 1 &&
      messageBytes({ t: 'chunk', index: 9_999_999, total: 9_999_999, data: text.slice(position, position + size) }) >
        maxBytes
    ) {
      size = Math.floor(size * 0.75)
    }
    pieces.push(text.slice(position, position + size))
    position += size
  }
  if (pieces.length === 0) pieces.push('')

  return pieces.map((data, index) => ({ t: 'chunk', index, total: pieces.length, data }))
}

/** Zet binnenkomende stukken weer aan elkaar, ook als ze in de war aankomen. */
export class ChunkAssembler {
  private parts: string[] = []
  private received = 0
  private total = 0

  /** Geeft de volledige tekst terug zodra het laatste stuk binnen is. */
  add(message: Extract<SyncMessage, { t: 'chunk' }>): string | null {
    if (this.total === 0) {
      this.total = message.total
      this.parts = new Array<string>(message.total)
    }
    if (this.parts[message.index] === undefined) {
      this.parts[message.index] = message.data
      this.received++
    }
    return this.received === this.total ? this.parts.join('') : null
  }

  /** 0 tot 1, voor de voortgangsbalk. */
  get progress(): number {
    return this.total === 0 ? 0 : this.received / this.total
  }
}

/* --------------------------------------------------------------- code */

/**
 * De koppelcode die het ene toestel toont en het andere invoert of scant.
 * Zes tekens zonder lettertjes die op elkaar lijken (geen 0/O, 1/I/L), zodat
 * je hem ook gewoon kunt overtikken als er geen camera is.
 */
export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
export const CODE_LENGTH = 6
const QR_PREFIX = 'g6sync:1:'
const PEER_PREFIX = 'p6g-'

export function newPairingCode(random: () => number = Math.random): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)]
  }
  return code
}

/** "K7M2PX" → "K7M-2PX", makkelijker voor te lezen. */
export function formatPairingCode(code: string): string {
  return `${code.slice(0, 3)}-${code.slice(3)}`
}

export function qrPayload(code: string): string {
  return QR_PREFIX + code
}

export function peerIdFor(code: string): string {
  return PEER_PREFIX + code.toLowerCase()
}

/**
 * Leest een code uit wat er gescand of getikt werd: de QR-inhoud, "k7m-2px",
 * "K7M 2PX", … Geeft null als het geen geldige code is.
 */
export function parsePairingCode(input: string): string | null {
  let text = input.trim()
  if (text.toLowerCase().startsWith(QR_PREFIX)) text = text.slice(QR_PREFIX.length)
  const code = text.toUpperCase().replace(/[\s-]/g, '')
  if (code.length !== CODE_LENGTH) return null
  for (const char of code) if (!CODE_ALPHABET.includes(char)) return null
  return code
}

/** "Klaar — 12 bijgewerkt, 3 verwijderd" */
export function describeCounts(counts: MergeCounts): string {
  const changed = counts.added + counts.updated
  if (changed === 0 && counts.deleted === 0) return 'niets nieuws'
  const parts: string[] = []
  if (changed > 0) parts.push(`${changed} bijgewerkt`)
  if (counts.deleted > 0) parts.push(`${counts.deleted} verwijderd`)
  return parts.join(', ')
}
