import { useId, useRef } from 'react'
import {
  areaColour,
  areaLabel,
  GRID_HEIGHT,
  GRID_WIDTH,
  outlineSegments,
  type Cell,
} from '../../core/layout'
import type { Id, IngredientCategory, LayoutArea, Rect, ShopLayout } from '../../core/types'

const ENTRY_COLOUR = { fill: '#c8ecc9', stroke: '#2e7d32' }
const REGISTER_COLOUR = { fill: '#dcdcec', stroke: '#454566' }

interface Props {
  layout: ShopLayout
  categories: IngredientCategory[]
  /** welk stuk van het rooster in beeld is */
  view: Rect
  showGrid?: boolean
  /** afdelingen die oplichten bij het zoeken; de rest vervaagt */
  highlight?: Set<Id> | null
  selectedAreaId?: Id | null
  selectedFloorIndex?: number | null
  /** de rechthoek die je nu aan het slepen bent */
  draft?: Rect | null
  onCellDown?: (cell: Cell) => void
  onCellMove?: (cell: Cell) => void
  onCellUp?: (cell: Cell) => void
  /** de browser brak het slepen af (bv. een melding op de telefoon) */
  onCancel?: () => void
}

function colourOf(area: LayoutArea, categories: IngredientCategory[]) {
  if (area.kind === 'entry') return ENTRY_COLOUR
  if (area.kind === 'register') return REGISTER_COLOUR
  return areaColour(area.categoryId ?? '', categories)
}

/**
 * Tekent de plattegrond als SVG op het rooster. De vloer is één vorm: elk
 * vloerstuk wordt zonder rand ingekleurd en daarna komt alleen de buitenrand
 * erover, zodat overlappende rechthoeken samensmelten.
 */
export default function ShopMap({
  layout,
  categories,
  view,
  showGrid = false,
  highlight = null,
  selectedAreaId = null,
  selectedFloorIndex = null,
  draft = null,
  onCellDown,
  onCellMove,
  onCellUp,
  onCancel,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const patternId = `grid${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const interactive = Boolean(onCellDown)

  const cellAt = (event: React.PointerEvent): Cell | null => {
    const svg = svgRef.current
    const matrix = svg?.getScreenCTM()
    if (!svg || !matrix) return null
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const p = point.matrixTransform(matrix.inverse())
    return { x: Math.floor(p.x), y: Math.floor(p.y) }
  }

  const outline = outlineSegments(layout.floor)
  const path = outline.map((s) => `M${s.x1} ${s.y1}L${s.x2} ${s.y2}`).join('')

  return (
    <svg
      ref={svgRef}
      className={interactive ? 'shop-map is-drawing' : 'shop-map'}
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      role="img"
      aria-label="Plattegrond van de winkel"
      onPointerDown={(event) => {
        if (!onCellDown) return
        const cell = cellAt(event)
        if (!cell) return
        event.currentTarget.setPointerCapture(event.pointerId)
        onCellDown(cell)
      }}
      onPointerMove={(event) => {
        if (!onCellMove) return
        const cell = cellAt(event)
        if (cell) onCellMove(cell)
      }}
      onPointerCancel={() => onCancel?.()}
      onPointerUp={(event) => {
        if (!onCellUp) return
        const cell = cellAt(event)
        if (cell) onCellUp(cell)
      }}
    >
      {showGrid && (
        <>
          <defs>
            <pattern id={patternId} width="1" height="1" patternUnits="userSpaceOnUse">
              <path d="M1 0H0V1" fill="none" stroke="var(--border)" strokeWidth="0.04" />
            </pattern>
          </defs>
          <rect x={0} y={0} width={GRID_WIDTH} height={GRID_HEIGHT} fill={`url(#${patternId})`} />
          <rect
            x={0}
            y={0}
            width={GRID_WIDTH}
            height={GRID_HEIGHT}
            fill="none"
            stroke="var(--border-strong)"
            strokeWidth="0.06"
          />
        </>
      )}

      {/* De vloer: ingekleurd zonder randen, daarna alleen de buitenrand. */}
      {layout.floor.map((r, i) => (
        <rect
          key={`f${i}`}
          x={r.x}
          y={r.y}
          width={r.w}
          height={r.h}
          fill={selectedFloorIndex === i ? 'var(--amber-soft)' : 'var(--surface)'}
        />
      ))}
      <path d={path} fill="none" stroke="var(--text)" strokeWidth="0.18" strokeLinecap="square" />

      {layout.areas.map((area) => {
        const colour = colourOf(area, categories)
        const label = areaLabel(area, categories)
        const matched = highlight === null || (area.categoryId !== undefined && highlight.has(area.categoryId))
        const selected = area.id === selectedAreaId
        const icon = area.kind === 'entry' ? '🚪 ' : area.kind === 'register' ? '🧾 ' : ''
        const text = icon + label
        const { x, y, w, h } = area.rect
        const fontSize = Math.max(0.3, Math.min(0.9, h * 0.55, (w * 1.7) / Math.max(text.length, 3)))
        return (
          <g key={area.id} opacity={matched ? 1 : 0.22}>
            <title>{label}</title>
            <rect
              x={x + 0.06}
              y={y + 0.06}
              width={w - 0.12}
              height={h - 0.12}
              rx={0.25}
              fill={colour.fill}
              stroke={selected ? 'var(--text)' : colour.stroke}
              strokeWidth={selected || (highlight && matched) ? 0.22 : 0.08}
              strokeDasharray={selected ? '0.35 0.2' : undefined}
            />
            <text
              x={x + w / 2}
              y={y + h / 2}
              fontSize={fontSize}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#1f2421"
              fontWeight={600}
              style={{ pointerEvents: 'none' }}
            >
              {text}
            </text>
          </g>
        )
      })}

      {draft && (
        <rect
          x={draft.x}
          y={draft.y}
          width={draft.w}
          height={draft.h}
          fill="var(--green)"
          fillOpacity={0.15}
          stroke="var(--green)"
          strokeWidth="0.12"
          strokeDasharray="0.3 0.2"
        />
      )}
    </svg>
  )
}
