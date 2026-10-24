import { db } from './db'
import { createRecord, deleteRecord, getRecord, listRecords, updateRecord } from './repo'
import { normalizeName } from '../core/ids'
import { NO_CATEGORY } from '../core/ingredients'
import type { CatalogIngredient, Id, Unit } from '../core/types'

/**
 * Zoekt een ingrediënt in de catalogus op naam, of maakt het aan.
 *
 * - Een eerder verwijderd ingrediënt wordt weer tot leven gewekt in plaats van
 *   gedupliceerd: als je het opnieuw intypt, wil je het duidelijk terug.
 * - Had het catalogusitem nog geen afdeling en geef je er nu een mee, dan
 *   onthoudt de catalogus die. Geef je er geen mee, dan blijft de bestaande.
 */
export async function ensureCatalogIngredient(
  name: string,
  categoryId: Id,
  defaultUnit: Unit,
): Promise<CatalogIngredient> {
  const trimmed = name.trim()
  const lower = normalizeName(trimmed)

  // Ook tombstones meenemen, vandaar de ruwe tabel in plaats van listRecords.
  const existing = await db.ingredients.where('nameLower').equals(lower).first()

  if (existing) {
    if (existing.deleted === 1) {
      const revived = await updateRecord('ingredients', existing.id, {
        deleted: 0,
        categoryId,
        name: trimmed,
      })
      return revived ?? existing
    }
    if (existing.categoryId === NO_CATEGORY && categoryId !== NO_CATEGORY) {
      return (await updateRecord('ingredients', existing.id, { categoryId })) ?? existing
    }
    return existing
  }

  return createRecord('ingredients', {
    name: trimmed,
    nameLower: lower,
    categoryId,
    defaultUnit,
    usageCount: 0,
    isSeed: 0,
  })
}

/** Houdt bij wat je vaak gebruikt, zodat de suggesties beter worden. */
export async function bumpIngredientUsage(ingredientId: Id): Promise<void> {
  const ingredient = await getRecord('ingredients', ingredientId)
  if (!ingredient) return
  await updateRecord('ingredients', ingredientId, { usageCount: ingredient.usageCount + 1 })
}

/* ------------------------------------------------------------ beheren */

/** Nieuw ingrediënt vanuit Instellingen. Weigert een naam die al bestaat. */
export async function addIngredient(
  name: string,
  categoryId: Id,
  defaultUnit: Unit,
): Promise<CatalogIngredient> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Geef het ingrediënt een naam.')
  const clash = (await listRecords('ingredients')).find(
    (item) => item.nameLower === normalizeName(trimmed),
  )
  if (clash) throw new Error(`${clash.name} staat al in de lijst.`)
  return ensureCatalogIngredient(trimmed, categoryId, defaultUnit)
}

export async function renameIngredient(id: Id, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) return
  const lower = normalizeName(trimmed)
  const clash = (await listRecords('ingredients')).find(
    (item) => item.id !== id && item.nameLower === lower,
  )
  if (clash) throw new Error(`${clash.name} staat al in de lijst.`)
  await updateRecord('ingredients', id, { name: trimmed, nameLower: lower })
}

export async function setIngredientUnit(id: Id, defaultUnit: Unit): Promise<void> {
  await updateRecord('ingredients', id, { defaultUnit })
}

/**
 * Zet de afdeling van een ingrediënt, en trekt die door naar alles wat het
 * gebruikt: receptregels, wat nog op de lijst staat en de voorraad. Anders
 * zou een recept het ingrediënt bij de volgende keer nog altijd in de oude
 * afdeling op de lijst zetten. Afgevinkte regels liggen al in de kar en
 * blijven zoals ze zijn.
 */
export async function setIngredientCategory(id: Id, categoryId: Id): Promise<void> {
  const ingredient = await getRecord('ingredients', id)
  if (!ingredient) return
  await updateRecord('ingredients', id, { categoryId })

  const matches = (item: { ingredientId: Id | null; name: string }) =>
    item.ingredientId === id ||
    (item.ingredientId === null && normalizeName(item.name) === ingredient.nameLower)

  for (const recipe of await listRecords('recipes')) {
    if (!recipe.ingredients.some((line) => matches(line) && line.categoryId !== categoryId)) {
      continue
    }
    await updateRecord('recipes', recipe.id, {
      ingredients: recipe.ingredients.map((line) =>
        matches(line) ? { ...line, categoryId } : line,
      ),
    })
  }
  for (const item of await listRecords('groceryItems')) {
    if (item.checked === 0 && matches(item) && item.categoryId !== categoryId) {
      await updateRecord('groceryItems', item.id, { categoryId })
    }
  }
  for (const item of await listRecords('pantryItems')) {
    if (matches(item) && item.categoryId !== categoryId) {
      await updateRecord('pantryItems', item.id, { categoryId })
    }
  }
}

/**
 * Haalt een ingrediënt uit de catalogus. Recepten, lijst en voorraad houden
 * hun regels gewoon; het verdwijnt alleen uit de suggesties.
 */
export async function deleteIngredient(id: Id): Promise<void> {
  await deleteRecord('ingredients', id)
}
