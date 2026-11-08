# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projekt

Statische Website von **bildung-im-freien.de** („Miteinander im Freien“, Kunde: Martin Brauns) – Outdoor-Möbel und Beschattungen für Schulen, Kitas, Universitäten, Kommunen, Architekten und Landschaftsplaner. Commit `b2d4f30` ist der übergebene Ausgangsstand für die Überarbeitung durch class21. Er ist **nicht identisch mit der Live-Seite**: Merkliste/`anfrage.php`, die Indoor-Kategorie und Footer-Korrekturen gibt es nur im Repo; `produkte/sonnen-eck/` gibt es nur live (Details und Sicherheitsbefunde: `docs/sicherheit.md`).

Ziele der Überarbeitung laut Kunden-E-Mail: drei Logo-Alternativen, Hauptmenü neu gewichten (Produkte am wichtigsten), neue Menüpunkte „Über uns“ und „Referenzen“ (Inhalte liefert der Kunde nach; Fotos dafür vermutlich in `referenzbilder/`, siehe unten), Kontakt + Impressum zusammenfassen und ans Ende der Menüleiste, Breiten von Layout, Menü und Produktdarstellung prüfen, Startseite neu (was / für wen / warum wir), schneller Kontakt per Telefon, E-Mail und Projektanfrage (Button „Meine Projektanfrage“ im Hauptmenü und auf den Produktseiten). Der Kunde will **Designs erst als Bild abstimmen und dann programmieren** – also keine Veröffentlichung ohne freigegebenen Entwurf.

Aufgabenstand mit Vorher-Nachher-Screenshots und offenen Punkten: `docs/aufgaben-2026-10-27.md`. Die Umsetzung liegt lokal als Entwurf vor, die Kundenfreigabe steht aus.

## Lokal starten

Es gibt kein Build-System, keinen Package-Manager, keinen Linter und keine Tests. Die Seite muss vom Repo-Root als Web-Root ausgeliefert werden, weil fast alle Pfade absolut sind (`/js/…`, `/produkte/<slug>/config.json`). Über `file://` funktionieren weder `fetch` noch Menü noch Konfigurator.

```bash
python3 -m http.server 8000      # statische Seiten, Menü, Konfigurator
php -S localhost:8000            # nur nötig für anfrage.php (PHP ist lokal nicht installiert; mail() verschickt lokal ohnehin nichts)
```

## Architektur

**Header und Footer liegen als Kopie in jeder HTML-Datei** (`index.html`, `kontakt.html`, `projektanfrage.html`, `ueber-uns.html`, `referenzen.html` und alle `produkte/*/index.html`; `impressum.html` ist nur noch eine Weiterleitung auf `/kontakt.html#impressum`). `js/menu.js` verändert diese Kopien zur Laufzeit:
- baut das Produkt-Mega-Menü aus `js/products.json` (Schulkinder & Erwachsene) und `js/products-kindergarten.json` (Kindergärten), Einträge `{name, image, slug}` → Link `/produkte/<slug>/`;
- hängt die Kategorie „Indoor“ an (Text + Bilder aus `bilder-indoor/`, verlinkt auf bildung-einrichten.de);
- lädt `js/merkliste.js` + `css/merkliste.css` auf jeder Seite und setzt das Copyright-Jahr;
- öffnet über `[data-open-products]` die Produktübersicht (Desktop) bzw. das Menü (mobil).

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

**Projektanfrage** (intern weiter `merkliste.*` und `wishlist-*`): `merkliste.js` setzt auf jeder `#product-page` den Bereich mit dem Button „Zu meiner Projektanfrage hinzufügen“ und oben den Sprung „Preis-/Projektanfrage stellen“. Ein Klick speichert eine Momentaufnahme der aktuellen Konfiguration (gewähltes Modell + aktive Farbfelder) in `localStorage` unter `bildung-im-freien-merkliste`. `projektanfrage.html` zeigt Liste und Formular und schickt JSON per POST an `anfrage.php`, das eine HTML-Mail an `info@bildung-einrichten.de` versendet. Das Formular geht auch ohne Produkte, dann ist das Anliegen Pflichtfeld. Die Validierung (5-stellige PLZ, Telefon nur Ziffern, Menge 1–999, Anliegen ohne Produkte, Längenlimits, höchstens 50 Produkte) steht doppelt – in JS und in PHP – und muss beidseitig gleich gehalten werden. Nur in PHP: Herkunfts- und Content-Type-Prüfung, Honeypot `website`, Mindestdauer `elapsed_ms`, 5 Mails pro Stunde und IP. Beim Testen `mail()` nie echt auslösen, Empfänger ist die Adresse des Kunden.

**Referenzen**: `referenzen.html` + `js/referenzen.js` + `css/referenzen.css`. Die Projekte stehen in `js/referenzen.json` (`text` und `produkte` bleiben leer, bis der Kunde sie liefert), die verkleinerten Fotos unter `bilder/referenzen/<slug>/` (`01.jpg` …, `vorschau.jpg`).

**Startseite**: `index.html` + `js/startseite.js` (die Daten für den Hero-Slider stehen fest im JS) + `css/startseite.css`. `ueber-uns.html` nutzt dieselbe CSS- und JS-Datei. Design-Tokens (Farben, Fonts Sen/Baumans, `--layout-width`) stehen in `:root` in `css/style.css`. `--layout-width` (1440px) gilt für `.container`, Startseiten-Hero, Kontaktseite und Produktübersicht; das Logo sitzt bündig am linken Rand des Inhalts.

## Referenzbilder (`referenzbilder/`)

Vom Kunden geliefertes Fotomaterial (eingecheckt am 2026-10-28, ohne weitere Erklärung): Fotos von **ausgelieferten Möbeln vor Ort** in Schulen, Kitas und einer Hochschule. Vermutlich das Material für den neuen Menüpunkt **„Referenzen“**; es eignet sich aber auch für Produktgalerien und die neue Startseite. Eine Auswahl ist verkleinert unter `bilder/referenzen/` eingebaut; der Ordner selbst wird nirgends im Code referenziert.

- **Originaldateien, nicht webtauglich**: 150 Fotos, insgesamt ca. 1,9 GB. Meist Sony-Kamera mit 6000×4000 px und 10–23 MB pro JPG, dazu einige Smartphone-Fotos. Vor dem Einbau verkleinerte Kopien erzeugen (z. B. `vipsthumbnail` oder Pillow sind lokal vorhanden) und diese außerhalb von `referenzbilder/` ablegen. Den Ordner selbst **nicht auf den Webserver** hochladen. Dateien mit `bearbeitet` im Namen sind vom Kunden nachbearbeitete Versionen und den Originalen vorzuziehen. Die EXIF-Daten enthalten keine GPS-Daten.
- **Ordnernamen**: `<Ort> - <Einrichtung>`, abgekürzt mit Kfz-Kennzeichen (B = Berlin, HH = Hamburg, M = München, OS = Osnabrück, SZ = Salzgitter). Die Umlaute sind durch einen Zip-Kodierungsfehler kaputt (`Ф` = ö, `Б` = ü, `с` = ß, z. B. `HБckelhoven` = Hückelhoven). Für Texte auf der Website die korrekte Schreibweise aus der Tabelle unten verwenden.
- **Personen auf Fotos**: Jane-Addams `_DSC7499`/`_DSC7500` (Schüler im Hintergrund), Hameln `_DSC0869`/`_DSC0871`/`_DSC0872` (zwei Personen sitzend), Ostfalia `_DSC8639`–`_DSC8641` (Arbeiter), Weilrod `_DSC7470` (Person im Hintergrund), Mülheim `P_20260423_140809` (Person am Tisch), Doveren `_DSC0134` (zwei Personen am Tor), Lauf `IMG_1523`/`IMG_1524`, Brachelen `_DSC0141`, Hilfarth `_DSC0137` (Personen hinter oder in Scheiben; in den Web-Kopien unkenntlich gemacht). Vor einer Veröffentlichung Einwilligung klären oder die Personen unkenntlich machen.
- Einige Bilder aus diesen Serien sind schon Menübilder: `menu-bilder/kreis-team-…` ≈ Jane-Addams `_DSC7499`, Sonneta und LINEApro ≈ Ostfalia `_DSC8638`/`_DSC8641`.

Inhalt (Produkte nach Augenschein zugeordnet; Aufnahmedatum laut EXIF):

| Ordner (korrekte Schreibweise) | Fotos | Aufnahme | Zu sehen |
|---|---|---|---|
| Abensberg – Kindergarten Römerstraße | 3 | 06/2025 | WERKHAUS (weißes Gestell, grünes HPL, Sonnentuch) |
| Berlin – Jane-Addams-Schule | 20 | 10/2022 | KREIS-TEAM (Tisch grün, Bänke orange) auf Wiese und Schulhof |
| Berlin – Pestalozzi-Fröbel-Haus | 10 | 10/2026 | Tisch mit versetzten Bänken, Edelstahlrahmen mit Holzauflage; **kein passendes Produkt im Katalog**, fotografiert auf Holzterrasse und Rasen |
| Burgdorf – Rudolf-Bembenneck-Gesamtschule | 15 | 09/2025 | KREIS-TEAM (Tische grün/orange, Bänke hellgrau) + SONNETA (grün/orange/gelb) im Innenhof |
| Hameln – Albert-Einstein-Gymnasium | 8 | 10/2026 | TEATRO (grüne Rückwände, Holzstufen) |
| Hamm – Elisabeth-Lüders-Berufskolleg | 9 | 10/2025 | runde Tische mit 4 angesetzten Hockern (Fantas-Prinzip; im Katalog gibt es FANTAS-TISCH nur bogenförmig/gerade) |
| Hamburg – Gymnasium Altona | 5 | 03/2026 | KREIS-TEAM (Tisch dunkelblau, Bänke hellblau) |
| Hückelhoven – GGS Hilfarth | 2 | 12/2025 | mehrere KREIS-TEAM (hellgrau/grün) |
| Hückelhoven – Grundschule Doveren | 8 | 12/2025 | KREIS-TEAM (Tisch apricot, Bänke grün) + SONNETA mit Schirmloch |
| Hückelhoven – Grundschule Kleingladbach | 5 | 12/2025 | KREIS-TEAM (Tisch gelb, Bänke grün) |
| Hückelhoven – KGS Brachelen | 2 | 12/2025 | SONNETA (lange Tische grau, Bänke grün) |
| Lauf – Christoph-Jakob-Treu-Gymnasium | 2 | 11/2025 | TREE-MEETING um einen Baum |
| München – Grundschule am Hildegard-von-Bingen-Anger | 7 | 10/2026 | FANTAS-TISCH gerade + bogenförmig (Hocker grün/orange) |
| Mülheim an der Ruhr – Gymnasium Broich | 9 | 04/2026 | RUSTIK-TEAM OUTDOOR + RELAX im Innenhof |
| Olpe – Grundschule Hohenstein | 1 | 06/2024 | gelbes Sonnensegel über Tisch-Bank-Garnituren |
| Opfenbach – Grundschule Opfenbach | 13 | 06/2025 | runder Tisch mit 4 Hockern (grün/weiß, wie Hamm), im Garten fotografiert |
| Osnabrück – LBZ | 7 | 09/2025 | KREIS-TEAM (grau/gelb), zwei Fotos mit Schutzhüllen |
| Salzgitter – Ostfalia Cafeteria + Outdoor | 13 | 03–04/2024 | SONNETA + LINEApro OUTDOOR mit grünen Stühlen (vermutlich NUKE) auf der Dachterrasse |
| Weilrod – Grundschule im Weiltal | 11 | 09/2022 | RUSTIK-TEAM OUTDOOR (mit Detailfotos der Verschraubung) + RUSTIK-FORUM (Achteck) |

## Stolperstellen

- Groß-/Kleinschreibung: `produkte/teatro/Modelle/` (großes M), `config.json` verweist aber auf `modelle/…` → auf Linux-Servern 404 (live heißt der Ordner `modelle`, ein Upload aus dem Repo würde es brechen).
- `docs/`, `CLAUDE.md`, `.gitignore` und `.DS_Store` dürfen nicht auf den Webserver – `docs/sicherheit.md` beschreibt ausnutzbare Schwachstellen. Auch `referenzbilder/` gehört nicht dorthin (1,9 GB Originalfotos).
- `kontakt.html` und `impressum.html` nutzen relative Asset-Pfade und Inline-`<style>`; die Footer-Logos auf `index.html`/`kontakt.html` werden direkt vom alten WordPress-Theme (`bildung-im-freien.de/wp-content/...`) geladen.
- Externe Abhängigkeiten: Google Fonts (direkt von Google geladen), Font Awesome 6.2.1 (cdnjs), three@0.160.0 (unpkg).
- Das Repo ist ca. 2,4 GB groß: rund 400 MB Website (GLB-Modelle bis 29 MB, PDFs, Videos) und 1,9 GB `referenzbilder/`. Es gibt kein Git LFS. `.DS_Store`-Dateien sind eingecheckt; die `.gitignore` schließt nur `Thumbs.db` aus. Ein Push über 2 GB lehnt GitHub ab, deshalb große Bildmengen auf mehrere Commits und Pushes verteilen.
