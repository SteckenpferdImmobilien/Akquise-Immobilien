#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1 || ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 24 ? 0 : 1)'; then
  echo "Bitte zuerst Node.js 24 LTS oder neuer von https://nodejs.org installieren."
  echo "Danach diese Datei erneut per Doppelklick starten."
  open "https://nodejs.org/en/download"
  read -r -p "Zum Schließen die Eingabetaste drücken … " _
  exit 1
fi
mac_ip="$(ipconfig getifaddr en0 2>/dev/null || true)"
if [ -z "$mac_ip" ]; then mac_ip="$(ipconfig getifaddr en1 2>/dev/null || true)"; fi
echo ""
echo "AKQUISE – Dein persönlicher Immobilienüberblick"
echo ""
if [ -n "$mac_ip" ]; then
 echo "Auf dem iPhone in Safari öffnen: http://${mac_ip}:3000"
else
 echo "WLAN-Adresse nicht erkannt. Siehe Systemeinstellungen > WLAN > Details > TCP/IP."
 echo "Auf dem iPhone: http://DEINE-MAC-IP:3000"
fi
echo "Mac und iPhone müssen im selben privaten WLAN sein."
echo "Dieses Fenster offen lassen. Beenden: Ctrl+C."
echo "Falls macOS fragt: Zugriff im lokalen Netzwerk erlauben."
echo ""
(sleep 2; open 'http://127.0.0.1:3000') &
export HOST=0.0.0.0
export PORT=3000
node server.js
