/* Control de obras: base local independiente de las cargas del teléfono. */
'use strict';
window.TecmaControl=(()=>{
  const T=Tecma,db=new Dexie('TecmaControl_v1',{chromeTransactionDurability:'strict'});
  db.version(1).stores({projects:'id,key,createdAt',products:'id,projectId,[projectId+numero]',events:'id,projectId,productId,at,[projectId+sourceKey]',accessories:'id,projectId,[projectId+sourceKey]'});
  db.version(2).stores({records:'id,projectId,[projectId+origin]'});
  const tables=[db.projects,db.products,db.events,db.accessories,db.records];
  const statuses=['pendiente en fábrica','en obra','devuelto'];
  const projectName=project=>T.clean(project.displayName)||project.obra;
  const opKey=value=>T.plain(value).replace(/\s+/g,' ');
  async function projectSummaries(projects){return Promise.all(projects.map(async p=>{const products=await db.products.where('projectId').equals(p.id).toArray();return {...p,productCount:products.length,statusCounts:Object.fromEntries(statuses.map(s=>[s,products.filter(p=>p.status===s).length]))};}));}
  async function listProjects(){return db.transaction('r',db.projects,db.products,async()=>projectSummaries(await db.projects.toArray()));}
  async function matchingProjects(work){
    const projects=(await db.projects.where('key').equals(T.obraKey(work.obra)).toArray()).filter(p=>opKey(p.op)===opKey(work.op));
    return projectSummaries(projects.sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)));
  }
  async function renameProject(id,name){
    const displayName=T.clean(name);if(!displayName)throw new Error('Escribe un nombre para la obra.');
    // El nombre visible no cambia la identidad original usada por Zebra y los cierres.
    if(!await db.projects.update(id,{displayName}))throw new Error('No se encontró la obra.');
  }
  async function deleteProject(id){
    await db.transaction('rw',tables,async()=>{
      if(!await db.projects.get(id))throw new Error('No se encontró la obra.');
      for(const table of [db.products,db.events,db.accessories,db.records])await table.where('projectId').equals(id).delete();
      await db.projects.delete(id);
    });
  }
  async function createProject(parsed,{allowDuplicate=false}={}){
    const w=T.firstWork(parsed);if(!w)throw new Error('No se encontraron productos.');
    const project={id:T.uid(),key:T.obraKey(w.obra),obra:w.obra,op:w.op,createdAt:T.now(),format:{headers:parsed.headers,columns:parsed.columns,delimiter:parsed.delimiter,newline:parsed.newline,bom:parsed.bom,sepLine:parsed.sepLine}};
    await db.transaction('rw',tables,async()=>{
      if(!allowDuplicate){const duplicates=await matchingProjects(w);if(duplicates.length){const err=new Error('La obra ya existe en el control.');err.code='CONTROL_DUPLICATE';err.duplicates=duplicates;throw err;}}
      await db.projects.add(project);
      await db.products.bulkAdd(w.products.map(p=>({...p,id:T.uid(),projectId:project.id,description:p.detalle,note:'',status:'pendiente en fábrica',dispatchDate:null,returnedAt:null,createdAt:T.now()})));
    });return project;
  }
  async function data(id){const project=await db.projects.get(id);if(!project)throw new Error('No se encontró la obra.');const [products,events,accessories]=await Promise.all([db.products.where('projectId').equals(id).toArray(),db.events.where('projectId').equals(id).toArray(),db.accessories.where('projectId').equals(id).toArray()]);return {project,products,events,accessories};}
  // La preparación es de solo lectura. Nada se guarda hasta pulsar Aplicar.
  const headerKey=value=>T.plain(value).replace(/[\s_°º-]/g,'');
  function zebraSignature(project,products){
    return JSON.stringify([project.key,project.format,project.zebraRevision||0,products.map(p=>[p.id,T.normalizeNumber(p.numero),p.tipo,p.description,p.detalle,p.orden]).sort((a,b)=>a[0].localeCompare(b[0]))]);
  }
  function zebraRows(project,parsed){
    const groups=parsed.works.filter(w=>T.obraKey(w.obra)===project.key);
    if(!groups.length)throw new Error(`El CSV no contiene la obra ${project.obra}. No se cambió ningún dato.`);
    const rows=new Map();
    for(const group of groups)for(const product of group.products){
      const p={...product,numero:T.normalizeNumber(product.numero),op:product.op||group.op};
      const old=rows.get(p.numero);
      if(old&&['tipo','detalle','orden'].some(key=>old[key]!==p[key]))throw new Error(`El CSV repite ${p.numero} con textos distintos. No se cambió ningún dato.`);
      if(!old)rows.set(p.numero,p);
    }
    return [...rows.values()];
  }
  function zebraSummary(project,products,rows){
    const existing=new Map(products.map(p=>[T.normalizeNumber(p.numero),p])),incoming=new Set(rows.map(p=>p.numero));
    const orders=new Set(products.map(p=>T.plain(p.orden).replace(/\s+/g,' ')));
    const newOfis=[...new Map(rows.filter(p=>T.clean(p.orden)&&!orders.has(T.plain(p.orden).replace(/\s+/g,' '))).map(p=>[T.plain(p.orden).replace(/\s+/g,' '),p.orden])).values()].sort(T.natural.compare);
    return {added:rows.filter(p=>!existing.has(p.numero)).length,existing:rows.filter(p=>existing.has(p.numero)).length,missing:products.filter(p=>!incoming.has(T.normalizeNumber(p.numero))).length,textChanged:rows.filter(p=>{const old=existing.get(p.numero);return old&&(old.description!==p.detalle||old.tipo!==p.tipo||old.orden!==p.orden);}).length,newOfis};
  }
  async function previewZebra(projectId,parsed){
    return db.transaction('r',db.projects,db.products,async()=>{
      const project=await db.projects.get(projectId);if(!project)throw new Error('No se encontró la obra.');
      const products=await db.products.where('projectId').equals(projectId).toArray(),rows=zebraRows(project,parsed);
      return {projectId,rows,sourceFormat:{headers:parsed.headers,columns:parsed.columns},signature:zebraSignature(project,products),...zebraSummary(project,products,rows)};
    });
  }
  function zebraRaw(project,source,format){
    // Mantener el formato original al preparar el siguiente CSV, incluso si el
    // nuevo archivo trae columnas en otro orden o utiliza otro separador.
    const columns=new Map(format.headers.map((h,i)=>[headerKey(h),i]));
    const row=project.format.headers.map(h=>{const index=columns.get(headerKey(h));return index===undefined?'':source.raw?.[index]??'';});
    for(const [field,index]of Object.entries(project.format.columns))if(index>=0&&format.columns[field]>=0)row[index]=source.raw?.[format.columns[field]]??'';
    return row;
  }
  async function applyZebra(preview){
    return db.transaction('rw',db.projects,db.products,async()=>{
      const project=await db.projects.get(preview.projectId);if(!project)throw new Error('No se encontró la obra.');
      const products=await db.products.where('projectId').equals(project.id).toArray();
      if(zebraSignature(project,products)!==preview.signature){const err=new Error('La lista de la obra cambió. Revisa el resumen actualizado antes de aplicar.');err.code='ZEBRA_CHANGED';throw err;}
      const incoming=new Map(preview.rows.map(p=>[p.numero,p])),existing=new Set(products.map(p=>T.normalizeNumber(p.numero))),at=T.now();
      const changes=[];
      for(const old of products){
        const source=incoming.get(T.normalizeNumber(old.numero)),patch={};
        if(!source){if(!old.zebraMissing)patch.zebraMissing=true;}
        else {
          if(old.zebraMissing)patch.zebraMissing=false;
          const texts={description:source.detalle,detalle:source.detalle,tipo:source.tipo,orden:source.orden};
          for(const [key,value]of Object.entries(texts))if(old[key]!==value)patch[key]=value;
          if(Object.keys(patch).some(k=>k!=='zebraMissing')&&Array.isArray(old.raw)&&old.raw.length===project.format.headers.length){
            const raw=old.raw.slice();for(const [key,value]of Object.entries({detalle:source.detalle,tipo:source.tipo,orden:source.orden})){const index=project.format.columns[key];if(index>=0)raw[index]=value;}
            if(JSON.stringify(raw)!==JSON.stringify(old.raw))patch.raw=raw;
          }
        }
        // Actualizaciones parciales: no escribir estados, fechas, notas ni eventos.
        if(Object.keys(patch).length)changes.push({id:old.id,patch});
      }
      const added=preview.rows.filter(p=>!existing.has(p.numero)).map(p=>({...p,id:T.uid(),projectId:project.id,raw:zebraRaw(project,p,preview.sourceFormat),description:p.detalle,note:'',status:'pendiente en fábrica',dispatchDate:null,returnedAt:null,createdAt:at,zebraMissing:false}));
      if(added.length)await db.products.bulkAdd(added);
      await Promise.all(changes.map(({id,patch})=>db.products.update(id,patch)));
      await db.projects.update(project.id,{zebraUpdatedAt:at,zebraRevision:(project.zebraRevision||0)+1});
      return {...zebraSummary(project,products,preview.rows),updatedAt:at};
    });
  }
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
    if(c?.app!=='tecma-despachos-cierre'||c.version!==1||!c.load?.id||!Array.isArray(c.works)||!Array.isArray(c.products)||!Array.isArray(c.accessories))throw new Error('Selecciona un archivo de cierre de Tecma (.txt o .json).');
    if(c.load.status!=='closed')throw new Error('Este archivo no corresponde a una carga cerrada.');
    const works=new Set(c.works.map(w=>w.id)),numbers=new Set();
    for(const p of c.products){const key=p.workId+':'+p.numero;if(!/^\d{6}$/.test(p.numero)||!works.has(p.workId)||numbers.has(key)||!['pendiente','cargado','devuelto','trasladado'].includes(p.status)||p.scannedAt&&!Number.isFinite(Date.parse(p.scannedAt))||p.returnedAt&&!Number.isFinite(Date.parse(p.returnedAt)))throw new Error('El cierre contiene productos incompletos.');numbers.add(key);}
    for(const a of c.accessories)if(!works.has(a.workId)||!Number.isFinite(a.quantity)||a.quantity<=0)throw new Error('El cierre contiene accesorios incompletos.');
    return c;
  }
  async function importClosure(projectId,input){
    const c=validateClosure(input),project=await db.projects.get(projectId);
    const works=new Map(c.works.filter(w=>T.obraKey(w.obra)===project.key&&(opKey(w.op)===opKey(project.op)||opKey(project.op).split(',').map(x=>x.trim()).includes(opKey(w.op)))).map(w=>[w.id,w]));
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
        const notesByLoad={...(p.notesByLoad||{}),[origin]:T.clean(source.note)},manualNote=p.manualNote??(!p.notesByLoad?p.note||'':'');await db.products.update(p.id,{notesByLoad,manualNote,note:[...new Set([manualNote,...Object.values(notesByLoad)].filter(Boolean))].join(' · ')});
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
  const defaultFormat={headers:['Numero','N_Obra','Obra','Orden Produccion','Tipo','Detalle Tipo'],columns:{numero:0,op:1,obra:2,orden:3,tipo:4,detalle:5,familia:-1,subfamilia:-1},delimiter:';',newline:'\r\n'};
  async function registryProject(source){
    const matches=(await db.projects.where('key').equals(T.obraKey(source.obra)).toArray()).filter(p=>opKey(p.op)===opKey(source.op)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
    let p=matches.find(p=>(p.registrySources||[]).includes(source.sourceId||source.id))||matches[0];
    if(!p){p={id:T.uid(),key:T.obraKey(source.obra),obra:source.obra,op:source.op,createdAt:source.createdAt||T.now(),format:source.format||defaultFormat};await db.projects.add(p);}
    const sources=[...new Set([...(p.registrySources||[]),source.sourceId||source.id])];if(JSON.stringify(sources)!==JSON.stringify(p.registrySources||[]))await db.projects.update(p.id,{registrySources:sources});return p;
  }
  async function importRegistry(input){
    const r=TecmaObras.validateRegistry(input);let added=0,updated=0;const projectIds=[];
    await db.transaction('rw',tables,async()=>{
      for(const source of r.projects){const project=await registryProject(source),projectId=project.id;projectIds.push(projectId);
        const catalogs=r.catalog.filter(p=>p.projectId===source.id),existing=new Map((await db.products.where('projectId').equals(projectId).toArray()).map(p=>[p.numero,p]));
        for(const row of catalogs){let p=existing.get(row.numero);const textAt=[source.zebraUpdatedAt,source.createdAt,row.updatedAt,row.createdAt].filter(Boolean).sort().at(-1)||r.exportedAt;
          if(!p){p={...row,id:T.uid(),projectId,status:'pendiente en fábrica',dispatchDate:null,returnedAt:null,note:'',notesByLoad:{},registryTextAt:textAt};delete p.loadId;delete p.workId;await db.products.add(p);existing.set(p.numero,p);}
          else if(textAt>(p.registryTextAt||project.zebraUpdatedAt||'')){await db.products.update(p.id,{tipo:row.tipo,description:row.description||row.detalle||'SIN DESCRIPCIÓN',detalle:row.detalle||'',orden:row.orden||'',zebraMissing:!!row.zebraMissing,registryTextAt:textAt});}
        }
        for(const load of r.loads.filter(l=>l.projectId===source.id&&l.status==='closed')){
          const origin=load.sourceId||load.id,products=r.products.filter(p=>p.loadId===load.id),works=r.works.filter(w=>w.loadId===load.id),accessories=r.accessories.filter(a=>a.loadId===load.id),events=r.events.filter(e=>e.loadId===load.id);
          const payload={load,works,products,accessories,events},signature=JSON.stringify(payload),revisionAt=[load.updatedAt,load.createdAt,...products.map(p=>p.updatedAt),...accessories.map(a=>a.updatedAt),...events.map(e=>e.at)].filter(Boolean).sort().at(-1);
          const old=await db.records.where('[projectId+origin]').equals([projectId,origin]).first();
          if(old&&(revisionAt<old.revisionAt||JSON.stringify(old.payload)===signature||revisionAt===old.revisionAt&&r.exportedAt<=old.exportedAt))continue;
          const beforeEvents=(await db.events.where('projectId').equals(projectId).toArray()).filter(e=>e.registryOrigin===origin),keys=new Set(),affected=new Set(beforeEvents.map(e=>e.productId)),name=T.loadName(load,works,products);
          for(const row of products){if(!row.scannedAt&&!row.returnedAt)continue;let p=existing.get(row.numero);if(!p){p={...row,id:T.uid(),projectId,status:'pendiente en fábrica',dispatchDate:null,note:''};delete p.loadId;delete p.workId;await db.products.add(p);existing.set(p.numero,p);}
            affected.add(p.id);
            for(const [kind,at]of [['dispatch',row.scannedAt],['return',row.returnedAt]])if(at){const sourceKey=JSON.stringify(['registro',origin,row.numero,kind]);keys.add(sourceKey);const event=beforeEvents.find(e=>e.sourceKey===sourceKey);await db.events.put({id:event?.id||T.uid(),projectId,productId:p.id,sourceLoad:origin,registryOrigin:origin,loadName:name,description:row.description,kind,at,sourceKey});if(!event)added++;}
            const notesByLoad={...(p.notesByLoad||{}),[origin]:T.clean(row.note)},manualNote=p.manualNote??(!p.notesByLoad?p.note||'':'');Object.assign(p,{notesByLoad,manualNote,note:[...new Set([manualNote,...Object.values(notesByLoad)].filter(Boolean))].join(' · ')});await db.products.update(p.id,{notesByLoad,manualNote,note:p.note});
          }
          for(const ev of beforeEvents)if(!keys.has(ev.sourceKey))await db.events.delete(ev.id);
          for(const id of affected)await recompute(id);
          const previousAccessories=(await db.accessories.where('projectId').equals(projectId).toArray()).filter(a=>a.registryOrigin===origin),accessoryKeys=new Set();
          for(const a of accessories){const sourceKey=JSON.stringify(['registro',origin,'accessory',a.sourceId||a.id]);accessoryKeys.add(sourceKey);const oldAccessory=previousAccessories.find(x=>x.sourceKey===sourceKey);await db.accessories.put({...a,id:oldAccessory?.id||T.uid(),projectId,sourceKey,registryOrigin:origin,at:load.closedAt||load.createdAt,kind:'dispatch',loadName:name});}
          for(const a of previousAccessories)if(!accessoryKeys.has(a.sourceKey))await db.accessories.delete(a.id);
          await db.records.put({id:old?.id||T.uid(),projectId,origin,revisionAt,exportedAt:r.exportedAt,payload});updated++;
        }
      }
    });return {added,updated,projectIds:[...new Set(projectIds)]};
  }
  async function importAny(input,projectId){
    if(input?.app==='tecma-registro')return importRegistry(input);
    const c=validateClosure(input);if(projectId)return importClosure(projectId,c);
    return db.transaction('rw',tables,async()=>{let added=0;const ids=[];for(const work of c.works){const p=await registryProject({...work,sourceId:'legacy:'+T.workKey(work.obra,work.op)});if(ids.includes(p.id))continue;ids.push(p.id);const result=await importClosure(p.id,{...c,works:c.works.filter(w=>T.workKey(w.obra,w.op)===T.workKey(work.obra,work.op)),products:c.products.filter(x=>c.works.some(w=>w.id===x.workId&&T.workKey(w.obra,w.op)===T.workKey(work.obra,work.op))),accessories:c.accessories.filter(x=>c.works.some(w=>w.id===x.workId&&T.workKey(w.obra,w.op)===T.workKey(work.obra,work.op)))});added+=result.added;}return {added,projectIds:ids};});
  }
  async function backup(){return db.transaction('r',tables,async()=>({version:2,records:await db.records.toArray(),projects:await db.projects.toArray(),products:await db.products.toArray(),events:await db.events.toArray(),accessories:await db.accessories.toArray()}));}
  function validateBackup(b){
    const fail=()=>{throw new Error('Los datos de Control del respaldo están incompletos.');};if(![1,2].includes(b?.version))fail();if(b.version===2&&!Array.isArray(b.records))fail();
    for(const name of ['projects','products','events','accessories']){if(!Array.isArray(b[name]))fail();const ids=new Set();for(const r of b[name]){if(typeof r.id!=='string'||ids.has(r.id))fail();ids.add(r.id);}}
    const projects=new Set(b.projects.map(p=>p.id)),products=new Map(b.products.map(p=>[p.id,p]));
    for(const p of b.projects)if(typeof p.obra!=='string'||!Array.isArray(p.format?.headers)||![';',','].includes(p.format.delimiter)||!p.format.columns)fail();
    for(const p of b.products)if(!projects.has(p.projectId)||!/^\d{6}$/.test(p.numero)||!statuses.includes(p.status))fail();
    for(const ev of b.events)if(products.get(ev.productId)?.projectId!==ev.projectId||!Number.isFinite(Date.parse(ev.at)))fail();
    const recordIds=new Set(),origins=new Set();for(const r of b.records||[]){const key=JSON.stringify([r.projectId,r.origin]);if(typeof r.id!=='string'||recordIds.has(r.id)||origins.has(key)||!projects.has(r.projectId)||typeof r.origin!=='string'||!Number.isFinite(Date.parse(r.revisionAt)))fail();recordIds.add(r.id);origins.add(key);}
    for(const a of b.accessories)if(!projects.has(a.projectId)||!Number.isFinite(a.quantity)||a.quantity<=0||!Number.isFinite(Date.parse(a.at)))fail();return b;
  }
  async function restoreBackup(b){
    validateBackup(b);const projectIds=new Map(b.projects.map(p=>[p.id,T.uid()])),productIds=new Map(b.products.map(p=>[p.id,T.uid()]));
    await db.transaction('rw',tables,async()=>{for(const name of ['projects','products','events','accessories','records']){
      const rows=(b[name]||[]).map(p=>({...p,id:name==='projects'?projectIds.get(p.id):name==='products'?productIds.get(p.id):T.uid(),...(p.projectId?{projectId:projectIds.get(p.projectId)}:{}),...(p.productId?{productId:productIds.get(p.productId)}:{})}));if(rows.length)await db[name].bulkAdd(rows);
    }});return [...projectIds.values()];
  }
  async function removeRestored(ids){await db.transaction('rw',tables,async()=>{for(const id of ids){for(const table of [db.products,db.events,db.accessories,db.records])await table.where('projectId').equals(id).delete();await db.projects.delete(id);}});}
  return {db,statuses,projectName,listProjects,renameProject,deleteProject,createProject,data,previewZebra,applyZebra,importClosure,validateClosure,mark,markNumbers,accessory,importRegistry,importAny,backup,validateBackup,restoreBackup,removeRestored};
})();
