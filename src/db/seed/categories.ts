import type { Unit } from '../../core/types'

/**
 * Winkelafdelingen zoals je ze in een Belgische supermarkt tegenkomt.
 * De `defaultUnit` bepaalt welke eenheid een nieuw ingrediënt uit die afdeling
 * standaard krijgt — per ingrediënt kan dat overschreven worden.
 */
export interface IngredientCategorySeed {
  slug: string
  name: string
  defaultUnit: Unit
}

export const INGREDIENT_CATEGORIES: IngredientCategorySeed[] = [
  { slug: 'groenten', name: 'Groenten', defaultUnit: 'g' },
  { slug: 'fruit', name: 'Fruit', defaultUnit: 'g' },
  { slug: 'aardappelen', name: 'Aardappelen', defaultUnit: 'kg' },
  { slug: 'verse-kruiden', name: 'Verse kruiden', defaultUnit: 'g' },
  { slug: 'vlees', name: 'Vlees', defaultUnit: 'g' },
  { slug: 'vis', name: 'Vis & zeevruchten', defaultUnit: 'g' },
  { slug: 'charcuterie', name: 'Charcuterie', defaultUnit: 'g' },
  { slug: 'kaas', name: 'Kaas', defaultUnit: 'g' },
  { slug: 'zuivel', name: 'Zuivel & melk', defaultUnit: 'ml' },
  { slug: 'eieren', name: 'Eieren', defaultUnit: 'st' },
  { slug: 'brood', name: 'Brood', defaultUnit: 'st' },
  { slug: 'bakkerij', name: 'Bakkerij', defaultUnit: 'st' },
  { slug: 'pasta-rijst', name: "Pasta & rijst", defaultUnit: 'g' },
  { slug: 'conserven', name: 'Conserven', defaultUnit: 'blik' },
  { slug: 'sauzen', name: 'Sauzen & condimenten', defaultUnit: 'ml' },
  { slug: 'specerijen', name: 'Kruiden & specerijen', defaultUnit: 'tl' },
  { slug: 'bakproducten', name: 'Bakproducten', defaultUnit: 'g' },
  { slug: 'ontbijt', name: 'Ontbijt & granen', defaultUnit: 'g' },
  { slug: 'snacks', name: 'Snacks', defaultUnit: 'g' },
  { slug: 'zoetwaren', name: 'Zoetwaren', defaultUnit: 'g' },
  { slug: 'diepvries', name: 'Diepvries', defaultUnit: 'g' },
  { slug: 'dranken', name: 'Dranken', defaultUnit: 'l' },
  { slug: 'water', name: 'Water', defaultUnit: 'l' },
  { slug: 'wijn-bier', name: 'Wijn & bier', defaultUnit: 'st' },
  { slug: 'koffie-thee', name: 'Koffie & thee', defaultUnit: 'g' },
  { slug: 'huishouden', name: 'Huishouden', defaultUnit: 'st' },
  { slug: 'hygiene', name: 'Hygiëne', defaultUnit: 'st' },
  { slug: 'overig', name: 'Overig', defaultUnit: 'st' },
]

export interface RecipeCategorySeed {
  slug: string
  name: string
}

export const RECIPE_CATEGORIES: RecipeCategorySeed[] = [
  { slug: 'soepen', name: 'Soepen' },
  { slug: 'voorgerechten', name: 'Voorgerechten' },
  { slug: 'salades', name: 'Salades' },
  { slug: 'pastas', name: "Pasta's" },
  { slug: 'hoofdgerechten', name: 'Hoofdgerechten' },
  { slug: 'vis', name: 'Visgerechten' },
  { slug: 'vegetarisch', name: 'Vegetarisch' },
  { slug: 'ovenschotels', name: 'Ovenschotels' },
  { slug: 'bijgerechten', name: 'Bijgerechten' },
  { slug: 'desserts', name: 'Desserts' },
  { slug: 'bakken', name: 'Bakken' },
  { slug: 'ontbijt-brunch', name: 'Ontbijt & brunch' },
]
