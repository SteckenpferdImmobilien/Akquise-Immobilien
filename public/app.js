const $=s=>document.querySelector(s);
const statuses=['Neu','Kontaktiert','Termin vereinbart','In Verhandlung','Gewonnen','Abgesagt'];
const types=['Wohnung','Einfamilienhaus','Mehrfamilienhaus','Grundstück','Gewerbe','Sonstiges'];
let properties=[],editing=null,image='',view='all',loadingPhoto=false;
const escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const open=p=>!['Gewonnen','Abgesagt'].includes(p.status);
const due=p=>open(p)&&p.dueDate&&p.dueDate<=today();
const date=s=>s?new Date(s+'T12:00:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}):'';
$('#today').textContent=new Date().toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
for(const s of statuses){$('#status').add(new Option(s,s));$('#status-filter').add(new Option(s,s));}
for(const t of types) $('#type').add(new Option(t,t));
async function api(path='',options={}){const res=await fetch('/api/properties'+path,options);const body=await res.json();if(!res.ok)throw Error(body.error||'Anfrage fehlgeschlagen');return body;}
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;setTimeout(()=>$('#toast').hidden=true,3500);}
function render(){
 $('#total').textContent=properties.length;$('#active').textContent=properties.filter(open).length;$('#due').textContent=properties.filter(due).length;$('#won').textContent=properties.filter(p=>p.status==='Gewonnen').length;$('#task-count').textContent=properties.filter(due).length;
 const q=$('#search').value.toLocaleLowerCase('de');const status=$('#status-filter').value;
 let list=properties.filter(p=>(view!=='tasks'||(open(p)&&p.dueDate))&&(!status||p.status===status)&&[p.title,p.address,p.owner,p.notes,p.nextAction].join(' ').toLocaleLowerCase('de').includes(q));
 list.sort((a,b)=>$('#sort').value==='name'?a.title.localeCompare(b.title,'de'):($('#sort').value==='due'||view==='tasks')?(a.dueDate||'9999').localeCompare(b.dueDate||'9999'):b.createdAt.localeCompare(a.createdAt));
 $('#result-count').textContent=`${list.length} ${list.length===1?'Objekt':'Objekte'}`;
 $('#cards').innerHTML=list.map(p=>`<article class="card" tabindex="0" role="button" aria-label="${escape(p.title)} bearbeiten" data-id="${p.id}"><div class="photo">${p.image?`<img src="${p.image}" alt="${escape(p.title)}" loading="lazy">`:'<div class="placeholder" aria-hidden="true">⌂</div>'}<span class="badge ${p.status==='Gewonnen'?'won':p.status==='Abgesagt'?'lost':''}">${escape(p.status)}</span></div><div class="card-body"><div class="object-type">${escape(p.type)}${p.price?' · '+escape(p.price)+' €':''}</div><h3>${escape(p.title)}</h3><div class="address">${escape(p.address)||'Adresse noch offen'}</div><div class="contact"><span class="avatar">${escape((p.owner||'?').split(' ').map(x=>x[0]).slice(0,2).join(''))}</span>${escape(p.owner)||'Noch kein Kontakt hinterlegt'}</div><div class="next"><span>${escape(p.nextAction)||'Nächsten Schritt planen'}</span><span class="${due(p)?'overdue':''}">${p.dueDate?(p.dueDate===today()?'Heute':date(p.dueDate)):'Kein Termin'}</span></div></div></article>`).join('');
 $('#empty').hidden=list.length>0;$('#empty h3').textContent=properties.length?'Keine passenden Objekte.':'Platz für deine nächste Chance.';$('#empty p').textContent=properties.length?'Passe deine Suche an oder lege ein neues Objekt an.':'Erfasse dein erstes Objekt mit Foto, Kontakt und nächstem Schritt.';$('#empty-add').textContent=properties.length?'Objekt hinzufügen':'Erstes Objekt hinzufügen';
}
function updatePhoto(){ $('#photo-preview').hidden=!image;$('#photo-preview').src=image||'';$('#photo-text').hidden=!!image;$('#remove-photo').hidden=!image; }
function edit(p=null){editing=p?.id||null;image=p?.image||'';$('#property-form').reset();$('#form-error').textContent='';$('#editor-title').textContent=p?'Objekt bearbeiten':'Neues Objekt';$('#delete').hidden=!p;for(const field of ['title','address','owner','phone','email','url','notes','nextAction','dueDate','status','type','price'])if(p)$('#property-form').elements[field].value=p[field]||'';$('#history').innerHTML=p?'<strong>Statusverlauf</strong><br>'+p.history.map(h=>`${date(h.at.slice(0,10))} · ${escape(h.status)}`).join('<br>'):'';updatePhoto();$('#editor').showModal();}
$('#add').onclick=()=>edit();$('#empty-add').onclick=()=>edit();document.querySelectorAll('.close').forEach(b=>b.onclick=()=>$('#editor').close());
$('#cards').onclick=e=>{const c=e.target.closest('[data-id]');if(c)edit(properties.find(p=>p.id===c.dataset.id));};$('#cards').onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-id]')){e.preventDefault();e.target.click();}};
$('#search').oninput=render;$('#status-filter').onchange=render;$('#sort').onchange=render;
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x===b));$('#page-title').textContent=view==='tasks'?'Dein nächster Schritt.':'Alles im Blick.';$('#list-title').textContent=view==='tasks'?'Anstehende Wiedervorlagen':'Deine Immobilien';render();});
$('#remove-photo').onclick=()=>{image='';$('#photo').value='';updatePhoto();};
$('#photo').onchange=async e=>{
 const file=e.target.files[0];if(!file)return;$('#form-error').textContent='';if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024){$('#form-error').textContent='Bitte JPG, PNG oder WebP mit maximal 10 MB auswählen.';e.target.value='';return;}
 loadingPhoto=true;$('#save').disabled=true;
 try{const bitmap=await createImageBitmap(file);const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);image=canvas.toDataURL('image/jpeg',.82);bitmap.close();updatePhoto();}catch{$('#form-error').textContent='Das Bild konnte nicht gelesen werden.';}finally{loadingPhoto=false;$('#save').disabled=false;}
};
$('#property-form').onsubmit=async e=>{e.preventDefault();if(loadingPhoto)return;$('#save').disabled=true;$('#form-error').textContent='';try{const data=Object.fromEntries(new FormData(e.target));data.image=image;const saved=await api(editing?'/'+editing:'',{method:editing?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});properties=properties.filter(p=>p.id!==saved.id);properties.unshift(saved);render();$('#editor').close();toast('Objekt gespeichert.');}catch(err){$('#form-error').textContent=err.message;}finally{$('#save').disabled=false;}};
$('#delete').onclick=async()=>{if(!confirm('Dieses Objekt mit Foto und Notizen endgültig löschen?'))return;try{await api('/'+editing,{method:'DELETE'});properties=properties.filter(p=>p.id!==editing);$('#editor').close();render();toast('Objekt gelöscht.');}catch(err){$('#form-error').textContent=err.message;}};
$('#export').onclick=()=>{const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),properties},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`akquise-sicherung-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('Sicherung mit Fotos heruntergeladen.');};
async function init(){try{properties=await api();render();}catch(err){$('#notice').textContent='Verbindung fehlgeschlagen. Bitte Seite neu laden. '+err.message;}}init();
