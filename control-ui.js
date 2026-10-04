'use strict';
window.TecmaControlUI=(()=>{
  const T=Tecma,C=TecmaControl,e=T.esc,$=s=>document.querySelector(s);let ui,route={},current=null,view='overview',query='',state='all',ofi='all',selected=new Set(),limit=100,zebraFilter='all',pendingZebra=null,zebraTicket=0,pendingImport=null,pendingDelete=null,renameId=null;
  const wide=()=>matchMedia('(min-width: 1000px)').matches;
  const today=()=>T.dateKey(T.now()),label=s=>s==='en obra'?'En obra':s==='devuelto'?'Devuelto':'Pendiente en fábrica';
  const cls=s=>s==='en obra'?'cargado':s==='devuelto'?'devuelto':'pendiente';
  const trash='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6"/></svg>';
  const shortDate=value=>{const d=new Date(value);return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}`;};
  const productCount=n=>`${n} ${n===1?'producto':'productos'}`;
  function projectCard(p){const n=p.productCount,c=p.statusCounts||{},sent=c['en obra']||0,returned=c.devuelto||0,pending=c['pendiente en fábrica']||0;return `<div class="control-project-card"><a class="button card control-project-link" href="#/control/${e(p.id)}"><span>${e(C.projectName(p))} · OP ${e(p.op)}</span><small class="muted" title="${e(T.date(p.createdAt))}">Creada ${shortDate(p.createdAt)} · ${productCount(p.productCount)}</small><span class="ofi-bar wide" style="height:6px" aria-label="${sent} en obra, ${returned} devueltos, ${pending} pendientes en fábrica"><span class="in-work" style="width:${n?sent/n*100:0}%"></span><span class="returned" style="width:${n?returned/n*100:0}%"></span><span class="at-factory" style="width:${n?pending/n*100:0}%"></span></span><small class="muted">${sent} / ${n} · ${n?Math.round(sent/n*100):0}% despachado</small></a>${ui.btn(trash,'control-delete','icon-button quiet',`data-id="${e(p.id)}" aria-label="Eliminar obra ${e(C.projectName(p))}" title="Eliminar obra"`)}</div>`;}
  function duplicateConfirmation(parsed,filename,projects){
    pendingImport={parsed,filename,projects,busy:false};
    ui.openModal('La obra ya existe',`${projects.map(p=>`<p>Ya existe la obra <strong>${e(C.projectName(p))}</strong> (OP ${e(p.op)}) en el control, creada el ${T.date(p.createdAt)}, con ${productCount(p.productCount)}.</p>`).join('')}<p>¿Qué quieres hacer?</p>${projects.length>1?`<label>Obra que quieres actualizar<select id="control-existing-project"><option value="">Selecciona una obra</option>${projects.map(p=>`<option value="${e(p.id)}">${e(C.projectName(p))} · ${T.date(p.createdAt)} ${T.time(p.createdAt)} · ${productCount(p.productCount)}</option>`).join('')}</select></label>`:''}<div class="stack" style="margin-top:22px">${ui.btn('Actualizar la existente','control-duplicate-update','primary')}${ui.btn('Crear una obra nueva de todas formas','control-duplicate-create')}${ui.btn('Cancelar','control-dialog-cancel')}</div>`);
  }
  async function createFromCSV(parsed,filename,allowDuplicate=false){
    try{const p=await C.createProject(parsed,{allowDuplicate});pendingImport=null;ui.closeModal();location.hash=`#/control/${p.id}`;if(new Set(parsed.works.map(w=>T.obraKey(w.obra))).size>1)ui.toast(`Se usó la primera obra: ${p.obra}.`);}
    catch(err){if(err.code==='CONTROL_DUPLICATE')duplicateConfirmation(parsed,filename,err.duplicates);else throw err;}
  }
  function init(bridge){ui=bridge;$('#modal').addEventListener('close',()=>{if(!$('#modal').open){pendingZebra=null;pendingImport=null;pendingDelete=null;renameId=null;}});matchMedia('(min-width: 1000px)').addEventListener('change',()=>{if(location.hash.startsWith('#/control'))render(route).catch(ui.error);});}
  async function render(next){
    route=next;pendingZebra=null;pendingImport=null;pendingDelete=null;renameId=null;++zebraTicket;const app=$('#app');if(!wide()){app.innerHTML=ui.heading('Tus cargas','',`<a class="button" href="#/">Volver</a>`);return;}
    if(!route.id){current=null;const projects=await C.listProjects();
      app.innerHTML=ui.heading('Control de obras','',`<a class="button small quiet" href="#/">Mis cargas</a>`)+`<div class="card"><h2>Crear obra</h2>${ui.btn('Importar CSV completo del Zebra','control-create','primary')}<input id="control-csv" type="file" accept=".csv,text/csv" hidden></div><div class="grid control-project-grid" style="margin-top:20px">${projects.map(projectCard).join('')}</div>`;return;
    }
    current=await C.data(route.id);view=route.sub||'overview';selected.clear();limit=100;query='';state='all';ofi='all';zebraFilter='all';paint();
  }
  function header(){return ui.heading(e(C.projectName(current.project)),`OP ${e(current.project.op)} · ${current.products.length} productos<br><small class="muted">Última actualización desde Zebra: ${current.project.zebraUpdatedAt?`${T.date(current.project.zebraUpdatedAt)} · ${T.time(current.project.zebraUpdatedAt)}`:'sin actualizaciones'}</small>`,`<a class="button small quiet" href="#/control">Obras</a>`)+`<div class="toolbar"><a class="button ${view==='overview'?'primary':''}" href="#/control/${route.id}">Vista general</a><a class="button ${view==='list'?'primary':''}" href="#/control/${route.id}/list">Productos</a><a class="button ${view==='accessories'?'primary':''}" href="#/control/${route.id}/accessories">Accesorios y MIT</a></div><div class="row control-actions">${ui.btn('Actualizar desde Zebra','control-zebra','small')}<input type="file" id="control-zebra-file" accept=".csv,text/csv" hidden>${ui.btn('Importar cierres','control-import','small')}${ui.btn('Pegar números','control-paste','small')}${ui.btn('Registrar devolución','control-return','small')}<input type="file" id="control-closures" accept=".txt,.json,text/plain,application/json" multiple hidden><a class="button primary" href="#/control/${route.id}/prepare">Preparar próxima carga</a>${ui.btn('Renombrar obra','control-rename','small',`data-id="${e(route.id)}"`)}${ui.btn('Eliminar obra','control-delete','small danger',`data-id="${e(route.id)}"`)}</div>`;}
  function paint(){
    if(!current||!wide())return;let html=header();
    if(view==='overview'){
      const groups=[...new Set(current.products.map(p=>p.orden||'Sin OFI'))].sort(T.natural.compare);
      html+=`<div class="stack" style="margin-top:22px">${groups.map(order=>{const ps=current.products.filter(p=>(p.orden||'Sin OFI')===order),counts=C.statuses.map(s=>ps.filter(p=>p.status===s).length);return `<button class="card wide ofi-card" data-action="control-ofi" data-ofi="${e(order)}"><span class="row between wide"><strong>${e(order)}</strong><span>${ps.length} productos</span></span><span class="ofi-bar" aria-label="${counts[1]} en obra, ${counts[2]} devueltos, ${counts[0]} pendientes"><span class="in-work" style="width:${counts[1]/ps.length*100}%">${counts[1]||''}</span><span class="returned" style="width:${counts[2]/ps.length*100}%">${counts[2]||''}</span><span class="at-factory" style="width:${counts[0]/ps.length*100}%">${counts[0]||''}</span></span><span class="row subtext"><span>${counts[1]} en obra</span><span>${counts[2]} devueltos</span><span>${counts[0]} pendientes en fábrica</span></span></button>`;}).join('')}</div>`;
    }else if(view==='accessories'){
      const groups=new Map();for(const a of current.accessories){const key=a.kind+'|'+a.description+'|'+a.unit;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(a);}
      html+=`<section class="card" style="margin-top:22px"><div class="row between"><h2>Accesorios y MIT</h2>${ui.btn('Agregar accesorio','control-accessory','small')}</div>${[...groups.values()].map(rows=>`<div class="accessory"><strong>${e(rows[0].description)} ${rows[0].kind==='return'?'<span class="badge">Devolución</span>':''}</strong><p class="muted subtext">Total: ${TecmaReports.num(rows.reduce((n,a)=>n+a.quantity,0))} ${e(rows[0].unit)}</p>${rows.sort((a,b)=>b.at.localeCompare(a.at)).map(a=>`<p>${e(a.description)} · ${TecmaReports.num(a.quantity)} ${e(a.unit)} · ${T.date(a.at)} ${a.loadName?`<small class="muted">${e(a.loadName)}</small>`:''}</p>`).join('')}</div>`).join('')||'<p class="muted">Sin accesorios registrados.</p>'}</section>`;
    }else{
      const orders=[...new Set(current.products.map(p=>p.orden||'Sin OFI'))].sort(T.natural.compare);
      html+=`<section style="margin-top:22px"><h2>${view==='prepare'?'Preparar próxima carga':'Productos'}</h2><div class="fields"><label>OFI<select id="control-ofi-filter"><option value="all">Todas</option>${orders.map(o=>`<option value="${e(o)}" ${ofi===o?'selected':''}>${e(o)}</option>`).join('')}</select></label><label>Estado<select id="control-state"><option value="all">Todos</option>${C.statuses.map(s=>`<option value="${s}" ${state===s?'selected':''}>${label(s)}</option>`).join('')}</select></label><label>Zebra<select id="control-zebra-filter"><option value="all" ${zebraFilter==='all'?'selected':''}>Todos</option><option value="present" ${zebraFilter==='present'?'selected':''}>Sin señal de ausencia</option><option value="missing" ${zebraFilter==='missing'?'selected':''}>Ya no está en el Zebra (${current.products.filter(p=>p.zebraMissing).length})</option></select></label><label class="full">Buscar número o tipo<input id="control-query" value="${e(query)}" placeholder="Número, tipo o descripción"></label></div><div class="row" style="margin:16px 0">${ui.btn('Seleccionar visibles','control-select-all','small')}${ui.btn('Quitar selección','control-clear','small')}<span id="control-selection-count"></span>${view==='prepare'?'<small class="muted">Sin casillas seleccionadas, se exportan los resultados del filtro.</small>':''}${view==='prepare'?ui.btn('Generar CSV','control-export','primary'):ui.btn(view==='returns'?'Marcar seleccionados devueltos':'Marcar seleccionados despachados',view==='returns'?'control-mark-return':'control-mark','primary')}</div><div id="control-product-list"></div></section>`;
    }
    $('#app').innerHTML=html;if($('#control-product-list'))paintList();
  }
  function filtered(){return current.products.filter(p=>(ofi==='all'||(p.orden||'Sin OFI')===ofi)&&(state==='all'||p.status===state)&&(zebraFilter==='all'||(zebraFilter==='missing'?p.zebraMissing:!p.zebraMissing))&&T.plain([p.numero,p.tipo,p.description].join(' ')).includes(T.plain(query))).sort((a,b)=>T.natural.compare(a.orden,b.orden)||T.natural.compare(a.numero,b.numero));}
  function paintList(){
    const rows=filtered();$('#control-product-list').innerHTML=rows.slice(0,limit).map(p=>`<div class="row control-product"><label class="check-label"><input type="checkbox" data-control-select="${p.id}" aria-label="Seleccionar ${p.numero}" ${selected.has(p.id)?'checked':''}></label><button class="product ${cls(p.status)}" data-action="control-product" data-id="${p.id}"><span class="body"><strong>${e(p.numero)} · ${e(p.tipo)} · ${e(p.description)}</strong><small>${e(p.orden)}${p.dispatchDate?' · Despacho '+T.date(p.dispatchDate):''}${p.note?' · '+e(p.note):''}</small>${p.zebraMissing?'<small><span class="badge">Ya no está en el Zebra</span></small>':''}</span><span class="state">${label(p.status)}</span></button></div>`).join('')||'<div class="empty">No hay productos con este filtro.</div>';
    if(rows.length>limit)$('#control-product-list').innerHTML+=ui.btn(`Mostrar más (${limit}/${rows.length})`,'control-more','wide');count();
  }
  function count(){if($('#control-selection-count'))$('#control-selection-count').textContent=`${selected.size} seleccionados`;}
  function dates(){return ui.field('Fecha (opcional)','date',today(),'type="date"');}
  function numbersModal(kind='dispatch'){ui.openModal(kind==='return'?'Registrar devolución':'Marcar despachados',`<form id="control-numbers-form"><input type="hidden" name="kind" value="${kind}"><div class="stack">${dates()}<label>Números<textarea name="numbers" placeholder="Uno por línea o separados por coma"></textarea></label></div><div class="dialog-actions"><button class="primary" type="submit">Guardar</button></div></form>`);}
  function accessoryModal(kind='dispatch'){ui.openModal(kind==='return'?'Devolución sin código':'Agregar accesorio o MIT',`<form id="control-accessory-form"><input name="kind" type="hidden" value="${kind}"><div class="stack"><label>Descripción<textarea name="description"></textarea></label><div class="fields">${ui.field('Cantidad','quantity','1','inputmode="decimal"')}${ui.field('Unidad','unit','UNI')}</div>${dates()}</div><div class="dialog-actions"><button class="primary" type="submit">Guardar</button></div></form>`);}
  function zebraConfirmation(plan,parsed,filename,project=current.project){
    pendingZebra={plan,parsed,filename,project,busy:false};
    ui.openModal('Actualizar desde Zebra',`<p><strong>${e(C.projectName(project))}</strong><br><small class="muted">${e(filename)}</small></p><div class="stack"><p>Se ${plan.added===1?'agregará':'agregarán'} <strong>${plan.added}</strong> ${plan.added===1?'producto nuevo':'productos nuevos'} (OFI: ${e(plan.newOfis.join(', ')||'sin OFI nuevas detectadas')}).</p><p><strong>${plan.existing}</strong> ${plan.existing===1?'producto ya existía':'productos ya existían'} y no se modificarán sus estados, fechas, notas ni historial.</p>${plan.textChanged?`<p>Se actualizarán los textos de descripción, tipo u orden de <strong>${plan.textChanged}</strong> ${plan.textChanged===1?'producto existente':'productos existentes'}.</p>`:''}<p><strong>${plan.missing}</strong> ${plan.missing===1?'producto del control no viene':'productos del control no vienen'} en este CSV. Se ${plan.missing===1?'conservará':'conservarán'} con la señal «ya no está en el Zebra».</p></div><p class="muted subtext">La comparación usa este CSV, aunque contenga solo algunas OFI.</p><div class="dialog-actions">${ui.btn('Cancelar','control-zebra-cancel')}${ui.btn('Aplicar','control-zebra-apply','primary')}</div>`);
  }
  async function refresh(){current=await C.data(route.id);paint();}
  async function click(action,b){
    if(!action.startsWith('control-'))return false;if(!wide())return true;
    if(action==='control-create')$('#control-csv').click();
    else if(action==='control-dialog-cancel'){pendingImport=null;pendingDelete=null;renameId=null;ui.closeModal();}
    else if(action==='control-delete'){
      const p=await C.db.projects.get(b.dataset.id);if(!p)throw new Error('No se encontró la obra.');
      pendingDelete={id:p.id,busy:false};
      ui.openModal('Eliminar obra',`<p>Esto eliminará la obra ${e(C.projectName(p))} (OP ${e(p.op)}) con todos sus productos, historial y accesorios. Esta acción no se puede deshacer.</p><div class="dialog-actions">${ui.btn('Cancelar','control-dialog-cancel')}${ui.btn('Eliminar','control-delete-confirm','danger')}</div>`);
    }
    else if(action==='control-delete-confirm'){
      const pending=pendingDelete;if(!pending||pending.busy)return true;pending.busy=true;b.disabled=true;
      try{await C.deleteProject(pending.id);pendingDelete=null;ui.closeModal();if(route.id)location.hash='#/control';else await render(route);ui.toast('Obra eliminada.');}catch(err){pending.busy=false;throw err;}
    }
    else if(action==='control-rename'){
      const p=await C.db.projects.get(b.dataset.id);if(!p)throw new Error('No se encontró la obra.');renameId=p.id;
      ui.openModal('Renombrar obra',`<form id="control-rename-form">${ui.field('Nombre de la obra','displayName',C.projectName(p),'required')}<div class="dialog-actions">${ui.btn('Cancelar','control-dialog-cancel')}<button type="submit" class="primary">Guardar</button></div></form>`);
    }
    else if(action==='control-duplicate-create'||action==='control-duplicate-update'){
      const pending=pendingImport;if(!pending||pending.busy)return true;
      const id=pending.projects.length===1?pending.projects[0].id:$('#control-existing-project').value;
      if(action==='control-duplicate-update'&&!id)throw new Error('Selecciona la obra que quieres actualizar.');
      pending.busy=true;b.disabled=true;
      try{if(action==='control-duplicate-create')await createFromCSV(pending.parsed,pending.filename,true);
        else {const project=await C.db.projects.get(id);if(!project)throw new Error('Esa obra ya no existe. Vuelve a seleccionar el CSV.');const plan=await C.previewZebra(id,pending.parsed);if(pendingImport===pending&&$('#modal').open){pendingImport=null;zebraConfirmation(plan,pending.parsed,pending.filename,project);}}
      }catch(err){pending.busy=false;throw err;}
    }
    else if(action==='control-zebra')$('#control-zebra-file').click();
    else if(action==='control-zebra-cancel'){pendingZebra=null;ui.closeModal();}
    else if(action==='control-zebra-apply'){
      const pending=pendingZebra;if(!pending||pending.busy||pending.plan.projectId!==pending.project.id)return true;
      pending.busy=true;b.disabled=true;
      try{const result=await C.applyZebra(pending.plan);pendingZebra=null;ui.closeModal();if(route.id===pending.plan.projectId)await refresh();else location.hash=`#/control/${pending.plan.projectId}`;ui.toast(`Zebra actualizado: ${result.added} nuevos · ${result.missing} ausentes del CSV.`);}
      catch(err){if(err.code==='ZEBRA_CHANGED'){const plan=await C.previewZebra(pending.plan.projectId,pending.parsed);zebraConfirmation(plan,pending.parsed,pending.filename,pending.project);ui.toast(err.message);}else{pending.busy=false;throw err;}}
    }
    else if(action==='control-import')$('#control-closures').click();
    else if(action==='control-ofi'){view='list';ofi=b.dataset.ofi;state='all';query='';paint();}
    else if(action==='control-paste')numbersModal();
    else if(action==='control-return'){ui.openModal('Registrar devolución',`<div class="stack">${ui.btn('Buscar por número o tipo','control-return-list')}${ui.btn('Pegar números','control-return-numbers')}${ui.btn('Escribir descripción libre','control-return-free')}</div>`);}
    else if(action==='control-return-list'){ui.closeModal();view='returns';state='all';ofi='all';paint();}
    else if(action==='control-return-numbers')numbersModal('return');
    else if(action==='control-return-free')accessoryModal('return');
    else if(action==='control-accessory')accessoryModal();
    else if(action==='control-select-all'){filtered().forEach(p=>selected.add(p.id));paintList();}
    else if(action==='control-clear'){selected.clear();paintList();}
    else if(action==='control-more'){limit+=100;paintList();}
    else if(action==='control-export'){const ids=selected.size?[...selected]:filtered().map(p=>p.id);ui.fileDialog(C.prepareCSV(current.project,current.products,ids));}
    else if(action==='control-mark'||action==='control-mark-return'){
      ui.openModal(action==='control-mark'?'Marcar despachados':'Marcar devueltos',`<form id="control-bulk-form"><input name="kind" type="hidden" value="${action==='control-mark'?'dispatch':'return'}"><p>${selected.size} productos seleccionados</p>${dates()}<div class="dialog-actions"><button type="submit" class="primary">Guardar</button></div></form>`);
    }else if(action==='control-product'){
      const p=current.products.find(p=>p.id===b.dataset.id),events=current.events.filter(ev=>ev.productId===p.id).sort((a,b)=>b.at.localeCompare(a.at));
      ui.openModal(`${p.numero} · ${p.tipo}`,`<p>${e(p.description)}</p><p>${label(p.status)}${p.dispatchDate?' · Despacho '+T.date(p.dispatchDate):''}</p><p>${e(p.note||'')}</p>${p.zebraMissing?'<p><span class="badge">Ya no está en el Zebra</span></p>':''}<ol class="history">${events.map(ev=>`<li>${T.date(ev.at)} · ${ev.kind==='return'?'Devuelto':'Despachado'}${ev.reconciled?' · volvió sin registrar':''}${ev.loadName?' · '+e(ev.loadName):''}</li>`).join('')||'<li>Sin despachos</li>'}</ol>${ui.btn('Marcar devuelto','control-single-return','small',`data-id="${p.id}"`)}`);
    }else if(action==='control-single-return'){await C.mark(route.id,[b.dataset.id],'return');ui.closeModal();await refresh();}
    return true;
  }
  async function change(el){
    if(!wide())return false;
    if(el.id==='control-zebra-file'){
      const file=el.files[0];el.value='';if(!file)return true;
      const projectId=current.project.id,ticket=++zebraTicket;
      const parsed=await T.readCSV(file),plan=await C.previewZebra(projectId,parsed);
      if(ticket===zebraTicket&&current?.project.id===projectId&&wide())zebraConfirmation(plan,parsed,file.name);
      return true;
    }
    if(el.id==='control-zebra-filter'){zebraFilter=el.value;limit=100;paintList();return true;}
    if(el.id==='control-csv'){
      const file=el.files[0];el.value='';if(!file)return true;const ticket=++zebraTicket,parsed=await T.readCSV(file);if(ticket===zebraTicket&&!route.id&&wide())await createFromCSV(parsed,file.name);return true;
    }
    if(el.id==='control-closures'){
      let added=0,imported=0;const errors=[],projectId=route.id,hash=location.hash;el.disabled=true;
      try{for(const file of el.files){try{const r=await C.importClosure(projectId,JSON.parse(await file.text()));added+=r.added;imported++;}catch(err){errors.push(file.name+': '+err.message);}}if(location.hash===hash)await refresh();ui.toast(errors.length?`${added} movimientos importados. ${errors.join(' ')}`:`${added} movimientos nuevos importados.`);}finally{el.disabled=false;if(imported)void ui.offerBackup();}return true;
    }
    if(el.dataset.controlSelect){el.checked?selected.add(el.dataset.controlSelect):selected.delete(el.dataset.controlSelect);count();return true;}
    if(el.id==='control-state'){state=el.value;limit=100;paintList();return true;}
    if(el.id==='control-ofi-filter'){ofi=el.value;limit=100;paintList();return true;}
    return false;
  }
  function input(el){if(el.id==='control-query'&&wide()){query=el.value;limit=100;paintList();}}
  async function submit(form){
    if(!wide())return;const row=Object.fromEntries(new FormData(form));
    if(form.id==='control-rename-form'){
      const id=renameId,button=form.querySelector('[type="submit"]');if(!id||button.disabled)return;button.disabled=true;
      try{await C.renameProject(id,row.displayName);renameId=null;ui.closeModal();await refresh();ui.toast('Nombre actualizado.');}finally{if(button.isConnected)button.disabled=false;}
    }
    else if(form.id==='control-bulk-form'){const n=await C.mark(route.id,[...selected],row.kind,row.date);ui.closeModal();selected.clear();await refresh();ui.toast(`${n} productos actualizados.`);}
    else if(form.id==='control-numbers-form'){const result=await C.markNumbers(route.id,row.numbers,row.kind,row.date);ui.closeModal();await refresh();ui.toast(`${result.count} productos actualizados.${result.missing.length?' No encontrados: '+result.missing.join(', '):''}`);}
    else if(form.id==='control-accessory-form'){await C.accessory(route.id,row);ui.closeModal();await refresh();}
  }
  return {init,render,click,change,input,submit};
})();
