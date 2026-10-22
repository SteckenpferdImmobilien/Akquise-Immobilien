import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=mkdtempSync(join(tmpdir(),'akquise-test-'));
const port=String(31000+Math.floor(Math.random()*10000));
let server;
async function start(){server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:port,DATA_DIR:dir},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('Server exit '+code)));});}
async function stop(){const p=server;if(p.exitCode!==null)return;await new Promise(resolve=>{p.once('exit',resolve);p.kill();});}
const request=async(path='',method='GET',body)=>{const res=await fetch(`http://127.0.0.1:${port}/api/properties${path}`,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:res.status,body:await res.json()};};
test('Objekt mit Foto: CRUD, Verlauf, Validierung und Persistenz nach Neustart',async()=>{try{
 await start();assert.deepEqual((await request()).body,[]);
 const p={title:'Altbau am Park',address:'Parkstraße 12, Berlin',owner:'Maria Muster',status:'Neu',type:'Mehrfamilienhaus',dueDate:'2026-10-22',nextAction:'Anrufen',image:'data:image/png;base64,iVBORw0KGgo='};
 assert.equal((await request('','POST',{...p,title:''})).status,400);
 assert.equal((await request('','POST',{...p,image:'data:image/svg+xml;base64,PHN2Zz4='})).status,400);
 assert.equal((await request('','POST',{...p,url:'javascript:alert(1)'})).status,400);
 assert.equal((await request('','POST',{...p,lat:'NaN',lng:'9.7'})).status,400);
 assert.equal((await request('','POST',{...p,activities:[{type:'Unbekannt',date:'2026-10-22',note:'Test'}]})).status,400);
 const created=await request('','POST',p);assert.equal(created.status,201);assert.equal(created.body.image,p.image);const id=created.body.id;
 const updated=await request('/'+id,'PUT',{...p,status:'Kontaktiert',notes:'Besichtigung vereinbaren',visitStatus:'Besucht',visitDate:'2026-10-22',lat:'52.3759',lng:'9.732',activities:[{type:'Nachbar getroffen',date:'2026-10-22',note:'Eigentümer am Freitag erreichbar.'}]} );assert.equal(updated.status,200);assert.equal(updated.body.history.length,2);assert.equal(updated.body.createdAt,created.body.createdAt);
 await stop();await start();const loaded=(await request()).body;assert.equal(loaded.length,1);assert.equal(loaded[0].notes,'Besichtigung vereinbaren');assert.equal(loaded[0].image,p.image);assert.equal(loaded[0].visitStatus,'Besucht');assert.equal(loaded[0].activities[0].type,'Nachbar getroffen');assert.equal(loaded[0].lat,'52.3759');
 assert.equal((await request('/'+id,'DELETE')).status,200);assert.deepEqual((await request()).body,[]);assert.equal((await request('/'+id,'PUT',p)).status,404);
 const blocked=await fetch(`http://127.0.0.1:${port}/api/properties`,{headers:{Origin:'https://untrusted.example'}});assert.equal(blocked.status,403);
}finally{if(server)await stop();rmSync(dir,{recursive:true,force:true});}});
