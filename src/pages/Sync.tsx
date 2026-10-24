import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageHeader } from '../components/AppLayout'
import QrDisplay from '../features/sync/QrDisplay'
import QrScanner from '../features/sync/QrScanner'
import { useSyncSession } from '../features/sync/useSyncSession'
import type { SyncState } from '../features/sync/session'
import { deviceName } from '../db/device'
import { exportText, importText } from '../db/sync'
import { describeCounts, formatPairingCode, parsePairingCode, qrPayload } from '../core/sync/protocol'
import { exportFileName, ImportError } from '../core/sync/serialize'

type Mode = 'choose' | 'join'

export default function Sync() {
  usePageHeader('Synchroniseren')

  const [state, session] = useSyncSession()
  const [mode, setMode] = useState<Mode>('choose')

  const busy = state.kind !== 'idle' && state.kind !== 'done' && state.kind !== 'error'

  const join = (input: string): boolean => {
    const code = parsePairingCode(input)
    if (!code) return false
    session.join(code)
    return true
  }

  const restart = () => {
    session.cancel()
    setMode('choose')
  }

  return (
    <div className="stack">
      <section className="card stack" style={{ padding: '1rem' }}>
        <p className="small muted" style={{ margin: 0 }}>
          Breng je recepten, lijst, winkels en voorraad gelijk tussen twee toestellen. Beide
          moeten online zijn, het liefst op hetzelfde wifi. Dit toestel heet{' '}
          <strong>{deviceName()}</strong> (<Link to="/instellingen">wijzigen</Link>).
        </p>

        {state.kind === 'idle' && mode === 'choose' && (
          <div className="sync-choice">
            <button type="button" className="btn btn--primary btn--block" onClick={() => session.host()}>
              📱 Toon een code
              <span className="sync-choice__sub">dit toestel wacht op het andere</span>
            </button>
            <button type="button" className="btn btn--block" onClick={() => setMode('join')}>
              📷 Scan of tik een code
              <span className="sync-choice__sub">van het andere toestel</span>
            </button>
          </div>
        )}

        {state.kind === 'idle' && mode === 'join' && (
          <JoinForm onJoin={join} onCancel={() => setMode('choose')} />
        )}

        {state.kind !== 'idle' && <SessionView state={state} />}

        {busy && (
          <button type="button" className="btn btn--ghost" onClick={restart}>
            Annuleer
          </button>
        )}
        {(state.kind === 'done' || state.kind === 'error') && (
          <button type="button" className="btn" onClick={restart}>
            Opnieuw
          </button>
        )}
      </section>

      <ExportImport />
    </div>
  )
}

/* ------------------------------------------------------------ verbinden */

function JoinForm({
  onJoin,
  onCancel,
}: {
  onJoin: (input: string) => boolean
  onCancel: () => void
}) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (input: string) => {
    if (!onJoin(input)) setError('Dat is geen geldige code. Een code ziet eruit als K7M-2PX.')
  }

  return (
    <div className="stack stack--tight">
      <QrScanner onScan={submit} />
      <div className="row">
        <input
          className="input sync-code-input"
          value={text}
          placeholder="K7M-2PX"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-label="Code van het andere toestel"
          onChange={(event) => {
            setText(event.target.value)
            setError(null)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit(text)
          }}
        />
        <button type="button" className="btn btn--primary" onClick={() => submit(text)} disabled={!text.trim()}>
          Verbind
        </button>
      </div>
      {error && (
        <p className="small" style={{ color: 'var(--red)', margin: 0 }}>
          {error}
        </p>
      )}
      <button type="button" className="btn btn--ghost" onClick={onCancel}>
        Terug
      </button>
    </div>
  )
}

/* ------------------------------------------------------------ voortgang */

const STEPS = ['Verbinden', 'Verbonden', 'Synchroniseren', 'Klaar'] as const

function stepIndex(state: SyncState): number {
  switch (state.kind) {
    case 'preparing':
    case 'waiting':
    case 'connecting':
      return 0
    case 'syncing':
      return state.sent === 0 && state.received === 0 ? 1 : 2
    case 'done':
      return 3
    default:
      return -1
  }
}

function SessionView({ state }: { state: SyncState }) {
  if (state.kind === 'error') {
    return (
      <div className="notice notice--error" role="alert">
        <div>
          <strong>Synchroniseren lukte niet.</strong>
          <div>{state.message}</div>
          {state.suggestExport && (
            <div className="small" style={{ marginTop: '0.4rem' }}>
              Lukt het blijvend niet? Gebruik dan hieronder <strong>Exporteren</strong> op het ene
              toestel en <strong>Importeren</strong> op het andere.
            </div>
          )}
        </div>
      </div>
    )
  }

  if (state.kind === 'waiting') {
    return (
      <div className="stack stack--tight sync-waiting">
        <QrDisplay text={qrPayload(state.code)} label={`Code ${formatPairingCode(state.code)}`} />
        <div className="sync-code" aria-label="Koppelcode">
          {formatPairingCode(state.code)}
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          Kies op het andere toestel <strong>Scan of tik een code</strong>. Laat deze pagina open
          tot het klaar is.
        </p>
      </div>
    )
  }

  const current = stepIndex(state)

  return (
    <div className="stack stack--tight">
      <ol className="sync-steps">
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={index < current ? 'is-done' : index === current ? 'is-current' : undefined}
          >
            {index === 1 && state.kind !== 'preparing' && state.kind !== 'connecting' && 'peerName' in state
              ? `Verbonden met ${state.peerName}`
              : label}
          </li>
        ))}
      </ol>

      {state.kind === 'preparing' && <p className="small muted">Code aanvragen…</p>}
      {state.kind === 'connecting' && <p className="small muted">Bezig met verbinden…</p>}

      {state.kind === 'syncing' && (
        <div className="stack stack--tight">
          <Progress label="Versturen" value={state.sent} />
          <Progress label="Ontvangen" value={state.received} />
        </div>
      )}

      {state.kind === 'done' && (
        <div className="notice notice--ok" role="status">
          <div>
            <strong>Klaar!</strong>
            <div>Hier: {describeCounts(state.here)}.</div>
            <div>
              Op {state.peerName}: {describeCounts(state.there)}.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Progress({ label, value }: { label: string; value: number }) {
  const percent = Math.round(value * 100)
  return (
    <div className="sync-progress">
      <span className="small muted">{label}</span>
      <progress max={100} value={percent} aria-label={label} />
      <span className="small muted">{percent}%</span>
    </div>
  )
}

/* -------------------------------------------------------- export/import */

function ExportImport() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const download = async () => {
    setBusy(true)
    try {
      const text = await exportText()
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = exportFileName(new Date())
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      setMessage({ ok: true, text: `Export gemaakt: ${link.download}` })
    } finally {
      setBusy(false)
    }
  }

  const importFile = async (file: File) => {
    setBusy(true)
    try {
      const result = await importText(await file.text())
      const from = result.deviceName ? ` van ${result.deviceName}` : ''
      const skipped = result.skipped > 0 ? ` (${result.skipped} onleesbare items overgeslagen)` : ''
      setMessage({ ok: true, text: `Import${from} klaar: ${describeCounts(result.counts)}${skipped}.` })
    } catch (error) {
      setMessage({
        ok: false,
        text:
          error instanceof ImportError
            ? error.message
            : 'Dit bestand kon niet ingelezen worden.',
      })
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <section className="stack stack--tight">
      <h2 className="section-title">Exporteren en importeren</h2>
      <p className="small muted" style={{ margin: 0 }}>
        Werkt altijd, ook zonder verbinding tussen de toestellen: exporteer hier een bestand,
        stuur het door (mail, chat, cloud) en importeer het op het andere toestel. Importeren
        voegt samen, het overschrijft niets dat nieuwer is. Ook een handige back-up.
      </p>
      <div className="row row--wrap">
        <button type="button" className="btn" onClick={download} disabled={busy}>
          ⬇️ Exporteren
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          ⬆️ Importeren
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void importFile(file)
          }}
        />
      </div>
      {message && (
        <div className={`notice ${message.ok ? 'notice--ok' : 'notice--error'}`} role="status">
          <div>{message.text}</div>
        </div>
      )}
    </section>
  )
}
