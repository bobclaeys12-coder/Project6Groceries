import { useCallback, useState } from 'react'

/**
 * Een voorkeur die bij dit toestel hoort en dus bewust niet meesynchroniseert:
 * welke winkel je nu geselecteerd hebt, bijvoorbeeld. Dat is iets anders dan
 * data, en het zou vervelend zijn als je telefoon de winkelkeuze van je pc
 * overschrijft.
 *
 * localStorage kan ontbreken of gooien (privénavigatie, geblokkeerde
 * site-gegevens), vandaar overal een vangnet.
 */
export function useLocalPreference(
  key: string,
  fallback: string,
): [string, (value: string) => void] {
  const [value, setValue] = useState(() => {
    try {
      return window.localStorage.getItem(key) ?? fallback
    } catch {
      return fallback
    }
  })

  const update = useCallback(
    (next: string) => {
      setValue(next)
      try {
        window.localStorage.setItem(key, next)
      } catch {
        // Niet kunnen onthouden is jammer, maar mag de app niet breken.
      }
    },
    [key],
  )

  return [value, update]
}
