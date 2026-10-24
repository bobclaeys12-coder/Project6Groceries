import { UNITS, UNIT_INFO } from '../core/units'
import type { Unit } from '../core/types'

interface Props {
  value: Unit
  onChange: (unit: Unit) => void
  className?: string
  ariaLabel?: string
}

export default function UnitSelect({ value, onChange, className, ariaLabel = 'Eenheid' }: Props) {
  return (
    <select
      className={`select ${className ?? ''}`}
      value={value}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value as Unit)}
    >
      {UNITS.map((unit) => (
        <option key={unit} value={unit}>
          {UNIT_INFO[unit].longLabel}
        </option>
      ))}
    </select>
  )
}
