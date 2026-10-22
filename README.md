# Akquise – persönlicher Immobilien-Arbeitsplatz

Responsive App für Immobilienakquise mit eigener Seitennavigation. Objekte, Kontakte, Besuche, Wiedervorlagen, Aktivitäten, Gebietskarte, Tagesroute, Kalender, Auswertung und Datensicherung sind getrennt erreichbar. Auf dem iPhone öffnet sich die Navigation über ☰.

## Start und Entwicklung

Node.js **24 oder neuer** ist erforderlich. Keine externen Laufzeitpakete, kein Build, keine API-Schlüssel für den Grundbetrieb.

```sh
cd /workspace/Akquise-Immobilien
npm ci --ignore-scripts --cache /tmp/akquise-npm-cache
npm test
npm start
```

`npm run dev` startet den Server mit Dateibeobachtung. Standardmäßig läuft er nur auf Loopback und Port 3000; `HOST`, `PORT` und `DATA_DIR` sind konfigurierbar. Auf dem Mac bietet **Akquise.app** den Start per Doppelklick ohne Terminaleingaben (Node.js weiterhin einmalig erforderlich). Der unsignierte macOS-Starter wurde in der Linux-Umgebung nur auf Syntax geprüft, nicht auf einem Mac ausgeführt.

## Zwei Speichermodi

- **Mac-Server:** Die Oberfläche unter `/` speichert Objekte, Anhänge, Kalender und die letzten fünf Datenstände in SQLite unter `data/akquise.sqlite`. Für eine vollständige Sicherung den Server stoppen und den gesamten Datenordner einschließlich Journaldateien kopieren. Der Mac-Starter verwendet bei neuen Installationen `~/Library/Application Support/Akquise/data`; eine vorhandene Datenbank im Projektordner wird weiterverwendet.
- **Eigenständiges iPhone:** `/phone.html` speichert in IndexedDB auf dem jeweiligen Gerät. Nach erfolgreicher Einrichtung über HTTPS kann die App einschließlich Objekten, Anhängen und Kalender offline gestartet werden. Kein laufender Mac nötig. Karte und Adresssuche benötigen Internet. Veröffentlichung/Installation: [IPHONE.md](IPHONE.md).

Beide Modi haben **keine automatische geräteübergreifende Synchronisierung**. Es gibt keine Benutzerkonten, keine Cloud-Datensicherung und keine Push-Erinnerungen. Der Mac-Server darf nicht ungeschützt öffentlich erreichbar sein. Beim iPhone-Modus wird nur die allgemeine Oberfläche veröffentlicht, nicht der persönliche Datenbestand. Die Daten sind nicht zusätzlich durch die App verschlüsselt.

## Arbeitsablauf

Objekte erhalten ein Titelbild, weitere Fotos, Kontaktdaten, Gebiet/Stadtteil, Priorität, Akquise- und Besuchsstatus. Ein schneller Besuchsabschluss erfasst „Niemand angetroffen“, „Nachbar getroffen“ oder „Eigentümer getroffen“ sowie Gesprächsnotiz, Datum und nächste Aktion. Weitere Aktivitäten lassen sich im Objekt erfassen. Die Aktivitätenübersicht fasst den Kontaktverlauf aller Objekte zusammen.

**Kalender:** Monatsansicht mit Tagesagenda; freie Termine und Aufgaben mit Datum, optionaler Start-/Endzeit, Notizen, Erledigt-Status und Objektbezug. Offene Objekt-Wiedervorlagen erscheinen zusätzlich. Ein `.ics`-Export der eigenen Kalendereinträge kann manuell in Apple Kalender importiert werden; keine laufende Synchronisierung und keine Hintergrundbenachrichtigungen. Zeitangaben im Export sind lokale Uhrzeiten ohne Zeitzonenumrechnung.

**Tagesroute:** Bis zu 20 vorhandene Objekte auswählen, Reihenfolge mit Pfeilen ändern, optional nur unbesuchte anzeigen. Die Navigation öffnet Google Maps mit Abschnitten aus maximal vier Stationen. Keine automatische Straßenoptimierung. Beim Öffnen werden die gewählten Standorte an Google übergeben.

**Gebiete & Auswertung:** Besuchsfortschritt pro manuell zugeordnetem Gebiet sowie Zahlen zu Gesprächen, besuchten Objekten, künftigen Besichtigungen, Prioritäten und Akquise-Status. Gezählt werden nur erfasste Objekte und dokumentierte Aktivitäten; daraus wird keine kausale Erfolgsattribution abgeleitet.

**Anhänge:** Hauptfoto bis 10 MB vor Verkleinerung; zusätzliche JPG/PNG/WebP, PDF, Text und Audiodateien bis 5 MB je Datei, maximal 30 Anhänge und 24 MB je Objekt. Bilder werden verkleinert. Sprachaufnahme über das Mikrofon (Browserfreigabe und HTTPS/localhost erforderlich), maximal zwei Minuten; als Audiodatei, keine automatische Transkription. Der tatsächliche iPhone-Mikrofonbetrieb muss auf dem Gerät geprüft werden.

## Karte

Lokal mitgeliefertes Leaflet, OpenStreetMap-Kacheln und ausdrücklich ausgelöste Adresssuche über Nominatim. Erforderliche Netzwerkziele: `tile.openstreetmap.org`, `nominatim.openstreetmap.org`. Es wird kein Google-Maps-API-Schlüssel benötigt; Google Maps ist ein externer Standort-/Navigationslink. Nur erfasste Objekte haben Markierungen. Unmarkierte Gebäude sind nicht automatisch „nicht besucht“. Kein Offline-Download von Kartenkacheln. Leaflet-Lizenz: `public/vendor/leaflet/LICENSE`.

## Sicherung und Datentransfer

„Daten sichern“ lädt JSON mit Objekten, Fotos, Anhängen, Aktivitäten, Statusverlauf und Kalender herunter. „Importieren“ prüft die Daten und fügt sie als neue Einträge hinzu; Objektbezüge des Kalenders werden auf die neuen IDs übertragen. Bestehende Daten bleiben erhalten, es findet keine Zusammenführung statt. Bei einem Speicherfehler kann ein Teilimport erfolgt sein; die Meldung nennt die Zahl bereits importierter Einträge. Nicht einfach die gesamte Datei erneut importieren, um Duplikate zu vermeiden.

Vor jeder Änderung werden die letzten fünf Zustände automatisch im jeweiligen lokalen Speicher behalten. Unter **Datensicherung** können sie heruntergeladen werden. Ein vorheriger Datenstand wird nicht automatisch über aktuelle Daten geschrieben; der Import ist additiv. Diese lokalen Kopien helfen nach versehentlichen Änderungen, schützen aber **nicht vor Geräteverlust, Browserdatenlöschung oder Speicherausfall**. Regelmäßig eine JSON-Datei nach Dateien/iCloud Drive exportieren. Automatische externe Sicherung und gemeinsamer Datenbestand benötigen einen noch einzurichtenden geschützten Online-Speicher.

## Prüfungen

`npm test` prüft Objekt- und Kalender-CRUD, Bild-/Anhangsvalidierung, Statusverlauf, Besuchsdaten, ungültige Daten/Uhrzeiten, Persistenz nach Serverneustart und die Rotation der fünf Sicherungsstände in temporären Datenbanken.

Zusätzlich in Chromium geprüft: Gebiet/Priorität, Textanhang, Sprachaufnahme mit simuliertem Mikrofon, schneller Besuch, Kalender bearbeiten/neuladen/exportieren, Tagesroute, Aktivitäten, Gebietsfilter, Sicherungen, vollständiger JSON-Import einschließlich Kalender und Audio in den Gerätemodus, IndexedDB-Upgrade, mobile Seitennavigation bei 390 Pixeln und Offline-Neustart mit Kalender. Das ersetzt keine Prüfung auf echtem iOS/macOS. Kartenkacheln und öffentliche Adresssuche waren bei der letzten Live-Prüfung durch den Cloud-Netzwerkproxy blockiert; Marker/Filter wurden geprüft, erfolgreiche Live-Kartendienste werden damit nicht behauptet.

Die GitHub-Pages-Veröffentlichung muss unter Settings → Pages aktiviert und der Workflow erfolgreich abgeschlossen sein. Ein Git-Push allein bestätigt keine produktive Bereitstellung.
