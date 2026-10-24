import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageHeader } from '../../components/AppLayout'
import { useIngredientCategories, useShops } from '../../hooks/useData'
import { addShop, deleteShop, renameShop } from '../../db/shops'
import type { Id } from '../../core/types'

/**
 * Overzicht van de winkels. Elke winkel heeft een eigen looproute; tik op een
 * winkel om die route in te stellen.
 */
export default function ShopList() {
  usePageHeader('Winkels')

  const shops = useShops()
  const categories = useIngredientCategories()

  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<Id | null>(null)
  const [editingName, setEditingName] = useState('')
  const [deletingId, setDeletingId] = useState<Id | null>(null)

  const known = new Set(categories.map((c) => c.id))

  const add = async () => {
    if (!newName.trim()) return
    await addShop(newName)
    setNewName('')
  }

  const saveRename = async () => {
    if (!editingId) return
    await renameShop(editingId, editingName)
    setEditingId(null)
    setEditingName('')
  }

  const confirmDelete = async () => {
    if (!deletingId) return
    await deleteShop(deletingId)
    setDeletingId(null)
  }

  return (
    <div className="stack">
      <p className="small muted" style={{ margin: 0 }}>
        Per winkel leg je vast in welke volgorde je langs de afdelingen loopt. Op de
        boodschappenlijst kies je dan de winkel, en de lijst schikt zich naar je route.
      </p>

      {shops.length === 0 ? (
        <div className="card empty">
          <div className="empty__icon" aria-hidden="true">
            🏬
          </div>
          <p>Nog geen winkels. Voeg hieronder je eerste winkel toe.</p>
        </div>
      ) : (
        <ul className="list">
          {shops.map((shop) => {
            const placed = shop.categoryOrder.filter((id) => known.has(id)).length
            const missing = categories.length - placed
            return (
              <li key={shop.id}>
                {editingId === shop.id ? (
                  <div className="list-item">
                    <input
                      className="input"
                      value={editingName}
                      autoFocus
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void saveRename()
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      aria-label="Nieuwe naam"
                    />
                    <button
                      type="button"
                      className="btn btn--small btn--primary"
                      onClick={saveRename}
                    >
                      Bewaar
                    </button>
                    <button
                      type="button"
                      className="btn btn--small btn--ghost"
                      onClick={() => setEditingId(null)}
                    >
                      Annuleer
                    </button>
                  </div>
                ) : (
                  <div className="list-item">
                    <Link
                      to={`/winkels/${shop.id}`}
                      className="list-item__body"
                      style={{ color: 'inherit', textDecoration: 'none' }}
                    >
                      <div className="list-item__title">{shop.name}</div>
                      <div className="list-item__sub">
                        {placed === 0
                          ? 'Nog geen looproute'
                          : `${placed} ${placed === 1 ? 'afdeling' : 'afdelingen'} in de route`}
                        {placed > 0 && missing > 0 && (
                          <>
                            {' '}
                            <span className="badge badge--amber">{missing} nog te plaatsen</span>
                          </>
                        )}
                      </div>
                    </Link>
                    <button
                      type="button"
                      className="btn btn--small btn--ghost btn--icon"
                      onClick={() => {
                        setDeletingId(null)
                        setEditingId(shop.id)
                        setEditingName(shop.name)
                      }}
                      aria-label={`${shop.name} hernoemen`}
                      title="Hernoemen"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      className="btn btn--small btn--ghost btn--icon"
                      onClick={() => setDeletingId(shop.id)}
                      aria-label={`${shop.name} verwijderen`}
                      title="Verwijderen"
                    >
                      🗑
                    </button>
                    <Link
                      to={`/winkels/${shop.id}`}
                      className="chevron"
                      aria-label={`Looproute van ${shop.name}`}
                    >
                      ›
                    </Link>
                  </div>
                )}

                {deletingId === shop.id && (
                  <div
                    className="stack stack--tight"
                    style={{ padding: '0.9rem', background: 'var(--red-soft)' }}
                  >
                    <strong className="small">{shop.name} verwijderen?</strong>
                    <p className="small" style={{ margin: 0 }}>
                      De looproute van deze winkel gaat verloren. Je boodschappenlijst blijft
                      gewoon staan.
                    </p>
                    <div className="row">
                      <button
                        type="button"
                        className="btn btn--small btn--danger"
                        onClick={confirmDelete}
                      >
                        Verwijder
                      </button>
                      <button
                        type="button"
                        className="btn btn--small btn--ghost"
                        onClick={() => setDeletingId(null)}
                      >
                        Annuleer
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <div className="row">
        <input
          className="input"
          placeholder="Nieuwe winkel, bv. Colruyt Leuven"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void add()
          }}
          aria-label="Nieuwe winkel"
        />
        <button
          type="button"
          className="btn btn--primary"
          onClick={add}
          disabled={!newName.trim()}
        >
          Voeg toe
        </button>
      </div>
    </div>
  )
}
