import { useMemo, useState } from 'react'
import ShopMap from './ShopMap'
import { useIngredientCatalog } from '../../hooks/useData'
import { setShopLayout } from '../../db/shops'
import { newId } from '../../core/ids'
import {
  addArea,
  addFloor,
  areaLabel,
  emptyLayout,
  GRID_HEIGHT,
  GRID_WIDTH,
  hitTest,
  layoutBounds,
  rectFromCells,
  removeHit,
  searchLayout,
  updateArea,
  type Cell,
  type Hit,
} from '../../core/layout'
import type { Id, IngredientCategory, Rect, Shop, ShopLayout } from '../../core/types'

type Tool = 'floor' | 'department' | 'entry' | 'register' | 'select'

const TOOLS: [Tool, string][] = [
  ['floor', '⬜ Vloer'],
  ['department', '🏷️ Afdeling'],
  ['entry', '🚪 Ingang'],
  ['register', '🧾 Kassa'],
  ['select', '👆 Selecteren'],
]

const HINTS: Record<Tool, string> = {
  floor:
    'Sleep een rechthoek om de winkelvloer te tekenen. Teken er meerdere die elkaar raken of overlappen voor een L-vorm of andere vorm; ze smelten samen.',
  department: 'Kies de afdeling en sleep haar plaats op de vloer.',
  entry: 'Tik of sleep waar de ingang is.',
  register: 'Tik of sleep waar de kassa’s zijn.',
  select: 'Tik op een zone of een stuk vloer om het aan te passen of te verwijderen.',
}

interface Props {
  shop: Shop
  categories: IngredientCategory[]
}

/**
 * De plattegrond van één winkel: bekijken en zoeken waar iets ligt, of
 * tekenen. Tekenen gebeurt in een kladversie; pas bij Bewaar wordt de
 * plattegrond in één keer opgeslagen (en dus gesynchroniseerd).
 */
export default function ShopPlan({ shop, categories }: Props) {
  const [editing, setEditing] = useState(false)
  const layout = shop.layout ?? emptyLayout()
  const isEmpty = layout.floor.length === 0 && layout.areas.length === 0

  if (editing) {
    return (
      <PlanEditor
        shop={shop}
        initial={layout}
        categories={categories}
        onClose={() => setEditing(false)}
      />
    )
  }

  if (isEmpty) {
    return (
      <div className="card empty">
        <div className="empty__icon" aria-hidden="true">
          🗺️
        </div>
        <p>Nog geen plattegrond voor {shop.name}.</p>
        <p className="small">
          Teken de winkelvloer en zet de afdelingen, de ingang en de kassa erop. Dan kun je
          later opzoeken waar iets ligt.
        </p>
        <button type="button" className="btn btn--primary" onClick={() => setEditing(true)}>
          Plattegrond tekenen
        </button>
      </div>
    )
  }

  return <PlanViewer layout={layout} categories={categories} onEdit={() => setEditing(true)} />
}

/* ------------------------------------------------------------ bekijken */

function PlanViewer({
  layout,
  categories,
  onEdit,
}: {
  layout: ShopLayout
  categories: IngredientCategory[]
  onEdit: () => void
}) {
  const catalog = useIngredientCatalog()
  const [query, setQuery] = useState('')

  const result = useMemo(
    () => searchLayout(query, layout, categories, catalog),
    [query, layout, categories, catalog],
  )
  const searching = query.trim() !== ''
  const highlight = searching ? new Set(result.categoryIds) : null

  return (
    <div className="stack">
      <input
        className="input search"
        type="search"
        placeholder="Zoek een afdeling of product, bv. tahin"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Zoek een afdeling of product"
      />

      {searching && (
        <div className="stack stack--tight">
          {result.lines.length === 0 ? (
            <p className="small muted" style={{ margin: 0 }}>
              Niets gevonden. Staat het product in Instellingen → Ingrediënten, met een afdeling?
            </p>
          ) : (
            <ul className="plan-results">
              {result.lines.map((line) => (
                <li key={line.text}>
                  {line.text}
                  {!line.onMap && (
                    <span className="badge badge--amber">staat niet op deze plattegrond</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="card shop-map-frame">
        <ShopMap
          layout={layout}
          categories={categories}
          view={layoutBounds(layout)}
          highlight={highlight}
        />
      </div>

      <button type="button" className="btn" onClick={onEdit}>
        ✏️ Plattegrond bewerken
      </button>
    </div>
  )
}

/* ------------------------------------------------------------- tekenen */

function PlanEditor({
  shop,
  initial,
  categories,
  onClose,
}: {
  shop: Shop
  initial: ShopLayout
  categories: IngredientCategory[]
  onClose: () => void
}) {
  const [draft, setDraft] = useState<ShopLayout>(initial)
  const [history, setHistory] = useState<ShopLayout[]>([])
  const [tool, setTool] = useState<Tool>(initial.floor.length === 0 ? 'floor' : 'department')
  const [start, setStart] = useState<Cell | null>(null)
  const [drag, setDrag] = useState<Rect | null>(null)
  const [selected, setSelected] = useState<Hit>(null)
  const [busy, setBusy] = useState(false)

  // Afdelingen in de volgorde van de looproute, daarna de rest.
  const ordered = useMemo(() => {
    const byId = new Map(categories.map((c) => [c.id, c]))
    const inRoute = shop.categoryOrder.map((id) => byId.get(id)).filter((c) => c !== undefined)
    const rest = categories.filter((c) => !shop.categoryOrder.includes(c.id))
    return [...inRoute, ...rest]
  }, [categories, shop.categoryOrder])

  const placed = new Set(draft.areas.map((a) => a.categoryId))
  const notPlaced = ordered.filter((c) => !placed.has(c.id))
  const [categoryId, setCategoryId] = useState<Id>(notPlaced[0]?.id ?? ordered[0]?.id ?? '')

  const change = (next: ShopLayout) => {
    setHistory((h) => [...h, draft])
    setDraft(next)
  }

  const undo = () => {
    const previous = history[history.length - 1]
    if (!previous) return
    setHistory((h) => h.slice(0, -1))
    setDraft(previous)
    setSelected(null)
  }

  const finishDrag = (end: Cell) => {
    if (!start) return
    const rect = rectFromCells(start, end)
    setStart(null)
    setDrag(null)

    if (tool === 'floor') {
      change(addFloor(draft, rect))
    } else if (tool === 'department') {
      if (!categoryId) return
      const next = addArea(draft, { id: newId(), kind: 'department', categoryId, rect })
      change(next)
      // Meteen door naar de volgende afdeling die nog geen plaats heeft.
      const nowPlaced = new Set(next.areas.map((a) => a.categoryId))
      const upcoming = ordered.find((c) => !nowPlaced.has(c.id))
      if (upcoming) setCategoryId(upcoming.id)
    } else if (tool === 'entry' || tool === 'register') {
      change(addArea(draft, { id: newId(), kind: tool, rect }))
    }
  }

  const selectedArea =
    selected?.kind === 'area' ? draft.areas.find((a) => a.id === selected.id) : undefined

  const save = async () => {
    setBusy(true)
    try {
      await setShopLayout(shop.id, draft)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <div className="row row--wrap" role="toolbar" aria-label="Tekengereedschap">
        {TOOLS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={tool === key}
            className={`btn btn--small ${tool === key ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => {
              setTool(key)
              setSelected(null)
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tool === 'department' && (
        <div className="stack stack--tight">
          <select
            className="select"
            value={categoryId}
            aria-label="Welke afdeling teken je"
            onChange={(event) => setCategoryId(event.target.value)}
          >
            {ordered.map((c) => (
              <option key={c.id} value={c.id}>
                {placed.has(c.id) ? '✓ ' : ''}
                {c.name}
              </option>
            ))}
          </select>
          <p className="tiny muted" style={{ margin: 0 }}>
            {notPlaced.length === 0
              ? 'Alle afdelingen staan op de plattegrond.'
              : `Nog niet op de plattegrond: ${notPlaced.length}. Na elke afdeling springt de keuze naar de volgende uit je looproute.`}
          </p>
        </div>
      )}

      <p className="small muted" style={{ margin: 0 }}>
        {HINTS[tool]}
      </p>

      <div className="card shop-map-frame">
        <ShopMap
          layout={draft}
          categories={categories}
          view={{ x: 0, y: 0, w: GRID_WIDTH, h: GRID_HEIGHT }}
          showGrid
          draft={drag}
          selectedAreaId={selected?.kind === 'area' ? selected.id : null}
          selectedFloorIndex={selected?.kind === 'floor' ? selected.index : null}
          onCellDown={(cell) => {
            if (tool === 'select') {
              setSelected(hitTest(draft, cell))
              return
            }
            setStart(cell)
            setDrag(rectFromCells(cell, cell))
          }}
          onCellMove={(cell) => {
            if (start) setDrag(rectFromCells(start, cell))
          }}
          onCellUp={finishDrag}
          onCancel={() => {
            setStart(null)
            setDrag(null)
          }}
        />
      </div>

      {selected && (
        <div className="card stack stack--tight" style={{ padding: '0.75rem' }}>
          <strong className="small">
            {selected.kind === 'floor'
              ? 'Stuk winkelvloer'
              : selectedArea
                ? areaLabel(selectedArea, categories)
                : ''}
          </strong>
          {selectedArea?.kind === 'department' && (
            <select
              className="select"
              value={selectedArea.categoryId}
              aria-label="Afdeling van deze zone"
              onChange={(event) =>
                change(updateArea(draft, selectedArea.id, { categoryId: event.target.value }))
              }
            >
              {ordered.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <div className="row">
            <button
              type="button"
              className="btn btn--small btn--danger"
              onClick={() => {
                change(removeHit(draft, selected))
                setSelected(null)
              }}
            >
              🗑 Verwijder
            </button>
            <button
              type="button"
              className="btn btn--small btn--ghost"
              onClick={() => setSelected(null)}
            >
              Sluiten
            </button>
          </div>
        </div>
      )}

      <div className="row row--wrap">
        <button type="button" className="btn btn--primary" onClick={save} disabled={busy}>
          Bewaar
        </button>
        <button type="button" className="btn btn--ghost" onClick={undo} disabled={history.length === 0}>
          ↶ Ongedaan maken
        </button>
        <span className="spacer" />
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          Annuleer
        </button>
      </div>
    </div>
  )
}
