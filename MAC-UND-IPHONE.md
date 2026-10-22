# Auf deinem Mac und iPhone verwenden

1. Installiere einmalig **Node.js 24 LTS oder neuer** von https://nodejs.org (macOS Installer).
2. Entpacke `Akquise-Mac.zip` und lege den Ordner dauerhaft auf deinem Mac ab, zum Beispiel unter Dokumente. Nicht bei jedem Start erneut entpacken: deine Daten entstehen im Ordner `data` neben dem Programm.
3. Doppelklicke auf **Start Akquise.command**. Wenn macOS eine Sicherheitsabfrage zeigt, starte die Datei über Rechtsklick > Öffnen. Bei einer Firewall- oder lokalen Netzwerkabfrage den Zugriff für dein privates Netzwerk erlauben. Falls macOS das Öffnen weiter blockiert, unter Systemeinstellungen > Datenschutz & Sicherheit die konkrete Datei prüfen und erlauben.
4. Die App öffnet sich auf dem Mac. Im Terminal steht die Adresse für dein iPhone. Öffne diese Adresse in **Safari auf dem iPhone**. Beide Geräte müssen im selben privaten WLAN sein. Gast-WLAN mit Geräteisolierung funktioniert nicht.
5. Auf dem iPhone: **Teilen > Zum Home-Bildschirm**. Je nach iOS-Version liegt Teilen im Safari-Menü. So erhältst du ein eigenes Symbol. Die App benötigt weiterhin die Verbindung zum Mac; sie arbeitet nicht offline.

Das Terminalfenster offen lassen. Zum Beenden Ctrl+C drücken. Der Mac muss eingeschaltet und wach sein. Nach einem Neustart des Macs die Startdatei erneut öffnen. Wenn sich seine WLAN-IP ändert, die neu angezeigte Adresse verwenden und gegebenenfalls das Symbol auf dem iPhone neu hinzufügen.

## Daten sichern

Objekte und Fotos liegen auf deinem Mac in `data/akquise.sqlite`. Für eine vollständige Sicherung die App mit Ctrl+C stoppen und den gesamten Ordner `data` kopieren, etwa mit Time Machine. Zum Wiederherstellen die App stoppen und den gesicherten Ordner zurückkopieren. Der JSON-Download „Daten sichern“ ist ein zusätzlicher Export; ein JSON-Import ist noch nicht eingebaut.

## Zugriff

Diese Variante hat keine Anmeldung. Andere Geräte im selben Netzwerk könnten die App ebenfalls erreichen. Deshalb nur im eigenen vertrauenswürdigen WLAN nutzen und **keine Portfreigabe am Router** einrichten. Unterwegs ist sie nicht erreichbar. Eine Adresse im Heimnetz verwendet HTTP; die Datenübertragung ist dort nicht zusätzlich verschlüsselt. Für Zugang in fremden Netzen oder von unterwegs wäre ein gesonderter geschützter Zugang nötig.

## Falls es nicht klappt

- Das Terminal muss „Akquise läuft auf Port 3000“ anzeigen.
- Prüfen, ob Mac und iPhone im selben WLAN sind und der Mac nicht schläft.
- Unter Systemeinstellungen > Netzwerk > Firewall prüfen, ob Node.js eingehende Verbindungen erlaubt.
- Ist Port 3000 schon belegt, die bereits gestartete App schließen und erneut starten.
