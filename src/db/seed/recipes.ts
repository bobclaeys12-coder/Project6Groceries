import type { Unit } from '../../core/types'

/**
 * Een handvol Vlaamse klassiekers, zodat de app niet leeg opstart en je meteen
 * iets hebt om het herschalen en de boodschappenlijst op te testen.
 * Alle hoeveelheden zijn voor 4 personen.
 *
 * `name` moet exact overeenkomen met een naam uit de ingrediëntencatalogus:
 * de seeder koppelt de regel daarmee aan het catalogusitem.
 */
export interface RecipeSeedIngredient {
  name: string
  amount: number | null
  unit: Unit
  /** slug van de ingrediëntcategorie */
  category: string
  note?: string
}

export interface RecipeSeed {
  slug: string
  name: string
  /** slug van de receptcategorie */
  category: string
  notes: string
  ingredients: RecipeSeedIngredient[]
  steps: string[]
}

export const EXAMPLE_RECIPES: RecipeSeed[] = [
  {
    slug: 'spaghetti-bolognese',
    name: 'Spaghetti bolognese',
    category: 'pastas',
    notes: 'Laat de saus gerust een uur pruttelen, dat maakt het verschil.',
    ingredients: [
      { name: 'Spaghetti', amount: 400, unit: 'g', category: 'pasta-rijst' },
      { name: 'Gemengd gehakt', amount: 500, unit: 'g', category: 'vlees' },
      { name: 'Ui', amount: 1, unit: 'st', category: 'groenten' },
      { name: 'Look', amount: 2, unit: 'teen', category: 'groenten' },
      { name: 'Wortelen', amount: 150, unit: 'g', category: 'groenten' },
      { name: 'Bleekselder', amount: 1, unit: 'st', category: 'groenten' },
      { name: 'Tomatenblokjes', amount: 2, unit: 'blik', category: 'conserven' },
      { name: 'Tomatenpuree', amount: 2, unit: 'el', category: 'conserven' },
      { name: 'Olijfolie', amount: 2, unit: 'el', category: 'sauzen' },
      { name: 'Gedroogde oregano', amount: 1, unit: 'tl', category: 'specerijen' },
      { name: 'Zout', amount: null, unit: 'snuf', category: 'specerijen' },
      { name: 'Zwarte peper', amount: null, unit: 'snuf', category: 'specerijen' },
      { name: 'Parmezaanse kaas', amount: 60, unit: 'g', category: 'kaas' },
    ],
    steps: [
      'Snipper de ui, pers de look en snijd wortel en selder in kleine blokjes.',
      'Verhit de olijfolie en stoof het gesnipperde groentemengsel glazig, ongeveer 8 minuten.',
      'Voeg het gehakt toe en bak het los tot het overal gekleurd is.',
      'Roer de tomatenpuree erdoor en laat die een minuut meebakken.',
      'Giet de tomatenblokjes erbij, kruid met oregano, zout en peper.',
      'Laat minstens 45 minuten zachtjes pruttelen met het deksel schuin op de pan.',
      'Kook ondertussen de spaghetti beetgaar volgens de verpakking.',
      'Serveer de saus op de pasta met geraspte parmezaan erover.',
    ],
  },
  {
    slug: 'vlaamse-stoverij',
    name: 'Vlaamse stoverij met frieten',
    category: 'hoofdgerechten',
    notes: 'Smaakt de dag nadien nog beter. De peperkoek bindt de saus.',
    ingredients: [
      { name: 'Stoofvlees', amount: 800, unit: 'g', category: 'vlees' },
      { name: 'Ui', amount: 3, unit: 'st', category: 'groenten' },
      { name: 'Bruin bier', amount: 330, unit: 'ml', category: 'wijn-bier' },
      { name: 'Boter', amount: 40, unit: 'g', category: 'zuivel' },
      { name: 'Mosterd', amount: 1, unit: 'el', category: 'sauzen' },
      { name: 'Peperkoek', amount: 2, unit: 'st', category: 'bakkerij' },
      { name: 'Laurier', amount: 2, unit: 'st', category: 'specerijen' },
      { name: 'Gedroogde tijm', amount: 1, unit: 'tl', category: 'specerijen' },
      { name: 'Bruine suiker', amount: 1, unit: 'el', category: 'bakproducten' },
      { name: 'Zout', amount: null, unit: 'snuf', category: 'specerijen' },
      { name: 'Zwarte peper', amount: null, unit: 'snuf', category: 'specerijen' },
      { name: 'Frieten', amount: 800, unit: 'g', category: 'diepvries' },
    ],
    steps: [
      'Dep het vlees droog en kruid het met zout en peper.',
      'Braad het vlees in de boter rondom bruin, in porties zodat de pan heet blijft.',
      'Haal het vlees uit de pan en stoof de grof gesneden uien aan in hetzelfde vet.',
      'Leg het vlees terug, giet het bier erbij en voeg laurier, tijm en suiker toe.',
      'Besmeer de peperkoek met mosterd en leg die bovenop het vlees.',
      'Laat 2 tot 3 uur op zacht vuur sudderen tot het vlees uit elkaar valt.',
      'Roer de peperkoek door de saus zodat ze bindt, en proef bij.',
      'Bak ondertussen de frieten en serveer.',
    ],
  },
  {
    slug: 'tomatensoep-balletjes',
    name: 'Tomatensoep met balletjes',
    category: 'soepen',
    notes: 'Met verse tomaten in de zomer, met blik in de winter.',
    ingredients: [
      { name: 'Trostomaten', amount: 1, unit: 'kg', category: 'groenten' },
      { name: 'Ui', amount: 1, unit: 'st', category: 'groenten' },
      { name: 'Wortelen', amount: 150, unit: 'g', category: 'groenten' },
      { name: 'Bleekselder', amount: 1, unit: 'st', category: 'groenten' },
      { name: 'Look', amount: 1, unit: 'teen', category: 'groenten' },
      { name: 'Groentebouillon', amount: 1.5, unit: 'l', category: 'conserven' },
      { name: 'Tomatenpuree', amount: 1, unit: 'el', category: 'conserven' },
      { name: 'Gemengd gehakt', amount: 250, unit: 'g', category: 'vlees' },
      { name: 'Eieren', amount: 1, unit: 'st', category: 'eieren' },
      { name: 'Paneermeel', amount: 2, unit: 'el', category: 'brood' },
      { name: 'Platte peterselie', amount: 1, unit: 'bussel', category: 'verse-kruiden' },
      { name: 'Suiker', amount: 1, unit: 'tl', category: 'bakproducten' },
      { name: 'Zout', amount: null, unit: 'snuf', category: 'specerijen' },
      { name: 'Zwarte peper', amount: null, unit: 'snuf', category: 'specerijen' },
    ],
    steps: [
      'Stoof ui, wortel, selder en look aan in een grote pot.',
      'Voeg de in stukken gesneden tomaten en de tomatenpuree toe.',
      'Giet de bouillon erbij en laat 25 minuten koken.',
      'Meng ondertussen het gehakt met het ei, het paneermeel, zout en peper.',
      'Rol er kleine balletjes van en laat die 10 minuten in de soep garen.',
      'Mix de soep glad als je ze graag gebonden hebt, of laat ze rustiek.',
      'Breng op smaak met een lepel suiker, zout en peper.',
      'Werk af met grof gehakte peterselie.',
    ],
  },
  {
    slug: 'witloof-in-hesp',
    name: 'Witloof in hesp met kaassaus',
    category: 'ovenschotels',
    notes: 'Kook het witloof niet te lang, anders wordt het waterig en bitter.',
    ingredients: [
      { name: 'Witloof', amount: 8, unit: 'st', category: 'groenten' },
      { name: 'Gekookte hesp', amount: 8, unit: 'st', category: 'charcuterie' },
      { name: 'Boter', amount: 50, unit: 'g', category: 'zuivel' },
      { name: 'Bloem', amount: 50, unit: 'g', category: 'bakproducten' },
      { name: 'Melk', amount: 600, unit: 'ml', category: 'zuivel' },
      { name: 'Geraspte kaas', amount: 150, unit: 'g', category: 'kaas' },
      { name: 'Nootmuskaat', amount: null, unit: 'snuf', category: 'specerijen' },
      { name: 'Zout', amount: null, unit: 'snuf', category: 'specerijen' },
      { name: 'Zwarte peper', amount: null, unit: 'snuf', category: 'specerijen' },
      { name: 'Aardappelen', amount: 1, unit: 'kg', category: 'aardappelen' },
    ],
    steps: [
      'Verwijder het bittere kegeltje uit het witloof en stoof de stronken gaar in wat boter.',
      'Laat ze goed uitlekken en afkoelen; vocht is de vijand van deze schotel.',
      'Maak een roux van boter en bloem en giet er al roerend de melk bij.',
      'Laat de saus indikken en roer er twee derde van de kaas door.',
      'Kruid met nootmuskaat, zout en peper.',
      'Rol elke stronk in een sneetje hesp en leg ze naast elkaar in een ovenschotel.',
      'Giet de saus erover, strooi de rest van de kaas erop.',
      'Gratineer 20 minuten in een oven van 200 graden tot de bovenkant goudbruin is.',
      'Serveer met gekookte aardappelen of puree.',
    ],
  },
]
