import { getMeta, setMeta } from './db'
import { newId } from '../core/ids'

const DEVICE_ID_KEY = 'deviceId'
const DEVICE_NAME_KEY = 'deviceName'

let cachedId: string | null = null
let cachedName: string | null = null

/** Raadt een bruikbare naam, zodat de sync-pagina niet "onbekend" hoeft te tonen. */
function guessDeviceName(): string {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  if (/android/i.test(ua)) return 'Android-telefoon'
  if (/iphone/i.test(ua)) return 'iPhone'
  if (/ipad/i.test(ua)) return 'iPad'
  if (/macintosh/i.test(ua)) return 'Mac'
  if (/windows/i.test(ua)) return 'Windows-pc'
  return 'Dit toestel'
}

/**
 * Wordt eenmalig bij het opstarten aangeroepen. Het toestel-id is permanent:
 * het dient als tiebreaker wanneer twee toestellen hetzelfde record op exact
 * dezelfde milliseconde aanpasten.
 */
export async function initDevice(): Promise<{ id: string; name: string }> {
  let id = await getMeta<string>(DEVICE_ID_KEY)
  if (!id) {
    id = newId()
    await setMeta(DEVICE_ID_KEY, id)
  }
  let name = await getMeta<string>(DEVICE_NAME_KEY)
  if (!name) {
    name = guessDeviceName()
    await setMeta(DEVICE_NAME_KEY, name)
  }
  cachedId = id
  cachedName = name
  return { id, name }
}

export function deviceId(): string {
  if (!cachedId) {
    throw new Error('Toestel-id nog niet geladen. Roep initDatabase() aan bij het opstarten.')
  }
  return cachedId
}

export function deviceName(): string {
  return cachedName ?? 'Dit toestel'
}

export async function setDeviceName(name: string): Promise<void> {
  const trimmed = name.trim() || guessDeviceName()
  cachedName = trimmed
  await setMeta(DEVICE_NAME_KEY, trimmed)
}
