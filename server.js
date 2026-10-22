import http from "node:http";
import "./public/model.js";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
const root = dirname(fileURLToPath(import.meta.url));
const data = process.env.DATA_DIR || join(root, "data");
mkdirSync(data, { recursive: true });
const db = new DatabaseSync(join(data, "akquise.sqlite"));
db.exec(
  "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS properties (id TEXT PRIMARY KEY, content TEXT NOT NULL)",
);
db.exec(
  "CREATE TABLE IF NOT EXISTS streets (id TEXT PRIMARY KEY, content TEXT NOT NULL); CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, content TEXT NOT NULL); CREATE TABLE IF NOT EXISTS snapshots (id TEXT PRIMARY KEY, content TEXT NOT NULL)",
);
function snapshot() {
  const properties = db
    .prepare("SELECT content FROM properties")
    .all()
    .map((r) => JSON.parse(r.content));
  const events = db
    .prepare("SELECT content FROM events")
    .all()
    .map((r) => JSON.parse(r.content));
  const streets = db
    .prepare("SELECT content FROM streets")
    .all()
    .map((r) => JSON.parse(r.content));
  db.prepare("INSERT INTO snapshots(id,content) VALUES (?,?)").run(
    randomUUID(),
    JSON.stringify({
      exportedAt: new Date().toISOString(),
      properties,
      events,
      streets,
    }),
  );
  db.exec(
    "DELETE FROM snapshots WHERE rowid NOT IN (SELECT rowid FROM snapshots ORDER BY rowid DESC LIMIT 5)",
  );
}
const statuses = [
  "Neu",
  "Kontaktiert",
  "Termin vereinbart",
  "In Verhandlung",
  "Gewonnen",
  "Abgesagt",
];
const types = [
  "Wohnung",
  "Einfamilienhaus",
  "Mehrfamilienhaus",
  "Grundstück",
  "Gewerbe",
  "Sonstiges",
];
const validate = AkquiseModel.property;
function send(res, code, value) {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(value));
}
let lastGeocode = 0;
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/api/")) {
      if (
        req.headers.origin &&
        req.headers.origin !== `http://${req.headers.host}` &&
        req.headers.origin !== `https://${req.headers.host}`
      )
        return send(res, 403, { error: "Zugriff nicht erlaubt" });
      if (url.pathname === "/api/streets" && req.method === "GET")
        return send(
          res,
          200,
          db
            .prepare("SELECT content FROM streets ORDER BY rowid DESC")
            .all()
            .map((r) => JSON.parse(r.content)),
        );
      const streetMatch = url.pathname.match(/^\/api\/streets\/([a-f0-9-]+)$/);
      if (streetMatch && req.method === "DELETE") {
        snapshot();
        const result = db
          .prepare("DELETE FROM streets WHERE id=?")
          .run(streetMatch[1]);
        return send(res, result.changes ? 200 : 404, { ok: !!result.changes });
      }
      if (
        (url.pathname === "/api/streets" && req.method === "POST") ||
        (streetMatch && req.method === "PUT")
      ) {
        if (!req.headers["content-type"]?.startsWith("application/json"))
          return send(res, 415, { error: "JSON erforderlich" });
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > 100000)
            return send(res, 413, { error: "Eintrag zu groß" });
        }
        let street;
        try {
          street = AkquiseModel.street(JSON.parse(body));
        } catch (err) {
          return send(res, 400, { error: err.message });
        }
        const old = streetMatch
          ? db
              .prepare("SELECT content FROM streets WHERE id=?")
              .get(streetMatch[1])
          : null;
        if (streetMatch && !old)
          return send(res, 404, { error: "Straße nicht gefunden" });
        street = {
          ...street,
          id: streetMatch ? streetMatch[1] : randomUUID(),
          createdAt: old
            ? JSON.parse(old.content).createdAt
            : new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        snapshot();
        db.prepare(
          "INSERT INTO streets(id,content) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content",
        ).run(street.id, JSON.stringify(street));
        return send(res, streetMatch ? 200 : 201, street);
      }
      if (url.pathname === "/api/snapshots" && req.method === "GET")
        return send(
          res,
          200,
          db
            .prepare("SELECT id,content FROM snapshots ORDER BY rowid DESC")
            .all()
            .map((r) => ({ id: r.id, ...JSON.parse(r.content) })),
        );
      if (url.pathname === "/api/events" && req.method === "GET")
        return send(
          res,
          200,
          db
            .prepare("SELECT content FROM events ORDER BY rowid DESC")
            .all()
            .map((r) => JSON.parse(r.content)),
        );
      const eventMatch = url.pathname.match(/^\/api\/events\/([a-f0-9-]+)$/);
      if (eventMatch && req.method === "DELETE") {
        snapshot();
        const result = db
          .prepare("DELETE FROM events WHERE id=?")
          .run(eventMatch[1]);
        return send(res, result.changes ? 200 : 404, { ok: !!result.changes });
      }
      if (
        (url.pathname === "/api/events" && req.method === "POST") ||
        (eventMatch && req.method === "PUT")
      ) {
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > 30000)
            return send(res, 413, { error: "Termin zu groß" });
        }
        let e;
        try {
          e = AkquiseModel.event(JSON.parse(body));
        } catch (err) {
          return send(res, 400, { error: err.message });
        }
        const old = eventMatch
          ? db
              .prepare("SELECT content FROM events WHERE id=?")
              .get(eventMatch[1])
          : null;
        if (eventMatch && !old)
          return send(res, 404, { error: "Termin nicht gefunden" });
        e = {
          ...e,
          id: eventMatch ? eventMatch[1] : randomUUID(),
          createdAt: old
            ? JSON.parse(old.content).createdAt
            : new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        snapshot();
        db.prepare(
          "INSERT INTO events(id,content) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content",
        ).run(e.id, JSON.stringify(e));
        return send(res, eventMatch ? 200 : 201, e);
      }
      if (url.pathname === "/api/geocode" && req.method === "GET") {
        const query = (url.searchParams.get("q") || "").trim();
        if (query.length < 5 || query.length > 400)
          return send(res, 400, {
            error: "Bitte eine vollständige Adresse eingeben.",
          });
        if (Date.now() - lastGeocode < 1100)
          return send(res, 429, {
            error: "Bitte einen Moment warten und erneut suchen.",
          });
        lastGeocode = Date.now();
        try {
          const result = await fetch(
            "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=de&q=" +
              encodeURIComponent(query),
            {
              headers: {
                "User-Agent":
                  "AkquiseImmobilien/1.1 (personal real estate visit planning)",
                "Accept-Language": "de",
              },
              signal: AbortSignal.timeout(10000),
            },
          );
          if (!result.ok)
            return send(res, 502, {
              error:
                "Adresssuche derzeit nicht verfügbar. Position direkt auf der Karte setzen.",
            });
          return send(
            res,
            200,
            (await result.json()).map((x) => ({
              label: x.display_name,
              lat: x.lat,
              lng: x.lon,
            })),
          );
        } catch {
          return send(res, 502, {
            error:
              "Adresssuche nicht erreichbar. Position direkt auf der Karte setzen.",
          });
        }
      }
      if (url.pathname === "/api/properties" && req.method === "GET")
        return send(
          res,
          200,
          db
            .prepare("SELECT content FROM properties ORDER BY rowid DESC")
            .all()
            .map((r) => JSON.parse(r.content)),
        );
      const match = url.pathname.match(/^\/api\/properties\/([a-f0-9-]+)$/);
      if (match && req.method === "DELETE") {
        snapshot();
        const result = db
          .prepare("DELETE FROM properties WHERE id = ?")
          .run(match[1]);
        return send(res, result.changes ? 200 : 404, { ok: !!result.changes });
      }
      if (
        (url.pathname === "/api/properties" && req.method === "POST") ||
        (match && req.method === "PUT")
      ) {
        if (!req.headers["content-type"]?.startsWith("application/json"))
          return send(res, 415, { error: "JSON erforderlich" });
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > 26_000_000)
            return send(res, 413, { error: "Datei zu groß" });
        }
        let input;
        try {
          input = JSON.parse(body);
        } catch {
          return send(res, 400, { error: "Ungültige Daten" });
        }
        let p;
        try {
          p = validate(input);
        } catch (e) {
          return send(res, 400, { error: e.message });
        }
        const previous = match
          ? db
              .prepare("SELECT content FROM properties WHERE id=?")
              .get(match[1])
          : null;
        if (match && !previous)
          return send(res, 404, { error: "Objekt nicht gefunden" });
        const old = previous ? JSON.parse(previous.content) : null;
        p = {
          ...p,
          id: match ? match[1] : randomUUID(),
          createdAt: old?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          history: old?.history || p.history || [],
        };
        if (
          old ? old.status !== p.status : p.history.at(-1)?.status !== p.status
        )
          p.history = [...p.history, { status: p.status, at: p.updatedAt }];
        snapshot();
        db.prepare(
          "INSERT INTO properties (id,content) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content",
        ).run(p.id, JSON.stringify(p));
        return send(res, match ? 200 : 201, p);
      }
      return send(res, 404, { error: "Nicht gefunden" });
    }
    if (req.method !== "GET") return send(res, 405, { error: "Nicht erlaubt" });
    const files = {
      "/": ["index.html", "text/html"],
      "/app.js": ["app.js", "text/javascript"],
      "/style.css": ["style.css", "text/css"],
      "/manifest.webmanifest": [
        "manifest.webmanifest",
        "application/manifest+json",
      ],
      "/icon.svg": ["icon.svg", "image/svg+xml"],
    };
    for (const name of ["workspace.js", "model.js", "streets.js"])
      files["/" + name] = [name, "text/javascript"];
    for (const name of ["steckenpferd-logo.png", "steckenpferd-icon.png"])
      files["/brand/" + name] = ["brand/" + name, "image/png"];
    const vendor = url.pathname.match(
      /^\/vendor\/leaflet\/(leaflet\.(js|css)|images\/(marker-icon(?:-2x)?|marker-shadow|layers(?:-2x)?)\.png)$/,
    );
    if (vendor)
      files[url.pathname] = [
        "vendor/leaflet/" + vendor[1],
        vendor[1].endsWith(".js")
          ? "text/javascript"
          : vendor[1].endsWith(".css")
            ? "text/css"
            : "image/png",
      ];
    for (const [path, type] of [
      ["phone.html", "text/html"],
      ["phone.webmanifest", "application/manifest+json"],
      ["sw.js", "text/javascript"],
    ])
      files["/" + path] = [path, type];
    const file = files[url.pathname];
    if (!file) return send(res, 404, { error: "Nicht gefunden" });
    res.writeHead(200, {
      "Content-Type": file[1] + "; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'self'; img-src 'self' data: https://tile.openstreetmap.org; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https://nominatim.openstreetmap.org; media-src 'self' data: blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    });
    res.end(readFileSync(join(root, "public", file[0])));
  } catch (e) {
    console.error(e.message);
    send(res, 500, {
      error: "Speichern fehlgeschlagen. Bitte erneut versuchen.",
    });
  }
});
server.listen(
  Number(process.env.PORT || 3000),
  process.env.HOST || "127.0.0.1",
  () => console.log("Akquise läuft auf Port " + (process.env.PORT || 3000)),
);
