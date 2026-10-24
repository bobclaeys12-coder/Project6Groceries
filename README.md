# Recepten & Boodschappen

Persoonlijke recepten-, boodschappen- en voorraadapp als PWA. Alles staat lokaal
op je eigen toestel (IndexedDB), werkt offline, en synchroniseert op aanvraag
rechtstreeks tussen je toestellen — zonder server, zonder account.

**De app openen:** https://bobclaeys12-coder.github.io/Project6Groceries/

## Installeren op je telefoon

1. Open de link hierboven op je telefoon.
2. **Android (Chrome):** tik op ⋮ rechtsboven → **App installeren**.
   **iPhone (Safari):** tik op het deelicoon (vierkant met pijl) → **Zet op beginscherm**.
3. Start de app voortaan via het icoon. Ze werkt ook zonder internet.

Je gegevens staan per toestel en per webadres. Een nieuw geïnstalleerde app
begint dus met alleen de voorbeelden; haal je recepten, lijst, winkels en
voorraad binnen via **Sync** (QR-code scannen of de code overtikken), of via
**Exporteren** en **Importeren** op diezelfde pagina.

Updates komen vanzelf: de app haalt de nieuwe versie op zodra je ze opent met
internet. Soms is het nodig ze één keer te sluiten en opnieuw te openen.

## Synchroniseren

Beide toestellen moeten online zijn. Het koppelen loopt via de gratis
publieke server van PeerJS; de gegevens zelf gaan rechtstreeks van toestel
naar toestel. Die server is niet altijd beschikbaar, en sommige netwerken
(bedrijfsnetwerken, soms mobiele data) laten geen rechtstreekse verbinding
toe. Lukt het niet, gebruik dan **Exporteren** op het ene toestel en
**Importeren** op het andere: dat voegt op exact dezelfde manier samen.

## Lokaal draaien

```bash
npm install
npm run dev          # http://localhost:5173/Project6Groceries/
```

De app draait onder het pad `/Project6Groceries/`, omdat ze op GitHub Pages
onder diezelfde submap staat. `http://localhost:5173` stuurt je er
automatisch naartoe.

| Commando | Wat het doet |
| --- | --- |
| `npm run dev` | Ontwikkelserver met hot reload |
| `npm test` | Draait de tests één keer |
| `npm run test:watch` | Tests die meelopen terwijl je schrijft |
| `npm run typecheck` | TypeScript controleren zonder te bouwen |
| `npm run build` | Productiebundel in `dist/` |
| `npm run preview` | `dist/` serveren zoals in productie (hier test je offline) |
| `npm run icons` | Genereert de app-iconen opnieuw |

## Offline testen

De service worker staat tijdens `npm run dev` bewust uit, anders krijg je
verouderde modules te zien terwijl je ontwikkelt. Offline gedrag test je zo:

```bash
npm run build
npm run preview      # http://localhost:4173/Project6Groceries/
```

Open de pagina, ga in DevTools naar **Application → Service Workers**, vink
**Offline** aan en herlaad. De app hoort gewoon te starten.

## Publiceren

Elke push naar `main` start `.github/workflows/deploy.yml`: installeren,
tests, bouwen en publiceren op GitHub Pages. Falen de tests, dan blijft de
vorige versie online staan. De voortgang zie je onder **Actions** in de
repository.

## Opbouw

```
src/
  core/      pure logica zonder React of database: eenheden, herschalen,
             samenvoegen, sorteren, de sync-merge. Hier staan de tests.
  db/        Dexie-schema, seed-gegevens en alle schrijfacties
  hooks/     live queries die hertekenen zodra de data verandert
  components/ gedeelde bouwstenen
  pages/     de schermen
```

Alle schrijfacties lopen via `src/db/repo.ts`. Dat stempelt elk record met
`updatedAt` en `deviceId`, wat de synchronisatie nodig heeft om te bepalen welke
versie van een record wint. Rechtstreeks naar een Dexie-tabel schrijven slaat
die stempel over en breekt dus de sync.

## Gegevensversies

`SCHEMA_VERSION` in `src/core/types.ts` beschrijft de vorm van de opgeslagen
records. Verandert die vorm, dan:

1. verhoog je `SCHEMA_VERSION`,
2. voeg je in `src/db/db.ts` een nieuwe `this.version(n)` toe met eventueel een
   `.upgrade()` die bestaande records omzet,
3. weigert sync tussen toestellen met verschillende versies, met een duidelijke
   melding in plaats van beschadigde gegevens.

`SEED_VERSION` staat daar los van: verhoog je die, dan worden ontbrekende
voorbeeldgegevens aangevuld. Items die je zelf verwijderd hebt, komen daarbij
niet terug.

## Status

- [x] Fase 1 — projectopzet, PWA-schil, navigatie, database en seed
- [x] Fase 2 — recepten, editor en herschalen
- [x] Fase 3 — boodschappenlijst
- [x] Fase 4 — winkels en looproutes
- [x] Fase 5 — voorraad
- [x] Fase 6 — synchroniseren en export/import
- [x] Fase 7 — publiceren op GitHub Pages
