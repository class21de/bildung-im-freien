# Sicherheitsanalyse bildung-im-freien.de

| | |
|---|---|
| **Stand** | 27.10.2026 |
| **Gegenstand** | Repository `bildung-im-freien` (Commit `b2d4f30`) und die Live-Website https://bildung-im-freien.de |
| **Erstellt von** | class21 (mit Claude Code) |
| **Art der Prüfung** | Statische Quelltext- und Asset-Analyse, Abhängigkeitsprüfung, passive Prüfung der Live-Website (nur lesende GET/HEAD-Anfragen), DNS- und TLS-Prüfung |

> **Vertraulich – nicht veröffentlichen.** Dieser Bericht beschreibt ausnutzbare Schwachstellen. Der Ordner `docs/` (und `CLAUDE.md`, `.DS_Store`) darf **nicht** auf den Webserver hochgeladen werden. Siehe [S-18](#s-18-interne-dateien-würden-mit-ausgeliefert).

> **Nachtrag 08.11.2026:** S-01, S-03 und S-11 sind in `anfrage.php` behoben (Adressprüfung, Honeypot, Mindest-Ausfülldauer, Limit je IP, Größen-, Typ-, Content-Type- und Herkunftsprüfung, `display_errors` aus). Geprüft mit einer Testkopie ohne echten Mailversand. PHPMailer mit SMTP (zweite Empfehlung zu S-01) ist nicht umgesetzt, dafür wären Postfach-Zugangsdaten nötig. Das Limit speichert gehashte IP-Adressen im Temp-Ordner des Servers, das gehört in die Datenschutzerklärung (S-14).

---

## 1. Zusammenfassung

Die Website ist eine statische Seite (HTML/CSS/JS, Three.js-Konfigurator) bei **IONOS** (Apache, IP 217.160.0.232). Sie hat nur eine kleine Angriffsfläche: Es gibt kein CMS, keine Datenbank, keine Logins. Die meisten Grundlagen sind solide (TLS 1.2/1.3, kein Verzeichnis-Listing, keine Geheimnisse im Code, saubere Ausgabe-Maskierung).

Es gibt aber **zwei Befunde der Stufe „Hoch“**:

1. **E-Mail-Header-Injection in `anfrage.php` (S-01).** Über eine präparierte, aber formal gültige E-Mail-Adresse lassen sich zusätzliche Mail-Header wie `Bcc:` einschleusen. Damit kann das Formular als **Spam-Schleuder** über den Server des Kunden missbraucht werden. `anfrage.php` ist **noch nicht live**, sondern nur im Repo – das muss vor dem Go-live der Merkliste bzw. Projektanfrage behoben werden.
2. **Kein HTTPS-Zwang und kein HSTS (S-02).** Die Seite wird über `http://` vollständig und unverschlüsselt ausgeliefert. Mit dem geplanten Anfrageformular würden personenbezogene Daten (Name, Adresse, Telefon, E-Mail) dann potenziell im Klartext übertragen.

Dazu kommen mehrere mittlere Befunde: fehlende Security-Header, Fremd-Skripte ohne Integritätsprüfung, Datenschutzlücken durch Google Fonts und CDNs, schwacher Schutz der E-Mail-Domains gegen Fälschung, kein Spam-Schutz im Formular.

**Zeitkritisch:** Das TLS-Zertifikat läuft am **16.11.2026** ab, also in 20 Tagen (S-08).

### Bewertung auf einen Blick

| Schwere | Anzahl | Befunde |
|---|---|---|
| Kritisch | 0 | – |
| Hoch | 2 | S-01, S-02 |
| Mittel | 6 | S-03, S-04, S-05, S-06, S-07, S-08 |
| Niedrig | 6 | S-09 bis S-14 |
| Info | 6 | S-15 bis S-20 |

### Die fünf wichtigsten Maßnahmen

1. **Sofort:** Verlängerung bzw. Auto-Renewal des TLS-Zertifikats im IONOS-Panel prüfen (S-08).
2. **Sofort:** HTTPS-Weiterleitung aktivieren und HSTS setzen (S-02).
3. **Vor Go-live der Merkliste/Projektanfrage:** `anfrage.php` härten – Header-Injection schließen, Spam-Schutz, Limits (S-01, S-03).
4. **Im Relaunch:** Google Fonts, Font Awesome und Three.js selbst hosten. Das löst Supply-Chain- und Datenschutz-Themen zusammen (S-05, S-06).
5. **Im Relaunch:** Security-Header per `.htaccess` setzen, `.DS_Store` entfernen und sperren (S-04, S-09).

---

## 2. Wichtiger Vorbefund: Live-Seite und Repository sind nicht identisch

Die Annahme, das Repository entspreche exakt der Live-Seite, stimmt **nur teilweise**. Startseite, Kontakt, Impressum, die Produktdaten (`config.json`, `products*.json`) und die meisten CSS- und JS-Dateien sind byte-identisch (MD5 verglichen). Es gibt aber diese Abweichungen:

| Datei/Bereich | Repo | Live |
|---|---|---|
| `merkliste.html`, `js/merkliste.js`, `css/merkliste.css`, `anfrage.php` | vorhanden | **fehlt** (Antwort 404, ausgeliefert als 500) |
| `js/menu.js`, `css/menu.css` | mit Merkliste-Button, Indoor-Kategorie, Umbenennung „Impressum“ | ältere Fassung ohne diese Funktionen |
| `produkte/*/index.html` (z. B. werkhaus) | Footer-Links `/kontakt.html` | Footer-Links `//kontakt.html` → **kaputt** (der Browser liest das als Hostname „kontakt.html“), zusätzlich ein Footer-Logo vom alten WordPress-Pfad, das nicht mehr existiert |
| `produkte/sonnen-eck/` | **fehlt** | existiert (200), ist aber nirgends verlinkt – gefunden über `.DS_Store` (siehe S-09) |
| `produkte/teatro/Modelle/` | großes **M** | kleines **m** (`modelle/`) – live funktioniert das 3D-Modell, ein Upload aus dem Repo würde es kaputt machen |

**Folge:** Das Repo enthält eine noch nicht veröffentlichte Entwicklungsstufe (Merkliste/Anfrage). Alle Befunde zu `anfrage.php` und `merkliste.js` betreffen diesen künftigen Stand. Vor dem nächsten Deployment sollten `sonnen-eck` und die Ordnerschreibweise abgeglichen werden.

---

## 3. Umfang, Methode und Grenzen

### 3.1 Geprüft

- **Quelltext:** `anfrage.php`, alle 13 JS-Dateien, 37 HTML-Seiten, 5 CSS-Dateien, 34 `config.json`.
  - Suche nach XSS-Senken (`innerHTML`, `eval`, `document.write` …) und DOM-XSS-Quellen (`location`, `hash`, `referrer` …).
  - Suche nach Geheimnissen (API-Keys, Passwörter, Tokens, private Schlüssel) und Prüfung der Git-Historie.
  - Inventar externer Ressourcen, `target="_blank"`, `http://`-Verweise, HTML-Kommentare.
- **PHP-Formular:** manuelle Codeprüfung. Das Verhalten von `FILTER_VALIDATE_EMAIL` und `mail()` wurde gegen den **originalen PHP-Quelltext** (php-src, Zweige PHP-8.3 und PHP-8.4: `ext/filter/logical_filters.c`, `ext/standard/mail.c`) nachgebildet und getestet.
- **Assets:** 581 Rasterbilder (EXIF/GPS, XMP), 129 SVGs (Skripte, Event-Handler, externe Verweise, Entities), 69 GLB-Modelle (externe URIs, Generator), 6 PDFs (Metadaten, JavaScript, Aktionen), 58 `.DS_Store`.
- **Abhängigkeiten:** Versionsabgleich mit der npm-Registry und `npm audit` für die fest eingebundenen Versionen.
- **Live-Seite (passiv):** HTTP-Header, HTTP→HTTPS-Verhalten, TLS-Protokolle und Zertifikat, Erreichbarkeit sensibler Pfade, Abgleich Live gegen Repo, DNS (SPF, DMARC, CAA, DNSSEC, MX, NS) per DNS-over-HTTPS. Die vollständige Liste der Anfragen steht in [Anhang C](#anhang-c-durchgeführte-live-anfragen).

### 3.2 Nicht geprüft / Grenzen

- **Keine aktiven Angriffe auf die Live-Seite:** keine POST-Anfragen, kein Fuzzing, kein Brute-Force, kein Portscan. Es wurde keine E-Mail ausgelöst.
- **PHP-Laufzeit:** PHP ist lokal nicht installiert. S-01 ist per Quelltextanalyse belegt, die tatsächliche Zustellung über den IONOS-Mailserver wurde aber nicht getestet.
- **Hosting-Konfiguration:** Ohne Zugang zum IONOS-Kundenkonto sind PHP-Version, `php.ini`, `.htaccess`, Server-Logs und Zertifikats-Automatik unbekannt.
- **Rechtliche Hinweise** (DSGVO, TDDDG) sind technische Einschätzungen, **keine Rechtsberatung**.

### 3.3 Schweregrade

| Stufe | Bedeutung |
|---|---|
| **Kritisch** | Direkt und einfach ausnutzbar, schwerer Schaden (z. B. Übernahme des Servers) |
| **Hoch** | Ausnutzbar mit erheblichem Schaden (Missbrauch des Servers, Datenabfluss, Reputationsschaden) |
| **Mittel** | Erhöht das Risiko deutlich oder ist rechtlich relevant, braucht aber zusätzliche Umstände |
| **Niedrig** | Geringe Auswirkung, Informationspreisgabe, Härtung |
| **Info** | Hinweis, Aktualität, gute Praxis |

---

## 4. Befundübersicht

| ID | Schwere | Titel | Ort | Betrifft |
|---|---|---|---|---|
| S-01 | **Hoch** | E-Mail-Header-Injection (Bcc) im Anfrageformular | `anfrage.php:94` | Repo (vor Go-live) |
| S-02 | **Hoch** | Kein HTTPS-Zwang, kein HSTS | Server | Live |
| S-03 | Mittel | Formular ohne Spam-Schutz, Rate-Limit, Größenlimits und Herkunftsprüfung | `anfrage.php` | Repo (vor Go-live) |
| S-04 | Mittel | Keine Security-Header (CSP, nosniff, Framing, Referrer, Permissions) | Server | Live |
| S-05 | Mittel | Fremd-Skripte und -Styles ohne Subresource Integrity | alle HTML-Seiten | Live |
| S-06 | Mittel | Datenübermittlung an Dritte ohne Einwilligung und Datenschutzhinweis | alle Seiten, `impressum.html` | Live |
| S-07 | Mittel | E-Mail-Domains fälschbar (DMARC `p=none`, SPF `~all`) | DNS | Live |
| S-08 | Mittel | TLS-Zertifikat läuft am 16.11.2026 ab | Server | Live, **zeitkritisch** |
| S-09 | Niedrig | `.DS_Store` öffentlich abrufbar – Verzeichnisinhalte und unverlinkte Seite einsehbar | Server + Repo | Live |
| S-10 | Niedrig | Fehlerseiten-Konfiguration defekt (404 wird zu 500) | Server | Live |
| S-11 | Niedrig | Robustheit `anfrage.php` (Typprüfung, Warnungen, Regex-Anker) | `anfrage.php` | Repo |
| S-12 | Niedrig | Veraltete, unverlinkte und übergroße Dateien öffentlich erreichbar | diverse | Live + Repo |
| S-13 | Niedrig | Kein CAA-Eintrag, kein DNSSEC | DNS | Live |
| S-14 | Niedrig | Datenschutzerklärung unvollständig (Pflichtangaben Art. 13 DSGVO) | `impressum.html` | Live |
| S-15 | Info | Veraltete Bibliotheken (Three.js, Font Awesome) | HTML-Seiten | Live |
| S-16 | Info | PHP-Version unbekannt – Prüfung im IONOS-Panel nötig | Hosting | – |
| S-17 | Info | `innerHTML` mit Konfigurationsdaten (Vertrauensgrenze) | `js/product-page*.js` | Live + Repo |
| S-18 | Info | Interne Dateien würden mit ausgeliefert (`docs/`, `CLAUDE.md`, `.DS_Store`) | Repo | Deployment |
| S-19 | Info | HTML 30 Tage im Browser-Cache – Korrekturen kommen verzögert an | Server | Live |
| S-20 | Info | Keine `robots.txt`, keine `security.txt` | Server | Live |

---

## 5. Befunde im Detail

### S-01 E-Mail-Header-Injection (Bcc) im Anfrageformular

**Schwere:** Hoch · **Ort:** `anfrage.php:37`, `anfrage.php:90-97` · **Status:** im Repo, noch nicht live

**Beschreibung.** `anfrage.php` prüft die E-Mail-Adresse mit `filter_var(..., FILTER_VALIDATE_EMAIL)` und setzt sie dann ungefiltert in den Mail-Header `Reply-To:`:

```php
// anfrage.php:94
'Reply-To: ' . clean($customer['email']),
```

`clean()` entfernt nur HTML-Tags und Leerraum an den Rändern. **Zeilenumbrüche mitten im Wert bleiben erhalten.** `FILTER_VALIDATE_EMAIL` gilt oft als ausreichender Schutz, ist es aber nicht. Der zugrunde liegende Regex (php-src, `logical_filters.c`, `regexp1`, identisch in PHP 8.3 und 8.4) erlaubt RFC-konforme **„quoted local parts“** und darin **mit Backslash maskierte Steuerzeichen**, also auch `\` + LF:

```
(?:\x22(?:[\x01-\x08\x0B\x0C\x0E-\x1F\x21\x23-\x5B\x5D-\x7F]|(?:\x5C[\x00-\x7F]))*\x22)
                                                               ^^^^^^^^^^^^^^^^^^
                                         Backslash + beliebiges ASCII-Zeichen, auch \n und \r
```

PHPs `mail()` lehnt nur **doppelte** bzw. fehlerhafte Zeilenumbrüche ab (`php_mail_detect_multiple_crlf()` in `mail.c`). Ein einzelnes LF mit folgendem Zeichen akzeptiert es.

**Nachweis.** Der Original-Regex und die Original-Prüflogik von `mail()` wurden in Python nachgebildet und mit folgendem Wert getestet:

```
"\<LF>Bcc:victim@evil.tld,x\<LF>X:"@example.com
```

Ergebnis:
- `FILTER_VALIDATE_EMAIL`: **gültig**
- `mail()`-Prüfung auf Mehrfach-Zeilenumbrüche: **nicht abgelehnt**
- Entstehender Header-Block, so wie ein Mailserver ihn an LF trennt:

```
From: Website-Anfrage <noreply@bildung-im-freien.de>
Reply-To: "\
Bcc:victim@evil.tld,x\
X:"@example.com
```

Damit entsteht eine eigene Header-Zeile `Bcc:`. Unter Linux ruft `mail()` `sendmail -t` auf und übernimmt Empfänger aus `To/Cc/Bcc`. Der Angreifer kann so **beliebig viele Empfänger** hinzufügen. Der Empfänger `x\` ist ungültig und erzeugt höchstens eine Rückläufer-Mail; gültige Adressen werden zugestellt. Die Mail kommt vom IONOS-Server des Kunden mit Absender `noreply@bildung-im-freien.de`. Den Inhalt steuert der Angreifer über das Feld „Anmerkungen“ (als Text, HTML wird maskiert). Das Anfügen eines eigenen Mail-Body ist durch die `mail()`-Prüfung verhindert.

Die tatsächliche Zustellung hängt vom Mail-Transfer-Agent bei IONOS ab und wurde **nicht** getestet, weil dafür echte E-Mails versendet werden müssten. Die Formular-Validierung im Browser spielt keine Rolle, weil ein Angreifer `anfrage.php` direkt per HTTP aufruft.

**Auswirkung.**
- Missbrauch als Spam- oder Phishing-Relay über Server und Domain des Kunden.
- Folge: Die Domain bzw. IONOS-IP landet auf Blacklists. Dann kommen auch echte Mails von bildung-im-freien.de und bildung-einrichten.de nicht mehr an. Möglich sind außerdem Sperrung des Webspace durch IONOS und Reputationsschaden bei Schulen und Kommunen.

**Empfehlung.**
1. Nutzereingaben **nie ungeprüft in Mail-Header** schreiben. E-Mail-Adresse zusätzlich auf CR, LF, Anführungszeichen und Backslash prüfen und notfalls ablehnen:

   ```php
   function header_safe_email(string $email): ?string {
       $email = trim($email);
       // Keine Steuerzeichen, keine quoted local parts – echte Kundenadressen brauchen das nicht.
       if (strlen($email) > 254 || preg_match('/[\x00-\x1F\x7F"\\\\]/', $email)) {
           return null;
       }
       return filter_var($email, FILTER_VALIDATE_EMAIL) ?: null;
   }
   ```

2. Besser: **PHPMailer mit SMTP-Authentifizierung** über ein IONOS-Postfach (`smtp.ionos.de`, Port 587, STARTTLS) statt `mail()`. PHPMailer kodiert und prüft Header-Werte. Zusätzlich wird die Mail mit dem echten Postfach versendet, was Zustellbarkeit und SPF/DKIM-Ausrichtung verbessert (siehe S-07).
3. Den Absender-Header (`From`) fest lassen und die Kunden-Adresse nur im `Reply-To` nach obiger Prüfung verwenden.

---

### S-02 Kein HTTPS-Zwang, kein HSTS

**Schwere:** Hoch · **Ort:** Webserver/IONOS · **Status:** live

**Beschreibung.** `http://bildung-im-freien.de/` und `http://www.bildung-im-freien.de/` liefern die Seite mit **HTTP 200 unverschlüsselt** aus, ohne Weiterleitung auf HTTPS. Der Inhalt ist identisch (MD5 `b59dd121…`). Ein `Strict-Transport-Security`-Header fehlt.

```
$ curl -I http://bildung-im-freien.de/
HTTP/1.1 200 OK
Server: Apache
```

**Auswirkung.**
- Wer `bildung-im-freien.de` eintippt oder einem alten `http://`-Link folgt, surft unverschlüsselt. In öffentlichen WLANs (Schulen, Kommunen, Messen) kann ein Angreifer die Seite mitlesen und **verändern**, z. B. Telefonnummer oder Bankdaten in PDFs, eingeschleuste Skripte.
- **Mit dem geplanten Anfrageformular** gilt außerdem: Wird die Seite über `http://` geladen, schickt `fetch('/anfrage.php')` Name, Anschrift, Telefon und E-Mail **im Klartext**. Das ist datenschutzrechtlich relevant (Art. 32 DSGVO, „Stand der Technik“).

**Empfehlung.**
1. Im IONOS-Panel unter Domains & SSL die **HTTPS-Weiterleitung** aktivieren. Alternativ per `.htaccess` (Anhang A).
2. HSTS setzen, zunächst mit kurzer Laufzeit und dann steigern: `Strict-Transport-Security: max-age=300` → `max-age=31536000`. `includeSubDomains` und `preload` erst nach Prüfung aller Subdomains.

---

### S-03 Formular ohne Spam-Schutz, Rate-Limit, Größenlimits und Herkunftsprüfung

**Schwere:** Mittel · **Ort:** `anfrage.php`, `js/merkliste.js` · **Status:** im Repo, noch nicht live

**Beschreibung.**
- **Kein Bot-Schutz:** kein Honeypot-Feld, keine Zeitprüfung, kein CAPTCHA.
- **Kein Rate-Limit:** Beliebig viele Anfragen pro IP und Minute lösen jeweils eine Mail aus.
- **Keine Größenlimits:** Anzahl der Produkte (`items`) und Länge der Felder (`notes`, `name`, `options`) sind unbegrenzt. Nur `post_max_size` von PHP begrenzt (typisch 8–64 MB). Eine einzelne Anfrage kann so eine Mail mit mehreren MB HTML erzeugen.
- **Keine Herkunftsprüfung:** Weder `Origin`/`Referer` noch `Content-Type` werden geprüft. `json_decode(file_get_contents('php://input'))` akzeptiert jeden Body. Eine fremde Webseite kann deshalb per unsichtbarem `<form enctype="text/plain">` einen gültigen JSON-Body bauen (bekannter Trick: Name `{"customer":{…},"x":"`, Wert `"}`). Der Browser jedes Besuchers dieser fremden Seite schickt dann eine Anfrage ab (CSRF-artig, verschleiert die Quelle).

**Auswirkung.** Das Postfach `info@bildung-einrichten.de` kann mit Anfragen geflutet werden, echte Anfragen gehen unter. Zusammen mit S-01 ist das ein skalierbarer Spam-Versand.

**Empfehlung.**
- Honeypot-Feld (z. B. verstecktes `website`, muss leer sein) und Mindest-Ausfülldauer (Zeitstempel beim Rendern, z. B. mindestens 3 s).
- Einfaches Rate-Limit pro IP, z. B. höchstens 5 Anfragen pro Stunde (Datei- oder Session-basiert).
- Limits: höchstens 50 Produkte, Feldlängen z. B. 200 Zeichen und `notes` 5000 Zeichen.
- Prüfen, dass `Content-Type` mit `application/json` beginnt. Ein vorhandener `Origin`-Header muss `https://bildung-im-freien.de` oder `https://www.bildung-im-freien.de` sein.

```php
if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) {
    reply(415, ['success' => false, 'message' => 'Ungültiges Format.']);
}
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && !in_array($origin, ['https://bildung-im-freien.de', 'https://www.bildung-im-freien.de'], true)) {
    reply(403, ['success' => false, 'message' => 'Nicht erlaubt.']);
}
if (count($input['items']) > 50) {
    reply(422, ['success' => false, 'message' => 'Zu viele Produkte.']);
}
```

---

### S-04 Keine Security-Header

**Schwere:** Mittel · **Ort:** Webserver · **Status:** live

**Beschreibung.** Die Antwort der Startseite enthält **keinen** der üblichen Schutz-Header:

| Header | Status | Zweck |
|---|---|---|
| `Strict-Transport-Security` | fehlt | HTTPS erzwingen (S-02) |
| `Content-Security-Policy` | fehlt | Begrenzt, woher Skripte, Styles usw. geladen werden dürfen – zweite Verteidigungslinie gegen XSS und kompromittierte CDNs (S-05) |
| `X-Content-Type-Options: nosniff` | fehlt | Verhindert MIME-Sniffing. Relevant, weil z. B. `.DS_Store` und `.glb` **ohne** `Content-Type` ausgeliefert werden |
| `X-Frame-Options` / `frame-ancestors` | fehlt | Schutz gegen Clickjacking (Einbetten der Seite oder des Anfrageformulars in fremde Seiten) |
| `Referrer-Policy` | fehlt | Steuert, welche URL an Dritte (Google Fonts, CDNs, OSM) gemeldet wird |
| `Permissions-Policy` | fehlt | Sperrt nicht benötigte Browser-APIs (Kamera, Mikrofon, Standort) |

Positiv: `Server: Apache` ohne Versionsnummer, kein `X-Powered-By`.

**Empfehlung.** Header per `.htaccess` setzen (Anhang A). Die CSP zuerst als `Content-Security-Policy-Report-Only` testen. Inline-Code gibt es nur in Form von 32 `importmap`-Blöcken mit zwei unterschiedlichen Inhalten. Deren Hashes sind in Anhang A bereits berechnet; `'unsafe-inline'` ist für Skripte deshalb nicht nötig.

---

### S-05 Fremd-Skripte und -Styles ohne Subresource Integrity

**Schwere:** Mittel · **Ort:** alle 37 HTML-Seiten · **Status:** live

**Beschreibung.** Externe Ressourcen werden ohne `integrity`-Attribut geladen (0 Treffer für `integrity=` im gesamten Repo):

| Ressource | Quelle | Seiten |
|---|---|---|
| Three.js 0.160.0 und Addons (GLTFLoader, OrbitControls, RGBELoader) als ES-Module über `importmap` | `unpkg.com` | 32 Produktseiten |
| Font Awesome 6.2.1 (CSS und Webfonts) | `cdnjs.cloudflare.com` | 37 |
| Schriften Sen und Baumans | `fonts.googleapis.com`, `fonts.gstatic.com` | 37 |
| Karte | `www.openstreetmap.org` (iframe) | 1 (Kontakt) |

Die Versionen sind fest gepinnt (gut), aber ohne Integritätsprüfung führt der Browser **alles aus, was der CDN ausliefert**. Ein Präzedenzfall ist der Vorfall um **polyfill.io (Juni 2024)**: Nach dem Verkauf der Domain wurde Schadcode an über 100.000 Websites ausgeliefert. unpkg ist ein Community-CDN ohne vertragliche Zusagen.

**Auswirkung.** Wird ein CDN kompromittiert, läuft fremder Code mit vollen Rechten auf bildung-im-freien.de. Er könnte z. B. das künftige Anfrageformular abgreifen oder Besucher umleiten.

**Empfehlung.**
- **Selbst hosten** (bevorzugt): Three.js-Module (`three.module.js` plus die drei Addons) nach `/vendor/three/` kopieren, Font Awesome und Google Fonts lokal einbinden. Das löst S-05, S-06 und einen Teil von S-15 auf einmal, und die CSP wird einfacher.
- Falls das CDN bleibt: `integrity="sha384-…" crossorigin="anonymous"` an `<link>`-Tags (cdnjs liefert die Hashes). Für Import-Maps gibt es inzwischen ein `integrity`-Feld, das aber noch nicht in allen Browsern unterstützt wird – deshalb Selbst-Hosting.

---

### S-06 Datenübermittlung an Dritte ohne Einwilligung und Datenschutzhinweis

**Schwere:** Mittel (rechtliches Risiko) · **Ort:** alle Seiten, `impressum.html` · **Status:** live

**Beschreibung.** Bei jedem Seitenaufruf überträgt der Browser die **IP-Adresse des Besuchers** an:
- **Google** (Google Fonts, `fonts.googleapis.com` / `fonts.gstatic.com`) auf allen Seiten,
- **Cloudflare** (cdnjs) auf allen Seiten,
- **unpkg** auf allen Produktseiten,
- **OpenStreetMap Foundation** (Karten-iframe) auf der Kontaktseite.

Die Datenschutzerklärung erwähnt **keinen** dieser Dienste. Sie sagt nur: „Wir verwenden auf dieser Website kein Google Analytics …“.

Das **LG München I** (Urteil vom 20.01.2022, Az. 3 O 17493/20) hat die dynamische Einbindung von Google Fonts ohne Einwilligung als Datenschutzverstoß gewertet (100 € Schadensersatz). Danach folgte 2022 eine Abmahnwelle gegen genau diese Konstellation.

**Empfehlung.** Schriften, Icons und Three.js selbst hosten (siehe S-05). Die Karte durch ein statisches Bild mit Link ersetzen oder erst nach Klick laden (Zwei-Klick-Lösung). Danach Datenschutzerklärung anpassen (S-14).

---

### S-07 E-Mail-Domains fälschbar (DMARC `p=none`, SPF `~all`)

**Schwere:** Mittel · **Ort:** DNS bei IONOS · **Status:** live

**Beschreibung.**

| Domain | SPF | DMARC | DKIM |
|---|---|---|---|
| bildung-im-freien.de | `v=spf1 include:_spf-eu.ionos.com ~all` (Softfail) | `v=DMARC1; p=none;` (nur Beobachtung) | Selector unbekannt, nicht prüfbar |
| bildung-einrichten.de | `v=spf1 include:_spf-eu.ionos.com ~all` (Softfail) | `v=DMARC1; p=none;` | nicht prüfbar |

Mit `p=none` gibt es **keine Anweisung an Empfänger**, gefälschte Mails abzulehnen. Ein DMARC-Report-Empfänger (`rua=`) fehlt, Missbrauch fällt also auch niemandem auf.

**Auswirkung.** Angreifer können glaubwürdige Mails „von“ `info@bildung-einrichten.de` an Schulträger, Kommunen oder Architekten schicken, z. B. gefälschte Rechnungen mit geänderter Bankverbindung (eine verbreitete Betrugsmasche gegenüber öffentlichen Auftraggebern).

**Empfehlung.**
1. Im IONOS-Mail-Panel DKIM-Signatur für beide Domains aktivieren bzw. prüfen.
2. DMARC stufenweise verschärfen: `v=DMARC1; p=none; rua=mailto:dmarc@…` (Reports 2–4 Wochen auswerten) → `p=quarantine` → `p=reject`.
3. SPF nach Prüfung aller legitimen Absender auf `-all` umstellen.
4. Falls `anfrage.php` per `mail()` versendet: sicherstellen, dass der Absender (`From`) und der Envelope-Sender zu einem echten IONOS-Postfach passen. Sonst landen die Anfragen bei strengerem DMARC im Spam. Hier hilft PHPMailer mit SMTP (S-01).

---

### S-08 TLS-Zertifikat läuft am 16.11.2026 ab

**Schwere:** Mittel (Verfügbarkeit), **zeitkritisch** · **Ort:** Webserver · **Status:** live

**Beschreibung.**

```
subject = CN=www.bildung-im-freien.de
SAN     = www.bildung-im-freien.de, bildung-im-freien.de
issuer  = Sectigo Public Server Authentication CA DV R36
gültig  = 02.11.2025 – 16.11.2026 23:59:59 GMT
```

Das Zertifikat läuft in **20 Tagen** ab. Danach zeigen alle Browser eine Vollbild-Warnung, und Konfigurator-Downloads und Formular funktionieren nicht mehr.

Außerdem gilt seit dem 15.03.2026 nach Beschluss des CA/Browser-Forums (Ballot SC-081): Neu ausgestellte öffentliche TLS-Zertifikate dürfen höchstens **200 Tage** gültig sein (ab 2027 100 Tage, ab 2029 47 Tage). Manuelle Verlängerung ist damit nicht mehr praktikabel.

**Empfehlung.** Sofort im IONOS-Panel prüfen, ob das Zertifikat automatisch verlängert wird (bei IONOS-SSL in der Regel ja). Andernfalls auf ein automatisch erneuertes Zertifikat umstellen und ein Monitoring einrichten, z. B. Erinnerung 30 Tage vor Ablauf.

---

### S-09 `.DS_Store` öffentlich abrufbar

**Schwere:** Niedrig · **Ort:** Webserver und Repo (58 Dateien) · **Status:** live

**Beschreibung.** Die macOS-Systemdatei `.DS_Store` enthält die Dateinamen ihres Ordners. Das Verzeichnis-Listing ist auf dem Server zwar korrekt deaktiviert (403), wird über diese Dateien aber **umgangen**:

```
GET /produkte/.DS_Store  → 200 (59 KB)
GET /bilder/.DS_Store    → 200
GET /js/.DS_Store        → 200
```

Aus `/produkte/.DS_Store` geht der Ordner `sonnen-eck` hervor. **`/produkte/sonnen-eck/` ist live erreichbar (200)**, aber weder verlinkt noch im Repo. Wäre das ein noch nicht freigegebenes Produkt, wäre es damit öffentlich auffindbar.

**Empfehlung.** Alle `.DS_Store` vom Server und aus dem Repo löschen. `.gitignore` mit `.DS_Store` anlegen. Zugriff per `.htaccess` sperren (Anhang A). Klären, ob `sonnen-eck` öffentlich sein soll.

---

### S-10 Fehlerseiten-Konfiguration defekt (404 wird zu 500)

**Schwere:** Niedrig · **Ort:** Webserver · **Status:** live

**Beschreibung.** Jede nicht existierende URL (`/robots.txt`, `/sitemap.xml`, `/merkliste.html` …) liefert **HTTP 500** mit:

> „Additionally, a 500 Internal Server Error error was encountered while trying to use an ErrorDocument to handle the request.“

Ein `ErrorDocument` zeigt also auf eine fehlende oder defekte Datei.

**Auswirkung.** Echte Serverfehler sind von 404 nicht zu unterscheiden, was Monitoring und Fehlersuche erschwert. Suchmaschinen werten gehäufte 500er negativ. Die Meldung verrät außerdem Details der Serverkonfiguration.

**Empfehlung.** Eigene `404.html` anlegen und `ErrorDocument 404 /404.html` setzen. Eine eventuell vorhandene fehlerhafte `ErrorDocument`-Zeile in der Live-`.htaccess` korrigieren.

---

### S-11 Robustheit von `anfrage.php`

**Schwere:** Niedrig · **Ort:** `anfrage.php` · **Status:** im Repo

| Stelle | Problem | Folge |
|---|---|---|
| Z. 24, 44-46 | Felder werden mit `(string)` gecastet, ohne den Typ zu prüfen. Ein JSON-Array als `first_name` ergibt `"Array"` und eine PHP-Warnung „Array to string conversion“ | Ist auf dem Server `display_errors=On`, landet die Warnung (mit Dateipfad) in der Antwort und zerstört das JSON |
| Z. 31, 34 | `preg_match('/^\d{5}$/')`: `$` akzeptiert ein abschließendes `\n` (`"12345\n"`) | aktuell harmlos (nur im Mail-Body, `trim()` entfernt es), aber eine Fehlerquelle; besser `\z` oder `/D` |
| Z. 37 | `filter_var` statt strenger Prüfung | siehe S-01 |
| Z. 66 | Mit `??` gewinnt `salutation` immer, auch wenn sie leer ist (`""`). Z. 67-69 fangen das ab | funktional korrekt, aber unübersichtlich |
| allgemein | keine Protokollierung fehlgeschlagener oder missbräuchlicher Anfragen | Missbrauch wird nicht bemerkt |

**Empfehlung.** Am Anfang jedes Feld mit `is_string()` prüfen. In Produktion `display_errors=Off`, `log_errors=On`. Regex mit `\z` verankern. Optional ein schlankes Protokoll (Zeit, IP-Hash, Ergebnis, **ohne** personenbezogene Inhalte).

---

### S-12 Veraltete, unverlinkte und übergroße Dateien öffentlich erreichbar

**Schwere:** Niedrig · **Ort:** diverse · **Status:** live + Repo

- **Unverlinkte Altdateien:** `bilder/logo-old.svg` (live 200), `produkte/werkhaus*/farben/archive/*` (18 Dateien), `produkte/teatro/Modelle/teatro.glb` (28,7 MB, nicht referenziert), `sand-und-gruenm-original.png`.
- **Übergroße Dateien:** `produkte/sonnenschirme/bilder/sun-premium-duo.png` (15,2 MB), GLB-Modelle bis 28,7 MB, `bilder/logo.svg` (456 KB, eingebettetes Rasterbild).
- **Doppelte Dateien:** `produkte/sonnenschirme/broschuere/sonnenschirme.pdf` und `produkte/sonnenschirme-2/broschuere/sonnenschirme.pdf` (identisch, je 11 MB).

**Auswirkung.** Wenige automatisierte Abrufe großer Dateien verbrauchen viel Bandbreite. IONOS meldet `x-ws-ratelimit-limit: 1000`, das Limit greift also womöglich auch für echte Besucher. Altdateien legen interne Arbeitsstände offen.

**Empfehlung.** Nicht referenzierte Dateien entfernen. Bilder komprimieren (WebP/AVIF, max. ~500 KB). GLB-Modelle mit Draco- oder Meshopt-Kompression verkleinern (Three.js unterstützt beides).

---

### S-13 Kein CAA-Eintrag, kein DNSSEC

**Schwere:** Niedrig · **Ort:** DNS · **Status:** live

- **CAA** fehlt für beide Domains. Damit darf jede Zertifizierungsstelle Zertifikate für die Domain ausstellen. Empfehlung: CAA mit den von IONOS genutzten CAs, z. B. `0 issue "sectigo.com"` (mit IONOS abstimmen).
- **DNSSEC** ist nicht aktiv (AD-Flag `false`). IONOS bietet DNSSEC im Domain-Panel an.
- **MTA-STS** gibt es nicht (optional).

---

### S-14 Datenschutzerklärung unvollständig

**Schwere:** Niedrig (rechtliches Risiko, keine Rechtsberatung) · **Ort:** `impressum.html` · **Status:** live

Der Abschnitt „Datenschutz“ ist sehr allgemein. Nach Art. 13 DSGVO fehlen insbesondere:
- **Rechtsgrundlagen** der Verarbeitung (Art. 6 Abs. 1 lit. b/f DSGVO für Anfragen und Server-Logs),
- **Speicherdauer** (Server-Logs, Anfrage-Mails),
- **Empfänger und Auftragsverarbeiter:** IONOS (Hosting, Mail) sowie Google, Cloudflare, unpkg und OpenStreetMap (S-06),
- **Beschwerderecht bei einer Aufsichtsbehörde** (Art. 77 DSGVO, für Niedersachsen: LfD Niedersachsen),
- **Hinweise zum Anfrageformular** (Pflichtfelder, Zweck, Speicherung im Postfach). Ein Verweis auf die Datenschutzerklärung im Formular selbst fehlt,
- **Local Storage:** Die Merkliste speichert Produktdaten (keine personenbezogenen Daten) im Browser. Das ist voraussichtlich nach § 25 Abs. 2 Nr. 2 TDDDG ohne Einwilligung zulässig, weil der Nutzer die Funktion ausdrücklich nutzt, sollte aber erwähnt werden.

**Empfehlung.** Datenschutzerklärung nach dem technischen Umbau (Selbst-Hosting) neu erstellen lassen, z. B. mit einem Generator für Anwaltskanzleien oder durch Rechtsberatung. Im Formular einen Hinweis mit Link ergänzen.

---

### S-15 Veraltete Bibliotheken

**Schwere:** Info · **Ort:** HTML-Seiten · **Status:** live

| Bibliothek | Eingebunden | Veröffentlicht | Aktuell (27.10.2026) | Bekannte Schwachstellen in eingebundener Version |
|---|---|---|---|---|
| three (Three.js) | **0.160.0** | 22.12.2023 | **0.186.1** (24.09.2026) | keine (`npm audit`: 0) |
| Font Awesome Free | **6.2.1** | 15.11.2022 | **7.3.1** (15.07.2026); letzte 6.x: 6.7.2 | keine (`npm audit`: 0) |
| Google Fonts (Sen, Baumans) | versionslos | – | – | – |

Hinweise für ein Update:
- Three.js ist **26 Minor-Versionen** zurück. `RGBELoader` gilt seit r180 als veraltet und wird durch `HDRLoader` ersetzt. Alle sechs Konfigurator-Skripte und die `importmap` in 32 HTML-Dateien müssen angepasst werden. Den Konfigurator danach visuell prüfen (Licht, Farbraum).
- Font Awesome 7 hat Breaking Changes (Icon-Namen, Stil-Klassen). Zuerst auf 6.7.2 gehen, falls nur Pflege gewünscht ist.

---

### S-16 PHP-Version unbekannt

**Schwere:** Info · **Ort:** Hosting

Der Server verrät seine PHP-Version nicht (gut). Weil `anfrage.php` eingeführt werden soll, muss die Version im **IONOS-Panel** geprüft werden:

| PHP | Sicherheitsupdates bis |
|---|---|
| 8.1 und älter | **beendet** (31.12.2025) |
| 8.2 | 31.12.2026 – **endet in zwei Monaten** |
| 8.3 | 31.12.2027 |
| 8.4 | 31.12.2028 |

**Empfehlung:** PHP 8.3 oder 8.4. `anfrage.php` ist kompatibel (benötigt mindestens 7.1).

---

### S-17 `innerHTML` mit Konfigurationsdaten (Vertrauensgrenze)

**Schwere:** Info · **Ort:** `js/product-page*.js`, `js/configurator*.js`, `js/startseite.js`

Die Produktseiten bauen Akkordeons, Farbfelder und Galerien per `innerHTML` aus `config.json` zusammen, ohne Maskierung (z. B. `product-page.js:190`: `descriptionDiv.innerHTML = config.description.join('')`). Das ist **aktuell unkritisch**, weil die Dateien statisch vom eigenen Server kommen. Es gibt keine DOM-XSS-Quellen: kein Zugriff auf `location.search/hash`, `document.referrer` oder `postMessage`, kein `eval`.

Die **Merkliste** (`merkliste.js`) maskiert dagegen korrekt mit `escapeHtml()`. Einziger Rest: `item.url` wird nicht auf das Schema geprüft (`javascript:`). Weil die Daten nur aus dem **eigenen** `localStorage` kommen, ist das höchstens Self-XSS.

**Merken:** Werden Produktdaten künftig von Kunden oder Redakteuren über ein CMS oder Formular gepflegt, muss diese Stelle auf `textContent` bzw. Maskierung umgestellt werden.

---

### S-18 Interne Dateien würden mit ausgeliefert

**Schwere:** Info · **Ort:** Deployment

Wird das Repo wie bisher als Ordner hochgeladen, landen `docs/sicherheit.md` (**dieser Bericht mit Angriffsdetails**), `CLAUDE.md` (interne Projektnotizen inklusive Kunden-E-Mail), 58 `.DS_Store` und eventuell `.git/` öffentlich auf dem Server. `.git/` liefert live derzeit 403, ist also geschützt oder nicht vorhanden.

**Empfehlung.** Mit einer Allowlist deployen: nur die benötigten Ordner (`bilder/`, `css/`, `js/`, `produkte/`, `materialien/`, `menu-bilder/`, `bilder-indoor/`, PDFs, HTML, `anfrage.php`). Zusätzlich die `.htaccess`-Sperre aus Anhang A.

---

### S-19 HTML 30 Tage im Browser-Cache

**Schwere:** Info · **Ort:** Webserver

`cache-control: max-age=2592000` (30 Tage) gilt auch für HTML-Seiten. Sicherheitskorrekturen (z. B. neue Header, geänderte Skript-Verweise) erreichen Wiederkehrer erst nach bis zu 30 Tagen.

**Empfehlung:** HTML auf `no-cache` (bzw. kurz) setzen. Lange Cache-Zeiten nur für versionierte Assets (Bilder, GLB, CSS/JS mit Versions-Parameter).

---

### S-20 Keine `robots.txt`, keine `security.txt`

**Schwere:** Info

Beide liefern 404 (als 500, siehe S-10). Empfohlen werden eine `robots.txt` mit Sitemap-Verweis und eine `/.well-known/security.txt` (RFC 9116) mit Kontaktadresse für Sicherheitsmeldungen.

---

## 6. Positive Befunde

| Bereich | Ergebnis |
|---|---|
| TLS | Nur **TLS 1.2 und 1.3**. TLS 1.0/1.1 abgelehnt. Bevorzugt `TLS_AES_256_GCM_SHA384`, ECDHE in TLS 1.2. Zertifikat deckt `www` und Apex ab |
| Server-Banner | `Server: Apache` ohne Version, kein `X-Powered-By` |
| Verzeichnis-Listing | deaktiviert (403 auf `/js/`, `/produkte/`, `/produkte/werkhaus/farben/archive/`) |
| Versteckte Dateien | `/.git/HEAD`, `/.git/config`, `/.htaccess` → 403 |
| WordPress-Altlasten | `/wp-login.php`, `/wp-json/` nicht vorhanden. `/xmlrpc.php` liefert 503 (vermutlich IONOS-Sperre). Keine Hinweise auf ein altes CMS |
| Geheimnisse | keine API-Keys, Passwörter, Tokens oder privaten Schlüssel im Code und in der Git-Historie (2 Commits) |
| Bilder | 581 Rasterbilder: **keine GPS-Koordinaten**, keine Benutzerpfade. Nur Kamera- und Software-Angaben (Sony ILCE-6300, Photoshop, Topaz Photo AI) |
| PDFs | 6 PDFs: kein JavaScript, keine Start-Aktionen, keine eingebetteten Dateien (`/JS`-, `/AA`-Treffer stammen aus Base64-Vorschaubildern im XMP) |
| SVGs | 129 SVGs: keine Skripte, keine Event-Handler, keine externen Verweise, keine XML-Entities |
| 3D-Modelle | 69 GLBs (Blender glTF I/O 4.0, 1× Babylon.js): keine externen URIs |
| JavaScript | kein `eval`/`new Function`/`document.write`, keine DOM-XSS-Quellen. Externe Links mit `rel="noopener noreferrer"`. Keine `http://`-Verweise (kein Mixed Content) |
| `anfrage.php` | nur POST, alle Ausgaben in der Mail per `htmlspecialchars()` maskiert, **fester Empfänger** (kein offenes Relay über `To`), Validierung serverseitig dupliziert |
| Datensparsamkeit | keine serverseitige Speicherung von Anfragen. `localStorage` enthält nur Produktdaten und wird nach dem Versand gelöscht. Keine Cookies, kein Tracking |
| Abhängigkeiten | exakte Versionen gepinnt. `npm audit` meldet 0 bekannte Schwachstellen |

---

## 7. Maßnahmenplan

### Sofort (diese Woche)

| # | Maßnahme | Befund | Aufwand |
|---|---|---|---|
| 1 | Zertifikats-Verlängerung bzw. Auto-Renewal im IONOS-Panel prüfen | S-08 | 15 min |
| 2 | HTTPS-Weiterleitung im IONOS-Panel aktivieren, HSTS (kurz) setzen | S-02 | 30 min |
| 3 | `.DS_Store` vom Server löschen, per `.htaccess` sperren | S-09 | 15 min |
| 4 | PHP-Version im Panel prüfen, auf 8.3/8.4 stellen | S-16 | 15 min |

### Vor Go-live der Merkliste/Projektanfrage

| # | Maßnahme | Befund | Aufwand |
|---|---|---|---|
| 5 | Header-Injection schließen (Adressprüfung, besser PHPMailer + SMTP) | S-01 | 2–4 h |
| 6 | Honeypot, Zeitprüfung, Rate-Limit, Größen-, Origin- und Content-Type-Prüfung | S-03 | 2–3 h |
| 7 | Typprüfung, `display_errors=Off`, Regex-Anker | S-11 | 1 h |
| 8 | Datenschutzhinweis im Formular und in der Datenschutzerklärung | S-14 | extern |
| 9 | Deployment-Allowlist (keine `docs/`, `CLAUDE.md`, `.DS_Store`) | S-18 | 30 min |

### Im Rahmen des Relaunchs

| # | Maßnahme | Befund |
|---|---|---|
| 10 | Google Fonts, Font Awesome und Three.js selbst hosten; Karte per Klick laden | S-05, S-06 |
| 11 | Security-Header inklusive CSP (erst Report-Only) | S-04 |
| 12 | Three.js auf aktuelle Version, `RGBELoader` → `HDRLoader` | S-15 |
| 13 | DKIM prüfen, DMARC mit Reports, dann `quarantine`/`reject`; SPF `-all`; CAA; DNSSEC | S-07, S-13 |
| 14 | 404-Seite, `robots.txt`, `security.txt`, Cache-Header für HTML | S-10, S-19, S-20 |
| 15 | Altdateien entfernen, Bilder und Modelle komprimieren, `.gitignore` | S-12, S-09 |
| 16 | Live-Abgleich: `sonnen-eck` ins Repo oder entfernen; `teatro/Modelle` → `modelle` | Abschnitt 2 |

---

## Anhang A: Vorschlag `.htaccess` (IONOS, Apache)

> Vor dem Einsatz auf einer Testumgebung prüfen. Bei IONOS ist die HTTPS-Weiterleitung im Panel der einfachere Weg. Falls die Rewrite-Regel unten eine Schleife erzeugt (Proxy vor dem Webspace), sie weglassen und nur die Panel-Option nutzen.

```apache
# --- HTTPS erzwingen ---
RewriteEngine On
RewriteCond %{HTTPS} !=on
RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# --- Interne Dateien sperren ---
RedirectMatch 404 (^|/)\.DS_Store$
RedirectMatch 404 (^|/)\.git(/|$)
RedirectMatch 404 ^/docs(/|$)
RedirectMatch 404 \.md$

# --- Fehlerseite ---
ErrorDocument 404 /404.html

<IfModule mod_headers.c>
  # Erst mit kurzer Laufzeit testen, dann auf 31536000 erhöhen
  Header always set Strict-Transport-Security "max-age=300"
  Header always set X-Content-Type-Options "nosniff"
  Header always set X-Frame-Options "SAMEORIGIN"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
  Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()"

  # CSP für den IST-Zustand (CDNs). Zuerst als Report-Only, Browser-Konsole beobachten.
  # Die beiden sha256-Werte sind die Hashes der zwei Import-Map-Varianten (30× bzw. 2× vorhanden).
  # Nach dem Selbst-Hosting entfallen unpkg, cdnjs und Google aus der Policy.
  Header always set Content-Security-Policy-Report-Only "default-src 'self'; script-src 'self' https://unpkg.com 'sha256-CTt5UK0QDTrpjSU0uPTykawY+Ta+UWh1MQcs9mWeHDk=' 'sha256-CMtpDt+adM9SkfNo44szEcRDQzkyjPoFtW/nvHpO4Hw='; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data: blob:; connect-src 'self' blob:; media-src 'self'; frame-src https://www.openstreetmap.org; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'"
</IfModule>

<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/html "access plus 0 seconds"
</IfModule>

# --- Korrekte Typen für 3D-Modelle und HDR ---
AddType model/gltf-binary .glb
AddType image/vnd.radiance .hdr
```

`style-src 'unsafe-inline'` ist vorerst nötig, weil 44 `style="…"`-Attribute in HTML und per JS erzeugtem Markup vorkommen. Das ist ein deutlich geringeres Risiko als `'unsafe-inline'` für Skripte.

## Anhang B: Prüfwerkzeuge und Datenbasis

- **Repo:** Commit `b2d4f30`, 938 Dateien, ca. 400 MB (581 Rasterbilder, 129 SVG, 69 GLB, 6 PDF, 37 HTML, 35 JSON, 13 JS, 5 CSS, 1 PHP).
- **Werkzeuge:** `grep`/`ugrep`, Python 3 mit Pillow 13.0 (EXIF/XMP), eigene Parser für GLB (JSON-Chunk) und `.DS_Store`, `pdfinfo` (Poppler), `openssl s_client`, `curl`, `npm view`/`npm audit` (npm-Registry, Stand 27.10.2026), Cloudflare DNS-over-HTTPS.
- **PHP-Referenz:** `php-src` (GitHub), Zweige `PHP-8.3` und `PHP-8.4`: `ext/filter/logical_filters.c` (`regexp1` identisch) und `ext/standard/mail.c` (`php_mail_detect_multiple_crlf`).

## Anhang C: Durchgeführte Live-Anfragen

Alle Anfragen am 27.10.2026, ausschließlich `GET`/`HEAD` bzw. TLS-Handshakes. Keine Formular-Übermittlung, keine E-Mail ausgelöst.

| Ziel | Ergebnis |
|---|---|
| `https://bildung-im-freien.de/` (Header, Inhalt) | 200, identisch mit Repo-`index.html` |
| `http://bildung-im-freien.de/`, `http://www.…/`, `https://www.…/` | jeweils 200, keine Weiterleitung |
| TLS-Handshake mit TLS 1.0 / 1.1 / 1.2 / 1.3 | abgelehnt / abgelehnt / ok / ok |
| `/anfrage.php`, `/merkliste.html`, `/js/merkliste.js`, `/css/merkliste.css` | 500 (= nicht vorhanden, S-10) |
| 15 weitere Repo-Dateien (MD5-Abgleich, Abschnitt 2) | 200 |
| `/.git/HEAD`, `/.git/config`, `/.htaccess`, `/js/`, `/produkte/`, `/produkte/werkhaus/farben/archive/` | 403 |
| `/.DS_Store`, `/produkte/.DS_Store`, `/produkte/werkhaus/.DS_Store`, `/bilder/.DS_Store`, `/js/.DS_Store` | 500 / 200 / 200 / 200 / 200 |
| `/produkte/sonnen-eck/`, `/produkte/sonnen-eck/config.json`, `/bilder/gemacht/` | 200 / 200 / 500 |
| `/produkte/teatro/modelle/teatro-neu.glb` bzw. `…/Modelle/…` | 200 bzw. 500 |
| `/produkte/lineapro-outdoor/piktogramme/sonneta-150.svg` | 500 (fehlt auch live) |
| `/wp-content/themes/bildung-im-freien/bilder/Wir-richten-Bildung-ein.svg` | 500 (Footer-Logo live kaputt) |
| `/wp-login.php`, `/wp-json/`, `/xmlrpc.php` | 500 / 500 / 503 |
| `/robots.txt`, `/sitemap.xml`, `/.well-known/security.txt`, `/phpinfo.php`, `/CLAUDE.md`, `/bilder/logo-old.svg` | 500 ×5 / 200 |
| DNS (A, AAAA, MX, TXT, CAA, NS, `_dmarc`, `default._domainkey`, `_mta-sts`) für beide Domains | siehe S-07, S-13 |
