# Akquise – Immobilien im Blick

Responsive Anwendung zur persönlichen Immobilienakquise. Objekte mit Foto, Adresse, Preisvorstellung, Angebotslink und Kontakten verwalten; Statusverlauf, Wiedervorlagen und nächste Schritte verfolgen. Dashboard, Suche, Statusfilter, Sortierung und JSON-Export inklusive Fotos.

## Entwickeln und starten

Voraussetzung: Node.js 24 oder neuer (integriertes SQLite). Keine externen Laufzeitpakete, Konten oder API-Schlüssel erforderlich.

```sh
cd /workspace/Akquise-Immobilien
npm ci --ignore-scripts --cache /tmp/akquise-npm-cache
npm test
npm start
```

`npm run dev` startet mit automatischem Neustart bei Änderungen am Server. Standard: Port 3000, ausschließlich Loopback. Die Oberfläche wird direkt ausgeliefert; kein Build notwendig.

## Speicherung und Sicherungen

SQLite-Datenbank inklusive Foto-Daten unter `data/akquise.sqlite`, nicht in Git. `DATA_DIR` kann ein anderes dauerhaftes Verzeichnis wählen. `PORT` und `HOST` steuern den Server. Fotos werden im Browser auf maximal 1600 Pixel verkleinert und als JPEG gespeichert. Upload: JPG, PNG, WebP bis 10 MB vor Verkleinerung.

„Daten sichern“ lädt alle Objekte samt Fotos als JSON herunter. Ein Import dieser Datei ist in dieser Version noch nicht enthalten. Für eine vollständige wiederherstellbare Sicherung den Server stoppen und das gesamte `data/`-Verzeichnis kopieren; zur Wiederherstellung bei gestopptem Server zurückkopieren.

## Umfang dieser Version

Ein gemeinsamer persönlicher Datenbestand; noch keine Anmeldung, Benutzertrennung oder Teamrechte. Wiedervorlagen erscheinen in der App; keine Push-, E-Mail- oder Hintergrundbenachrichtigungen. Das Manifest unterstützt das Hinzufügen zum Startbildschirm bei geeigneter Browser-/HTTPS-Konfiguration; kein Offlinebetrieb.

Für die gemeinsame Nutzung auf Handy und PC sind ein erreichbarer Server, HTTPS, eine vorgeschaltete Anmeldung und dauerhaftes Datenvolume nötig. Diese Version deshalb nicht ungeschützt öffentlich betreiben. Hosting und Anmeldung sind noch nicht eingerichtet.

## Prüfungen

`npm test` testet CRUD, Foto-Speicherung, Statusverlauf, Eingabevalidierung, Schutz vor fremden Origins und Datenpersistenz nach Neustart in einer eigenen temporären Datenbank. Der Test verändert keine Nutzerdaten. Zusätzlich beim Aufbau in Chromium geprüft: Foto-Upload, Anlegen, Bearbeiten, Neuladen, Kennzahlen, Suche, JSON-Download und Löschen sowie Desktop und 390-Pixel-Mobilansicht.
