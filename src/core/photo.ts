/**
 * Foto's verkleinen voor opslag.
 *
 * Een foto rechtstreeks uit een telefooncamera is al snel 4 MB. Die gaat mee
 * over de sync en in de JSON-export, dus verkleinen we hem eerst tot iets dat
 * op een telefoonscherm nog altijd scherp is: maximaal 1024px op de langste
 * zijde, JPEG op kwaliteit 0,8. Dat levert doorgaans 100 tot 200 kB op.
 */
export const MAX_PHOTO_DIMENSION = 1024
export const PHOTO_QUALITY = 0.8

export async function downscaleImage(
  file: Blob,
  maxDimension: number = MAX_PHOTO_DIMENSION,
  quality: number = PHOTO_QUALITY,
): Promise<Blob> {
  // imageOrientation zorgt dat een staande telefoonfoto niet gekanteld opslaat.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })

  try {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) throw new Error('Kon de foto niet verwerken.')
    context.drawImage(bitmap, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    )
    if (!blob) throw new Error('Kon de foto niet opslaan.')
    return blob
  } finally {
    bitmap.close()
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
