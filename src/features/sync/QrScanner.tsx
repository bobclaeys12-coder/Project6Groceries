import { useEffect, useRef, useState } from 'react'
import QrScannerLib from 'qr-scanner'

interface Props {
  /** Wordt één keer aangeroepen met de inhoud van de eerste QR-code. */
  onScan: (text: string) => void
}

/**
 * Camerabeeld dat naar een QR-code zoekt. De camera mag alleen op een
 * beveiligde pagina (https of localhost); anders tonen we meteen waarom het
 * niet lukt, zodat je weet dat je de code kunt overtikken.
 */
export default function QrScanner({ onScan }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan
  const [problem, setProblem] = useState<string | null>(
    window.isSecureContext
      ? null
      : 'De camera werkt alleen via een beveiligde (https) verbinding. Tik de code hieronder over.',
  )

  useEffect(() => {
    const video = videoRef.current
    if (!video || !window.isSecureContext) return

    let done = false
    const scanner = new QrScannerLib(
      video,
      (result) => {
        if (done) return
        done = true
        scanner.stop()
        onScanRef.current(result.data)
      },
      { returnDetailedScanResult: true, highlightScanRegion: true, preferredCamera: 'environment' },
    )

    scanner.start().catch(() => {
      setProblem('De camera kon niet starten. Geef toestemming of tik de code hieronder over.')
    })

    return () => {
      done = true
      scanner.destroy()
    }
  }, [])

  if (problem) {
    return (
      <p className="small muted" style={{ margin: 0 }}>
        📷 {problem}
      </p>
    )
  }

  return (
    <div className="scanner">
      <video ref={videoRef} muted playsInline />
    </div>
  )
}
