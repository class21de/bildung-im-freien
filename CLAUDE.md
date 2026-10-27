# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projekt

Statische Website von **bildung-im-freien.de** („Miteinander im Freien“, Kunde: Martin Brauns) – Outdoor-Möbel und Beschattungen für Schulen, Kitas, Universitäten, Kommunen, Architekten und Landschaftsplaner. Commit `b2d4f30` ist der übergebene Ausgangsstand für die Überarbeitung durch class21. Er ist **nicht identisch mit der Live-Seite**: Merkliste/`anfrage.php`, die Indoor-Kategorie und Footer-Korrekturen gibt es nur im Repo; `produkte/sonnen-eck/` gibt es nur live (Details und Sicherheitsbefunde: `docs/sicherheit.md`).

Ziele der Überarbeitung laut Kunden-E-Mail: drei Logo-Alternativen, Hauptmenü neu gewichten (Produkte am wichtigsten), neue Menüpunkte „Über uns“ und „Referenzen“ (Inhalte liefert der Kunde nach), Kontakt + Impressum zusammenfassen und ans Ende der Menüleiste, Breiten von Layout, Menü und Produktdarstellung prüfen, Startseite neu (was / für wen / warum wir), schneller Kontakt per Telefon, E-Mail und Projektanfrage (Button „Meine Projektanfrage“ im Hauptmenü und auf den Produktseiten). Der Kunde will **Designs erst als Bild abstimmen und dann programmieren** – also keine Umsetzung ohne freigegebenen Entwurf.

## Lokal starten

Es gibt kein Build-System, keinen Package-Manager, keinen Linter und keine Tests. Die Seite muss vom Repo-Root als Web-Root ausgeliefert werden, weil fast alle Pfade absolut sind (`/js/…`, `/produkte/<slug>/config.json`). Über `file://` funktionieren weder `fetch` noch Menü noch Konfigurator.

```bash
python3 -m http.server 8000      # statische Seiten, Menü, Konfigurator
php -S localhost:8000            # nur nötig für anfrage.php (PHP ist lokal nicht installiert; mail() verschickt lokal ohnehin nichts)
```

## Architektur

**Header und Footer liegen als Kopie in jeder HTML-Datei** (`index.html`, `kontakt.html`, `impressum.html`, `merkliste.html` und alle `produkte/*/index.html`). `js/menu.js` verändert diese Kopien zur Laufzeit:
- baut das Produkt-Mega-Menü aus `js/products.json` (Schulkinder & Erwachsene) und `js/products-kindergarten.json` (Kindergärten), Einträge `{name, image, slug}` → Link `/produkte/<slug>/`;
- hängt die Kategorie „Indoor“ an (Text + Bilder aus `bilder-indoor/`, verlinkt auf bildung-einrichten.de);
- fügt den Button „Merkliste“ vor „Broschüren“ ein und lädt `js/merkliste.js` + `css/merkliste.css` auf jeder Seite;
- benennt „Impressum & Datenschutz“ in „Impressum“ um und setzt das Copyright-Jahr.

Wer die Navigation ändert, muss also entweder **alle** Header-Kopien gleich ändern oder es zentral in `menu.js` lösen. Der Mobile-Breakpoint für die Navigation ist 1240px – in CSS (`menu.css`) und in JS (`window.innerWidth > 1240`) gleichermaßen.

**Produktseiten** (`produkte/<slug>/`): `index.html` enthält den handgeschriebenen Beschreibungstext, die Bildergalerie und das leere DOM-Gerüst des Konfigurators; `config.json` liefert die Daten (`colorOptions`, `modelVariants`, `measurements`, `accessories`, `woodInfo`, `colorInfo`, `configurations`, `stretchable`, `has3D`, …). Die Skripte ermitteln den Slug aus der URL – eine Produktseite funktioniert nur unter `/produkte/<slug>/`. Relative Pfade in `config.json` werden relativ zur Produktseite aufgelöst.

Zu jeder Produktseite gehört ein Paar aus „Seiten-Skript“ (Akkordeons, Farbfelder, Galerie-Modal) und „Konfigurator“ (ES-Modul, Three.js 0.160 über eine `importmap` im `<head>` jeder Produktseite, lädt GLB-Modelle aus `modelle/`). Die Varianten sind Kopien mit Abweichungen, kein gemeinsamer Code:

| Seiten-Skript | Konfigurator | Produkte |
|---|---|---|
| `product-page.js` | `configurator.js` | Standard (Kreis-Team, Fantas-Tisch, Sonneta, Rustik…, Teamer, …) |
| `product-page.js` | `configurator-werkhaus.js` | werkhaus, werkhaus-bambini (zusätzlich Sonnentuch) |
| `product-page.js` | `configurator-linea.js` | lineapro-outdoor |
| `product-page-stufenprodukte.js` | `configurator_stufenprodukte.js` | dreistufen, stufenhaus, teatro, treppenspiel |
| `product-page-luxembour-und-andere.js` | `configurator-luxemburg-und-andere.js` | luxembourg-*, inspire, oasa, work-free |
| `product-page-relax.js` | `configurator-relax.js` | relax |

Die Konfiguratoren färben Mesh-Objekte über deren Namen im GLB um (`Gestell`, `Sitzplatte`, `Tischplatte`, `Sonnentuch`, `HPL`, `Holz`). Das Attribut `data-material` eines Farbfelds muss zu den Material-Keys aus `config.json` passen. `product-page.js` greift ohne Prüfung auf `config.stretchable.exists` zu – Configs für dieses Skript brauchen das Feld `stretchable`. Auf Mobilgeräten (per User-Agent erkannt) wird ohne HDR-Umgebung und mit flacher Beleuchtung gerendert.

**Merkliste / Preis- und Projektanfrage** (die Grundlage für die gewünschte „Projektanfrage“): `merkliste.js` setzt auf jeder `#product-page` den Button „Merkliste oder auch Ihre (Preis-)Anfrage“. Ein Klick speichert eine Momentaufnahme der aktuellen Konfiguration (gewähltes Modell + aktive Farbfelder) in `localStorage` unter `bildung-im-freien-merkliste`. `merkliste.html` zeigt Liste und Formular und schickt JSON per POST an `anfrage.php`, das eine HTML-Mail an `info@bildung-einrichten.de` versendet. Die Validierung (5-stellige PLZ, Telefon nur Ziffern, Menge 1–999) steht doppelt – in JS und in PHP – und muss beidseitig gleich gehalten werden.

**Startseite**: `index.html` + `js/startseite.js` (die Daten für den Hero-Slider stehen fest im JS) + `css/startseite.css`. Design-Tokens (Farben, Fonts Sen/Baumans) stehen in `:root` in `css/style.css`. `.container` ist 1240px breit; das Logo sitzt mit `position: absolute; left: -116px` außerhalb des Containers.

## Stolperstellen

- Groß-/Kleinschreibung: `produkte/teatro/Modelle/` (großes M), `config.json` verweist aber auf `modelle/…` → auf Linux-Servern 404 (live heißt der Ordner `modelle`, ein Upload aus dem Repo würde es brechen).
- `docs/`, `CLAUDE.md` und `.DS_Store` dürfen nicht auf den Webserver – `docs/sicherheit.md` beschreibt ausnutzbare Schwachstellen.
- `kontakt.html` und `impressum.html` nutzen relative Asset-Pfade und Inline-`<style>`; die Footer-Logos auf `index.html`/`kontakt.html` werden direkt vom alten WordPress-Theme (`bildung-im-freien.de/wp-content/...`) geladen.
- Externe Abhängigkeiten: Google Fonts (direkt von Google geladen), Font Awesome 6.2.1 (cdnjs), three@0.160.0 (unpkg).
- Das Repo ist ca. 400 MB groß (GLB-Modelle bis 29 MB, PDFs, Videos); keine `.gitignore`, `.DS_Store`-Dateien sind eingecheckt, kein Git LFS.
