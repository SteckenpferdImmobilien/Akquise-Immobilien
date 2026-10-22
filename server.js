import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
const root = dirname(fileURLToPath(import.meta.url));
const data = process.env.DATA_DIR || join(root, 'data');
mkdirSync(data, { recursive: true });
const db = new DatabaseSync(join(data, 'akquise.sqlite'));
db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS properties (id TEXT PRIMARY KEY, content TEXT NOT NULL)');
const statuses = ['Neu','Kontaktiert','Termin vereinbart','In Verhandlung','Gewonnen','Abgesagt'];
const types = ['Wohnung','Einfamilienhaus','Mehrfamilienhaus','Grundstück','Gewerbe','Sonstiges'];
function validate(input) {
 const p = {};
 for (const key of ['title','address','owner','phone','email','url','notes','nextAction','dueDate','status','type','price','image','visitStatus','visitDate','lat','lng']) {
  if (input[key] !== undefined && typeof input[key] !== 'string') throw Error('Ungültiges Feld: ' + key);
  p[key] = (input[key] || '').trim();
  if (key !== 'image' && p[key].length > (key === 'notes' ? 20000 : 1000)) throw Error('Eingabe zu lang');
 }
 p.visitStatus ||= 'Nicht besucht';
 if (!['Nicht besucht','Niemand angetroffen','Besucht','Erneut besuchen'].includes(p.visitStatus)) throw Error('Ungültiger Besuchsstatus');
 if ((p.lat === '') !== (p.lng === '')) throw Error('Bitte beide Koordinaten angeben.');
 if(p.lat && (!Number.isFinite(Number(p.lat)) || !Number.isFinite(Number(p.lng)) || Math.abs(Number(p.lat))>90 || Math.abs(Number(p.lng))>180)) throw Error('Ungültige Koordinaten');
 if(p.visitDate && (!/^\d{4}-\d{2}-\d{2}$/.test(p.visitDate) || Number.isNaN(Date.parse(p.visitDate)))) throw Error('Ungültiges Besuchsdatum');
 if(input.activities !== undefined && !Array.isArray(input.activities)) throw Error('Ungültige Aktivitäten');
 p.activities=(input.activities || []).map(a=>{
  if(!a || !['Eigentümer getroffen','Nachbar getroffen','Information erhalten','Niemand angetroffen','Telefonat','E-Mail','Besichtigung','Sonstiges'].includes(a.type) || typeof a.note!=='string' || a.note.length>10000 || typeof a.date!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(a.date) || Number.isNaN(Date.parse(a.date))) throw Error('Ungültiger Aktivitäteneintrag');
  return {type:a.type,note:a.note.trim(),date:a.date};
 });
 if(p.activities.length>500) throw Error('Maximal 500 Aktivitäten pro Objekt');
 if (!p.title) throw Error('Bitte eine Objektbezeichnung eingeben.');
 if (!statuses.includes(p.status)) throw Error('Ungültiger Status');
 if (!types.includes(p.type)) throw Error('Ungültige Objektart');
 if (p.url && !/^https?:\/\//i.test(p.url)) throw Error('Der Link muss mit https:// oder http:// beginnen.');
 if (p.dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(p.dueDate) || Number.isNaN(Date.parse(p.dueDate)))) throw Error('Ungültiges Datum');
 if (p.image && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(p.image)) throw Error('Bitte JPG, PNG oder WebP verwenden.');
 if (p.image.length > 5_000_000) throw Error('Das Bild ist zu groß.');
 return p;
}
function send(res, code, value) { res.writeHead(code, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(value)); }
let lastGeocode=0;
const server = http.createServer(async (req,res) => {
 try {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
   if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}`) return send(res,403,{error:'Zugriff nicht erlaubt'});
   if(url.pathname === '/api/geocode' && req.method==='GET') {
    const query=(url.searchParams.get('q')||'').trim();
    if(query.length<5 || query.length>400) return send(res,400,{error:'Bitte eine vollständige Adresse eingeben.'});
    if(Date.now()-lastGeocode<1100) return send(res,429,{error:'Bitte einen Moment warten und erneut suchen.'});
    lastGeocode=Date.now();
    try {
     const result=await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=de&q='+encodeURIComponent(query),{headers:{'User-Agent':'AkquiseImmobilien/1.1 (personal real estate visit planning)','Accept-Language':'de'},signal:AbortSignal.timeout(10000)});
     if(!result.ok) return send(res,502,{error:'Adresssuche derzeit nicht verfügbar. Position direkt auf der Karte setzen.'});
     return send(res,200,(await result.json()).map(x=>({label:x.display_name,lat:x.lat,lng:x.lon})));
    } catch { return send(res,502,{error:'Adresssuche nicht erreichbar. Position direkt auf der Karte setzen.'}); }
   }
   if (url.pathname === '/api/properties' && req.method === 'GET') return send(res,200,db.prepare('SELECT content FROM properties ORDER BY rowid DESC').all().map(r=>JSON.parse(r.content)));
   const match = url.pathname.match(/^\/api\/properties\/([a-f0-9-]+)$/);
   if (match && req.method === 'DELETE') {
    const result = db.prepare('DELETE FROM properties WHERE id = ?').run(match[1]);
    return send(res,result.changes ? 200 : 404,{ok:!!result.changes});
   }
   if ((url.pathname === '/api/properties' && req.method === 'POST') || (match && req.method === 'PUT')) {
    if (!req.headers['content-type']?.startsWith('application/json')) return send(res,415,{error:'JSON erforderlich'});
    let body=''; for await (const chunk of req) { body+=chunk; if (Buffer.byteLength(body)>6_000_000) return send(res,413,{error:'Datei zu groß'}); }
    let input; try { input=JSON.parse(body); } catch { return send(res,400,{error:'Ungültige Daten'}); }
    let p; try { p=validate(input); } catch(e) { return send(res,400,{error:e.message}); }
    const previous=match ? db.prepare('SELECT content FROM properties WHERE id=?').get(match[1]) : null;
    if(match && !previous) return send(res,404,{error:'Objekt nicht gefunden'});
    const old=previous ? JSON.parse(previous.content) : null;
    p={...p,id:match ? match[1] : randomUUID(),createdAt:old?.createdAt || new Date().toISOString(),updatedAt:new Date().toISOString(),history:old?.history || []};
    if(!old || old.status!==p.status) p.history=[...p.history,{status:p.status,at:p.updatedAt}];
    db.prepare('INSERT INTO properties (id,content) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content').run(p.id,JSON.stringify(p));
    return send(res,match?200:201,p);
   }
   return send(res,404,{error:'Nicht gefunden'});
  }
  if(req.method!=='GET') return send(res,405,{error:'Nicht erlaubt'});
  const files={'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/style.css':['style.css','text/css'],'/manifest.webmanifest':['manifest.webmanifest','application/manifest+json'],'/icon.svg':['icon.svg','image/svg+xml']};
  const vendor=url.pathname.match(/^\/vendor\/leaflet\/(leaflet\.(js|css)|images\/(marker-icon(?:-2x)?|marker-shadow|layers(?:-2x)?)\.png)$/);
  if(vendor) files[url.pathname]=['vendor/leaflet/'+vendor[1],vendor[1].endsWith('.js')?'text/javascript':vendor[1].endsWith('.css')?'text/css':'image/png'];
  for(const [path,type] of [['phone.html','text/html'],['phone.webmanifest','application/manifest+json'],['sw.js','text/javascript']])files['/'+path]=[path,type];
  const file=files[url.pathname]; if(!file) return send(res,404,{error:'Nicht gefunden'});
  res.writeHead(200,{'Content-Type':file[1]+'; charset=utf-8','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; img-src 'self' data: https://tile.openstreetmap.org; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"});
  res.end(readFileSync(join(root,'public',file[0])));
 } catch(e) { console.error(e.message); send(res,500,{error:'Speichern fehlgeschlagen. Bitte erneut versuchen.'}); }
});
server.listen(Number(process.env.PORT || 3000),process.env.HOST || '127.0.0.1',()=>console.log('Akquise läuft auf Port '+(process.env.PORT || 3000)));
