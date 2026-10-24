import { normalizeName } from './ids'
import { addAmounts, canMerge } from './units'
import type { GroceryItem, GrocerySource, Id, Unit } from './types'

/** Wat er aan de lijst toegevoegd wordt, voordat er iets over ids bekend is. */
export interface GroceryAddition {
  name: string
  ingredientId: Id | null
  amount: number | null
  unit: Unit
  categoryId: Id
  source: GrocerySource
}

export interface GroceryUpdate {
  id: Id
  amount: number | null
  unit: Unit
  sources: GrocerySource[]
}

export interface GroceryCreation {
  name: string
  nameLower: string
  ingredientId: Id | null
  amount: number | null
  unit: Unit
  categoryId: Id
  checked: 0
  sources: GrocerySource[]
}

export interface GroceryMergePlan {
  updates: GroceryUpdate[]
  creations: GroceryCreation[]
  /** samengevoegd bij een regel die er al stond */
  merged: number
  /** als nieuwe regel toegevoegd */
  added: number
}

interface WorkingLine {
  id?: Id
  name: string
  nameLower: string
  ingredientId: Id | null
  amount: number | null
  unit: Unit
  categoryId: Id
  sources: GrocerySource[]
  touched: boolean
  isNew: boolean
}

function isSameIngredient(line: WorkingLine, addition: GroceryAddition, lower: string): boolean {
  // Een id-match is harder dan een naam-match: twee catalogusitems kunnen
  // dezelfde naam dragen na een hernoeming.
  if (line.ingredientId && addition.ingredientId) {
    return line.ingredientId === addition.ingredientId
  }
  return line.nameLower === lower
}

/**
 * Bepaalt wat er met de boodschappenlijst moet gebeuren als je iets toevoegt.
 * Pure functie: ze leest geen database en verzint geen ids, zodat ze precies
 * te testen valt.
 *
 * Twee regels die het gedrag bepalen:
 *
 * 1. Samenvoegen kan alleen bij een verenigbare eenheid. 200 g en 0,3 kg wordt
 *    500 g; 2 stuks en 400 g blijven twee regels, want we weten niet hoeveel
 *    een stuk weegt.
 *
 * 2. Er wordt nooit samengevoegd met een afgevinkte regel. Afgevinkt betekent
 *    "ligt al in de kar". Zou je daar 300 g bij optellen, dan koop je de 500 g
 *    die er al in ligt een tweede keer. In plaats daarvan komt er een nieuwe
 *    regel bij voor wat je nog nodig hebt.
 */
export function planGroceryAdditions(
  existing: GroceryItem[],
  additions: GroceryAddition[],
): GroceryMergePlan {
  const working: WorkingLine[] = existing
    .filter((item) => item.checked === 0)
    .map((item) => ({
      id: item.id,
      name: item.name,
      nameLower: item.nameLower,
      ingredientId: item.ingredientId,
      amount: item.amount,
      unit: item.unit,
      categoryId: item.categoryId,
      sources: [...item.sources],
      touched: false,
      isNew: false,
    }))

  let merged = 0
  let added = 0

  for (const addition of additions) {
    const name = addition.name.trim()
    if (!name) continue
    const lower = normalizeName(name)

    const match = working.find(
      (line) => isSameIngredient(line, addition, lower) && canMerge(line.unit, addition.unit),
    )

    if (match) {
      const total = addAmounts(
        { amount: match.amount, unit: match.unit },
        { amount: addition.amount, unit: addition.unit },
      )
      if (total) {
        match.amount = total.amount
        match.unit = total.unit
      }
      match.sources.push(addition.source)
      match.touched = true
      // Twee toevoegingen in dezelfde ronde die op elkaar landen tellen als
      // één nieuwe regel, niet als een samenvoeging met de bestaande lijst.
      if (!match.isNew) merged++
    } else {
      working.push({
        name,
        nameLower: lower,
        ingredientId: addition.ingredientId,
        amount: addition.amount,
        unit: addition.unit,
        categoryId: addition.categoryId,
        sources: [addition.source],
        touched: true,
        isNew: true,
      })
      added++
    }
  }

  return {
    updates: working
      .filter((line) => !line.isNew && line.touched && line.id)
      .map((line) => ({
        id: line.id!,
        amount: line.amount,
        unit: line.unit,
        sources: line.sources,
      })),
    creations: working
      .filter((line) => line.isNew)
      .map((line) => ({
        name: line.name,
        nameLower: line.nameLower,
        ingredientId: line.ingredientId,
        amount: line.amount,
        unit: line.unit,
        categoryId: line.categoryId,
        checked: 0 as const,
        sources: line.sources,
      })),
    merged,
    added,
  }
}

/** Korte omschrijving van de herkomst, voor onder de regel op de lijst. */
export function describeSources(sources: GrocerySource[]): string {
  if (sources.length === 0) return ''

  const recipes = new Map<string, number | undefined>()
  let manual = false
  let pantry = false

  for (const source of sources) {
    if (source.kind === 'recipe' && source.recipeName) {
      recipes.set(source.recipeName, source.portions)
    } else if (source.kind === 'pantry') {
      pantry = true
    } else {
      manual = true
    }
  }

  const parts = [...recipes.entries()].map(([name, portions]) =>
    portions ? `${name} (${portions} p.)` : name,
  )
  if (pantry) parts.push('voorraad')
  if (manual) parts.push('zelf toegevoegd')
  return parts.join(' · ')
}
