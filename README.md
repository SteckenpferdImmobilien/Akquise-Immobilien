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

## Version 2 – Gebietsakquise und iPhone-Modus

CRM-Layout mit Reitern für Objekt, Kontakte, Besuche & Aktivitäten und Aufgaben & Notizen. Besuchsstatus mit Datum, datierte Aktivitäten und Kartenmarkierungen für erfasste Objekte. OpenStreetMap/Leaflet ohne API-Schlüssel, manuelle Adresssuche über Nominatim und Google-Maps-Link pro Standort. Nur erfasste Objekte werden markiert; keine vollständige Gebäudedatenbank.

Die frühere Angabe „kein Offlinebetrieb“ gilt weiterhin für den Mac-Servermodus. Neu: `phone.html` ist ein unabhängiger Geräte-Modus mit IndexedDB und Service Worker; App und Objekte sind nach erfolgreichem Laden offline nutzbar, Kartendienste nicht. JSON-Import ermöglicht den manuellen Transfer; keine automatische Synchronisierung. Der iPhone-Modus benötigt nach seiner Veröffentlichung keinen laufenden Mac und keine Anmeldung. Die Daten werden dort nur auf dem Gerät gespeichert und müssen regelmäßig exportiert werden. Ausführliche Einrichtung: [IPHONE.md](IPHONE.md). GitHub-Pages-Workflow vorbereitet, Veröffentlichung muss unter Settings → Pages aktiviert und erfolgreich ausgeführt werden; bisher keine produktive Veröffentlichung bestätigt.

**Akquise.app** ergänzt den Start des Mac-Servers per Doppelklick ohne Terminaleingaben. Voraussetzung Node.js 24+, keine Apple-Signatur; Start auf macOS noch nicht praktisch getestet. Siehe [MAC-UND-IPHONE.md](MAC-UND-IPHONE.md).

Die Cloud-Funktionsprüfung für Version 2 umfasst Aktivitäten-/Besuchspersistenz, Kartenmarker und Filter, Anlage per Kartenklick, 390-Pixel-Ansicht sowie einen Offline-Neustart des Gerätemodus in Chromium. Kartenkacheln und öffentliche Adresssuche waren in der Cloud durch den Netzwerkproxy (HTTP 403) blockiert; die erforderlichen Domains wurden als Konfigurationsentwurf gespeichert. Keine erfolgreiche Live-Karten-/Geocoding-Prüfung behauptet.
