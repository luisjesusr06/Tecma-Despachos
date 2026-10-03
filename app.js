/* Interfaz local. No hay API remota, analítica ni envío automático de datos. */
'use strict';
(() => {
  const T=Tecma,R=TecmaReports,$=s=>document.querySelector(s),app=$('#app'),modal=$('#modal');
  const e=T.esc;let current=null,route={},draft=null,draftKey='',selectedWork='',filter='todos',listLimit=100,feedback=null,camera=null,cameraStarting=null,cameraGeneration=0,torch=false,scanQueue=Promise.resolve(),toastTimer,renderVersion=0,audioContext,exportURL=null;
  const cameraTimes=new Map();let homeTab='prepared',recentReads=[],flashTimer,carryGroups=[],closeFiles=[],closeToken=0;
  const btn=(label,action,cls='',attrs='')=>`<button type="button" class="${cls}" data-action="${action}" ${attrs}>${label}</button>`;
  const field=(label,name,value='',extra='')=>`<label>${label}<input name="${name}" value="${e(value)}" ${extra}></label>`;
  const stateLabel=s=>({'cargado':'Cargado','pendiente':'Pendiente','devuelto':'Devuelto','trasladado':'Trasladado'}[s]||'Pendiente');
  const shortLoad=l=>l.name||`Carga · ${T.date(l.createdAt)}`;
  function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,5000);}
  function errorMessage(err){console.error(err);return /quota/i.test(err?.name||'')?'No hay espacio para guardar. Libera espacio y vuelve a intentar. La acción no se registró.':/abort|closed|database/i.test(err?.name||'')?'No se pudo guardar en este dispositivo. Vuelve a abrir la app y revisa los permisos de almacenamiento.':err?.message||'Ocurrió un problema. Vuelve a intentar.';}
  function error(err){const message=errorMessage(err);if(modal.open){let el=$('#dialog-error');if(!el){el=document.createElement('div');el.id='dialog-error';el.className='notice error dialog-error';$('#modal-content').append(el);}el.textContent=message;}else toast(message);}
  function openModal(title,html){$('#modal-title').textContent=title;$('#modal-content').innerHTML=html;if(!modal.open)modal.showModal();}
  function closeModal(){modal.close();if(exportURL){URL.revokeObjectURL(exportURL);exportURL=null;}setTimeout(focusCapture,30);}
  $('#modal-close').onclick=closeModal;
  modal.addEventListener('cancel',event=>{event.preventDefault();closeModal();});
  modal.addEventListener('click',event=>{if(event.target===modal){const r=modal.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeModal();}});
  function confirmModal(title,message,action,label='Confirmar',danger=false){openModal(title,`<p>${message}</p><div class="dialog-actions">${btn('Cancelar','cancel')}${btn(label,action,danger?'danger':'primary')}</div>`);}
  function nav(active){return `<nav class="nav-bottom" aria-label="Secciones de la carga"><a href="#/scan/${current.load.id}" class="${active==='scan'?'current':''}">▥ &nbsp; Escanear</a><a href="#/detail/${current.load.id}" class="${active==='detail'?'current':''}">▤ &nbsp; Productos</a><a href="#/close/${current.load.id}" class="${active==='close'?'current':''}">✓ &nbsp; Cierre y PDF</a></nav>`;}
  function heading(title,sub,action=''){return `<div class="page-heading"><div><div class="eyebrow">Control de despachos</div><h1>${title}</h1>${sub?`<p class="muted subtext">${sub}</p>`:''}</div>${action}</div>`;}
  function workProgress(w,products){const c=T.counts(products.filter(p=>p.workId===w.id));return `<div class="work-progress"><div class="row"><strong>${e(w.obra)}</strong><span>${c.cargado} / ${c.total}</span></div><small class="muted">OP ${e(w.op||'sin OP')}</small><div class="track"><span style="width:${c.total?c.cargado/c.total*100:0}%"></span></div></div>`;}
  async function renderHome(){
    const [loads,works,products,savedDraft]=await Promise.all([T.db.loads.toArray(),T.db.works.toArray(),T.db.products.toArray(),T.db.meta.where('key').startsWith('draft:').toArray()]);
    loads.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    const category=l=>l.status==='closed'?'closed':products.some(p=>p.loadId===l.id&&p.status==='cargado')?'active':'prepared';
    const tabs=[['prepared','Preparadas'],['active','En curso'],['closed','Cerradas']];
    const card=l=>{const ps=products.filter(p=>p.loadId===l.id),ws=works.filter(w=>w.loadId===l.id),c=T.counts(ps);return `<article class="card load-card"><div class="row between"><h2>${e(T.loadName(l,ws,ps))} ${l.label?`<span class="badge">${e(l.label)}</span>`:''}</h2><span class="badge ${l.status==='open'?'active':'closed'}">${tabs.find(t=>t[0]===category(l))[1]}</span></div><small class="muted">${c.cargado} / ${c.total} cargados</small><div class="load-works">${ws.map(w=>workProgress(w,ps)).join('')}</div>${l.patente||l.chofer?`<div class="muted subtext">${e([l.chofer,l.patente].filter(Boolean).join(' · '))}</div>`:''}<div class="card-actions"><a class="button ${l.status==='open'?'primary':''}" href="#/${l.status==='open'?'scan':'close'}/${l.id}">${l.status==='open'?'Continuar carga':'Ver documentos'} →</a>${btn('Eliminar','delete-load','small danger',`data-id="${l.id}"`)}</div></article>`;};
    app.innerHTML=heading('Tus cargas',`${loads.length} cargas guardadas`,`<div class="row"><a class="button desktop-control" href="#/control">Control</a>${btn('＋ Nueva carga','new','primary')}</div>`)+
      savedDraft.filter(d=>d.key==='draft:new'||d.key.startsWith('draft:recovered:')).map(d=>`<div class="notice row between" style="margin-bottom:12px"><span>Preparación guardada.</span>${btn('Retomar','resume-draft','small',`data-key="${e(d.key)}"`)}${btn('Descartar','discard-draft','small danger',`data-key="${e(d.key)}"`)}</div>`).join('')+
      `<div class="tabs" role="tablist" aria-label="Cargas">${tabs.map(([key,label])=>btn(`${label} <span class="count-pill">${loads.filter(l=>category(l)===key).length}</span>`,'home-tab',homeTab===key?'selected':'',`role="tab" aria-selected="${homeTab===key}" data-tab="${key}"`)).join('')}</div>`+
      (loads.some(l=>category(l)===homeTab)?`<div class="grid">${loads.filter(l=>category(l)===homeTab).map(card).join('')}</div>`:`<div class="empty"><h2>${loads.length?'No hay cargas en esta pestaña.':'Tu próximo despacho'}</h2><p class="muted">Una carga para cada obra.</p>${btn('＋ Nueva carga','new','primary')}</div>`)+
      `<div class="backup-bar"><div class="row between"><div><h3>Respaldos</h3><p class="muted subtext">Tus cargas y el Control se guardan en este dispositivo.</p></div><div class="row">${btn('Exportar respaldo','backup','small')}${btn('Importar respaldo','restore','small')}</div></div><input type="file" id="backup-file" accept=".json,application/json" hidden></div><footer><span>Versión 2.0.0</span> · <a href="./ACTUALIZAR.html" class="button small quiet" target="_blank" rel="noopener">Actualizar e instalar</a> ${btn('Buscar actualización','check-update','small quiet')}</footer>`;
  }
  async function getDraft(loadId){draftKey=loadId?`draft:${loadId}`:route.id&&route.id.startsWith('draft:recovered:')?route.id:'draft:new';const saved=await T.db.meta.get(draftKey);draft=saved?.value||{works:[],files:[],chofer:current?.load.chofer||'',rutChofer:current?.load.rutChofer||'',patente:current?.load.patente||'',scheduledDate:'',label:'',carryIds:[]};carryGroups=draft.works[0]?await T.carryCandidates(draft.works[0].obra):[];}
  async function saveDraft(){if(draft)await T.db.meta.put({key:draftKey,value:structuredClone(draft)});}
  function captureDraft(){
    if(!draft)return;for(const key of ['chofer','rutChofer','patente','scheduledDate','label']){const el=$(`[name="${key}"]`);if(el)draft[key]=el.value;}
    const w=draft.works[0];if(w)for(const key of ['rutCliente','direccion','comuna','constructora']){const el=$(`[name="${key}"]`);if(el)w[key]=el.value;}
    draft.carryIds=[...document.querySelectorAll('[data-carry]:checked')].map(el=>el.value);
  }
  function renderDraft(){
    const work=draft.works[0],count=work?.products.length||0;
    app.innerHTML=heading('Nueva carga','Selecciona el CSV de la obra.',`<a class="button quiet small" href="#/">Volver</a>`)+
      `<div class="stack"><section class="card"><div class="row between"><h2>01 · Lista de productos</h2><span class="step">CSV de Excel</span></div><div class="upload-zone">${btn('Seleccionar CSV','choose-csv','primary')}<p>Un archivo por carga.</p>${btn('Usar ejemplo de prueba','example','small quiet')}</div><input type="file" id="csv-files" accept=".csv,text/csv" hidden>${draft.files.length?`<div class="file-list">${draft.files.map(e).join(' · ')}</div>`:''}<div id="import-error" hidden class="notice error" style="margin-top:14px"></div>${draft.notice?`<div class="notice warn" style="margin-top:14px">${e(draft.notice)}</div>`:''}</section>`+
      (work?`<section class="card"><div class="row between"><h2>${e(work.obra)}</h2><span class="badge">OP ${e(work.op||'sin OP')} · ${count} productos</span></div><details><summary>Datos de la obra (opcionales)</summary><div class="fields">${field('RUT cliente','rutCliente',work.rutCliente)}${field('Constructora','constructora',work.constructora)}${field('Dirección','direccion',work.direccion)}${field('Comuna','comuna',work.comuna)}</div></details></section>`:'')+
      carryGroups.map((g,i)=>`<section class="notice"><p>${e(g.name)} tiene ${g.products.length} productos pendientes. ¿Agregarlos a esta carga?</p><details><summary>Elegir productos (opcional)</summary><label class="check-label"><input type="checkbox" data-carry-all="${i}"> Seleccionar todos</label>${g.products.map(p=>`<label class="check-label"><input type="checkbox" data-carry data-group="${i}" value="${p.id}" ${(draft.carryIds||[]).includes(p.id)?'checked':''}><span>${e(p.numero)} · ${e(p.tipo)} · ${e(p.description)}${p.status==='devuelto'?'<small>Devuelto</small>':''}</span></label>`).join('')}</details></section>`).join('')+
      `<section class="card"><h2>02 · Despacho <span class="muted subtext">(opcional)</span></h2><div class="fields">${field('Fecha programada','scheduledDate',draft.scheduledDate||'','type="date"')}${field('Etiqueta','label',draft.label||'','placeholder="sale primero" maxlength="120"')}${field('Chofer','chofer',draft.chofer,'maxlength="120"')}${field('RUT chofer','rutChofer',draft.rutChofer,'maxlength="30"')}${field('Patente','patente',draft.patente,'maxlength="20" autocapitalize="characters"')}</div></section>${btn('Comenzar a escanear','commit-draft','primary wide')}</div>`;
  }
  async function importFiles(files){
    const file=files[0];if(!file)return;captureDraft();const box=$('#import-error');box.hidden=true;
    try{const parsed=await T.readCSV(file),w=T.firstWork(parsed);draft.works=[w];draft.files=[file.name];draft.carryIds=[];
      draft.csvFormat={headers:parsed.headers,columns:parsed.columns,delimiter:parsed.delimiter,newline:parsed.newline,bom:parsed.bom,sepLine:parsed.sepLine};
      draft.notice=new Set(parsed.works.map(w=>T.obraKey(w.obra))).size>1?`El CSV contiene varias obras. Se usó la primera: ${w.obra}.`:'';
      carryGroups=await T.carryCandidates(w.obra);await saveDraft();renderDraft();if(parsed.duplicates)toast(`${parsed.duplicates} filas repetidas se incluyeron una sola vez.`);
    }catch(err){box.textContent=errorMessage(err);box.hidden=false;}
  }
  function renderScan(){
    const closed=false,returns=route.page==='return';
    app.innerHTML=heading(returns?'Registrar devolución':'Escanear carga',e(shortLoad(current.load)),`<a class="button quiet small" href="#/">Mis cargas</a>`)+
      (returns?'<div class="notice" style="margin-bottom:18px">Escanea los productos que volvieron.</div>':'')+
      `<div class="scan-layout"><div class="stack"><div id="scan-feedback" role="status" aria-live="polite" aria-atomic="true"></div>${!closed?`<div class="reader-box"><div class="row between"><h2>Lector Bluetooth</h2><span id="reader-status" class="reader-status">Lector en pausa</span></div><p>Lee una etiqueta. El lector debe enviar Enter al terminar.</p><input id="capture" aria-label="Captura del lector Bluetooth" inputmode="none" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="Esperando código…"><div class="row" style="margin-top:12px">${btn('Activar lector','focus','lime wide')}</div></div><section class="card"><h2>Ingresar código a mano</h2><form id="manual-scan" class="manual-entry"><input name="numero" id="manual-code" aria-label="Código de 6 dígitos" inputmode="numeric" autocomplete="off" placeholder="000000" maxlength="30"><button type="submit" class="primary">Agregar</button></form></section><div class="scan-controls">${btn('▣ Cámara','camera','wide')}${btn('↶ Deshacer último','undo','wide')}</div><div id="camera-panel" class="camera-panel" hidden><div id="camera-surface" class="camera-surface"><div id="camera-reader"></div><div id="camera-counter" class="camera-counter"></div><div id="camera-flash" class="camera-flash" hidden></div></div><div id="camera-recent" class="camera-recent" aria-label="Últimas tres lecturas"></div><div class="row">${btn('Encender linterna','torch','small','id="torch-button" hidden')}${btn('Cerrar cámara','stop-camera','small')}</div><p id="camera-note" class="subtext muted" style="padding:0 12px"></p></div>`:''}</div><aside class="scan-side stack"><section><h2>Obra de esta carga</h2><div id="scan-summary" class="scan-summary"></div></section><div class="toolbar"><a class="button small" href="#/detail/${current.load.id}">Ver productos</a></div></aside></div>${nav('scan')}`;
    updateScan();focusCapture();
  }
  function updateScan(){if(!$('#scan-summary'))return;$('#scan-summary').innerHTML=current.works.map(w=>workProgress(w,current.products)).join('');const c=T.counts(current.products);if($('#camera-counter'))$('#camera-counter').innerHTML=`<strong>${route.page==='return'?c.devuelto:c.cargado}</strong><small>de ${c.total}${route.page==='return'?' devueltos':''}</small>`;renderFeedback();}
  function renderFeedback(){const el=$('#scan-feedback');if(!el)return;const f=feedback||{style:'neutral',title:'Todo listo para cargar',message:'Escanea la primera etiqueta del camión.'};el.className=`scan-feedback ${f.style}`;el.innerHTML=`${f.numero?`<div class="code">${e(f.numero)}</div>`:''}<h2>${e(f.title)}</h2>${f.message?`<p class="${f.product?'product-label':'subtext'}">${e(f.message)}</p>`:''}${f.extra?`<p class="subtext">${e(f.extra)}</p>`:''}${f.unknown?btn('Agregar como línea manual','unknown-accessory','small'):''}`;}
  function focusCapture(){if(!['scan','return'].includes(route.page)||modal.open||document.hidden)return;const el=$('#capture');if(el){el.focus({preventScroll:true});updateReader();}}
  function updateReader(){const el=$('#reader-status');if(el){const ready=document.activeElement===$('#capture');el.textContent=ready?'Lector listo':'Lector en pausa';el.classList.toggle('ready',ready);}}
  function unlockAudio(){try{audioContext ||= new (window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});}catch{}}
  function signal(kind){
    const config={success:{v:[60],tones:[880],ms:120},duplicate:{v:[40,80,40],tones:[600,600],ms:90},previous:{v:[40,80,40,80,40],tones:[700,600,500],ms:90},error:{v:[250,100,250,100,250],tones:[220],ms:400}}[kind]||{v:[250,100,250,100,250],tones:[220],ms:400};
    try{if(audioContext?.state==='running'){const start=audioContext.currentTime;config.tones.forEach((hz,i)=>{const at=start+i*(config.ms/1000+.08),osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type='sine';osc.frequency.value=hz;gain.gain.setValueAtTime(.12,at);gain.gain.exponentialRampToValueAtTime(.001,at+config.ms/1000);osc.connect(gain);gain.connect(audioContext.destination);osc.start(at);osc.stop(at+config.ms/1000);});}}catch{}
    try{navigator.vibrate?.(config.v);}catch{}
  }
  function showReading(kind){
    updateScan();signal(kind);
    const f=feedback,flash=$('#camera-flash'),surface=$('#camera-surface');
    recentReads.unshift({style:f.style,title:f.title,numero:f.numero||''});recentReads=recentReads.slice(0,3);
    if(surface){surface.dataset.result=f.style;flash.className=`camera-flash ${f.style}`;flash.innerHTML=`<strong>${e(f.title)}</strong><span>${e(f.numero||'')}</span>`;flash.hidden=false;clearTimeout(flashTimer);flashTimer=setTimeout(()=>{flash.hidden=true;},600);}
    const recent=$('#camera-recent');if(recent)recent.innerHTML=recentReads.map(r=>`<span class="read-chip ${r.style}"><b>${e(r.numero)}</b> ${e(r.title)}</span>`).join('');
  }
  function queueScan(raw,source){unlockAudio();const loadId=current?.load.id;if(!loadId||modal.open)return;scanQueue=scanQueue.then(()=>processCode(raw,source,loadId)).catch(err=>{feedback={style:'error',title:'No se guardó la lectura',message:errorMessage(err)};showReading('error');});return scanQueue;}
  async function processCode(raw,source,loadId){
    if(!['scan','return'].includes(route.page)||current?.load.id!==loadId||modal.open)return;
    const numero=T.normalizeNumber(raw);if(!numero)return;
    if(!/^\d{6}$/.test(numero)){feedback={style:'error',title:'Código no válido',message:'La etiqueta debe tener un número de 6 dígitos.',numero};showReading('error');return;}
    const found=await T.db.products.where('[loadId+numero]').equals([loadId,numero]).toArray();
    if(!found.length){
      if(route.page==='return'){feedback={style:'error',title:'No está en esta carga',numero,message:'Puedes seguir escaneando.'};showReading('error');return;}
      const result=await T.scanUnknown(loadId,numero,source);current=await T.loadData(loadId);
      feedback={style:'error',title:'No está en la carga',numero,message:'Incluido en el PDF como «Código '+numero+'». Puedes completar el detalle tocando el producto.',product:true};showReading('error');return;
    }
    // En cargas antiguas con códigos duplicados usamos el primer registro pendiente.
    await acceptProduct((found.find(p=>p.status==='pendiente')||found[0]).id,source);
  }
  async function acceptProduct(id,source){
    const returns=route.page==='return',result=returns?await T.returnProduct(id,T.now(),source):await T.scanProduct(id,source),p=result.product,w=current.works.find(w=>w.id===p.workId);
    current.products=current.products.map(x=>x.id===p.id?p:x);
    const message=`${w.obra} · ${p.tipo} · ${p.description}`;
    const previous=result.kind==='previous',duplicate=result.kind==='duplicate';
    feedback={style:previous?'info':duplicate?'warning':'success',title:previous?'Ya se despachó antes':duplicate?(returns?'Ya devuelto':'Ya escaneado'):returns?'Devuelto':'Cargado',message,product:true,numero:p.numero,extra:previous?`${result.previous.name} · ${T.date(result.previous.date)}`:`${T.date(returns?p.returnedAt:p.scannedAt)} · ${T.time(returns?p.returnedAt:p.scannedAt)}`};
    showReading(previous?'previous':duplicate?'duplicate':'success');
  }
  async function startCamera(){
    if(camera||cameraStarting)return;if(!navigator.mediaDevices?.getUserMedia){toast('La cámara necesita abrir la app con HTTPS y un navegador compatible.');return;}
    const panel=$('#camera-panel');panel.hidden=false;const generation=++cameraGeneration;$('#camera-note').textContent='Abriendo cámara…';
    const reader=new Html5Qrcode('camera-reader',{formatsToSupport:[Html5QrcodeSupportedFormats.CODE_128,Html5QrcodeSupportedFormats.CODE_39,Html5QrcodeSupportedFormats.ITF],useBarCodeDetectorIfSupported:false,verbose:false});camera=reader;
    cameraStarting=reader.start({facingMode:'environment'},{fps:10,qrbox:(w,h)=>({width:Math.floor(w*.9),height:Math.floor(Math.min(h*.65,160))}),disableFlip:false},decoded=>{const n=T.normalizeNumber(decoded);if(modal.open||document.hidden)return;const stamp=Date.now();if(stamp-(cameraTimes.get(n)||0)<2000)return;cameraTimes.set(n,stamp);if(cameraTimes.size>300)cameraTimes.delete(cameraTimes.keys().next().value);queueScan(n,'cámara');},()=>{});
    try{await cameraStarting;if(generation!==cameraGeneration)return;$('#camera-note').textContent='Centra el código completo y deja espacio a sus lados.';let caps;try{caps=reader.getRunningTrackCapabilities();}catch{}$('#torch-button').hidden=!caps?.torch;panel.scrollIntoView({block:'nearest',behavior:'smooth'});}catch(err){if(generation===cameraGeneration){camera=null;$('#camera-note').textContent='No se pudo abrir la cámara. Revisa el permiso de cámara en el navegador. Puedes seguir con el lector o ingreso manual.';}}finally{cameraStarting=null;}
  }
  async function stopCamera(){++cameraGeneration;const c=camera;camera=null;if(cameraStarting){try{await cameraStarting;}catch{}}if(c){try{if(c.isScanning)await c.stop();c.clear();}catch{}}torch=false;const p=$('#camera-panel');if(p)p.hidden=true;}
  async function toggleTorch(){if(!camera)return;try{await camera.applyVideoConstraints({advanced:[{torch:!torch}]});torch=!torch;$('#torch-button').textContent=torch?'Apagar linterna':'Encender linterna';}catch{toast('Este teléfono no permite controlar la linterna desde el navegador.');}}
  function currentWork(){return current.works.find(w=>w.id===selectedWork)||current.works[0];}
  function renderDetail(){
    const work=currentWork();selectedWork=work.id;const closed=current.load.status==='closed',products=current.products,c=T.counts(products),all=products.filter(p=>filter==='todos'||p.status===filter).sort((a,b)=>T.natural.compare(a.tipo,b.tipo)||T.natural.compare(a.numero,b.numero)),visible=all.slice(0,listLimit);let lastType='';
    const filters=[['todos','Todos',products.length],['pendiente','Pendientes',c.pendiente],['cargado','Cargados',c.cargado]];if(c.devuelto)filters.push(['devuelto','Devueltos',c.devuelto]);if(c.trasladado)filters.push(['trasladado','Trasladados',c.trasladado]);
    app.innerHTML=heading('Detalle de productos',e(shortLoad(current.load)),`<a class="button small quiet" href="#/">Mis cargas</a>`)+`<div class="row between"><div><h2 style="margin:10px 0">${e(work.obra)}</h2><span class="muted subtext">OP ${e(work.op||'—')} · ${c.cargado}/${c.total} cargados</span></div>${btn('Editar datos','edit-metadata','small')}${closed?`<a class="button small" href="#/return/${current.load.id}">Registrar devolución</a>`:''}</div><div class="filters" aria-label="Filtrar productos">${filters.map(([key,label,count])=>btn(`${label} ${count}`,'filter',filter===key?'selected':'',`data-filter="${key}" aria-pressed="${filter===key}"`)).join('')}</div><section aria-label="Productos">${visible.map(p=>{const header=p.tipo!==lastType?`<h3 class="type-heading">${e(p.tipo)}</h3>`:'';lastType=p.tipo;return header+`<button type="button" class="product ${p.status}" data-action="product" data-id="${p.id}"><span class="body"><strong>${e(p.description)} ${p.note?'<span class="note-dot" title="Tiene nota" aria-label="Tiene nota">●</span>':''}</strong><small>${e(p.numero)} · ${e(p.orden||'Sin OF')}${p.atril?' · Atril '+e(p.atril):''}</small>${p.carryFrom?.length?'<small>↳ Viene de carga anterior</small>':''}${p.transferredTo?`<small>Trasladado a ${e(p.transferredTo.name||'otra carga')}</small>`:''}</span><span class="state">${stateLabel(p.status)}${p.scannedAt?`<small>${T.time(p.scannedAt)}</small>`:''}</span></button>`;}).join('')||'<div class="empty">No hay productos con este estado.</div>'}${all.length>visible.length?btn(`Mostrar más (${visible.length}/${all.length})`,'more-products','wide'):''}</section><section class="card" style="margin-top:28px"><div class="row between"><h2 style="margin:0">Accesorios</h2>${btn('＋ Agregar accesorio','accessory','small')}</div><div style="margin-top:16px">${current.accessories.map(a=>`<div class="accessory row between"><div><strong>${e(a.description)}</strong><p class="muted subtext" style="margin:5px 0">${R.num(a.quantity)} ${e(a.unit)}${a.atril?' · Atril '+e(a.atril):''}</p></div>${btn('Editar','accessory','small',`data-id="${a.id}"`)}</div>`).join('')||'<p class="muted subtext">Sin accesorios agregados.</p>'}</div></section>${nav('detail')}`;
  }
  async function productModal(id){
    const p=await T.db.products.get(id);if(!p)return;const closed=current.load.status==='closed';
    const history=(await T.db.events.where('productId').equals(id).toArray()).sort((a,b)=>b.at.localeCompare(a.at));
    const labels={scan:'Escaneado',edit:'Producto editado',undo:'Escaneo deshecho','scan-duplicate':'Lectura repetida',return:'Devuelto',transfer:'Trasladado'};
    openModal(`${p.numero} · ${p.tipo}`,`<form id="product-form" data-id="${p.id}"><div class="stack">${!closed&&p.status!=='trasladado'?`<label>Estado<select name="status">${['pendiente','cargado'].map(s=>`<option value="${s}" ${p.status===s?'selected':''}>${stateLabel(s)}</option>`).join('')}</select></label>`:`<p>${stateLabel(p.status)}</p>`}<label>Descripción para el PDF<textarea name="description" maxlength="1200">${e(p.description)}</textarea></label>${field('Atril (opcional)','atril',p.atril,'maxlength="100"')}<label>Nota (opcional)<textarea name="note" maxlength="4000">${e(p.note||'')}</textarea></label></div><details><summary>Historial (${history.length})</summary><ol class="history">${history.map(h=>`<li>${T.date(h.at)} ${T.time(h.at)} · ${e(labels[h.kind]||h.kind)}${h.after?.status?' → '+stateLabel(h.after.status):''}</li>`).join('')||'<li>Sin cambios registrados.</li>'}</ol></details><div class="dialog-actions">${closed?btn('Marcar devuelto','return-product','',`data-id="${p.id}"`):''}<button type="submit" class="primary">Guardar cambios</button></div></form>`);
  }
  function accessoryModal(id,unknown=false){const a=current.accessories.find(a=>a.id===id),work=a?current.works.find(w=>w.id===a.workId):currentWork();openModal(a?'Editar accesorio':'Agregar accesorio',`<form id="accessory-form" data-id="${a?.id||''}"><div class="stack"><input type="hidden" name="workId" value="${work.id}"><label>Descripción<textarea name="description" maxlength="1200">${e(a?.description||(unknown?`Código ${feedback.numero} · `:''))}</textarea></label><div class="fields">${field('Cantidad','quantity',a?.quantity||1,'inputmode="decimal"')}${field('Unidad','unit',a?.unit||'UNI','id="accessory-unit" maxlength="20"')}</div><div class="unit-buttons">${btn('UNI','unit','small',`data-unit="UNI"`)}${btn('MT','unit','small',`data-unit="MT"`)}${btn('Otra unidad','unit','small',`data-unit=""`)}</div>${field('Atril (opcional)','atril',a?.atril||'','maxlength="100"')}</div><div class="dialog-actions">${a?btn('Eliminar','delete-accessory','danger',`data-id="${a.id}"`):btn('Cancelar','cancel')}<button type="submit" class="primary">Guardar accesorio</button></div></form>`);}
  function metadataModal(){const w=currentWork(),l=current.load,closed=false;openModal('Datos de la obra y transporte',`<form id="metadata-form"><div class="stack"><h3>${e(w.obra)} · OP ${e(w.op)}</h3><div class="fields">${field('RUT cliente','rutCliente',w.rutCliente,`maxlength="30" ${closed?'readonly':''}`)}${field('Constructora','constructora',w.constructora,`maxlength="160" ${closed?'readonly':''}`)}${field('Dirección','direccion',w.direccion,`maxlength="250" ${closed?'readonly':''}`)}${field('Comuna','comuna',w.comuna,`maxlength="100" ${closed?'readonly':''}`)}</div><h3>Transporte de toda la carga</h3><div class="fields">${field('Chofer','chofer',l.chofer,`maxlength="120" ${closed?'readonly':''}`)}${field('RUT chofer','rutChofer',l.rutChofer,`maxlength="30" ${closed?'readonly':''}`)}${field('Patente','patente',l.patente,`maxlength="20" ${closed?'readonly':''}`)}</div></div>${closed?'':'<div class="dialog-actions"><button type="submit" class="primary">Guardar datos</button></div>'}</form>`);}
  function renderClose(){
    const closed=current.load.status==='closed',c=T.counts(current.products),w=current.works[0];
    app.innerHTML=heading('Cierre y documentos',e(shortLoad(current.load)),`<a class="button small quiet" href="#/">Mis cargas</a>`)+
      `<div class="card ${closed?'':'hero-card'}" style="margin-bottom:22px"><div class="row between"><div><span class="badge ${closed?'closed':'active'}">${closed?'Cerrada':'En curso'}</span><h2 style="margin:12px 0 6px">${closed?'Despacho cerrado':'Documentos del despacho'}</h2><p class="muted subtext" style="margin:0">${closed?`${T.date(current.load.closedAt)} · ${T.time(current.load.closedAt)}`:`${c.cargado} cargados · ${c.pendiente} pendientes`}</p></div>${btn(closed?'Reabrir carga':'Cerrar carga',closed?'reopen':'close',closed?'':'lime')}</div></div>`+
      `<section class="card"><div class="row between"><h2 style="margin:0">${e(w.obra)}</h2><span class="muted subtext">OP ${e(w.op||'—')}</span></div><div class="stats"><div class="stat good"><strong>${c.cargado}</strong><span>Cargados</span></div><div class="stat pending"><strong>${c.pendiente}</strong><span>Pendientes</span></div><div class="stat"><strong>${c.total}</strong><span>Productos</span></div><div class="stat"><strong>${current.accessories.length}</strong><span>Accesorios</span></div></div><div class="export-buttons">${btn('↓ PDF para guías','export','primary',`data-kind="guide"`)}${btn('↓ PDF de control','export','',`data-kind="control"`)}${btn('↓ Códigos escaneados','export','',`data-kind="codes"`)}${closed?btn('↓ JSON de cierre','export','',`data-kind="closure"`):''}</div>${closed?`<div class="row" style="margin-top:16px">${btn('Compartir archivos del cierre','share-close','small','id="share-close" hidden')}<a class="button small" href="#/return/${current.load.id}">Registrar devolución</a></div><p id="close-file-status" class="muted subtext"></p>`:''}</section>${nav('close')}`;
    if(closed)prepareCloseFiles().catch(error);
  }
  async function prepareCloseFiles(){
    const token=++closeToken,data=structuredClone(current),files=[];
    for(const kind of ['guide','control','codes','closure']){try{files.push(makeFile(data,kind));}catch(err){toast(errorMessage(err));}}
    if(token!==closeToken||route.page!=='close'||current.load.id!==data.load.id)return;
    closeFiles=files;const status=$('#close-file-status');if(status)status.textContent=`${files.length} archivos listos para compartir o descargar.`;
    const ready=files.map(f=>new File([f.blob],f.name,{type:f.blob.type}));if($('#share-close'))$('#share-close').hidden=!(navigator.canShare?.({files:ready}));
  }
  function makeFile(data,kind){return kind==='codes'?R.createCodes(data):kind==='closure'?R.createClosure(data):R.createPDF(data,undefined,kind==='control');}
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  function fileDialog(file){const readyFile=new File([file.blob],file.name,{type:file.blob.type});const share=!!(navigator.canShare&&navigator.canShare({files:[readyFile]}));exportURL=URL.createObjectURL(file.blob);openModal('Documento listo',`<p style="overflow-wrap:anywhere"><strong>${e(file.name)}</strong></p><p>Elige cómo guardar o enviar el archivo.</p><div class="stack">${share?btn('Compartir por WhatsApp, correo…','share-file','primary'):''}${btn('Descargar archivo','download-file',share?'':'primary')}${file.blob.type==='application/pdf'?`<a class="button" href="${exportURL}" target="_blank" rel="noopener">Ver PDF</a>`:''}</div>`);$('#modal-content')._file={...file,readyFile};if(!share)download(file.blob,file.name);}
  async function exportWork(workId,kind){await scanQueue;const data=await T.loadData(current.load.id);fileDialog(makeFile(data,kind));}
  async function restoreFile(file){if(!file)return;if(file.size>100*1024*1024)throw new Error('El respaldo supera 100 MB. Prueba en un computador con más memoria.');let b;try{b=JSON.parse(await file.text());}catch{throw new Error('No se pudo leer el respaldo. Selecciona el archivo JSON original.');}T.validateBackup(b);openModal('Importar respaldo',`<p>Se agregarán <strong>${b.loads.length} cargas</strong> y ${b.products.length} productos como copias. Tus cargas actuales se conservan.</p><p>Si ya importaste este archivo, volverás a tener esas cargas.</p><div class="dialog-actions">${btn('Cancelar','cancel')}${btn('Importar cargas','confirm-restore','primary')}</div>`);$('#modal-content')._backup=b;}
  async function refresh(){if(current){current=await T.loadData(current.load.id);if(['scan','return'].includes(route.page))updateScan();else if(route.page==='detail')renderDetail();else if(route.page==='close')renderClose();}}
  async function navigate(){
    const version=++renderVersion;if(draft&&route.page==='new'){captureDraft();await saveDraft();}
    await stopCamera();if(modal.open)closeModal();
    const parts=location.hash.replace(/^#\/?/,'').split('/');route={page:parts[0]||'home',id:parts[1],sub:parts[2]};feedback=null;recentReads=[];draft=null;
    try{
      if(['scan','return','detail','close'].includes(route.page)){const data=await T.loadData(route.id);if(version!==renderVersion)return;current=data;}else current=null;
      if(route.page==='home')await renderHome();
      else if(route.page==='new'){await getDraft();renderDraft();}
      else if(['scan','return'].includes(route.page))renderScan();
      else if(route.page==='control')await TecmaControlUI.render(route);
      else if(route.page==='detail'){listLimit=100;renderDetail();}
      else if(route.page==='close')renderClose();
      else location.hash='#/';
      window.scrollTo(0,0);
    }catch(err){app.innerHTML=heading('No se pudo abrir',e(errorMessage(err)),`<a class="button" href="#/">Volver al inicio</a>`);}
  }
  document.addEventListener('click',async event=>{
    unlockAudio();const b=event.target.closest('[data-action]');if(!b||b.disabled)return;const action=b.dataset.action;
    try{
      if(await TecmaControlUI.click(action,b))return;
      if(action==='cancel')closeModal();
      else if(action==='home-tab'){homeTab=b.dataset.tab;await renderHome();}
      else if(action==='check-update'){const reg=await navigator.serviceWorker?.getRegistration();await reg?.update();toast(reg?.waiting?'Actualización lista. Cierra todas las ventanas de Tecma y vuelve a abrirla.':'Comprobación terminada. Si hay una actualización, cierra y vuelve a abrir Tecma.');}
      else if(action==='return-product'){await T.returnProduct(b.dataset.id);closeModal();await refresh();}
      else if(action==='share-close'){const files=closeFiles.map(f=>new File([f.blob],f.name,{type:f.blob.type}));try{await navigator.share({files,title:shortLoad(current.load)});}catch(err){if(err.name!=='AbortError')toast('Puedes descargar cada archivo con sus botones.');}}
      else if(action==='new')location.hash='#/new';
      else if(action==='choose-csv')$('#csv-files').click();
      else if(action==='example'){const response=await fetch('./ejemplo.csv');if(!response.ok)throw new Error('No se pudo abrir el ejemplo.');await importFiles([new File([await response.blob()],'ejemplo.csv',{type:'text/csv'})]);}
      else if(action==='commit-draft'){b.disabled=true;captureDraft();await saveDraft();const result=await T.commitDraft(draft,null,draftKey);draft=null;location.hash=`#/scan/${result.loadId}`;toast(`${result.added} productos agregados.${result.skipped?` ${result.skipped} ya estaban en la carga.`:''}`);try{await navigator.storage?.persist?.();}catch{}}
      else if(action==='resume-draft')location.hash=`#/new/${b.dataset.key}`;
      else if(action==='discard-draft'){confirmModal('¿Descartar preparación?','Se eliminarán los CSV de esta preparación. Las cargas existentes se conservan.','confirm-discard','Descartar',true);$('#modal-content').dataset.key=b.dataset.key;}
      else if(action==='confirm-discard'){await T.db.meta.delete($('#modal-content').dataset.key);closeModal();await renderHome();}
      else if(action==='delete-load'){confirmModal('¿Eliminar esta carga?','Se eliminarán sus productos, accesorios e historial de este dispositivo. Esta acción no se puede deshacer.','confirm-delete-load','Eliminar carga',true);$('#modal-content').dataset.load=b.dataset.id;}
      else if(action==='confirm-delete-load'){await T.deleteLoad($('#modal-content').dataset.load);closeModal();await renderHome();toast('Carga eliminada.');}
      else if(action==='focus')focusCapture();
      else if(action==='camera')await startCamera();
      else if(action==='stop-camera'){await stopCamera();focusCapture();}
      else if(action==='torch')await toggleTorch();
      else if(action==='undo'){b.disabled=true;await scanQueue;const p=await T.undoScan(current.load.id);current.products=current.products.map(x=>x.id===p.id?p:x);feedback={style:'neutral',title:'Escaneo deshecho',numero:p.numero,message:`${p.tipo} · ${p.description}`,extra:`Estado: ${stateLabel(p.status)}`};updateScan();focusCapture();}
      else if(action==='unknown-accessory')accessoryModal(null,true);
      else if(action==='filter'){filter=b.dataset.filter;listLimit=100;renderDetail();}
      else if(action==='more-products'){listLimit+=100;const y=scrollY;renderDetail();scrollTo(0,y);}
      else if(action==='product')await productModal(b.dataset.id);
      else if(action==='accessory')accessoryModal(b.dataset.id);
      else if(action==='unit'){$('#accessory-unit').value=b.dataset.unit;if(!b.dataset.unit)$('#accessory-unit').focus();}
      else if(action==='delete-accessory'){const id=b.dataset.id;confirmModal('¿Eliminar accesorio?','Se quitará esta línea del despacho.','confirm-delete-accessory','Eliminar',true);$('#modal-content').dataset.accessory=id;}
      else if(action==='confirm-delete-accessory'){await T.deleteAccessory($('#modal-content').dataset.accessory);closeModal();await refresh();}
      else if(action==='edit-metadata')metadataModal();
      else if(action==='close'){await scanQueue;await T.setClosed(current.load.id,true);await refresh();}
      else if(action==='reopen'){await T.setClosed(current.load.id,false);await refresh();}
      else if(action==='export'){b.disabled=true;await exportWork(b.dataset.work,b.dataset.kind);}
      else if(action==='share-file'){const f=$('#modal-content')._file;try{await navigator.share({files:[f.readyFile],title:f.name});}catch(err){if(err.name!=='AbortError'){download(f.blob,f.name);toast('No se pudo compartir. El archivo se descargó.');}}}
      else if(action==='download-file'){const f=$('#modal-content')._file;download(f.blob,f.name);}
      else if(action==='backup'){b.disabled=true;const backup=await T.backup();fileDialog({blob:new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}),name:`Respaldo_Tecma_${T.dateKey(T.now())}.json`});}
      else if(action==='restore')$('#backup-file').click();
      else if(action==='confirm-restore'){b.disabled=true;const n=await T.restoreBackup($('#modal-content')._backup);closeModal();await renderHome();toast(`${n} cargas restauradas.`);}
    }catch(err){error(err);}finally{if(b.isConnected)b.disabled=false;}
  });
  document.addEventListener('submit',async event=>{
    const f=event.target;if(f.id.startsWith('control-')){event.preventDefault();try{await TecmaControlUI.submit(f);}catch(err){error(err);}return;}if(!['manual-scan','product-form','accessory-form','metadata-form'].includes(f.id))return;event.preventDefault();const data=Object.fromEntries(new FormData(f)),submit=f.querySelector('[type="submit"]');
    try{
      if(f.id==='manual-scan'){const code=data.numero;f.reset();await queueScan(code,'manual');focusCapture();return;}
      submit.disabled=true;
      if(f.id==='product-form'){await T.changeProduct(f.dataset.id,{status:data.status,note:data.note,description:data.description,atril:data.atril});}
      else if(f.id==='accessory-form')await T.saveAccessory({...data,id:f.dataset.id||undefined,loadId:current.load.id});
      else if(f.id==='metadata-form'){const w=currentWork();await T.db.transaction('rw',T.db.loads,T.db.works,T.db.events,async()=>{const workPatch={},loadPatch={updatedAt:T.now()};for(const key of ['rutCliente','direccion','comuna','constructora'])workPatch[key]=T.clean(data[key]);for(const key of ['chofer','rutChofer','patente'])loadPatch[key]=T.clean(data[key]);await T.db.works.update(w.id,workPatch);await T.db.loads.update(current.load.id,loadPatch);await T.db.events.add({id:T.uid(),loadId:current.load.id,at:T.now(),kind:'metadata-edit',workId:w.id,before:{work:w,load:current.load},after:{work:workPatch,load:loadPatch}});});}
      closeModal();await refresh();toast('Cambios guardados.');
    }catch(err){error(err);}finally{if(submit?.isConnected)submit.disabled=false;}
  });
  document.addEventListener('change',async event=>{try{
    if(await TecmaControlUI.change(event.target))return;
    if(event.target.dataset.carryAll!==undefined){document.querySelectorAll(`[data-carry][data-group="${event.target.dataset.carryAll}"]`).forEach(el=>el.checked=event.target.checked);captureDraft();await saveDraft();}
    else if(event.target.id==='csv-files'){if(event.target.files.length)await importFiles(event.target.files);}
    else if(event.target.id==='backup-file'){await restoreFile(event.target.files[0]);event.target.value='';}
    else if(draft&&app.contains(event.target)){captureDraft();await saveDraft();if(event.target.name==='include')renderDraft();}
  }catch(err){error(err);}});
  document.addEventListener('input',event=>{TecmaControlUI.input(event.target);if(draft&&app.contains(event.target)&&event.target.type!=='file'){captureDraft();saveDraft().catch(error);}});
  document.addEventListener('keydown',event=>{if(event.target.id==='capture'&&event.key==='Enter'){event.preventDefault();const code=event.target.value;event.target.value='';queueScan(code,'bluetooth');}});
  document.addEventListener('focusin',updateReader);document.addEventListener('focusout',()=>setTimeout(updateReader,0));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCamera();else{if(!modal.open&&current)refresh().catch(error);focusCapture();}});
  window.addEventListener('pagehide',()=>{stopCamera();});
  window.addEventListener('hashchange',navigate);
  function network(){ $('#online-state').textContent=navigator.onLine?'Con conexión':'Sin conexión'; }
  window.addEventListener('online',network);window.addEventListener('offline',network);
  async function offlineReady(){
    const label=$('#offline-state');if(!('serviceWorker'in navigator)||!window.isSecureContext){label.textContent='Abre con HTTPS para usar sin conexión';return;}
    try{
      const reg=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
      const ready=await navigator.serviceWorker.ready;
      const check=()=>{const worker=navigator.serviceWorker.controller||ready.active;if(worker){const channel=new MessageChannel();channel.port1.onmessage=event=>{label.textContent=event.data.ready?'Lista para usar sin conexión':'Preparando uso sin conexión';};worker.postMessage({type:'CHECK_CACHE'},[channel.port2]);}};
      check();navigator.serviceWorker.addEventListener('controllerchange',check);
      reg.addEventListener('updatefound',()=>{const sw=reg.installing;sw?.addEventListener('statechange',()=>{if(sw.state==='installed'&&navigator.serviceWorker.controller)toast('Hay una actualización. Cierra todas las ventanas de la app y vuelve a abrirla para aplicarla.');});});
    }catch(err){label.textContent='Sin conexión aún no disponible';console.error(err);}
  }
  TecmaControlUI.init({btn,field,heading,toast,error,openModal,closeModal,fileDialog,download});
  (async()=>{network();try{await T.db.open();await navigate();offlineReady();}catch(err){app.innerHTML=heading('No se pudo iniciar',e(errorMessage(err)))+'<p>Usa una ventana normal de Chrome o Safari y permite guardar datos del sitio.</p>';}})();
})();
