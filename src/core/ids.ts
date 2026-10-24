/**
 * Id-generatie. crypto.randomUUID() bestaat in elke moderne browser op
 * https/localhost; de fallback is er enkel voor exotische omgevingen.
 */
export function newId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  const bytes = new Uint8Array(16)
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes)
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * Seed-records krijgen een stabiel, afleidbaar id. Daardoor herkent een latere
 * app-versie wat al bestaat (of wat je bewust verwijderd hebt) en voegt ze geen
 * duplicaten toe.
 */
export function seedId(kind: string, slug: string): string {
  return `seed:${kind}:${slug}`
}

/** Combining diacritical marks: accenten die NFD losmaakt van hun letter. */
const DIACRITICS = /[̀-ͯ]/g

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Normalisatie voor zoeken en voor het matchen van ingrediëntnamen. */
export function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
