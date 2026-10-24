import { createRecord, deleteRecord, getRecord, listRecords, nextSortOrder, updateRecord } from './repo'
import { cleanRoute } from '../core/sorting'
import type { Id, Shop, ShopLayout } from '../core/types'

/* ------------------------------------------------------------ aanmaken */

/** Een nieuwe winkel begint met een lege looproute: alles is nog te plaatsen. */
export async function addShop(name: string): Promise<Shop | undefined> {
  const trimmed = name.trim()
  if (!trimmed) return undefined
  return createRecord('shops', {
    name: trimmed,
    sortOrder: await nextSortOrder('shops'),
    categoryOrder: [],
  })
}

export async function renameShop(id: Id, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) return
  await updateRecord('shops', id, { name: trimmed })
}

/** Zacht verwijderen, zodat de verwijdering bij sync ook op het andere toestel aankomt. */
export async function deleteShop(id: Id): Promise<void> {
  await deleteRecord('shops', id)
}

/* ------------------------------------------------------------ looproute */

/**
 * Legt de volledige looproute in een keer vast. Dubbels vallen weg, zodat een
 * afdeling nooit op twee plaatsen in de route kan staan.
 */
export async function setCategoryOrder(shopId: Id, categoryIds: Id[]): Promise<void> {
  await updateRecord('shops', shopId, { categoryOrder: [...new Set(categoryIds)] })
}

/** Zet een afdeling achteraan in de route; staat ze er al in, dan gebeurt er niets. */
export async function addCategoryToRoute(shopId: Id, categoryId: Id): Promise<void> {
  await addCategoriesToRoute(shopId, [categoryId])
}

/** Meerdere afdelingen tegelijk achteraan toevoegen, in de gegeven volgorde. */
export async function addCategoriesToRoute(shopId: Id, categoryIds: Id[]): Promise<void> {
  const shop = await getRecord('shops', shopId)
  if (!shop) return
  const missing = categoryIds.filter((id) => !shop.categoryOrder.includes(id))
  if (missing.length === 0) return
  await setCategoryOrder(shopId, [...shop.categoryOrder, ...missing])
}

/** Haalt een afdeling uit de route; ze komt dan terug bij "nog te plaatsen". */
export async function removeFromRoute(shopId: Id, categoryId: Id): Promise<void> {
  const shop = await getRecord('shops', shopId)
  if (!shop || !shop.categoryOrder.includes(categoryId)) return
  await setCategoryOrder(
    shopId,
    shop.categoryOrder.filter((id) => id !== categoryId),
  )
}

/** Verschuift een afdeling een plaats; de knoppen naast het slepen gebruiken dit. */
export async function moveInRoute(shopId: Id, categoryId: Id, direction: -1 | 1): Promise<void> {
  const shop = await getRecord('shops', shopId)
  if (!shop) return
  const order = [...shop.categoryOrder]
  const index = order.indexOf(categoryId)
  const target = index + direction
  if (index < 0 || target < 0 || target >= order.length) return
  ;[order[index], order[target]] = [order[target]!, order[index]!]
  await setCategoryOrder(shopId, order)
}

/**
 * Haalt afdelingen die niet meer bestaan uit elke looproute en plattegrond. Een ander toestel
 * kan een afdeling verwijderd hebben terwijl deze winkel daar nog naar
 * verwees; na een sync ruimt dit dat op. Schrijft alleen winkels die echt
 * veranderen, zodat er geen onnodige nieuwe updatedAt's ontstaan.
 */
export async function cleanShopRoutes(): Promise<number> {
  const categories = await listRecords('ingredientCategories')
  let changed = 0
  const known = new Set(categories.map((c) => c.id))
  for (const shop of await listRecords('shops')) {
    const cleaned = cleanRoute(shop, categories)
    // Afdelingszones van een verdwenen afdeling gaan ook van de plattegrond.
    const areas = shop.layout?.areas.filter(
      (a) => a.kind !== 'department' || known.has(a.categoryId ?? ''),
    )
    const routeChanged = cleaned.length !== shop.categoryOrder.length
    const mapChanged = shop.layout !== undefined && areas!.length !== shop.layout.areas.length
    if (routeChanged || mapChanged) {
      await updateRecord('shops', shop.id, {
        categoryOrder: cleaned,
        ...(mapChanged ? { layout: { ...shop.layout!, areas: areas! } } : {}),
      })
      changed++
    }
  }
  return changed
}

/** Bewaart de plattegrond in één keer, zodat hij als geheel synchroniseert. */
export async function setShopLayout(shopId: Id, layout: ShopLayout): Promise<void> {
  await updateRecord('shops', shopId, { layout })
}
