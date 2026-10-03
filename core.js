/* Tecma Despachos. Datos locales, importación y transacciones atómicas. */
'use strict';
window.Tecma = (() => {
  const db = new Dexie('TecmaDespachos_v1',{chromeTransactionDurability:'strict'});
  db.version(1).stores({loads:'id,status,createdAt',works:'id,loadId,[loadId+key]',products:'id,loadId,workId,[loadId+numero],[workId+numero]',accessories:'id,loadId,workId',events:'id,loadId,productId,at',meta:'key'});
  // La versión 1 y el nombre de base se conservan para actualizar in situ.
  db.version(2).stores({loads:'id,status,createdAt',works:'id,loadId,[loadId+key]',products:'id,loadId,workId,numero,[loadId+numero],[workId+numero]',accessories:'id,loadId,workId',events:'id,loadId,productId,at',meta:'key'}).upgrade(async tx=>{
    await tx.table('products').toCollection().modify(migrateProduct);
    await tx.table('events').toCollection().modify(event=>{
      for(const k of ['before','after']) if(event[k]?.status==='no enviado') migrateProduct(event[k]);
    });
  });
  function migrateProduct(p){
    if(p.status==='no enviado') {p.status='pendiente';p.note=[p.note,p.reason].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(' · ');p.reason='';}
    p.note=p.note||'';
    return p;
  }
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
        if(JSON.stringify({...existing,raw:undefined})!==JSON.stringify(product))throw new Error(`${filename}: el código ${numero} está repetido con datos distintos dentro de ${obra}. Corrige el archivo antes de cargarlo.`);
        duplicates++;continue;
      }
      product.raw=row.slice();group.products.push(product);seen.set(productKey,product);
    }
    if(!works.size)throw new Error(`${filename}: no hay productos con número.`);
    return {works:[...works.values()],ignored,duplicates,delimiter:result.meta.delimiter,headers,columns,bom:String(arguments[0]).startsWith('\uFEFF'),newline:result.meta.linebreak||'\r\n',sepLine:!!sep};
  }
  async function readCSV(file){
    const buffer=await file.arrayBuffer();let text=new TextDecoder('utf-8').decode(buffer);
    if(text.includes('\uFFFD'))text=new TextDecoder('windows-1252').decode(buffer);
    return parseCSV(text,file.name);
  }
  async function assertOpen(loadId){const load=await db.loads.get(loadId);if(!load)throw new Error('Esta carga ya no existe.');if(load.status!=='open'){await db.loads.update(loadId,{status:'open',closedAt:null,updatedAt:now()});load.status='open';load.closedAt=null;}return load;}
  const txTables=[db.loads,db.works,db.products,db.accessories,db.events,db.meta];
  const obraKey=v=>plain(v).replace(/\s+/g,' ');
  const localDate=v=>new Date(/^\d{4}-\d{2}-\d{2}$/.test(v||'')?v+'T12:00:00':v||now());
  function ofis(products){return [...new Set(products.map(p=>clean(p.orden).replace(/^OFI?\s*/i,'')).filter(Boolean))].sort(natural.compare);}
  function ofiLabel(products){
    const values=ofis(products);if(!values.length)return 'OFI sin indicar';
    const shown=values.length>3?values.slice(0,2):values;
    const consecutive=shown.length>1&&shown.every((v,i)=>/^\d+$/.test(v)&&(!i||Number(v)===Number(shown[i-1])+1));
    return 'OFI '+(consecutive?shown[0]+'-'+shown.at(-1):shown.join(', '))+(values.length>3?' +'+(values.length-2)+' más':'');
  }
  function loadName(load,works=[],products=[]){
    const d=localDate(load.scheduledDate||load.createdAt),week=['dom','lun','mar','mié','jue','vie','sáb'][d.getDay()];
    return `${works.map(w=>w.obra).filter((v,i,a)=>a.indexOf(v)===i).join(' / ')||'Sin obra'} · ${ofiLabel(products)} · ${week} ${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }
  function firstWork(parsed){
    const first=parsed.works[0];if(!first)return null;
    const same=parsed.works.filter(w=>obraKey(w.obra)===obraKey(first.obra)),codes=new Set();
    return {...first,op:[...new Set(same.map(w=>w.op).filter(Boolean))].join(', '),include:true,products:same.flatMap(w=>w.products.map(p=>({...p,op:p.op||w.op}))).filter(p=>{if(codes.has(p.numero))return false;codes.add(p.numero);return true;})};
  }
  async function carryCandidates(obra){
    const closed=new Map((await db.loads.where('status').equals('closed').toArray()).map(l=>[l.id,l]));
    const works=(await db.works.toArray()).filter(w=>closed.has(w.loadId)&&obraKey(w.obra)===obraKey(obra));
    const all=await db.products.toArray();
    return works.map(w=>({work:w,load:closed.get(w.loadId),products:all.filter(p=>p.workId===w.id&&['pendiente','devuelto'].includes(p.status))})).filter(g=>g.products.length).map(g=>({...g,name:loadName(g.load,[g.work],all.filter(p=>p.workId===g.work.id))}));
  }
  async function commitDraft(draft,loadId,savedDraftKey){
    return db.transaction('rw',txTables,async()=>{
      // Nuevas cargas: una obra. Las cargas antiguas se conservan completas.
      const group=firstWork({works:draft.works})||{obra:'Sin obra',op:'',products:[]};
      let load=loadId?await assertOpen(loadId):{id:uid(),createdAt:now(),status:'open',closedAt:null};
      Object.assign(load,{chofer:clean(draft.chofer),rutChofer:clean(draft.rutChofer),patente:clean(draft.patente),scheduledDate:clean(draft.scheduledDate),label:clean(draft.label),updatedAt:now(),csvFormat:draft.csvFormat||null});
      await db.loads.put(load);
      let work=loadId?await db.works.where('loadId').equals(load.id).first():null;
      if(!work){work={id:uid(),loadId:load.id,key:workKey(group.obra,group.op),obra:group.obra,op:group.op,rutCliente:clean(group.rutCliente),direccion:clean(group.direccion),comuna:clean(group.comuna),constructora:clean(group.constructora)};await db.works.add(work);}
      const existing=new Map((await db.products.where('loadId').equals(load.id).toArray()).map(p=>[p.numero,p]));
      let added=0,skipped=0;
      for(const p of group.products){
        if(existing.has(p.numero)){skipped++;continue;}
        const row={...p,id:uid(),workId:work.id,loadId:load.id,description:p.detalle,atril:'',status:'pendiente',reason:'',note:'',scannedAt:null,lastEvent:null,createdAt:now(),updatedAt:now()};
        await db.products.add(row);existing.set(row.numero,row);added++;
      }
      for(const id of new Set(draft.carryIds||[])){
        const old=await db.products.get(id);if(!old||!['pendiente','devuelto'].includes(old.status))continue;
        const oldLoad=await db.loads.get(old.loadId),oldWork=await db.works.get(old.workId);
        if(oldLoad?.status!=='closed'||obraKey(oldWork?.obra)!==obraKey(work.obra))continue;
        const sourceProducts=await db.products.where('loadId').equals(old.loadId).toArray();
        const origin={loadId:old.loadId,productId:old.id,name:loadName(oldLoad,[oldWork],sourceProducts),at:now()};
        let row=existing.get(old.numero);
        if(row){row={...row,note:[row.note,old.note].filter(Boolean).join(' · '),carryFrom:[...(row.carryFrom||[]),origin]};await db.products.put(row);}
        else {row={...old,id:uid(),loadId:load.id,workId:work.id,status:'pendiente',scannedAt:null,returnedAt:null,transferredTo:null,lastEvent:null,carryFrom:[origin],createdAt:now(),updatedAt:now()};await db.products.add(row);added++;}
        existing.set(row.numero,row);
        await db.products.update(old.id,{status:'trasladado',transferredTo:{loadId:load.id,productId:row.id},updatedAt:now()});
        await db.events.add({id:uid(),loadId:old.loadId,productId:old.id,kind:'transfer',at:now(),toLoadId:load.id,before:snapshot(old),after:{status:'trasladado'}});
      }
      load.name=loadName(load,[work],[...existing.values()]);await db.loads.put(load);
      // Conservamos también el nombre de destino si más adelante se elimina su carga.
      for(const id of draft.carryIds||[]){const old=await db.products.get(id);if(old?.transferredTo?.loadId===load.id)await db.products.update(id,{'transferredTo.name':load.name});}
      await db.events.add({id:uid(),loadId:load.id,at:now(),kind:'import',added,skipped});
      await db.meta.delete(savedDraftKey||(loadId?`draft:${loadId}`:'draft:new'));
      return {loadId:load.id,added,skipped};
    });
  }
  async function loadData(loadId){const load=await db.loads.get(loadId);if(!load)throw new Error('No se encontró la carga.');const [works,products,accessories]=await Promise.all([db.works.where('loadId').equals(loadId).toArray(),db.products.where('loadId').equals(loadId).toArray(),db.accessories.where('loadId').equals(loadId).toArray()]);works.sort((a,b)=>natural.compare(a.obra,b.obra)||natural.compare(a.op,b.op));accessories.sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));load.name=loadName(load,works,products);return {load,works,products,accessories};}
  function counts(products){return {total:products.filter(p=>p.status!=='trasladado').length,cargado:products.filter(p=>p.status==='cargado').length,pendiente:products.filter(p=>p.status==='pendiente').length,devuelto:products.filter(p=>p.status==='devuelto').length,trasladado:products.filter(p=>p.status==='trasladado').length};}
  const snapshot=p=>({status:p.status,reason:p.reason||'',note:p.note||'',scannedAt:p.scannedAt,returnedAt:p.returnedAt||null,description:p.description,atril:p.atril,lastEvent:p.lastEvent});
  async function changeProduct(id,patch,kind='edit',source='detalle'){
    return db.transaction('rw',db.loads,db.products,db.events,async()=>{
      const p=await db.products.get(id);if(!p)throw new Error('El producto ya no existe.');
      const load=await db.loads.get(p.loadId);if(!load)throw new Error('La carga ya no existe.');
      const at=now(),eventId=uid(),before=snapshot(p);
      if(patch.status&&['pendiente','cargado'].includes(patch.status)){
        p.status=patch.status;p.scannedAt=p.status==='cargado'?(before.status==='cargado'?p.scannedAt:at):null;
        if(load.status==='closed'&&p.status!==before.status)await db.loads.update(load.id,{status:'open',closedAt:null,updatedAt:at});
      }
      if(patch.description!==undefined)p.description=clean(patch.description)||p.detalle||`Código ${p.numero}`;
      if(patch.atril!==undefined)p.atril=clean(patch.atril);
      if(patch.note!==undefined)p.note=clean(patch.note);
      p.reason='';p.updatedAt=at;p.lastEvent=eventId;
      await db.products.put(p);await db.events.add({id:eventId,loadId:p.loadId,productId:p.id,at,kind,source,before,after:snapshot(p),undone:false});return p;
    });
  }
  async function previousDispatch(p){
    const matches=await db.products.where('numero').equals(p.numero).toArray(),found=[];
    for(const old of matches){if(old.loadId===p.loadId||old.status!=='cargado')continue;const l=await db.loads.get(old.loadId);if(l?.status==='closed')found.push({load:l,date:l.closedAt||old.scannedAt});}
    const latest=found.sort((a,b)=>b.date.localeCompare(a.date))[0];if(!latest)return null;
    const l=latest.load;let name=l.name;
    if(!name){const works=await db.works.where('loadId').equals(l.id).toArray(),products=await db.products.where('loadId').equals(l.id).toArray();name=loadName(l,works,products);}
    return {id:l.id,name,date:latest.date};
  }
  async function scanProduct(id,source){
    return db.transaction('rw',db.loads,db.works,db.products,db.events,async()=>{
      const p=await db.products.get(id);if(!p)throw new Error('El producto ya no existe.');
      if(p.status==='cargado'){await db.events.add({id:uid(),loadId:p.loadId,productId:id,at:now(),kind:'scan-duplicate',source,numero:p.numero});return {kind:'duplicate',product:p};}
      const previous=await previousDispatch(p);
      return {kind:previous?'previous':'success',previous,product:await changeProduct(id,{status:'cargado'},'scan',source)};
    });
  }
  async function scanUnknown(loadId,numero,source){
    return db.transaction('rw',db.loads,db.works,db.products,db.events,async()=>{
      const existing=await db.products.where('[loadId+numero]').equals([loadId,numero]).first();if(existing)return scanProduct(existing.id,source);
      const work=await db.works.where('loadId').equals(loadId).first();
      const p={id:uid(),loadId,workId:work.id,numero,tipo:'SIN IDENTIFICAR',detalle:`Código ${numero}`,description:`Código ${numero}`,orden:'',familia:'',subfamilia:'',atril:'',reason:'',note:'',unknown:true,status:'pendiente',scannedAt:null,lastEvent:null,createdAt:now(),updatedAt:now()};
      await db.products.add(p);return {kind:'unknown',product:await changeProduct(p.id,{status:'cargado'},'scan',source)};
    });
  }
  async function returnProduct(id,at=now(),source='lista'){
    return db.transaction('rw',db.loads,db.products,db.events,async()=>{
      const p=await db.products.get(id);if(!p)throw new Error('Producto no encontrado.');
      if(p.status==='devuelto')return {kind:'duplicate',product:p};
      const before=snapshot(p),eventId=uid();Object.assign(p,{status:'devuelto',returnedAt:at,updatedAt:now(),lastEvent:eventId});
      await db.products.put(p);await db.events.add({id:eventId,loadId:p.loadId,productId:p.id,at,kind:'return',source,before,after:snapshot(p)});
      return {kind:'success',product:p};
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
      // Campos vacíos usan valores útiles; los PDF no dependen de completar formularios.
      
      const old=row.id?await db.accessories.get(row.id):null;
      if(old&&old.loadId!==row.loadId)throw new Error('El accesorio no corresponde a esta carga.');
      const a={id:old?.id||uid(),loadId:row.loadId,workId:row.workId,description:clean(row.description)||'Accesorio',quantity:Number.isFinite(quantity)&&quantity>0?quantity:1,unit:clean(row.unit).toUpperCase()||'UNI',atril:clean(row.atril),createdAt:old?.createdAt||now(),updatedAt:now()};
      await db.accessories.put(a);await db.events.add({id:uid(),loadId:row.loadId,at:now(),kind:old?'accessory-edit':'accessory-add',accessoryId:a.id,before:old,after:a});return a;
    });
  }
  async function deleteAccessory(id){return db.transaction('rw',db.loads,db.accessories,db.events,async()=>{const a=await db.accessories.get(id);if(!a)return;await assertOpen(a.loadId);await db.accessories.delete(id);await db.events.add({id:uid(),loadId:a.loadId,at:now(),kind:'accessory-delete',accessoryId:id,before:a});});}
  async function setClosed(loadId,closed){return db.transaction('rw',db.loads,db.events,async()=>{const l=await db.loads.get(loadId);if(!l)throw new Error('No se encontró la carga.');const at=now();await db.loads.update(loadId,{status:closed?'closed':'open',closedAt:closed?at:null,updatedAt:at});await db.events.add({id:uid(),loadId,at,kind:closed?'close':'reopen'});});}
  async function deleteLoad(id){return db.transaction('rw',txTables,async()=>{for(const table of [db.works,db.products,db.accessories,db.events])await table.where('loadId').equals(id).delete();await db.loads.delete(id);await db.meta.delete(`draft:${id}`);});}
  async function backup(){const local=await db.transaction('r',txTables,async()=>({app:'tecma-despachos',version:2,exportedAt:now(),loads:await db.loads.toArray(),works:await db.works.toArray(),products:await db.products.toArray(),accessories:await db.accessories.toArray(),events:await db.events.toArray(),drafts:(await db.meta.toArray()).filter(x=>x.key.startsWith('draft:'))}));local.control=window.TecmaControl?await TecmaControl.backup():null;return local;}
  function validateBackup(b){
    const fail=()=>{throw new Error('El respaldo no es válido o está incompleto. No se cambió ningún dato.');};
    if(!b||b.app!=='tecma-despachos'||![1,2].includes(b.version))fail();
    for(const name of ['loads','works','products','accessories','events']){if(!Array.isArray(b[name]))fail();const ids=new Set();for(const row of b[name]){if(!row||typeof row.id!=='string'||!row.id||ids.has(row.id))fail();ids.add(row.id);}}
    const validDate=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
    const strings=(o,keys)=>keys.every(k=>typeof o[k]==='string');
    const loads=new Map(b.loads.map(l=>[l.id,l])),works=new Map(b.works.map(w=>[w.id,w])),products=new Map(b.products.map(p=>[p.id,p]));
    for(const l of b.loads)if(!['open','closed'].includes(l.status)||!validDate(l.createdAt)||!strings(l,['chofer','rutChofer','patente'])||(l.closedAt&&!validDate(l.closedAt)))fail();
    const wKeys=new Set();for(const w of b.works){const key=JSON.stringify([w.loadId,workKey(w.obra,w.op)]);if(!loads.has(w.loadId)||!strings(w,['obra','op','key','rutCliente','direccion','comuna','constructora'])||!w.obra||wKeys.has(key))fail();wKeys.add(key);}
    const codes=new Set();
    for(const p of b.products){const key=JSON.stringify([p.workId,p.numero]);if(!loads.has(p.loadId)||works.get(p.workId)?.loadId!==p.loadId||!/^\d{6}$/.test(p.numero)||!strings(p,['numero','tipo','detalle','description','orden','atril','reason','familia','subfamilia'])||!p.description||codes.has(key)||!['pendiente','cargado','no enviado','devuelto','trasladado'].includes(p.status)||(p.status==='no enviado'&&!p.reason)||(p.status==='cargado'&&!validDate(p.scannedAt))||!validDate(p.createdAt))fail();codes.add(key);}
    for(const a of b.accessories)if(!loads.has(a.loadId)||works.get(a.workId)?.loadId!==a.loadId||!strings(a,['description','unit','atril'])||!a.description||!a.unit||typeof a.quantity!=='number'||!Number.isFinite(a.quantity)||a.quantity<=0||!validDate(a.createdAt))fail();
    for(const e of b.events){if(!loads.has(e.loadId)||!validDate(e.at)||typeof e.kind!=='string'||(e.productId&&products.get(e.productId)?.loadId!==e.loadId))fail();if(e.kind==='scan'){if(!e.before||!['pendiente','no enviado','devuelto','trasladado'].includes(e.before.status)||!strings(e.before,['reason','description','atril'])||(e.before.status==='no enviado'&&!e.before.reason))fail();}}
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
    const b=validateBackup(structuredClone(input)),maps={};for(const p of b.products)migrateProduct(p);for(const ev of b.events)for(const k of ['before','after'])if(ev[k]?.status==='no enviado')migrateProduct(ev[k]);if(b.control&&window.TecmaControl)TecmaControl.validateBackup(b.control);for(const name of ['loads','works','products','accessories','events'])maps[name]=new Map(b[name].map(r=>[r.id,uid()]));
    const remap=r=>{if(!r||typeof r!=='object')return r;if(Array.isArray(r))return r.map(remap);const out={};for(const[k,v]of Object.entries(r)){if(['__proto__','constructor','prototype'].includes(k))continue;const table={loadId:'loads',workId:'works',productId:'products',accessoryId:'accessories',lastEvent:'events',undoes:'events',toLoadId:'loads'}[k];out[k]=table?(maps[table].get(v)||null):remap(v);}return out;};
    const controlCopy=b.control&&window.TecmaControl?await TecmaControl.restoreBackup(b.control):null;
    try{await db.transaction('rw',txTables,async()=>{for(const name of ['loads','works','products','accessories','events']){const rows=b[name].map(r=>({...remap(r),...(name==='loads'?{sourceId:r.sourceId||r.id}:{}),id:maps[name].get(r.id)}));if(rows.length)await db[name].bulkAdd(rows);}
      for(const entry of b.drafts||[]){
        const oldLoad=entry.key.slice(6),mappedLoad=maps.loads.get(oldLoad);
        await db.meta.put({key:mappedLoad?`draft:${mappedLoad}`:`draft:recovered:${uid()}`,value:remap(entry.value)});
      }
    });
    }catch(err){if(controlCopy)await TecmaControl.removeRestored(controlCopy);throw err;}
    return b.loads.length;
  }
  return {db,migrateProduct,obraKey,localDate,ofis,ofiLabel,loadName,firstWork,carryCandidates,previousDispatch,returnProduct,scanUnknown,uid,now,clean,plain,normalizeNumber,natural,date,time,dateKey,esc,workKey,parseCSV,readCSV,assertOpen,commitDraft,loadData,counts,changeProduct,scanProduct,logScan,undoScan,saveAccessory,deleteAccessory,setClosed,deleteLoad,backup,validateBackup,restoreBackup};
})();
