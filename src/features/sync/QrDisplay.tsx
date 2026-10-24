import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/** Toont een tekst als QR-code. */
export default function QrDisplay({ text, label }: { text: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(text, { margin: 1, width: 240, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setSrc(url)
      })
      .catch(() => {
        if (!cancelled) setSrc(null)
      })
    return () => {
      cancelled = true
    }
  }, [text])

  if (!src) return <div className="qr qr--empty" aria-hidden="true" />
  return <img className="qr" src={src} alt={label} width={240} height={240} />
}
