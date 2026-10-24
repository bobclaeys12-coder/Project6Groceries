import { useId, useMemo, useRef, useState } from 'react'
import { normalizeName } from '../core/ids'
import type { CatalogIngredient } from '../core/types'

interface Props {
  value: string
  onChange: (name: string) => void
  /** Aangeroepen zodra je een bestaand ingrediënt uit de lijst kiest. */
  onPick: (item: CatalogIngredient) => void
  catalog: CatalogIngredient[]
  placeholder?: string
  autoFocus?: boolean
  /** Enter op een leeg suggestielijstje, bv. om meteen toe te voegen. */
  onSubmit?: () => void
}

const MAX_SUGGESTIONS = 8

/**
 * Tekstveld met suggesties uit de ingrediëntencatalogus.
 *
 * Bewust geen <datalist>: die geeft geen betrouwbaar signaal welk item gekozen
 * werd, en net dat signaal hebben we nodig om de afdeling en de eenheid
 * automatisch in te vullen. Bovendien ziet een eigen lijst er op iOS en
 * Android hetzelfde uit.
 */
export default function IngredientPicker({
  value,
  onChange,
  onPick,
  catalog,
  placeholder = 'Ingrediënt',
  autoFocus,
  onSubmit,
}: Props) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  const query = normalizeName(value)

  const suggestions = useMemo(() => {
    if (!query) return []
    const matches = catalog.filter((item) => item.nameLower.includes(query))
    return matches
      .sort((a, b) => {
        // Wat vooraan begint is relevanter dan wat ergens middenin matcht.
        const aStarts = a.nameLower.startsWith(query) ? 0 : 1
        const bStarts = b.nameLower.startsWith(query) ? 0 : 1
        if (aStarts !== bStarts) return aStarts - bStarts
        if (a.usageCount !== b.usageCount) return b.usageCount - a.usageCount
        return a.nameLower.localeCompare(b.nameLower)
      })
      .slice(0, MAX_SUGGESTIONS)
  }, [catalog, query])

  const exactMatch = useMemo(
    () => catalog.find((item) => item.nameLower === query),
    [catalog, query],
  )
  const isNew = query.length > 0 && !exactMatch

  const choose = (item: CatalogIngredient) => {
    onPick(item)
    setOpen(false)
    setHighlight(0)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) {
      if (event.key === 'Enter' && onSubmit) {
        event.preventDefault()
        onSubmit()
      }
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlight((h) => (h + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const picked = suggestions[highlight]
      if (picked) choose(picked)
      else if (onSubmit) onSubmit()
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="picker">
      <input
        ref={inputRef}
        className="input"
        type="text"
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
          setHighlight(0)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
      />

      {isNew && <span className="picker__new">nieuw</span>}

      {open && suggestions.length > 0 && (
        <ul className="picker__list" id={listId} role="listbox">
          {suggestions.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                aria-selected={index === highlight}
                className={`picker__option ${index === highlight ? 'is-active' : ''}`}
                // onMouseDown i.p.v. onClick: blur van het invoerveld zou de
                // lijst anders sluiten voordat de klik aankomt.
                onMouseDown={(event) => {
                  event.preventDefault()
                  choose(item)
                }}
                onMouseEnter={() => setHighlight(index)}
              >
                <span>{item.name}</span>
                <span className="picker__option-unit">{item.defaultUnit}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
