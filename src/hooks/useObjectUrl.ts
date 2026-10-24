import { useEffect, useState } from 'react'

/**
 * Maakt een tijdelijke URL voor een Blob uit de database en ruimt die weer op.
 * Zonder revokeObjectURL blijft elke foto in het geheugen hangen zolang het
 * tabblad openstaat.
 */
export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(blob)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [blob])

  return url
}
