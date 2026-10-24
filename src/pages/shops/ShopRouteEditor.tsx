import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { usePageHeader } from '../../components/AppLayout'
import { useIngredientCategories, useShop } from '../../hooks/useData'
import {
  addCategoriesToRoute,
  addCategoryToRoute,
  removeFromRoute,
  setCategoryOrder,
} from '../../db/shops'
import { cleanRoute, unplacedCategories } from '../../core/sorting'
import ShopPlan from './ShopPlan'
import type { Id, IngredientCategory } from '../../core/types'

/**
 * Looproute van een winkel: de afdelingen in de volgorde waarin je ze
 * tegenkomt. Slepen gaat via het handvat, zodat je op de telefoon nog gewoon
 * door de lijst kunt scrollen. De pijltjes doen hetzelfde zonder slepen.
 */
export default function ShopRouteEditor() {
  const { shopId } = useParams<{ shopId: string }>()
  const shop = useShop(shopId)
  const categories = useIngredientCategories()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'plan' ? 'plan' : 'route'

  usePageHeader(shop?.name ?? 'Winkel')

  // Tijdens het wegschrijven tonen we de nieuwe volgorde al, anders springt
  // de rij na het loslaten heel even terug naar haar oude plaats.
  const [pending, setPending] = useState<Id[] | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  )

  if (shop === undefined) return null

  if (shop === null) {
    return (
      <div className="card empty">
        <div className="empty__icon" aria-hidden="true">
          🧭
        </div>
        <p>Deze winkel bestaat niet meer.</p>
        <Link className="btn btn--primary" to="/winkels">
          Terug naar de winkels
        </Link>
      </div>
    )
  }

  const route = pending ?? cleanRoute(shop, categories)
  const placed = route
    .map((id) => categoryById.get(id))
    .filter((c): c is IngredientCategory => c !== undefined)
  const unplaced = unplacedCategories(categories, { ...shop, categoryOrder: route })

  // Schuift binnen de zichtbare route, zodat een afdeling die elders al
  // verwijderd is nooit als onzichtbare buur een verplaatsing opslokt.
  const move = async (from: number, to: number) => {
    if (from < 0 || to < 0 || to >= route.length || from === to) return
    const next = arrayMove(route, from, to)
    setPending(next)
    try {
      await setCategoryOrder(shop.id, next)
    } finally {
      setPending(null)
    }
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return
    void move(route.indexOf(String(active.id)), route.indexOf(String(over.id)))
  }

  return (
    <div className="stack">
      <div className="row" role="tablist" aria-label="Winkel">
        {(
          [
            ['route', '🚶 Looproute'],
            ['plan', '🗺️ Plattegrond'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`btn btn--small ${tab === key ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setSearchParams(key === 'plan' ? { tab: 'plan' } : {}, { replace: true })}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'plan' ? (
        <ShopPlan shop={shop} categories={categories} />
      ) : (
        <>
      <p className="small muted" style={{ margin: 0 }}>
        Zet de afdelingen in de volgorde waarin je door de winkel loopt. Sleep aan ⠿ of
        gebruik de pijltjes.
      </p>

      <section className="stack stack--tight">
        <h2 className="section-title">
          Looproute
          <span className="spacer" />
          <span className="muted">{placed.length}</span>
        </h2>

        {placed.length === 0 ? (
          <div className="card empty">
            <div className="empty__icon" aria-hidden="true">
              🚶
            </div>
            <p>Nog leeg. Voeg hieronder de afdelingen toe in de volgorde waarin je ze tegenkomt.</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={route} strategy={verticalListSortingStrategy}>
              <ol className="list route">
                {placed.map((category, index) => (
                  <RouteRow
                    key={category.id}
                    category={category}
                    position={index + 1}
                    isFirst={index === 0}
                    isLast={index === placed.length - 1}
                    onMove={(direction) => void move(index, index + direction)}
                    onRemove={() => void removeFromRoute(shop.id, category.id)}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}
      </section>

      {unplaced.length > 0 && (
        <section className="stack stack--tight route-tray">
          <h2 className="section-title">
            Nog te plaatsen
            <span className="badge badge--amber">{unplaced.length}</span>
            <span className="spacer" />
            <button
              type="button"
              className="btn btn--small btn--ghost"
              onClick={() =>
                void addCategoriesToRoute(
                  shop.id,
                  unplaced.map((c) => c.id),
                )
              }
            >
              Alles toevoegen
            </button>
          </h2>
          <p className="small muted" style={{ margin: 0 }}>
            Deze afdelingen hebben in deze winkel nog geen plaats. Op de lijst komen ze
            achteraan.
          </p>
          <ul className="list">
            {unplaced.map((category) => (
              <li key={category.id}>
                <div className="list-item">
                  <div className="list-item__body">
                    <div className="list-item__title">{category.name}</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn--small"
                    onClick={() => void addCategoryToRoute(shop.id, category.id)}
                    aria-label={`${category.name} aan de route toevoegen`}
                  >
                    + Aan route
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
        </>
      )}
    </div>
  )
}

interface RouteRowProps {
  category: IngredientCategory
  position: number
  isFirst: boolean
  isLast: boolean
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
}

function RouteRow({ category, position, isFirst, isLast, onMove, onRemove }: RouteRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: category.id })

  return (
    <li
      ref={setNodeRef}
      className={isDragging ? 'route__row is-dragging' : 'route__row'}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div className="list-item">
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="route__handle"
          aria-label={`${category.name} verslepen`}
          title="Verslepen"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <span className="route__position">{position}</span>
        <div className="list-item__body">
          <div className="list-item__title">{category.name}</div>
        </div>
        <button
          type="button"
          className="btn btn--small btn--ghost btn--icon"
          onClick={() => onMove(-1)}
          disabled={isFirst}
          aria-label={`${category.name} omhoog`}
          title="Omhoog"
        >
          ↑
        </button>
        <button
          type="button"
          className="btn btn--small btn--ghost btn--icon"
          onClick={() => onMove(1)}
          disabled={isLast}
          aria-label={`${category.name} omlaag`}
          title="Omlaag"
        >
          ↓
        </button>
        <button
          type="button"
          className="btn btn--small btn--ghost btn--icon"
          onClick={onRemove}
          aria-label={`${category.name} uit de route halen`}
          title="Uit de route halen"
        >
          ✕
        </button>
      </div>
    </li>
  )
}
