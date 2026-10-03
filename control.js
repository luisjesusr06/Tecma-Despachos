/* Control de obras: base local independiente de las cargas del teléfono. */
'use strict';
window.TecmaControl=(()=>{
  const T=Tecma,db=new Dexie('TecmaControl_v1',{chromeTransactionDurability:'strict'});
  db.version(1).stores({projects:'id,key,createdAt',products:'id,projectId,[projectId+numero]',events:'id,projectId,productId,at,[projectId+sourceKey]',accessories:'id,projectId,[projectId+sourceKey]'});
  const tables=[db.projects,db.products,db.events,db.accessories];
  const statuses=['pendiente en fábrica','en obra','devuelto'];
  async function createProject(parsed){
    const w=T.firstWork(parsed);if(!w)throw new Error('No se encontraron productos.');
    const project={id:T.uid(),key:T.obraKey(w.obra),obra:w.obra,op:w.op,createdAt:T.now(),format:{headers:parsed.headers,columns:parsed.columns,delimiter:parsed.delimiter,newline:parsed.newline,bom:parsed.bom,sepLine:parsed.sepLine}};
    await db.transaction('rw',tables,async()=>{
      await db.projects.add(project);
      await db.products.bulkAdd(w.products.map(p=>({...p,id:T.uid(),projectId:project.id,description:p.detalle,note:'',status:'pendiente en fábrica',dispatchDate:null,returnedAt:null,createdAt:T.now()})));
    });return project;
  }
  async function data(id){const project=await db.projects.get(id);if(!project)throw new Error('No se encontró la obra.');const [products,events,accessories]=await Promise.all([db.products.where('projectId').equals(id).toArray(),db.events.where('projectId').equals(id).toArray(),db.accessories.where('projectId').equals(id).toArray()]);return {project,products,events,accessories};}
  // Recalcular cronológicamente permite importar cierres fuera de orden sin alterar el saldo final.
  async function recompute(productId){
    const p=await db.products.get(productId),events=(await db.events.where('productId').equals(productId).toArray()).sort((a,b)=>a.at.localeCompare(b.at)||Number(a.kind==='return')-Number(b.kind==='return')||a.id.localeCompare(b.id));
    let status='pendiente en fábrica',dispatchDate=null,returnedAt=null;
    for(const event of events){
      const reconciled=event.kind==='dispatch'&&status==='en obra';
      if(event.kind==='dispatch'){status='en obra';dispatchDate=event.at;returnedAt=null;}
      if(event.kind==='return'){status='devuelto';returnedAt=event.at;}
      if(event.reconciled!==reconciled)await db.events.update(event.id,{reconciled});
    }
    await db.products.update(p.id,{status,dispatchDate,returnedAt});
  }
  async function addEvent(row){
    if(row.sourceKey&&await db.events.where('[projectId+sourceKey]').equals([row.projectId,row.sourceKey]).count())return false;
    await db.events.add({id:T.uid(),...row});return true;
  }
  function validateClosure(c){
    if(c?.app!=='tecma-despachos-cierre'||c.version!==1||!c.load?.id||!Array.isArray(c.works)||!Array.isArray(c.products)||!Array.isArray(c.accessories))throw new Error('Selecciona un archivo JSON de cierre de Tecma.');
    if(c.load.status!=='closed')throw new Error('Este archivo no corresponde a una carga cerrada.');
    const works=new Set(c.works.map(w=>w.id)),numbers=new Set();
    for(const p of c.products){const key=p.workId+':'+p.numero;if(!/^\d{6}$/.test(p.numero)||!works.has(p.workId)||numbers.has(key)||!['pendiente','cargado','devuelto','trasladado'].includes(p.status)||p.scannedAt&&!Number.isFinite(Date.parse(p.scannedAt))||p.returnedAt&&!Number.isFinite(Date.parse(p.returnedAt)))throw new Error('El cierre contiene productos incompletos.');numbers.add(key);}
    for(const a of c.accessories)if(!works.has(a.workId)||!Number.isFinite(a.quantity)||a.quantity<=0)throw new Error('El cierre contiene accesorios incompletos.');
    return c;
  }
  async function importClosure(projectId,input){
    const c=validateClosure(input),project=await db.projects.get(projectId);
    const works=new Map(c.works.filter(w=>T.obraKey(w.obra)===project.key).map(w=>[w.id,w]));
    if(!works.size)throw new Error(`El cierre es de otra obra. Obra abierta: ${project.obra}.`);
    const origin=c.load.sourceId||c.load.id;let added=0,ignored=0;
    await db.transaction('rw',tables,async()=>{
      for(const source of c.products.filter(p=>works.has(p.workId))){
        // Un pendiente nunca revierte un despacho existente.
        if(!source.scannedAt&&!source.returnedAt){ignored++;continue;}
        let p=await db.products.where('[projectId+numero]').equals([projectId,source.numero]).first();
        if(!p){p={...source,id:T.uid(),projectId,op:source.op||works.get(source.workId).op,status:'pendiente en fábrica',dispatchDate:null};delete p.loadId;delete p.workId;await db.products.add(p);}
        const shared={projectId,productId:p.id,sourceLoad:origin,loadName:c.load.name||c.works[0].obra,description:source.description};
        if(source.scannedAt)added+=Number(await addEvent({...shared,kind:'dispatch',at:source.scannedAt,sourceKey:`${origin}:${source.numero}:dispatch:${source.scannedAt}`}));
        if(source.returnedAt)added+=Number(await addEvent({...shared,kind:'return',at:source.returnedAt,sourceKey:`${origin}:${source.numero}:return:${source.returnedAt}`}));
        const notesByLoad={...(p.notesByLoad||{}),[origin]:T.clean(source.note)};await db.products.update(p.id,{notesByLoad,note:[...new Set(Object.values(notesByLoad).filter(Boolean))].join(' · ')});
        await recompute(p.id);
      }
      for(const a of c.accessories.filter(a=>works.has(a.workId))){
        const sourceKey=`${origin}:accessory:${a.id}`;
        const old=await db.accessories.where('[projectId+sourceKey]').equals([projectId,sourceKey]).first();
        await db.accessories.put({...a,id:old?.id||T.uid(),projectId,sourceKey,at:c.load.closedAt||c.exportedAt,kind:'dispatch',loadName:c.load.name});
      }
    });return {added,ignored};
  }
  async function mark(projectId,ids,kind,day,note=''){
    const at=day?T.localDate(day).toISOString():T.now();let n=0;
    await db.transaction('rw',tables,async()=>{for(const id of new Set(ids)){
      const p=await db.products.get(id);if(!p||p.projectId!==projectId)continue;
      await addEvent({projectId,productId:id,kind,at,source:'manual',note,sourceKey:T.uid()});await recompute(id);n++;
    }});return n;
  }
  async function markNumbers(projectId,text,kind,day){
    const nums=[...new Set(text.split(/[\s,;]+/).map(T.normalizeNumber).filter(Boolean))];
    const rows=await db.products.where('projectId').equals(projectId).toArray(),map=new Map(rows.map(p=>[p.numero,p]));
    const found=nums.filter(n=>map.has(n));await mark(projectId,found.map(n=>map.get(n).id),kind,day);return {count:found.length,missing:nums.filter(n=>!map.has(n))};
  }
  async function accessory(projectId,row){
    const q=Number(String(row.quantity||1).replace(',','.'));
    return db.accessories.add({id:T.uid(),projectId,description:T.clean(row.description)||'Material sin identificar',quantity:Number.isFinite(q)&&q>0?q:1,unit:T.clean(row.unit)||'UNI',at:T.localDate(row.date).toISOString(),kind:row.kind==='return'?'return':'dispatch',source:'manual'});
  }
  function prepareCSV(project,products,ids){
    const f=project.format,selection=new Set(ids),rows=products.filter(p=>selection.has(p.id)).map(p=>{
      if(Array.isArray(p.raw)&&p.raw.length===f.headers.length)return p.raw;
      const row=f.headers.map(()=>''),values={numero:p.numero,op:p.op||project.op,obra:project.obra,orden:p.orden,tipo:p.tipo,detalle:p.description||p.detalle,subfamilia:p.subfamilia,familia:p.familia};
      for(const [key,value]of Object.entries(values))if(f.columns[key]>=0)row[f.columns[key]]=value||'';
      const qty=f.headers.findIndex(h=>T.plain(h)==='cantidad');if(qty>=0)row[qty]='1';return row;
    });
    const csv=(f.bom?'\uFEFF':'')+(f.sepLine?`sep=${f.delimiter}${f.newline||'\r\n'}`:'')+Papa.unparse([f.headers,...rows],{delimiter:f.delimiter,newline:f.newline||'\r\n'});
    return {blob:new Blob([csv],{type:'text/csv;charset=utf-8'}),name:`Preparacion_${TecmaReports.safeName(project.obra)}_${T.dateKey(T.now())}.csv`};
  }
  async function backup(){return db.transaction('r',tables,async()=>({version:1,projects:await db.projects.toArray(),products:await db.products.toArray(),events:await db.events.toArray(),accessories:await db.accessories.toArray()}));}
  function validateBackup(b){
    const fail=()=>{throw new Error('Los datos de Control del respaldo están incompletos.');};if(b?.version!==1)fail();
    for(const name of ['projects','products','events','accessories']){if(!Array.isArray(b[name]))fail();const ids=new Set();for(const r of b[name]){if(typeof r.id!=='string'||ids.has(r.id))fail();ids.add(r.id);}}
    const projects=new Set(b.projects.map(p=>p.id)),products=new Map(b.products.map(p=>[p.id,p]));
    for(const p of b.projects)if(typeof p.obra!=='string'||!Array.isArray(p.format?.headers)||![';',','].includes(p.format.delimiter)||!p.format.columns)fail();
    for(const p of b.products)if(!projects.has(p.projectId)||!/^\d{6}$/.test(p.numero)||!statuses.includes(p.status))fail();
    for(const ev of b.events)if(products.get(ev.productId)?.projectId!==ev.projectId||!Number.isFinite(Date.parse(ev.at)))fail();
    for(const a of b.accessories)if(!projects.has(a.projectId)||!Number.isFinite(a.quantity)||a.quantity<=0||!Number.isFinite(Date.parse(a.at)))fail();return b;
  }
  async function restoreBackup(b){
    validateBackup(b);const projectIds=new Map(b.projects.map(p=>[p.id,T.uid()])),productIds=new Map(b.products.map(p=>[p.id,T.uid()]));
    await db.transaction('rw',tables,async()=>{for(const name of ['projects','products','events','accessories']){
      const rows=b[name].map(p=>({...p,id:name==='projects'?projectIds.get(p.id):name==='products'?productIds.get(p.id):T.uid(),...(p.projectId?{projectId:projectIds.get(p.projectId)}:{}),...(p.productId?{productId:productIds.get(p.productId)}:{})}));if(rows.length)await db[name].bulkAdd(rows);
    }});return [...projectIds.values()];
  }
  async function removeRestored(ids){await db.transaction('rw',tables,async()=>{for(const id of ids){for(const table of [db.products,db.events,db.accessories])await table.where('projectId').equals(id).delete();await db.projects.delete(id);}});}
  return {db,statuses,createProject,data,importClosure,validateClosure,mark,markNumbers,accessory,prepareCSV,backup,validateBackup,restoreBackup,removeRestored};
})();
