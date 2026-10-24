import { useState } from 'react'
import {
  addIngredientCategory,
  addRecipeCategory,
  countIngredientCategoryUsage,
  countRecipesInCategory,
  deleteIngredientCategory,
  deleteRecipeCategory,
  moveCategory,
  renameCategory,
  setCategoryBasic,
} from '../db/categories'
import type { Id } from '../core/types'

type Kind = 'ingredient' | 'recipe'

interface Category {
  id: Id
  name: string
  sortOrder: number
  basic?: 0 | 1
}

interface Props {
  kind: Kind
  categories: Category[]
  /** uitleg onder de titel */
  hint: string
}

const TABLE = {
  ingredient: 'ingredientCategories',
  recipe: 'recipeCategories',
} as const

/**
 * Beheer van een categorielijst: toevoegen, hernoemen, verplaatsen en
 * verwijderen. Verwijderen vraagt altijd eerst waar bestaande items naartoe
 * moeten, zodat er nooit items achterblijven die naar een verdwenen categorie
 * verwijzen.
 */
export default function CategoryManager({ kind, categories, hint }: Props) {
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<Id | null>(null)
  const [editingName, setEditingName] = useState('')
  const [deleting, setDeleting] = useState<{ id: Id; usage: string; needsTarget: boolean } | null>(
    null,
  )
  const [moveTo, setMoveTo] = useState<Id | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const add = async () => {
    const name = newName.trim()
    if (!name) return
    setBusy(true)
    try {
      if (kind === 'ingredient') await addIngredientCategory(name)
      else await addRecipeCategory(name)
      setNewName('')
      setError(null)
    } finally {
      setBusy(false)
    }
  }

  const saveRename = async () => {
    if (!editingId) return
    await renameCategory(TABLE[kind], editingId, editingName)
    setEditingId(null)
    setEditingName('')
  }

  const startDelete = async (id: Id) => {
    setError(null)
    setMoveTo('')
    if (kind === 'ingredient') {
      const usage = await countIngredientCategoryUsage(id)
      const parts: string[] = []
      if (usage.ingredients) parts.push(`${usage.ingredients} ingrediënten`)
      if (usage.recipes) parts.push(`${usage.recipes} recepten`)
      if (usage.groceryItems) parts.push(`${usage.groceryItems} items op de lijst`)
      if (usage.pantryItems) parts.push(`${usage.pantryItems} voorraaditems`)
      setDeleting({
        id,
        usage: parts.length ? parts.join(', ') : 'niets',
        needsTarget: usage.total > 0,
      })
    } else {
      const count = await countRecipesInCategory(id)
      setDeleting({
        id,
        usage: count ? `${count} recepten` : 'niets',
        needsTarget: count > 0,
      })
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setBusy(true)
    setError(null)
    try {
      const target = moveTo === '' ? null : moveTo
      if (kind === 'ingredient') await deleteIngredientCategory(deleting.id, target)
      else await deleteRecipeCategory(deleting.id, target)
      setDeleting(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verwijderen is niet gelukt.')
    } finally {
      setBusy(false)
    }
  }

  const others = categories.filter((c) => c.id !== deleting?.id)
  const lastOne = categories.length <= 1

  return (
    <section className="stack">
      <p className="small muted" style={{ margin: 0 }}>
        {hint}
      </p>

      <ul className="list">
        {categories.map((category, index) => (
          <li key={category.id}>
            {editingId === category.id ? (
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
                <button type="button" className="btn btn--small btn--primary" onClick={saveRename}>
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
                <div className="list-item__body">
                  <div className="list-item__title">{category.name}</div>
                </div>
                {kind === 'ingredient' && (
                  <button
                    type="button"
                    className={`btn btn--small ${category.basic === 1 ? 'btn--primary' : 'btn--ghost'}`}
                    onClick={() => void setCategoryBasic(category.id, category.basic !== 1)}
                    aria-pressed={category.basic === 1}
                    title="Basis: bij Klaarmaken voor de boodschappenlijst standaard uitgevinkt"
                  >
                    Basis
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn--small btn--ghost btn--icon"
                  onClick={() => void moveCategory(TABLE[kind], category.id, -1)}
                  disabled={index === 0}
                  aria-label={`${category.name} omhoog`}
                  title="Omhoog"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn btn--small btn--ghost btn--icon"
                  onClick={() => void moveCategory(TABLE[kind], category.id, 1)}
                  disabled={index === categories.length - 1}
                  aria-label={`${category.name} omlaag`}
                  title="Omlaag"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn btn--small btn--ghost btn--icon"
                  onClick={() => {
                    setEditingId(category.id)
                    setEditingName(category.name)
                  }}
                  aria-label={`${category.name} hernoemen`}
                  title="Hernoemen"
                >
                  ✏️
                </button>
                <button
                  type="button"
                  className="btn btn--small btn--ghost btn--icon"
                  onClick={() => void startDelete(category.id)}
                  disabled={lastOne}
                  aria-label={`${category.name} verwijderen`}
                  title={lastOne ? 'De laatste categorie kan niet weg' : 'Verwijderen'}
                >
                  🗑
                </button>
              </div>
            )}

            {deleting?.id === category.id && (
              <div
                className="stack stack--tight"
                style={{ padding: '0.9rem', background: 'var(--red-soft)' }}
              >
                <strong className="small">{category.name} verwijderen?</strong>
                <p className="small" style={{ margin: 0 }}>
                  {deleting.needsTarget
                    ? `Hieraan hangt nog ${deleting.usage}. Kies waar dat naartoe gaat.`
                    : 'Er hangt niets aan deze categorie.'}
                </p>
                {deleting.needsTarget && (
                  <select
                    className="select"
                    value={moveTo}
                    onChange={(e) => setMoveTo(e.target.value)}
                    aria-label="Verplaatsen naar"
                  >
                    <option value="">Kies een categorie…</option>
                    {others.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
                {error && (
                  <p className="small" style={{ margin: 0, color: 'var(--red)' }}>
                    {error}
                  </p>
                )}
                <div className="row">
                  <button
                    type="button"
                    className="btn btn--small btn--danger"
                    onClick={confirmDelete}
                    disabled={busy || (deleting.needsTarget && moveTo === '')}
                  >
                    Verwijder
                  </button>
                  <button
                    type="button"
                    className="btn btn--small btn--ghost"
                    onClick={() => setDeleting(null)}
                  >
                    Annuleer
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="row">
        <input
          className="input"
          placeholder="Nieuwe categorie"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void add()
          }}
          aria-label="Nieuwe categorie"
        />
        <button
          type="button"
          className="btn btn--primary"
          onClick={add}
          disabled={busy || !newName.trim()}
        >
          Voeg toe
        </button>
      </div>
    </section>
  )
}
