import { useEffect, useRef, useState } from 'react'
import { SyncSession, type SyncState } from './session'

/** De sync-sessie als React-toestand; ruimt de verbinding op bij het verlaten van de pagina. */
export function useSyncSession(): [SyncState, SyncSession] {
  const [state, setState] = useState<SyncState>({ kind: 'idle' })
  const sessionRef = useRef<SyncSession | null>(null)
  if (!sessionRef.current) sessionRef.current = new SyncSession(setState)
  const session = sessionRef.current

  useEffect(() => () => session.destroy(), [session])

  return [state, session]
}
