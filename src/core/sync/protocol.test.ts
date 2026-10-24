import { describe, expect, it } from 'vitest'
import {
  ChunkAssembler,
  checkHello,
  chunkText,
  CODE_ALPHABET,
  describeCounts,
  formatPairingCode,
  helloMessage,
  MAX_MESSAGE_BYTES,
  messageBytes,
  newPairingCode,
  parsePairingCode,
  peerIdFor,
  qrPayload,
} from './protocol'
import type { SyncMessage } from './protocol'

type Chunk = Extract<SyncMessage, { t: 'chunk' }>

describe('stukken', () => {
  it('knipt een lange tekst en zet hem weer aan elkaar, ook in de war', () => {
    const text = 'abcdefghij'.repeat(1000)
    const chunks = chunkText(text, 400) as Chunk[]
    expect(chunks.length).toBeGreaterThan(20)

    const assembler = new ChunkAssembler()
    const shuffled = [...chunks].reverse()
    let result: string | null = null
    for (const chunk of shuffled) result = assembler.add(chunk)
    expect(result).toBe(text)
    expect(assembler.progress).toBe(1)
  })

  it('negeert een stuk dat twee keer binnenkomt', () => {
    const text = 'abcdefghij'.repeat(6)
    const chunks = chunkText(text, 75) as Chunk[]
    expect(chunks.length).toBeGreaterThanOrEqual(3)
    const assembler = new ChunkAssembler()
    assembler.add(chunks[0]!)
    assembler.add(chunks[0]!)
    let result: string | null = null
    for (const chunk of chunks.slice(1)) result = assembler.add(chunk)
    expect(result).toBe(text)
  })

  it('blijft onder de berichtgrens van PeerJS, ook met JSON, accenten en emoji', () => {
    // Zo ziet een export eruit: JSON met aanhalingstekens, backslashes en é's.
    const record = { naam: 'Crème brûlée "speciaal" \\ 🍮', stappen: ['Één', 'Twéé\nDrie'] }
    const text = JSON.stringify(Array.from({ length: 2000 }, () => record))
    const chunks = chunkText(text) as Chunk[]
    for (const chunk of chunks) expect(messageBytes(chunk)).toBeLessThan(MAX_MESSAGE_BYTES)
    expect(messageBytes(chunks[0]!)).toBeLessThan(16_300)

    const assembler = new ChunkAssembler()
    let result: string | null = null
    for (const chunk of chunks) result = assembler.add(chunk)
    expect(result).toBe(text)
    expect(JSON.parse(result!)).toHaveLength(2000)
  })

  it('stuurt ook een lege tekst als één stuk', () => {
    const chunks = chunkText('') as Chunk[]
    expect(chunks).toHaveLength(1)
    expect(new ChunkAssembler().add(chunks[0]!)).toBe('')
  })
})

describe('handdruk', () => {
  it('aanvaardt dezelfde versie', () => {
    const hello = helloMessage('tel', 'iPhone') as Extract<SyncMessage, { t: 'hello' }>
    expect(checkHello(hello)).toBeNull()
  })

  it('weigert een andere gegevensversie met uitleg', () => {
    const hello = { ...helloMessage('tel', 'iPhone'), schema: 2 } as Extract<
      SyncMessage,
      { t: 'hello' }
    >
    expect(checkHello(hello)).toMatch(/iPhone draait een andere versie/)
  })
})

describe('koppelcode', () => {
  it('bestaat uit zes tekens zonder verwarrende letters', () => {
    const code = newPairingCode()
    expect(code).toHaveLength(6)
    for (const char of code) expect(CODE_ALPHABET).toContain(char)
    expect(CODE_ALPHABET).not.toMatch(/[01OIL]/)
  })

  it('leest de QR-inhoud en getikte varianten', () => {
    expect(parsePairingCode(qrPayload('K7M2PX'))).toBe('K7M2PX')
    expect(parsePairingCode('k7m-2px')).toBe('K7M2PX')
    expect(parsePairingCode(' K7M 2PX ')).toBe('K7M2PX')
    expect(parsePairingCode(formatPairingCode('K7M2PX'))).toBe('K7M2PX')
  })

  it('weigert iets dat geen code is', () => {
    expect(parsePairingCode('K7M2P')).toBeNull()
    expect(parsePairingCode('K7M2P0')).toBeNull()
    expect(parsePairingCode('https://example.com')).toBeNull()
  })

  it('maakt er een geldig PeerJS-id van', () => {
    expect(peerIdFor('K7M2PX')).toBe('p6g-k7m2px')
  })
})

describe('samenvatting', () => {
  it('telt toegevoegd en bijgewerkt samen', () => {
    expect(describeCounts({ added: 2, updated: 10, deleted: 3 })).toBe('12 bijgewerkt, 3 verwijderd')
    expect(describeCounts({ added: 0, updated: 0, deleted: 0 })).toBe('niets nieuws')
  })
})
