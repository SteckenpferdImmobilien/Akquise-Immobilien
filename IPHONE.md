# Auf dem iPhone verwenden – unabhängig vom Mac

Die iPhone-Version speichert Objekte, Fotos und Aktivitäten direkt im Browser-Speicher des jeweiligen Geräts (IndexedDB). Nach der ersten erfolgreichen Einrichtung kann sie ohne laufenden Mac und ohne Internet gestartet werden. Kartenkacheln und Adresssuche brauchen Internet. Keine automatische Synchronisierung zwischen Geräten. Safari-Privatmodus vermeiden. Browserdaten nicht löschen; regelmäßig JSON-Sicherungen über „Daten sichern“ in Dateien/iCloud Drive ablegen. Bei Gerätewechsel diese Sicherung importieren. Wird die App neu installiert oder unter einer anderen Internetadresse geöffnet, können andere Browser-Speicherbereiche gelten: vorher sichern. Vorhandene Mac-Daten können als JSON exportiert und auf dem iPhone importiert werden. Der Import erzeugt zusätzliche Objekte und führt keine automatische Zusammenführung durch.

## Einmalig die Oberfläche veröffentlichen

Es wird nur die allgemeine Oberfläche veröffentlicht, keine Datenbank und keine Objekte oder Bilder. Wer die Adresse kennt, kann die leere Oberfläche öffnen; er erhält keinen Zugriff auf die lokalen Daten anderer Geräte. Keine Zugangskontrolle oder Geräteverschlüsselung durch die Anwendung selbst.

1. Auf GitHub das Repository öffnen: https://github.com/SteckenpferdImmobilien/Akquise-Immobilien
2. **Settings → Pages → Build and deployment → Source: GitHub Actions** wählen.
3. Unter **Actions → iPhone-App veröffentlichen → Run workflow** den Branch `main` starten. Falls der Workflow schon erfolgreich lief, nicht erneut starten.
4. Nach erfolgreichem Lauf zeigt **Settings → Pages** die HTTPS-Adresse. Die Adresse nicht ändern, solange ungesicherte Objektdaten darauf gespeichert sind.

GitHub Pages hängt vom Repository-Typ und GitHub-Tarif ab. Falls GitHub Pages für dieses private Repository nicht verfügbar ist, das Repository nicht einfach öffentlich schalten: zunächst eine passende Hosting-Option festlegen. Der Workflow stellt ausschließlich `public/` bereit. Zum Testen lokal `phone.html` über den Server öffnen; produktiver Offline-Betrieb/Installation braucht HTTPS (Ausnahme lokaler Entwicklungszugriff).

## Auf dem iPhone installieren

1. Die von GitHub angezeigte HTTPS-Adresse in **Safari** öffnen.
2. **Teilen → Zum Home-Bildschirm**, falls angeboten „Als Web-App öffnen“ aktivieren und **Hinzufügen** wählen.
3. Die App über ihr neues Symbol öffnen und online fertig laden lassen.
4. Ein Testobjekt speichern. App schließen, Flugmodus aktivieren und neu öffnen: Objekt und Aktivitäten sollen erhalten bleiben. Dann Flugmodus ausschalten. Diesen Test einmal auf dem tatsächlichen iPhone durchführen; der Entwicklungstest in Chromium ersetzt ihn nicht.

Im iPhone-Modus steht oben „Daten nur auf diesem Gerät“. Ein Server und Node.js auf deinem Mac werden für diesen Modus nicht benötigt.

## Karte und Besuche

- **Gebietskarte** startet in Hannover; verschieben und zoomen ist möglich.
- Ein Kartenklick legt ein neues Objekt an der angeklickten Position an. Das Objekt benennen und speichern.
- Bestehende Objekte: unter **Objekt → Position auf der Karte → Adresse suchen** den passenden Treffer auswählen und speichern. Nur diese ausdrücklich gestartete Suche sendet die Adresse an OpenStreetMap/Nominatim; keine automatische Massensuche.
- Farben: blau = nicht besucht, grün = besucht, orange = niemand angetroffen / erneut besuchen.
- Nur erfasste Objekte besitzen einen Status. Unmarkierte Gebäude sind nicht automatisch „unbesucht“; es gibt keine vollständige Gebäudedatenbank.
- **Besuche & Aktivitäten** enthält Besuchsdatum und Aktivitäten wie „Nachbar getroffen“ und „Information erhalten“. Aktivität vormerken und anschließend das Objekt speichern.
- „In Google Maps öffnen“ bietet die Navigation/Ansicht eines einzelnen Standorts. Die eingebaute Karte stammt von OpenStreetMap, nicht von Google. Für eine eingebettete Google-Karte wäre ein eigenes freigeschaltetes Google-Maps-Projekt nötig.

Leaflet ist lokal mitgeliefert (BSD-2-Clause-Lizenz unter public/vendor/leaflet/LICENSE). Die Karten werden direkt von OpenStreetMap geladen; kein Offline-Download von Kartenkacheln. Kartenanbieter erhalten bei Nutzung übliche Verbindungs-/Kartenausschnittdaten.
