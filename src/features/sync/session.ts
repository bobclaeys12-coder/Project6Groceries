import Peer, { type DataConnection } from 'peerjs'
import { deviceId, deviceName } from '../../db/device'
import { applyRemoteDataset, exportText } from '../../db/sync'
import { decodeEnvelope } from '../../core/sync/serialize'
import type { MergeCounts } from '../../core/sync/merge'
import {
  ChunkAssembler,
  checkHello,
  chunkText,
  helloMessage,
  isSyncMessage,
  newPairingCode,
  peerIdFor,
} from '../../core/sync/protocol'
import type { SyncMessage } from '../../core/sync/protocol'
import type { Dataset } from '../../core/types'

/** Wat de sessie van dit toestel nodig heeft; los te vervangen in tests. */
export interface LocalStore {
  deviceId(): string
  deviceName(): string
  exportText(): Promise<string>
  applyRemoteDataset(remote: Partial<Dataset>): Promise<MergeCounts>
}

const databaseStore: LocalStore = { deviceId, deviceName, exportText, applyRemoteDataset }

export type SyncState =
  | { kind: 'idle' }
  | { kind: 'preparing' }
  | { kind: 'waiting'; code: string }
  | { kind: 'connecting' }
  | { kind: 'syncing'; peerName: string; sent: number; received: number }
  | { kind: 'done'; peerName: string; here: MergeCounts; there: MergeCounts }
  | { kind: 'error'; message: string; suggestExport: boolean }

/** Zo lang mag verbinden duren voor we opgeven en de export voorstellen. */
const CONNECT_TIMEOUT_MS = 20_000

/**
 * Eén synchronisatie met een ander toestel, van koppelen tot klaar.
 *
 * Het ene toestel wacht met een code (host), het andere verbindt met die code.
 * Daarna is het gesprek symmetrisch; zie core/sync/protocol.ts. Deze klasse
 * weet niets van React: ze meldt elke toestandswijziging via `onChange`.
 */
export class SyncSession {
  private peer: Peer | null = null
  private conn: DataConnection | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private assembler = new ChunkAssembler()
  private peerName = 'het andere toestel'
  private here: MergeCounts | null = null
  private there: MergeCounts | null = null
  private sent = 0
  private finished = false
  private state: SyncState = { kind: 'idle' }

  constructor(
    private readonly onChange: (state: SyncState) => void,
    private readonly local: LocalStore = databaseStore,
  ) {}

  /* ------------------------------------------------------------ starten */

  /** Dit toestel toont een code en wacht. */
  host(attempt = 1): void {
    this.reset()
    this.set({ kind: 'preparing' })
    const code = newPairingCode()
    const peer = new Peer(peerIdFor(code), { debug: 0 })
    this.peer = peer

    peer.on('open', () => this.set({ kind: 'waiting', code }))
    peer.on('connection', (conn) => {
      // Eén sync tegelijk; een tweede toestel krijgt geen gehoor.
      if (this.conn) {
        conn.close()
        return
      }
      this.set({ kind: 'connecting' })
      this.attach(conn)
    })
    peer.on('error', (error) => {
      // Iemand anders gebruikt toevallig dezelfde code: neem een nieuwe.
      if (error.type === 'unavailable-id' && attempt < 3) {
        this.host(attempt + 1)
        return
      }
      this.fail(describePeerError(error.type))
    })
  }

  /** Dit toestel verbindt met de code van het andere. */
  join(code: string): void {
    this.reset()
    this.set({ kind: 'connecting' })
    const peer = new Peer({ debug: 0 })
    this.peer = peer

    this.timer = setTimeout(() => {
      if (this.state.kind === 'connecting') {
        this.fail(
          'Het lukt niet om een verbinding te maken. Staan beide toestellen op hetzelfde wifi?',
        )
      }
    }, CONNECT_TIMEOUT_MS)

    peer.on('open', () => {
      this.attach(peer.connect(peerIdFor(code), { reliable: true, serialization: 'json' }))
    })
    peer.on('error', (error) => {
      if (error.type === 'peer-unavailable') {
        this.fail(
          'Geen toestel gevonden met deze code. Staat de code nog open op het andere toestel?',
          false,
        )
        return
      }
      this.fail(describePeerError(error.type))
    })
  }

  cancel(): void {
    this.reset()
    this.set({ kind: 'idle' })
  }

  /** Opruimen bij het verlaten van de pagina. */
  destroy(): void {
    this.reset()
  }

  /* ------------------------------------------------------------ gesprek */

  private attach(conn: DataConnection): void {
    this.conn = conn
    conn.on('open', () => {
      if (this.timer) clearTimeout(this.timer)
      this.send(helloMessage(this.local.deviceId(), this.local.deviceName()))
    })
    conn.on('data', (data) => {
      if (isSyncMessage(data)) void this.handle(data)
    })
    conn.on('close', () => {
      if (!this.finished && this.state.kind !== 'error') {
        this.fail('De verbinding werd verbroken voor de synchronisatie klaar was.')
      }
    })
    conn.on('error', (error) => {
      // Het technische type erbij, zodat een melding van een gebruiker te herleiden is.
      const type = (error as { type?: string }).type
      if (!this.finished) {
        this.fail(`Er liep iets mis met de verbinding${type ? ` (${type})` : ''}.`)
      }
    })
  }

  private async handle(message: SyncMessage): Promise<void> {
    try {
      switch (message.t) {
        case 'hello': {
          const problem = checkHello(message)
          if (problem) {
            this.send({ t: 'error', message: `${this.local.deviceName()} draait een andere versie van de app.` })
            this.fail(problem, false)
            return
          }
          this.peerName = message.deviceName || this.peerName
          this.progress()
          await this.sendDataset()
          return
        }
        case 'chunk': {
          const text = this.assembler.add(message)
          this.progress()
          if (text === null) return
          const decoded = decodeEnvelope(JSON.parse(text))
          this.here = await this.local.applyRemoteDataset(decoded.dataset)
          this.send({ t: 'done', counts: this.here })
          this.maybeFinish()
          return
        }
        case 'done':
          this.there = message.counts
          this.maybeFinish()
          return
        case 'error':
          this.fail(message.message, false)
          return
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      this.send({ t: 'error', message: `Bij ${this.local.deviceName()} liep het samenvoegen mis: ${detail}` })
      this.fail(`Het samenvoegen liep mis: ${detail}`)
    }
  }

  private async sendDataset(): Promise<void> {
    const chunks = chunkText(await this.local.exportText())
    for (let i = 0; i < chunks.length; i++) {
      this.send(chunks[i]!)
      this.sent = (i + 1) / chunks.length
      // Af en toe even loslaten, zodat de voortgangsbalk kan bijwerken.
      if (i % 16 === 15) {
        this.progress()
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    }
    this.progress()
  }

  private maybeFinish(): void {
    if (!this.here || !this.there || this.finished) return
    this.finished = true
    this.set({ kind: 'done', peerName: this.peerName, here: this.here, there: this.there })
    // Even wachten met afsluiten, zodat het laatste bericht zeker vertrokken is.
    this.timer = setTimeout(() => this.disconnect(), 1000)
  }

  /* ------------------------------------------------------------ hulpjes */

  private send(message: SyncMessage): void {
    try {
      void this.conn?.send(message)
    } catch {
      // Een verbroken verbinding meldt zich zelf via 'close'.
    }
  }

  private progress(): void {
    if (this.finished || this.state.kind === 'error') return
    this.set({
      kind: 'syncing',
      peerName: this.peerName,
      sent: this.sent,
      received: this.assembler.progress,
    })
  }

  private fail(message: string, suggestExport = true): void {
    if (this.finished) return
    this.reset()
    this.set({ kind: 'error', message, suggestExport })
  }

  private set(state: SyncState): void {
    this.state = state
    this.onChange(state)
  }

  /** Verbinding en koppelserver los, maar de uitkomst blijft staan. */
  private disconnect(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    const conn = this.conn
    const peer = this.peer
    this.conn = null
    this.peer = null
    conn?.removeAllListeners()
    peer?.removeAllListeners()
    conn?.close()
    peer?.destroy()
  }

  /** Alles los en terug naar af, klaar voor een nieuwe synchronisatie. */
  private reset(): void {
    this.disconnect()
    this.assembler = new ChunkAssembler()
    this.here = null
    this.there = null
    this.sent = 0
    this.finished = false
    this.peerName = 'het andere toestel'
  }
}

function describePeerError(type: string): string {
  switch (type) {
    case 'browser-incompatible':
      return 'Deze browser ondersteunt geen rechtstreekse verbinding tussen toestellen.'
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed':
      return 'De koppelserver is niet bereikbaar. Ben je online?'
    case 'webrtc':
      return 'De rechtstreekse verbinding tussen de toestellen lukt niet op dit netwerk.'
    default:
      return 'Er liep iets mis bij het verbinden.'
  }
}
