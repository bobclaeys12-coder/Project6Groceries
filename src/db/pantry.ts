import { createRecord, deleteRecord, getRecord, listRecords, updateRecord } from './repo'
import { addToGroceryList } from './grocery'
import { ensureCatalogIngredient } from './ingredients'
import type { AddResult } from './grocery'
import { normalizeName } from '../core/ids'
import { pantryAddition, pantryAdditions, stepAmount } from '../core/pantry'
import type { Id, PantryItem, Unit } from '../core/types'

export interface PantryInput {
  name: string
  ingredientId: Id | null
  categoryId: Id
  current: number
  target: number
  unit: Unit
}

function clean(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}

/**
 * Voegt een voorraaditem toe. Hetzelfde ingrediënt twee keer in de voorraad
 * zou de tekorten dubbel tellen, dus dat weigeren we.
 */
export async function addPantryItem(input: PantryInput): Promise<PantryItem> {
  const name = input.name.trim()
  if (!name) throw new Error('Geef het voorraaditem een naam.')
  const nameLower = normalizeName(name)

  const existing = (await listRecords('pantryItems')).find((item) =>
    item.ingredientId && input.ingredientId
      ? item.ingredientId === input.ingredientId
      : item.nameLower === nameLower,
  )
  if (existing) throw new Error(`${existing.name} staat al in je voorraad.`)

  // Ook in de catalogus, zodat het in Instellingen → Ingrediënten staat.
  const catalogItem = await ensureCatalogIngredient(name, input.categoryId, input.unit)

  return createRecord('pantryItems', {
    name,
    nameLower,
    ingredientId: input.ingredientId ?? catalogItem.id,
    categoryId: input.categoryId || catalogItem.categoryId,
    current: clean(input.current),
    target: clean(input.target),
    unit: input.unit,
  })
}

export async function updatePantryItem(
  id: Id,
  changes: Partial<Pick<PantryItem, 'name' | 'categoryId' | 'current' | 'target' | 'unit'>>,
): Promise<void> {
  const patch: Partial<PantryItem> = { ...changes }
  if (changes.name !== undefined) {
    const name = changes.name.trim()
    if (!name) return
    patch.name = name
    patch.nameLower = normalizeName(name)
  }
  if (changes.current !== undefined) patch.current = clean(changes.current)
  if (changes.target !== undefined) patch.target = clean(changes.target)
  await updateRecord('pantryItems', id, patch)
}

/** De grote +/− knoppen. */
export async function stepPantryItem(id: Id, direction: -1 | 1): Promise<void> {
  const item = await getRecord('pantryItems', id)
  if (!item) return
  await updateRecord('pantryItems', id, { current: stepAmount(item.current, item.unit, direction) })
}

export async function removePantryItem(id: Id): Promise<void> {
  await deleteRecord('pantryItems', id)
}

/** Zet het tekort van een item op de lijst, min wat er al op staat. */
export async function pushShortfall(id: Id): Promise<AddResult> {
  const item = await getRecord('pantryItems', id)
  if (!item) return { added: 0, merged: 0 }
  const addition = pantryAddition(item, await listRecords('groceryItems'), Date.now())
  return addToGroceryList(addition ? [addition] : [])
}

export async function pushAllShortfalls(): Promise<AddResult> {
  const [items, groceryItems] = await Promise.all([
    listRecords('pantryItems'),
    listRecords('groceryItems'),
  ])
  return addToGroceryList(pantryAdditions(items, groceryItems, Date.now()))
}
