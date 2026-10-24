import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Een nagebootste PeerJS: twee "toestellen" in hetzelfde proces, met berichten
 * die asynchroon en via JSON overgaan, net als over een echt datakanaal.
 */
vi.mock('peerjs', () => {
  type Handler = (...args: unknown[]) => void

  class Emitter {
    private handlers = new Map<string, Handler[]>()
    on(event: string, handler: Handler) {
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler])
      return this
    }
    emit(event: string, ...args: unknown[]) {
      for (const handler of this.handlers.get(event) ?? []) handler(...args)
    }
    removeAllListeners() {
      this.handlers.clear()
      return this
    }
  }

  class FakeConn extends Emitter {
    partner: FakeConn | null = null
    open = false
    send(data: unknown) {
      // Dezelfde grens als de echte JSON-verbinding van PeerJS.
      if (new TextEncoder().encode(JSON.stringify(data)).byteLength >= 16300) {
        setTimeout(() => this.emit('error', { type: 'message-too-big' }), 0)
        return
      }
      const copy = JSON.parse(JSON.stringify(data))
      const partner = this.partner
      setTimeout(() => partner?.emit('data', copy), 0)
    }
    close() {
      if (!this.open) return
      this.open = false
      const partner = this.partner
      setTimeout(() => partner?.emit('close'), 0)
    }
  }

  const registry = new Map<string, FakePeer>()
  let counter = 0

  class FakePeer extends Emitter {
    id: string
    constructor(idOrOptions?: unknown) {
      super()
      this.id = typeof idOrOptions === 'string' ? idOrOptions : `anon-${++counter}`
      registry.set(this.id, this)
      setTimeout(() => this.emit('open', this.id), 0)
    }
    connect(targetId: string) {
      const mine = new FakeConn()
      const host = registry.get(targetId)
      if (!host) {
        setTimeout(() => this.emit('error', { type: 'peer-unavailable' }), 0)
        return mine
      }
      const theirs = new FakeConn()
      mine.partner = theirs
      theirs.partner = mine
      setTimeout(() => {
        host.emit('connection', theirs)
        mine.open = true
        theirs.open = true
        theirs.emit('open')
        mine.emit('open')
      }, 0)
      return mine
    }
    destroy() {
      registry.delete(this.id)
    }
  }

  return { default: FakePeer }
})

const { db } = await import('../../db/db')
const { initDatabase } = await import('../../db/init')
const { SyncSession } = await import('./session')
const { applyMerge, mergeDatasets } = await import('../../core/sync/merge')
const { encodeDataset } = await import('../../core/sync/serialize')
type SyncState = import('./session').SyncState
type LocalStore = import('./session').LocalStore
type Dataset = import('../../core/types').Dataset
type RecipeCategory = import('../../core/types').RecipeCategory

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Een toestel met zijn gegevens in het geheugen, en trage export/merge zoals op een telefoon. */
function memoryDevice(id: string, name: string, data: Dataset, delays: { export: number; merge: number }) {
  const device = { data }
  const store: LocalStore = {
    deviceId: () => id,
    deviceName: () => name,
    exportText: async () => {
      const snapshot = device.data
      await pause(delays.export)
      return JSON.stringify(await encodeDataset(snapshot, { deviceId: id, now: 1 }))
    },
    applyRemoteDataset: async (remote) => {
      await pause(delays.merge)
      const merge = mergeDatasets(device.data, remote)
      device.data = applyMerge(device.data, merge)
      return merge.counts
    },
  }
  return { device, store }
}

const emptyDataset = (): Dataset => ({
  recipeCategories: [],
  ingredientCategories: [],
  ingredients: [],
  recipes: [],
  groceryItems: [],
  shops: [],
  pantryItems: [],
})

const record = (id: string, updatedAt: number, deviceId: string): RecipeCategory => ({
  id,
  name: id,
  sortOrder: 1,
  updatedAt,
  deleted: 0,
  deviceId,
})

function track(): { states: SyncState[]; session: InstanceType<typeof SyncSession> } {
  const states: SyncState[] = []
  return { states, session: new SyncSession((state) => states.push(state)) }
}

const last = (states: SyncState[]) => states[states.length - 1]!

async function until(check: () => boolean, ms = 5000): Promise<void> {
  const start = Date.now()
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('time-out')
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

describe('sync-sessie', () => {
  beforeEach(async () => {
    if (db.isOpen()) db.close()
    await db.delete()
    await initDatabase()
  })

  it('host en gast doorlopen het hele gesprek en eindigen allebei op klaar', async () => {
    const host = track()
    const guest = track()

    host.session.host()
    await until(() => last(host.states)?.kind === 'waiting')
    const code = (last(host.states) as Extract<SyncState, { kind: 'waiting' }>).code

    guest.session.join(code)
    await until(() => last(host.states).kind === 'done' && last(guest.states).kind === 'done')

    // Zelfde database aan beide kanten, dus er valt niets samen te voegen.
    for (const { states } of [host, guest]) {
      const done = last(states) as Extract<SyncState, { kind: 'done' }>
      expect(done.here).toEqual({ added: 0, updated: 0, deleted: 0 })
      expect(done.there).toEqual({ added: 0, updated: 0, deleted: 0 })
      expect(states.some((s) => s.kind === 'syncing' && s.sent === 1)).toBe(true)
      expect(states.some((s) => s.kind === 'error')).toBe(false)
    }
  })

  it('meldt een onbekende code zonder export voor te stellen', async () => {
    const guest = track()
    guest.session.join('K7M2PX')
    await until(() => last(guest.states).kind === 'error')
    expect(last(guest.states)).toMatchObject({
      kind: 'error',
      message: expect.stringMatching(/Geen toestel gevonden/),
      suggestExport: false,
    })
  })

  it('kan na klaar meteen opnieuw beginnen', async () => {
    const host = track()
    const guest = track()
    host.session.host()
    await until(() => last(host.states)?.kind === 'waiting')
    guest.session.join((last(host.states) as Extract<SyncState, { kind: 'waiting' }>).code)
    await until(() => last(host.states).kind === 'done' && last(guest.states).kind === 'done')

    host.session.host()
    await until(() => last(host.states).kind === 'waiting')
    expect(last(host.states).kind).toBe('waiting')
  })

  it('toont op beide toestellen elk zijn eigen aantallen, gespiegeld', async () => {
    // Zoals bij de gebruiker: de telefoon heeft 625 nieuwere seed-records,
    // de pc heeft 15 eigen records die de telefoon nog niet kent.
    for (const [hostIsPc, delays] of [
      [true, { pc: { export: 0, merge: 0 }, tel: { export: 30, merge: 30 } }],
      [false, { pc: { export: 0, merge: 0 }, tel: { export: 30, merge: 30 } }],
      [true, { pc: { export: 30, merge: 0 }, tel: { export: 0, merge: 30 } }],
      [false, { pc: { export: 0, merge: 30 }, tel: { export: 30, merge: 0 } }],
    ] as const) {
      const pcData = emptyDataset()
      const telData = emptyDataset()
      for (let i = 0; i < 625; i++) {
        pcData.recipeCategories.push(record(`seed-${i}`, 1, 'pc'))
        telData.recipeCategories.push(record(`seed-${i}`, 100, 'tel'))
      }
      for (let i = 0; i < 15; i++) pcData.recipeCategories.push(record(`pc-${i}`, 50, 'pc'))

      const pc = memoryDevice('pc', 'PC', pcData, delays.pc)
      const tel = memoryDevice('tel', 'Android-telefoon', telData, delays.tel)
      const pcStates: SyncState[] = []
      const telStates: SyncState[] = []
      const pcSession = new SyncSession((s) => pcStates.push(s), pc.store)
      const telSession = new SyncSession((s) => telStates.push(s), tel.store)

      const [host, hostStates, guest] = hostIsPc
        ? [pcSession, pcStates, telSession]
        : [telSession, telStates, pcSession]
      host.host()
      await until(() => last(hostStates)?.kind === 'waiting')
      guest.join((last(hostStates) as Extract<SyncState, { kind: 'waiting' }>).code)
      await until(() => last(pcStates).kind === 'done' && last(telStates).kind === 'done')

      const pcDone = last(pcStates) as Extract<SyncState, { kind: 'done' }>
      const telDone = last(telStates) as Extract<SyncState, { kind: 'done' }>
      const label = `host=${hostIsPc ? 'pc' : 'tel'} ${JSON.stringify(delays)}`
      expect(pcDone.here, label).toEqual({ added: 0, updated: 625, deleted: 0 })
      expect(telDone.here, label).toEqual({ added: 15, updated: 0, deleted: 0 })
      expect(pcDone.there, label).toEqual(telDone.here)
      expect(telDone.there, label).toEqual(pcDone.here)
      expect(pcDone.peerName).toBe('Android-telefoon')
      expect(telDone.peerName).toBe('PC')
    }
  })
})
