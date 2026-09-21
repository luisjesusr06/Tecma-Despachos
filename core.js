/* Tecma Despachos. Datos locales, importación y transacciones atómicas. */
'use strict';
window.Tecma = (() => {
  const db = new Dexie('TecmaDespachos_v1',{chromeTransactionDurability:'strict'});
  db.version(1).stores({loads:'id,status,createdAt',works:'id,loadId,[loadId+key]',products:'id,loadId,workId,[loadId+numero],[workId+numero]',accessories:'id,loadId,workId',events:'id,loadId,productId,at',meta:'key'});
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Array.from(crypto.getRandomValues(new Uint32Array(4)), x=>x.toString(36)).join('-')}`;
  const now = () => new Date().toISOString();
  const clean = v => String(v ?? '').trim();
  const plain = v => clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const normalizeNumber = v => clean(v).replace(/[\s*]/g,'').replace(/\.0$/,'');
  const natural = new Intl.Collator('es-CL',{numeric:true,sensitivity:'base'});
  const date = value => new Date(value).toLocaleDateString('es-CL');
  const time = value => value ? new Date(value).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}) : '—';
  const dateKey = value => {const d=new Date(value);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const workKey = (obra,op) => JSON.stringify([plain(obra).replace(/\s+/g,' '),plain(op)]);
  function parseCSV(text, filename='CSV') {
    text=String(text).replace(/^\uFEFF/,'');
    // Excel puede incluir una instrucción de separador en su primera línea.
    const sep=text.match(/^sep=([;,])\s*\r?\n/i); if(sep) text=text.slice(sep[0].length);
    const result=Papa.parse(text,{delimiter:sep?sep[1]:'',delimitersToGuess:[';',','],skipEmptyLines:'greedy',dynamicTyping:false});
    if(!result.data.length) throw new Error(`${filename}: el archivo está vacío.`);
    const fatal=result.errors.filter(e=>e.code!=='UndetectableDelimiter');
    if(fatal.length) throw new Error(`${filename}: no se pudo leer el CSV (fila ${(fatal[0].row??0)+1}). Revisa las comillas y vuelve a exportarlo desde Excel.`);
    const headers=result.data[0].map(clean);
    const rules={numero:h=>h.startsWith('numero'),op:h=>h.startsWith('nob')||h.startsWith('nobra'),obra:h=>h==='obra',orden:h=>h.startsWith('orden'),tipo:h=>h==='tipo',detalle:h=>h.startsWith('detalle'),subfamilia:h=>h.startsWith('sub'),familia:h=>h==='familia'};
    const columns={};
    for(const [field,test] of Object.entries(rules)) {
      const matches=headers.map((h,i)=>test(plain(h).replace(/[\s_°º-]/g,''))?i:-1).filter(i=>i>=0);
      if(matches.length>1) throw new Error(`${filename}: hay más de una columna para «${field}». Encabezados encontrados: ${headers.join(' · ')}`);
      columns[field]=matches[0]??-1;
    }
    const missing=['numero','obra','tipo','detalle'].filter(f=>columns[f]===-1);
    if(missing.length) throw new Error(`${filename}: falta ${missing.join(', ')}. Encabezados encontrados: ${headers.join(' · ')}`);
    const works=new Map(), seen=new Map(); let ignored=0,duplicates=0;
    for(let i=1;i<result.data.length;i++) {
      const row=result.data[i]; const get=f=>columns[f]>=0?clean(row[columns[f]]):'';
      const numero=normalizeNumber(get('numero')); if(!numero){ignored++;continue;}
      if(!/^\d{6}$/.test(numero)) throw new Error(`${filename}, fila ${i+1}: «${numero}» no es un código de 6 dígitos.`);
      if(row.length!==headers.length) throw new Error(`${filename}, fila ${i+1}: hay ${row.length} columnas y el encabezado tiene ${headers.length}. Revisa el separador y las comillas.`);
      const obra=get('obra'),op=get('op');
      if(!obra||!get('tipo')||!get('detalle')) throw new Error(`${filename}, fila ${i+1}: faltan datos de obra, tipo o detalle para el código ${numero}.`);
      const key=workKey(obra,op);
      if(!works.has(key))works.set(key,{key,obra,op,include:true,rutCliente:'',direccion:'',comuna:'',constructora:'',products:[]});
      const product={numero,orden:get('orden'),tipo:get('tipo'),detalle:get('detalle'),subfamilia:get('subfamilia'),familia:get('familia')};
      const group=works.get(key), productKey=JSON.stringify([key,numero]), existing=seen.get(productKey);
      if(existing) {
        if(JSON.stringify(existing)!==JSON.stringify(product))throw new Error(`${filename}: el código ${numero} está repetido con datos distintos dentro de ${obra}. Corrige el archivo antes de cargarlo.`);
        duplicates++;continue;
      }
      group.products.push(product);seen.set(productKey,product);
    }
    if(!works.size)throw new Error(`${filename}: no hay productos con número.`);
    return {works:[...works.values()],ignored,duplicates,delimiter:result.meta.delimiter};
  }
  async function readCSV(file){
    const buffer=await file.arrayBuffer();let text=new TextDecoder('utf-8').decode(buffer);
    if(text.includes('\uFFFD'))text=new TextDecoder('windows-1252').decode(buffer);
    return parseCSV(text,file.name);
  }
  function mergeDraft(draft,incoming){
    const output=structuredClone(draft);let repeated=0;
    for(const w of incoming){
      const existing=output.works.find(x=>x.key===w.key);
      if(!existing){output.works.push(w);continue;}
      const map=new Map(existing.products.map(p=>[p.numero,p]));
      for(const p of w.products){
        if(map.has(p.numero)){
          const prev=map.get(p.numero);
          if(['tipo','detalle','orden'].some(k=>prev[k]!==p[k]))throw new Error(`El código ${p.numero} tiene datos distintos en ${w.obra}. Revisa los archivos.`);
          repeated++;continue;
        }
        existing.products.push(p);map.set(p.numero,p);
      }
    }
    return {draft:output,repeated};
  }
  function conflicts(works){
    const map=new Map();
    for(const w of works.filter(x=>x.include!==false))for(const p of w.products){if(!map.has(p.numero))map.set(p.numero,new Set());map.get(p.numero).add(`${w.obra} · OP ${w.op||'sin OP'}`);}
    return [...map].filter(([,groups])=>groups.size>1).map(([numero,groups])=>({numero,works:[...groups]}));
  }
  async function assertOpen(loadId){const load=await db.loads.get(loadId);if(!load)throw new Error('Esta carga ya no existe.');if(load.status!=='open')throw new Error('La carga está cerrada. Reábrela para hacer cambios.');return load;}
  const txTables=[db.loads,db.works,db.products,db.accessories,db.events,db.meta];
  async function commitDraft(draft,loadId,savedDraftKey){
    return db.transaction('rw',txTables,async()=>{
      const selected=draft.works.filter(w=>w.include);if(!selected.length)throw new Error('Selecciona al menos una obra.');
      let load=loadId?await assertOpen(loadId):{id:uid(),createdAt:now(),status:'open',closedAt:null};
      Object.assign(load,{chofer:clean(draft.chofer),rutChofer:clean(draft.rutChofer),patente:clean(draft.patente),updatedAt:now()});
      await db.loads.put(load);let added=0,skipped=0;
      for(const group of selected){
        let work=await db.works.where('[loadId+key]').equals([load.id,group.key]).first();
        if(!work){work={id:uid(),loadId:load.id,key:group.key,obra:group.obra,op:group.op,rutCliente:clean(group.rutCliente),direccion:clean(group.direccion),comuna:clean(group.comuna),constructora:clean(group.constructora)};await db.works.add(work);}
        const existing=new Map((await db.products.where('workId').equals(work.id).toArray()).map(p=>[p.numero,p]));
        const rows=[];
        for(const p of group.products){if(existing.has(p.numero)){skipped++;continue;}const id=uid();rows.push({...p,id,workId:work.id,loadId:load.id,description:p.detalle,atril:'',status:'pendiente',reason:'',scannedAt:null,lastEvent:null,createdAt:now(),updatedAt:now()});added++;}
        if(rows.length)await db.products.bulkAdd(rows);
      }
      await db.events.add({id:uid(),loadId:load.id,at:now(),kind:'import',added,skipped});
      await db.meta.delete(savedDraftKey||(loadId?`draft:${loadId}`:'draft:new')); 
      return {loadId:load.id,added,skipped};
    });
  }
  async function loadData(loadId){const load=await db.loads.get(loadId);if(!load)throw new Error('No se encontró la carga.');const [works,products,accessories]=await Promise.all([db.works.where('loadId').equals(loadId).toArray(),db.products.where('loadId').equals(loadId).toArray(),db.accessories.where('loadId').equals(loadId).toArray()]);works.sort((a,b)=>natural.compare(a.obra,b.obra)||natural.compare(a.op,b.op));accessories.sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));return {load,works,products,accessories};}
  function counts(products){return {total:products.length,cargado:products.filter(p=>p.status==='cargado').length,pendiente:products.filter(p=>p.status==='pendiente').length,noEnviado:products.filter(p=>p.status==='no enviado').length};}
  const snapshot=p=>({status:p.status,reason:p.reason,scannedAt:p.scannedAt,description:p.description,atril:p.atril,lastEvent:p.lastEvent});
  async function changeProduct(id,patch,kind='edit',source='detalle'){
    return db.transaction('rw',db.loads,db.products,db.events,async()=>{
      const p=await db.products.get(id);if(!p)throw new Error('El producto ya no existe.');await assertOpen(p.loadId);
      if(!['pendiente','cargado','no enviado'].includes(patch.status))throw new Error('Estado no válido.');
      if(patch.status==='no enviado'&&!clean(patch.reason))throw new Error('Debes indicar el motivo.');
      const at=now(),eventId=uid(),before=snapshot(p);
      p.status=patch.status;p.reason=p.status==='no enviado'?clean(patch.reason):'';
      p.scannedAt=p.status==='cargado'?(before.status==='cargado'?p.scannedAt:at):null;
      if(patch.description!==undefined){if(!clean(patch.description))throw new Error('La descripción no puede quedar vacía.');p.description=clean(patch.description);}
      if(patch.atril!==undefined)p.atril=clean(patch.atril);
      p.updatedAt=at;p.lastEvent=eventId;
      await db.products.put(p);await db.events.add({id:eventId,loadId:p.loadId,productId:p.id,at,kind,source,before,after:snapshot(p),undone:false});
      return p;
    });
  }
  async function scanProduct(id,source,allowNoEnviado=false){
    return db.transaction('rw',db.loads,db.products,db.events,async()=>{
      const p=await db.products.get(id);if(!p)throw new Error('El producto ya no existe.');await assertOpen(p.loadId);
      if(p.status==='cargado'){await db.events.add({id:uid(),loadId:p.loadId,productId:id,at:now(),kind:'scan-duplicate',source,numero:p.numero});return {kind:'duplicate',product:p};}
      if(p.status==='no enviado'&&!allowNoEnviado){await db.events.add({id:uid(),loadId:p.loadId,productId:id,at:now(),kind:'scan-not-sent',source,numero:p.numero});return {kind:'not-sent',product:p};}
      return {kind:'success',product:await changeProduct(id,{status:'cargado'},'scan',source)};
    });
  }
  async function logScan(loadId,numero,kind,source){return db.transaction('rw',db.loads,db.events,async()=>{await assertOpen(loadId);await db.events.add({id:uid(),loadId,numero,kind,source,at:now()});});}
  async function undoScan(loadId){
    return db.transaction('rw',db.loads,db.products,db.events,async()=>{
      await assertOpen(loadId);
      const events=(await db.events.where('loadId').equals(loadId).toArray()).filter(e=>e.kind==='scan'&&!e.undone).sort((a,b)=>b.at.localeCompare(a.at));
      for(const e of events){
        const p=await db.products.get(e.productId);if(!p||p.lastEvent!==e.id)continue;
        const before=snapshot(p),id=uid();Object.assign(p,snapshot(e.before),{updatedAt:now()});await db.products.put(p);
        await db.events.update(e.id,{undone:true});await db.events.add({id,loadId,productId:p.id,kind:'undo',at:now(),before,after:snapshot(p),undoes:e.id});return p;
      }
      throw new Error('No quedan escaneos que se puedan deshacer. Los productos editados después se conservan.');
    });
  }
  async function saveAccessory(row){
    return db.transaction('rw',db.loads,db.works,db.accessories,db.events,async()=>{
      await assertOpen(row.loadId);const work=await db.works.get(row.workId);if(!work||work.loadId!==row.loadId)throw new Error('Selecciona una obra de esta carga.');
      const quantity=Number(String(row.quantity).replace(',','.'));
      if(!Number.isFinite(quantity)||quantity<=0)throw new Error('La cantidad debe ser mayor que cero.');
      if(!clean(row.description)||!clean(row.unit))throw new Error('Completa descripción y unidad.');
      const old=row.id?await db.accessories.get(row.id):null;
      if(old&&old.loadId!==row.loadId)throw new Error('El accesorio no corresponde a esta carga.');
      const a={id:old?.id||uid(),loadId:row.loadId,workId:row.workId,description:clean(row.description),quantity,unit:clean(row.unit).toUpperCase(),atril:clean(row.atril),createdAt:old?.createdAt||now(),updatedAt:now()};
      await db.accessories.put(a);await db.events.add({id:uid(),loadId:row.loadId,at:now(),kind:old?'accessory-edit':'accessory-add',accessoryId:a.id,before:old,after:a});return a;
    });
  }
  async function deleteAccessory(id){return db.transaction('rw',db.loads,db.accessories,db.events,async()=>{const a=await db.accessories.get(id);if(!a)return;await assertOpen(a.loadId);await db.accessories.delete(id);await db.events.add({id:uid(),loadId:a.loadId,at:now(),kind:'accessory-delete',accessoryId:id,before:a});});}
  async function setClosed(loadId,closed){return db.transaction('rw',db.loads,db.events,async()=>{const l=await db.loads.get(loadId);if(!l)throw new Error('No se encontró la carga.');const at=now();await db.loads.update(loadId,{status:closed?'closed':'open',closedAt:closed?at:null,updatedAt:at});await db.events.add({id:uid(),loadId,at,kind:closed?'close':'reopen'});});}
  async function deleteLoad(id){return db.transaction('rw',txTables,async()=>{for(const table of [db.works,db.products,db.accessories,db.events])await table.where('loadId').equals(id).delete();await db.loads.delete(id);await db.meta.delete(`draft:${id}`);});}
  async function backup(){return db.transaction('r',txTables,async()=>({app:'tecma-despachos',version:1,exportedAt:now(),loads:await db.loads.toArray(),works:await db.works.toArray(),products:await db.products.toArray(),accessories:await db.accessories.toArray(),events:await db.events.toArray(),drafts:await db.meta.toArray()}));}
  function validateBackup(b){
    const fail=()=>{throw new Error('El respaldo no es válido o está incompleto. No se cambió ningún dato.');};
    if(!b||b.app!=='tecma-despachos'||b.version!==1)fail();
    for(const name of ['loads','works','products','accessories','events']){if(!Array.isArray(b[name]))fail();const ids=new Set();for(const row of b[name]){if(!row||typeof row.id!=='string'||!row.id||ids.has(row.id))fail();ids.add(row.id);}}
    const validDate=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
    const strings=(o,keys)=>keys.every(k=>typeof o[k]==='string');
    const loads=new Map(b.loads.map(l=>[l.id,l])),works=new Map(b.works.map(w=>[w.id,w])),products=new Map(b.products.map(p=>[p.id,p]));
    for(const l of b.loads)if(!['open','closed'].includes(l.status)||!validDate(l.createdAt)||!strings(l,['chofer','rutChofer','patente'])||(l.closedAt&&!validDate(l.closedAt)))fail();
    const wKeys=new Set();for(const w of b.works){const key=JSON.stringify([w.loadId,workKey(w.obra,w.op)]);if(!loads.has(w.loadId)||!strings(w,['obra','op','key','rutCliente','direccion','comuna','constructora'])||!w.obra||wKeys.has(key))fail();wKeys.add(key);}
    const codes=new Set();
    for(const p of b.products){const key=JSON.stringify([p.workId,p.numero]);if(!loads.has(p.loadId)||works.get(p.workId)?.loadId!==p.loadId||!/^\d{6}$/.test(p.numero)||!strings(p,['numero','tipo','detalle','description','orden','atril','reason','familia','subfamilia'])||!p.description||codes.has(key)||!['pendiente','cargado','no enviado'].includes(p.status)||(p.status==='no enviado'&&!p.reason)||(p.status==='cargado'&&!validDate(p.scannedAt))||!validDate(p.createdAt))fail();codes.add(key);}
    for(const a of b.accessories)if(!loads.has(a.loadId)||works.get(a.workId)?.loadId!==a.loadId||!strings(a,['description','unit','atril'])||!a.description||!a.unit||typeof a.quantity!=='number'||!Number.isFinite(a.quantity)||a.quantity<=0||!validDate(a.createdAt))fail();
    for(const e of b.events){if(!loads.has(e.loadId)||!validDate(e.at)||typeof e.kind!=='string'||(e.productId&&products.get(e.productId)?.loadId!==e.loadId))fail();if(e.kind==='scan'){if(!e.before||!['pendiente','no enviado'].includes(e.before.status)||!strings(e.before,['reason','description','atril'])||(e.before.status==='no enviado'&&!e.before.reason))fail();}}
    if(b.drafts!==undefined){
      if(!Array.isArray(b.drafts))fail();
      for(const entry of b.drafts){
        const d=entry?.value;
        if(typeof entry?.key!=='string'||!entry.key.startsWith('draft:')||!d||!Array.isArray(d.works)||!Array.isArray(d.files)||!d.files.every(x=>typeof x==='string')||!strings(d,['chofer','rutChofer','patente']))fail();
        for(const w of d.works){
          if(!strings(w,['key','obra','op','rutCliente','direccion','comuna','constructora'])||typeof w.include!=='boolean'||!Array.isArray(w.products))fail();
          const seen=new Set();for(const p of w.products){if(!strings(p,['numero','tipo','detalle','orden','familia','subfamilia'])||!/^\d{6}$/.test(p.numero)||seen.has(p.numero))fail();seen.add(p.numero);}
        }
      }
    }
    return b;
  }
  async function restoreBackup(input){
    const b=validateBackup(input),maps={};for(const name of ['loads','works','products','accessories','events'])maps[name]=new Map(b[name].map(r=>[r.id,uid()]));
    const remap=r=>{if(!r||typeof r!=='object')return r;if(Array.isArray(r))return r.map(remap);const out={};for(const[k,v]of Object.entries(r)){if(['__proto__','constructor','prototype'].includes(k))continue;const table={loadId:'loads',workId:'works',productId:'products',accessoryId:'accessories',lastEvent:'events',undoes:'events'}[k];out[k]=table?(maps[table].get(v)||null):remap(v);}return out;};
    await db.transaction('rw',txTables,async()=>{for(const name of ['loads','works','products','accessories','events']){const rows=b[name].map(r=>({...remap(r),id:maps[name].get(r.id)}));if(rows.length)await db[name].bulkAdd(rows);}
      for(const entry of b.drafts||[]){
        const oldLoad=entry.key.slice(6),mappedLoad=maps.loads.get(oldLoad);
        await db.meta.put({key:mappedLoad?`draft:${mappedLoad}`:`draft:recovered:${uid()}`,value:remap(entry.value)});
      }
    });
    return b.loads.length;
  }
  return {db,uid,now,clean,plain,normalizeNumber,natural,date,time,dateKey,esc,workKey,parseCSV,readCSV,mergeDraft,conflicts,assertOpen,commitDraft,loadData,counts,changeProduct,scanProduct,logScan,undoScan,saveAccessory,deleteAccessory,setClosed,deleteLoad,backup,validateBackup,restoreBackup};
})();
