/* Catálogo permanente. Los despachos usan las tablas y PDF existentes. */
'use strict';
window.TecmaObras=(()=>{
 const T=Tecma,db=T.db,model='obra-v1',tables=[db.projects,db.catalog,db.loads,db.works,db.products,db.accessories,db.events];
 const order=p=>T.clean(p.orden).replace(/^OFI?\s*/i,'').trim(),orderLabel=o=>o?'OFI '+o:'Sin OFI';
 const focused=(load,p)=>!load.focus?.length||load.focus.includes(order(p));
 const format=p=>({headers:p.headers,columns:p.columns,delimiter:p.delimiter,newline:p.newline,bom:p.bom,sepLine:p.sepLine});
 const catalogRow=(p,id,at)=>({...p,id:T.uid(),projectId:id,description:p.description||p.detalle||'SIN DESCRIPCIÓN',createdAt:at,updatedAt:at});
 function groups(parsed){return parsed.works.map(w=>({...w,key:T.workKey(w.obra,w.op),products:w.products.map(p=>({...p,numero:T.normalizeNumber(p.numero)}))}));}
 function planFor(work,project,products){const map=new Map(products.map(p=>[p.numero,p])),nums=new Set(work.products.map(p=>p.numero)),orders=new Set(products.map(order));return {work,projectId:project?.id||null,revision:project?.revision||0,added:work.products.filter(p=>!map.has(p.numero)).length,existing:work.products.filter(p=>map.has(p.numero)).length,missing:products.filter(p=>!nums.has(p.numero)).length,newOfis:[...new Set(work.products.map(order).filter(o=>o&&!orders.has(o)))].sort(T.natural.compare)};}
 async function preview(parsed,projectId){return db.transaction('r',db.projects,db.catalog,async()=>{
  const target=projectId?await db.projects.get(projectId):null;if(projectId&&!target)throw new Error('No se encontró la obra.');
  const works=groups(parsed).filter(w=>!target||w.key===target.key);if(!works.length)throw new Error('Este CSV no corresponde al nombre y OP de esta obra.');
  const plans=[];for(const work of works){const project=target||await db.projects.where('key').equals(work.key).first();plans.push(planFor(work,project,project?await db.catalog.where('projectId').equals(project.id).toArray():[]));}return {plans,format:format(parsed)};
 });}
 async function apply(preview){return db.transaction('rw',db.projects,db.catalog,async()=>{
  const ids=[],at=T.now();for(const plan of preview.plans){let project=plan.projectId?await db.projects.get(plan.projectId):await db.projects.where('key').equals(plan.work.key).first();
   if((plan.projectId&&(!project||project.revision!==plan.revision))||(!plan.projectId&&project)){const e=new Error('La obra cambió. Revisa el resumen actualizado antes de aplicar.');e.code='OBRA_CHANGED';throw e;}
   if(!project){project={id:T.uid(),key:plan.work.key,obra:plan.work.obra,op:plan.work.op,createdAt:at,format:preview.format,revision:0};await db.projects.add(project);}
   const old=await db.catalog.where('projectId').equals(project.id).toArray(),incoming=new Map(plan.work.products.map(p=>[p.numero,p])),existing=new Set(old.map(p=>p.numero));
   for(const p of old){const source=incoming.get(p.numero);if(!source){if(!p.zebraMissing)await db.catalog.update(p.id,{zebraMissing:true});}else {const patch={zebraMissing:false};for(const [k,v]of Object.entries({description:source.detalle,detalle:source.detalle,tipo:source.tipo,orden:source.orden}))if(p[k]!==v)patch[k]=v;await db.catalog.update(p.id,patch);}}
   const added=plan.work.products.filter(p=>!existing.has(p.numero)).map(p=>catalogRow(p,project.id,at));if(added.length)await db.catalog.bulkAdd(added);
   await db.projects.update(project.id,{revision:(project.revision||0)+1,zebraUpdatedAt:at,catalogIncomplete:false,format:project.format||preview.format});ids.push(project.id);
  }return ids;
 });}
 async function ensureProduct(loadId,numero){return db.transaction('rw',db.loads,db.works,db.products,db.catalog,async()=>{const load=T.editable(await db.loads.get(loadId));let p=await db.products.where('[loadId+numero]').equals([loadId,numero]).first();if(p)return p;const source=await db.catalog.where('[projectId+numero]').equals([load.projectId,numero]).first();if(!source)return null;const work=await db.works.where('loadId').equals(loadId).first();p=dispatchRow(source,load,work);await db.products.add(p);return p;});}
 function dispatchRow(p,load,work){return {...p,id:T.uid(),loadId:load.id,workId:work.id,projectId:load.projectId,status:'pendiente',description:p.description||p.detalle||'SIN DESCRIPCIÓN',detalle:p.detalle||'',tipo:p.tipo||'',orden:p.orden||'',familia:p.familia||'',subfamilia:p.subfamilia||'',atril:'',note:'',reason:'',scannedAt:null,returnedAt:null,lastEvent:null,createdAt:T.now(),updatedAt:T.now()};}
 async function createDispatch(projectId,fields={}){return db.transaction('rw',tables,async()=>{
  const project=await db.projects.get(projectId);if(!project)throw new Error('No se encontró la obra.');const at=T.now(),load={id:T.uid(),model,projectId,status:'open',createdAt:at,updatedAt:at,closedAt:null,focus:[...new Set(fields.focus||[])],scheduledDate:T.clean(fields.date),chofer:T.clean(fields.chofer),rutChofer:T.clean(fields.rutChofer),patente:T.clean(fields.patente)};
  const work={id:T.uid(),loadId:load.id,key:project.key,obra:project.obra,op:project.op,rutCliente:'',direccion:'',comuna:'',constructora:''};await db.loads.add(load);await db.works.add(work);
  const ps=await db.catalog.where('projectId').equals(projectId).toArray();if(ps.length)await db.products.bulkAdd(ps.map(p=>dispatchRow(p,load,work)));await db.events.add({id:T.uid(),loadId:load.id,at,kind:'dispatch-created'});return load.id;
 });}
 async function syncCatalog(loadId){return db.transaction('rw',db.loads,db.works,db.products,db.catalog,async()=>{const load=T.editable(await db.loads.get(loadId));if(load.status!=='open')return;const existing=new Set((await db.products.where('loadId').equals(loadId).toArray()).map(p=>p.numero)),sources=await db.catalog.where('projectId').equals(load.projectId).toArray(),work=await db.works.where('loadId').equals(loadId).first(),rows=sources.filter(p=>!existing.has(p.numero)).map(p=>dispatchRow(p,load,work));if(rows.length)await db.products.bulkAdd(rows);});}
 async function setFocus(id,values){const load=T.editable(await db.loads.get(id));await db.loads.update(load.id,{focus:[...new Set(values)],updatedAt:T.now()});}
 function balances(catalog,loads,products){const closed=new Map(loads.filter(l=>l.status==='closed').map(l=>[l.id,l])),moves=new Map();for(const p of products){if(!closed.has(p.loadId))continue;for(const [kind,at]of [['despachado',p.scannedAt],['devuelto',p.returnedAt]])if(at){const old=moves.get(p.numero);if(!old||at>old.at||at===old.at&&kind==='devuelto')moves.set(p.numero,{kind,at});}}return catalog.map(p=>({...p,status:moves.get(p.numero)?.kind||'pendiente',lastMovementAt:moves.get(p.numero)?.at||null}));}
 async function data(id){return db.transaction('r',tables,async()=>{const project=await db.projects.get(id);if(!project)throw new Error('No se encontró la obra.');const loads=await db.loads.where('projectId').equals(id).toArray(),snapshots=await db.products.where('projectId').equals(id).toArray(),catalog=await db.catalog.where('projectId').equals(id).toArray(),ids=new Set(loads.map(l=>l.id)),accessories=(await db.accessories.toArray()).filter(a=>ids.has(a.loadId));return {project,loads,snapshots,products:balances(catalog,loads,snapshots),accessories};});}
 async function list(){const projects=await db.projects.toArray();return Promise.all(projects.map(p=>data(p.id)));}
 async function registry(){return db.transaction('r',tables,async()=>{const projects=await db.projects.toArray(),loads=(await db.loads.toArray()).filter(l=>l.model===model),ids=new Set(loads.map(l=>l.id)),products=(await db.products.toArray()).filter(p=>ids.has(p.loadId)),rawCatalog=await db.catalog.toArray(),catalog=projects.flatMap(p=>balances(rawCatalog.filter(x=>x.projectId===p.id),loads.filter(l=>l.projectId===p.id),products.filter(x=>x.projectId===p.id)));return {app:'tecma-registro',version:1,exportedAt:T.now(),projects,catalog,loads,works:(await db.works.toArray()).filter(w=>ids.has(w.loadId)),products,accessories:(await db.accessories.toArray()).filter(a=>ids.has(a.loadId)),events:(await db.events.toArray()).filter(e=>ids.has(e.loadId))};});}
 async function exportFile(){const record=await registry();return {blob:new Blob([JSON.stringify(record,null,2)],{type:'text/plain'}),name:`Registro_Tecma_${T.dateKey(record.exportedAt)}.txt`};}
 function validateRegistry(r){if(r?.app!=='tecma-registro'||r.version!==1||!Number.isFinite(Date.parse(r.exportedAt)))throw new Error('Selecciona un Registro_Tecma válido.');T.validateBackup({...r,app:'tecma-despachos',version:3});return r;}

 // La marca se guarda en la misma transacción que la integración y viaja en los respaldos.
 const transitionKey='model:obra-v1',transitionBackupKey='model:obra-v1:backup';
 const defaultFormat={headers:['Numero','N_Obra','Obra','Orden Produccion','Tipo','Detalle Tipo'],columns:{numero:0,op:1,obra:2,orden:3,tipo:4,detalle:5,familia:-1,subfamilia:-1},delimiter:';',newline:'\r\n'};
 const allTables=[...tables,db.meta],names=['projects','catalog','loads','works','products','accessories','events'];
 async function localState(){const state={};for(const name of names)state[name]=await db[name].toArray();state.drafts=await db.meta.where('key').startsWith('draft:').toArray();return state;}
 function fingerprint(b){return JSON.stringify(Object.fromEntries([...names,'drafts'].map(k=>[k,b[k]||[]])));}
 async function transitionStatus(){return db.transaction('rw',db.loads,db.meta,async()=>{
  if((await db.meta.get(transitionKey))?.value.completed)return null;
  const count=(await db.loads.toArray()).filter(l=>l.model!==model).length;
  if(!count){await db.meta.put({key:transitionKey,value:{completed:true,at:T.now(),version:'3.1.0',created:0,integrated:0}});return null;}
  return {count,backup:(await db.meta.get(transitionBackupKey))?.value||null};
 });}
 async function prepareTransition(){
  const status=await transitionStatus();if(!status)return null;
  const backup=await T.backup(),record={at:backup.exportedAt,text:JSON.stringify(backup,null,2)};
  // La copia queda disponible incluso si se cierra la app o la integración falla.
  try{await db.transaction('rw',db.meta,async()=>{await db.meta.put({key:transitionBackupKey,value:record});await db.meta.put({key:'backup:pending',value:record});await db.meta.put({key:'backup:last',value:record.at});});}catch(err){err.backup=record;throw err;}return record;
 }
 async function integrateRows(ids){
  const state=await localState(),wanted=ids?new Set(ids):null,oldLoads=state.loads.filter(l=>l.model!==model&&(!wanted||wanted.has(l.id))).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||T.natural.compare(a.id,b.id));
  const projects=new Map(state.projects.map(p=>[p.key,p])),catalogs=new Map(state.catalog.map(p=>[JSON.stringify([p.projectId,p.numero]),p])),newProjects=new Set(),productLoads=new Map(state.products.map(p=>[p.id,p.loadId]));let created=0,integrated=0;
  for(const original of oldLoads){
   const ws=state.works.filter(w=>w.loadId===original.id),ps=state.products.filter(p=>p.loadId===original.id),accessories=state.accessories.filter(a=>a.loadId===original.id),events=state.events.filter(e=>e.loadId===original.id),groups=new Map(),productGroup=new Map(),accessoryGroup=new Map(),workGroups=new Map();
   const groupFor=(w,op)=>{const key=T.workKey(w.obra,op);if(!groups.has(key))groups.set(key,{key,obra:w.obra,op,source:w,products:[],accessories:[],events:[]});const g=groups.get(key);if(!workGroups.has(w.id))workGroups.set(w.id,new Set());workGroups.get(w.id).add(g);return g;};
   for(const w of ws){const rows=ps.filter(p=>p.workId===w.id);for(const p of rows){const g=groupFor(w,T.clean(p.op)||w.op);g.products.push(p);productGroup.set(p.id,g);}if(!rows.length)groupFor(w,w.op);
    for(const a of accessories.filter(a=>a.workId===w.id)){const candidates=[...(workGroups.get(w.id)||[])],g=groupFor(w,T.clean(a.op)||(candidates.length===1?candidates[0].op:w.op));g.accessories.push(a);accessoryGroup.set(a.id,g);}}
   if(!groups.size){if(ps.length||accessories.length)throw new Error('No se pudo identificar la obra de un despacho. El respaldo conserva todos sus datos.');groupFor({id:'empty',obra:original.obra||'Sin obra',op:original.op||'',rutCliente:'',direccion:'',comuna:'',constructora:''},original.op||'');}
   const usedWorkIds=new Set();let first=true;
   for(const g of groups.values()){
    let project=projects.get(g.key);if(!project){project={id:T.uid(),key:g.key,obra:g.obra,op:g.op,createdAt:original.createdAt,format:original.csvFormat||defaultFormat,revision:0,catalogIncomplete:true};projects.set(g.key,project);newProjects.add(project.id);await db.projects.add(project);created++;}
    g.project=project;g.load={...original,id:first?original.id:T.uid(),sourceId:original.sourceId||original.id,model,projectId:project.id,focus:[],status:'closed',closedAt:original.closedAt||original.createdAt,originalStatus:original.status};first=false;
    const workId=g.source.id!=='empty'&&!usedWorkIds.has(g.source.id)?g.source.id:T.uid();usedWorkIds.add(workId);g.work={...g.source,id:workId,loadId:g.load.id,key:g.key,obra:g.obra,op:g.op};integrated++;
    for(const p of g.products){productLoads.set(p.id,g.load.id);const key=JSON.stringify([project.id,p.numero]);if(!catalogs.has(key)||newProjects.has(project.id)){const previous=catalogs.get(key),row={id:previous?.id||T.uid(),projectId:project.id,numero:p.numero,tipo:p.tipo,detalle:p.detalle,description:p.description,orden:p.orden,familia:p.familia||'',subfamilia:p.subfamilia||'',op:g.op,unknown:!!p.unknown,raw:p.raw,createdAt:previous?.createdAt||p.createdAt,updatedAt:p.updatedAt||p.createdAt};catalogs.set(key,row);await db.catalog.put(row);}}
   }
   for(const ev of events){let targets=[];if(ev.productId){const g=productGroup.get(ev.productId);if(!g)throw new Error('Un movimiento no corresponde a sus productos. No se aplicó ningún cambio.');targets=[g];}else if(accessoryGroup.has(ev.accessoryId))targets=[accessoryGroup.get(ev.accessoryId)];else {const workId=ev.workId||ev.after?.workId||ev.before?.workId;targets=workGroups.has(workId)?[...workGroups.get(workId)]:[...groups.values()];}targets.forEach((g,i)=>g.events.push({...ev,id:i?T.uid():ev.id,sourceId:ev.sourceId||ev.id,loadId:g.load.id,...(ev.workId?{workId:g.work.id}:{})}));}
   // Sustituir relaciones y cargas dentro de la transacción; no queda una copia antigua.
   await db.works.where('loadId').equals(original.id).delete();await db.events.where('loadId').equals(original.id).delete();await db.loads.delete(original.id);
   for(const g of groups.values()){await db.loads.add(g.load);await db.works.add(g.work);for(const p of g.products)await db.products.put({...p,projectId:g.project.id,loadId:g.load.id,workId:g.work.id});for(const a of g.accessories)await db.accessories.put({...a,loadId:g.load.id,workId:g.work.id});if(g.events.length)await db.events.bulkAdd(g.events);}
  }
  // Enlaces de arrastre entre viajes: conservar también el destino correcto al dividir una carga.
  for(const p of await db.products.toArray()){let changed=false;const row={...p};if(p.carryFrom){row.carryFrom=p.carryFrom.map(x=>{const id=productLoads.get(x.productId);if(id&&id!==x.loadId){changed=true;return {...x,loadId:id};}return x;});}if(p.transferredTo){const id=productLoads.get(p.transferredTo.productId);if(id&&id!==p.transferredTo.loadId){changed=true;row.transferredTo={...p.transferredTo,loadId:id};}}if(changed)await db.products.put(row);}
  return {created,integrated};
 }
 async function completeTransition(record){return db.transaction('rw',allTables,async()=>{
  const done=(await db.meta.get(transitionKey))?.value;if(done?.completed)return {...done,already:true};
  const saved=(await db.meta.get(transitionBackupKey))?.value;if(!record||saved?.text!==record.text)throw new Error('Primero guarda el respaldo completo.');
  const backup=T.validateBackup(JSON.parse(record.text));if(fingerprint(backup)!==fingerprint(await localState()))throw new Error('Los datos cambiaron en otra ventana. Pulsa Comenzar para guardar un respaldo actualizado.');
  const result=await integrateRows();T.validateBackup({app:'tecma-despachos',version:3,...await localState()});
  await db.meta.put({key:transitionKey,value:{...result,completed:true,at:T.now(),version:'3.1.0'}});await db.meta.delete(transitionBackupKey);if((await db.meta.get('backup:pending'))?.value.at===record.at)await db.meta.delete('backup:pending');return result;
 });}

 return {transitionKey,transitionStatus,prepareTransition,completeTransition,integrateRows,model,order,orderLabel,focused,preview,apply,ensureProduct,syncCatalog,createDispatch,setFocus,data,list,registry,exportFile,validateRegistry};
})();
