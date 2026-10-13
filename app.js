/* Interfaz local. No hay API remota, analítica ni envío automático de datos. */
'use strict';
(() => {
  const T=Tecma,P=TecmaObras,U=TecmaObrasUI,R=TecmaReports,$=s=>document.querySelector(s),app=$('#app'),modal=$('#modal');
  const e=T.esc;let current=null,route={},selectedWork='',filter='todos',listLimit=100,feedback=null,camera=null,cameraStarting=null,cameraGeneration=0,torch=false,scanQueue=Promise.resolve(),toastTimer,renderVersion=0,audioContext,exportURL=null;
  const cameraTimes=new Map();let recentReads=[],flashTimer,closeFiles=[],closeToken=0,detailQuery='',focusLimit=20,pendingBackup=null,backupQueue=Promise.resolve(),transition=null,transitionBusy=false,booting=true;
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
  const backLink=()=>`<a class="button small quiet" href="${current?.load.projectId?'#/obra/'+e(current.load.projectId):'#/'}">Obra</a>`;
  async function backupBar(){const lastBackup=await T.db.meta.get('backup:last');return `<div class="backup-bar"><div class="row between"><div><h3>Respaldos</h3><p class="muted subtext">Tus obras, despachos y el Control se guardan en este dispositivo.</p><small class="muted">Último respaldo: ${lastBackup?shortDate(lastBackup.value):'sin respaldos'}</small></div><div class="row">${btn('Exportar respaldo','backup','small')}${btn('Importar respaldo','restore','small')}</div></div><input type="file" id="backup-file" accept=".txt,.json,text/plain,application/json" hidden>${!lastBackup||Date.now()-Date.parse(lastBackup.value)>7*86400000?`<div class="notice row between"><small>${lastBackup?'Han pasado más de 7 días sin generar un respaldo.':'Todavía no hay un respaldo completo.'}</small>${btn('Respaldar ahora','backup','small')}</div>`:''}</div><footer><span>Versión 3.1.0</span> · <a href="./ACTUALIZAR.html" class="button small quiet" target="_blank" rel="noopener">Actualizar e instalar</a> ${btn('Buscar actualización','check-update','small quiet')}</footer>`;}
  async function renderHome(){await U.render({page:'home'});app.insertAdjacentHTML('beforeend',await backupBar());}
  function focusOrders(){return [...new Set(current.products.map(P.order))].sort((a,b)=>Number(!a)-Number(!b)||T.natural.compare(a,b));}
  function focusPicker(){const f=current.load.focus||[],v=f.length>1?'custom':f.length?'ofi:'+f[0]:'all';return `<div class="row"><label>Foco OFI<select id="scan-ofi"><option value="all" ${v==='all'?'selected':''}>Todas las OFI</option>${f.length>1?`<option value="custom" selected>${e(f.map(P.orderLabel).join(', '))}</option>`:''}${focusOrders().map(o=>`<option value="ofi:${e(o)}" ${v==='ofi:'+o?'selected':''}>${e(P.orderLabel(o))}</option>`).join('')}</select></label>${btn('Elegir varias','focus-many','small')}</div>`;}
  function paintFocus(){if($('#focus-picker'))$('#focus-picker').innerHTML=focusPicker();}
  function paintFocusProducts(){const target=$('#focus-products');if(!target)return;const rows=current.products.filter(p=>P.focused(current.load,p)).sort((a,b)=>T.natural.compare(P.order(a),P.order(b))||T.natural.compare(a.tipo,b.tipo)||T.natural.compare(a.numero,b.numero));$('#focus-count').textContent=rows.filter(p=>p.status==='cargado').length+' de '+rows.length+' cargados';target.innerHTML=rows.slice(0,focusLimit).map(p=>`<button class="product ${p.status}" data-action="product" data-id="${e(p.id)}"><span class="body"><strong>${e(p.tipo)} · ${e(p.description)}</strong><small>${e(p.numero)} · ${e(P.orderLabel(P.order(p)))}</small></span><span class="state">${stateLabel(p.status)}</span></button>`).join('')+(rows.length>focusLimit?btn('Mostrar más','focus-more','small wide'):'');}
  function renderScan(){
    const closed=false,returns=route.page==='return';
    app.innerHTML=heading(returns?'Registrar devolución':'Escanear carga',e(shortLoad(current.load)),backLink())+
      (returns?'<div class="notice" style="margin-bottom:18px">Escanea los productos que volvieron.</div>':'')+
      `<div id="focus-picker" class="control-actions">${focusPicker()}</div><div class="scan-layout"><div class="stack"><div id="scan-feedback" role="status" aria-live="polite" aria-atomic="true"></div>${!closed?`<div class="reader-box"><div class="row between"><h2>Lector Bluetooth</h2><span id="reader-status" class="reader-status">Lector en pausa</span></div><p>Lee una etiqueta. El lector debe enviar Enter al terminar.</p><input id="capture" aria-label="Captura del lector Bluetooth" inputmode="none" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="Esperando código…"><div class="row" style="margin-top:12px">${btn('Activar lector','focus','lime wide')}</div></div><section class="card"><h2>Ingresar código a mano</h2><form id="manual-scan" class="manual-entry"><input name="numero" id="manual-code" aria-label="Código de 6 dígitos" inputmode="numeric" autocomplete="off" placeholder="000000" maxlength="30"><button type="submit" class="primary">Agregar</button></form></section><div class="scan-controls">${btn('▣ Cámara','camera','wide')}${btn('↶ Deshacer último','undo','wide')}</div><div id="camera-panel" class="camera-panel" hidden><div id="camera-surface" class="camera-surface"><div id="camera-reader"></div><div id="camera-counter" class="camera-counter"></div><div id="camera-flash" class="camera-flash" hidden></div></div><div id="camera-recent" class="camera-recent" aria-label="Últimas tres lecturas"></div><div class="row">${btn('Encender linterna','torch','small','id="torch-button" hidden')}${btn('Cerrar cámara','stop-camera','small')}</div><p id="camera-note" class="subtext muted" style="padding:0 12px"></p></div>`:''}</div><aside class="scan-side stack"><section><h2>Obra de esta carga</h2><div id="scan-summary" class="scan-summary"></div></section><div class="toolbar"><a class="button small" href="#/detail/${current.load.id}">Ver productos</a></div><section><h2>Productos del foco</h2><small id="focus-count" class="muted"></small><div id="focus-products"></div></section></aside></div>${nav('scan')}`;
    updateScan();focusCapture();
  }
  function updateScan(){paintFocusProducts();if(!$('#scan-summary'))return;$('#scan-summary').innerHTML=current.works.map(w=>workProgress(w,current.products)).join('');const c=T.counts(current.products);if($('#camera-counter'))$('#camera-counter').innerHTML=`<strong>${route.page==='return'?c.devuelto:c.cargado}</strong><small>de ${c.total}${route.page==='return'?' devueltos':''}</small>`;renderFeedback();}
  function renderFeedback(){const el=$('#scan-feedback');if(!el)return;const f=feedback||{style:'neutral',title:'Todo listo para cargar',message:'Escanea la primera etiqueta del camión.'};el.className=`scan-feedback ${f.style}`;el.innerHTML=`${f.numero?`<div class="code">${e(f.numero)}</div>`:''}<h2>${e(f.title)}</h2>${f.message?`<p class="${f.product?'product-label':'subtext'}">${e(f.message)}</p>`:''}${f.extra?`<p class="subtext">${e(f.extra)}</p>`:''}${f.unknown?`<div class="row">${btn('Seguir escaneando','dismiss-unknown','small')}${btn('Agregar como accesorio','unknown-accessory','small')}${btn('Agregar como producto','unknown-product','small')}</div>`:''}`;}
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
    let found=await T.db.products.where('[loadId+numero]').equals([loadId,numero]).toArray();
    if(!found.length&&route.page!=='return'){const p=await P.ensureProduct(loadId,numero);if(p){found=[p];current.products.push(p);}}
    if(!found.length){
      if(route.page==='return'){feedback={style:'error',title:'No está en esta carga',numero,message:'Puedes seguir escaneando.'};showReading('error');return;}
      feedback={style:'error',title:'No está en la carga',numero,source,loadId,unknown:true,message:'Puedes agregarlo como producto o accesorio, o seguir escaneando.'};showReading('error');return;
    }
    // En cargas antiguas con códigos duplicados usamos el primer registro pendiente.
    await acceptProduct((found.find(p=>p.status==='pendiente')||found[0]).id,source);
  }
  async function acceptProduct(id,source){
    const returns=route.page==='return',result=returns?await T.returnProduct(id,T.now(),source):await T.scanProduct(id,source),p=result.product,w=current.works.find(w=>w.id===p.workId);
    current.products=current.products.map(x=>x.id===p.id?p:x);
    const message=`${w.obra} · ${p.tipo} · ${p.description}`;
    const previous=result.kind==='previous',duplicate=result.kind==='duplicate',outside=!P.focused(current.load,p)?P.orderLabel(P.order(p))+' · fuera del foco':'';
    feedback={style:previous?'info':duplicate?'warning':'success',title:previous?'Ya se despachó antes':duplicate?(returns?'Ya devuelto':'Ya escaneado'):returns?'Devuelto':'Cargado',message,product:true,numero:p.numero,extra:previous?`${result.previous.name} · ${T.date(result.previous.date)}`:`${T.date(returns?p.returnedAt:p.scannedAt)} · ${T.time(returns?p.returnedAt:p.scannedAt)}`};
    if(outside)feedback.extra=[feedback.extra,outside].filter(Boolean).join(' · ');
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
  // El sufijo entre paréntesis pertenece al Tipo de Zebra, no a un conteo.
  // Solo se oculta en el encabezado; el valor original y sus grupos se conservan.
  const typeLabel=tipo=>T.clean(tipo).replace(/\s*\(\d+\)$/, '')||'Sin tipo';
  const orderKey=p=>T.clean(p.orden).replace(/^OFI?\s*/i,'').trim();
  const orderLabel=key=>key?'OFI '+key:'Sin OFI';
  const progress=ps=>{const c=T.counts(ps);return `${c.cargado} de ${c.total}`;};
  function detailList(){
    const products=current.products,q=T.plain(detailQuery),orders=new Map(),types=new Map();
    for(const p of products){const order=orderKey(p),key=JSON.stringify([order,p.tipo]);if(!orders.has(order))orders.set(order,[]);orders.get(order).push(p);if(!types.has(key))types.set(key,[]);types.get(key).push(p);}
    const all=products.filter(p=>P.focused(current.load,p)&&(filter==='todos'||p.status===filter)&&(!q||[p.numero,p.tipo,p.description,p.orden].some(v=>T.plain(v).includes(q)))).sort((a,b)=>{const x=orderKey(a),y=orderKey(b);return Number(!x)-Number(!y)||T.natural.compare(x,y)||T.natural.compare(a.tipo,b.tipo)||T.natural.compare(a.numero,b.numero);});
    const visible=all.slice(0,listLimit);let lastOrder=null,lastType=null;
    const html=visible.map(p=>{const order=orderKey(p),key=JSON.stringify([order,p.tipo]);let header='';
      if(order!==lastOrder){header+=`<h3 class="type-heading">${e(orderLabel(order))} · ${progress(orders.get(order))}</h3>`;lastOrder=order;lastType=null;}
      if(key!==lastType){header+=`<h3 class="type-heading" title="${e(p.tipo)}">${e(typeLabel(p.tipo))} · ${progress(types.get(key))}</h3>`;lastType=key;}
      return header+`<button type="button" class="product ${p.status}" data-action="product" data-id="${p.id}"><span class="body"><strong>${e(p.description||'SIN DESCRIPCIÓN')} ${p.note?'<span class="note-dot" title="Tiene nota" aria-label="Tiene nota">●</span>':''}</strong><small>${e(p.numero)} · ${e(p.orden||'Sin OFI')}${p.atril?' · Atril '+e(p.atril):''}</small>${p.unknown?'<small>agregado al escanear</small>':''}${p.carryFrom?.length?'<small>↳ Viene de carga anterior</small>':''}${p.transferredTo?`<small>Trasladado a ${e(p.transferredTo.name||'otra carga')}</small>`:''}</span><span class="state">${stateLabel(p.status)}${p.scannedAt?`<small>${T.time(p.scannedAt)}</small>`:''}</span></button>`;
    }).join('')||'<div class="empty">No hay productos que coincidan.</div>';
    return {count:all.length,html:html+(all.length>visible.length?btn(`Mostrar más (${visible.length}/${all.length})`,'more-products','wide'):'')};
  }
  function paintDetailList(){const list=detailList();$('#detail-products').innerHTML=list.html;$('#detail-results').textContent=`${list.count} ${list.count===1?'resultado':'resultados'}`;$('#detail-clear').hidden=!detailQuery;}
  function renderDetail(){
    const work=currentWork();selectedWork=work.id;const closed=current.load.status==='closed',products=current.products,c=T.counts(products);
    const filters=[['todos','Todos',products.length],['pendiente','Pendientes',c.pendiente],['cargado','Cargados',c.cargado]];if(c.devuelto)filters.push(['devuelto','Devueltos',c.devuelto]);if(c.trasladado)filters.push(['trasladado','Trasladados',c.trasladado]);
    app.innerHTML=heading('Detalle de productos',e(shortLoad(current.load)),backLink())+`<div class="row between"><div><h2 style="margin:10px 0">${e(work.obra)}</h2><span class="muted subtext">OP ${e(work.op||'—')} · ${c.cargado}/${c.total} cargados</span></div>${btn('Editar datos','edit-metadata','small')}${closed?`<a class="button small" href="#/return/${current.load.id}">Registrar devolución</a>`:''}</div>${focusPicker()}<div class="manual-entry"><input id="detail-query" type="search" value="${e(detailQuery)}" aria-label="Buscar productos" placeholder="Buscar número, tipo, descripción u OFI" autocomplete="off">${btn('✕','clear-detail','icon-button quiet','id="detail-clear" aria-label="Limpiar búsqueda"')}</div><small id="detail-results" class="muted" role="status" aria-live="polite"></small><div class="filters" aria-label="Filtrar productos">${filters.map(([key,label,count])=>btn(`${label} ${count}`,'filter',filter===key?'selected':'',`data-filter="${key}" aria-pressed="${filter===key}"`)).join('')}</div><section id="detail-products" aria-label="Productos"></section><section class="card" style="margin-top:28px"><div class="row between"><h2 style="margin:0">Accesorios</h2>${btn('＋ Agregar accesorio','accessory','small')}</div><div style="margin-top:16px">${current.accessories.map(a=>`<div class="accessory row between"><div><strong>${e(a.description)}</strong><p class="muted subtext" style="margin:5px 0">${R.num(a.quantity)} ${e(a.unit)}${a.atril?' · Atril '+e(a.atril):''}</p></div>${btn('Editar','accessory','small',`data-id="${a.id}"`)}</div>`).join('')||'<p class="muted subtext">Sin accesorios agregados.</p>'}</div></section>${nav('detail')}`;
    paintDetailList();
  }
  const optionalDescription=p=>p.description==='SIN DESCRIPCIÓN'?'':p.description;
  function scannedProductModal(p){openModal('Producto agregado y cargado',`<p>${e(p.numero)} ya está en la carga. Estos datos son opcionales; puedes completarlos después en Productos.</p><form id="scanned-product-form" data-id="${p.id}"><div class="stack">${field('Tipo (opcional)','tipo',p.tipo,'maxlength="200"')}<label>Descripción (opcional)<textarea name="description" maxlength="1200">${e(optionalDescription(p))}</textarea></label>${field('OFI (opcional)','orden',p.orden,'maxlength="200"')}</div><div class="dialog-actions">${btn('Completar después','cancel')}<button type="submit" class="primary">Guardar</button></div></form>`);}
  async function addScannedProduct(reading){
    const result=await T.scanUnknown(reading.loadId,reading.numero,reading.source);
    if(current?.load.id!==reading.loadId||route.page!=='scan')return;
    const data=await T.loadData(reading.loadId);if(current?.load.id!==reading.loadId||route.page!=='scan')return;
    current=data;feedback={style:'success',title:'Cargado',numero:result.product.numero,message:result.product.description,product:true};showReading('success');scannedProductModal(result.product);
  }
  async function productModal(id){
    const p=await T.db.products.get(id);if(!p)return;const closed=current.load.status==='closed';
    const history=(await T.db.events.where('productId').equals(id).toArray()).sort((a,b)=>b.at.localeCompare(a.at));
    const labels={scan:'Escaneado',edit:'Producto editado',undo:'Escaneo deshecho','scan-duplicate':'Lectura repetida',return:'Devuelto',transfer:'Trasladado'};

    openModal(`${p.numero} · ${p.tipo}`,`<form id="product-form" data-id="${p.id}"><div class="stack">${!closed&&p.status!=='trasladado'?`<label>Estado<select name="status">${['pendiente','cargado'].map(s=>`<option value="${s}" ${p.status===s?'selected':''}>${stateLabel(s)}</option>`).join('')}</select></label>`:`<p>${stateLabel(p.status)}</p>`}${p.unknown?field('Tipo (opcional)','tipo',p.tipo,'maxlength="200"')+field('OFI (opcional)','orden',p.orden,'maxlength="200"'):''}<label>Descripción para el PDF<textarea name="description" maxlength="1200">${e(p.unknown?optionalDescription(p):p.description)}</textarea></label>${field('Atril (opcional)','atril',p.atril,'maxlength="100"')}<label>Nota (opcional)<textarea name="note" maxlength="4000">${e(p.note||'')}</textarea></label></div><details><summary>Historial (${history.length})</summary><ol class="history">${history.map(h=>`<li>${T.date(h.at)} ${T.time(h.at)} · ${e(labels[h.kind]||h.kind)}${h.after?.status?' → '+stateLabel(h.after.status):''}</li>`).join('')||'<li>Sin cambios registrados.</li>'}</ol></details><div class="dialog-actions">${closed?btn('Marcar devuelto','return-product','',`data-id="${p.id}"`):''}<button type="submit" class="primary">Guardar cambios</button></div></form>`);
  }
  function accessoryModal(id,unknown=false){const a=current.accessories.find(a=>a.id===id),work=a?current.works.find(w=>w.id===a.workId):currentWork();openModal(a?'Editar accesorio':'Agregar accesorio',`<form id="accessory-form" data-id="${a?.id||''}"><div class="stack"><input type="hidden" name="workId" value="${work.id}"><label>Descripción<textarea name="description" maxlength="1200">${e(a?.description||(unknown?`Código ${feedback.numero} · `:''))}</textarea></label><div class="fields">${field('Cantidad','quantity',a?.quantity||1,'inputmode="decimal"')}${field('Unidad','unit',a?.unit||'UNI','id="accessory-unit" maxlength="20"')}</div><div class="unit-buttons">${btn('UNI','unit','small',`data-unit="UNI"`)}${btn('MT','unit','small',`data-unit="MT"`)}${btn('Otra unidad','unit','small',`data-unit=""`)}</div>${field('Atril (opcional)','atril',a?.atril||'','maxlength="100"')}</div><div class="dialog-actions">${a?btn('Eliminar','delete-accessory','danger',`data-id="${a.id}"`):btn('Cancelar','cancel')}<button type="submit" class="primary">Guardar accesorio</button></div></form>`);}
  function metadataModal(){const w=currentWork(),l=current.load,closed=false;openModal('Datos de la obra y transporte',`<form id="metadata-form"><div class="stack"><h3>${e(w.obra)} · OP ${e(w.op)}</h3><div class="fields">${field('RUT cliente','rutCliente',w.rutCliente,`maxlength="30" ${closed?'readonly':''}`)}${field('Constructora','constructora',w.constructora,`maxlength="160" ${closed?'readonly':''}`)}${field('Dirección','direccion',w.direccion,`maxlength="250" ${closed?'readonly':''}`)}${field('Comuna','comuna',w.comuna,`maxlength="100" ${closed?'readonly':''}`)}</div><h3>Transporte de toda la carga</h3><div class="fields">${field('Chofer','chofer',l.chofer,`maxlength="120" ${closed?'readonly':''}`)}${field('RUT chofer','rutChofer',l.rutChofer,`maxlength="30" ${closed?'readonly':''}`)}${field('Patente','patente',l.patente,`maxlength="20" ${closed?'readonly':''}`)}</div></div>${closed?'':'<div class="dialog-actions"><button type="submit" class="primary">Guardar datos</button></div>'}</form>`);}
  function renderClose(){
    const closed=current.load.status==='closed',c=T.counts(current.products),w=current.works[0];
    app.innerHTML=heading('Cierre y documentos',e(shortLoad(current.load)),backLink())+
      `<div class="card ${closed?'':'hero-card'}" style="margin-bottom:22px"><div class="row between"><div><span class="badge ${closed?'closed':'active'}">${closed?'Cerrada':'En curso'}</span><h2 style="margin:12px 0 6px">${closed?'Despacho cerrado':'Documentos del despacho'}</h2><p class="muted subtext" style="margin:0">${closed?`${T.date(current.load.closedAt)} · ${T.time(current.load.closedAt)}`:`${c.cargado} cargados · ${c.pendiente} pendientes`}</p></div>${btn(closed?'Reabrir despacho':'Cerrar despacho',closed?'reopen':'close',closed?'':'lime')}</div></div>`+
      `<section class="card"><div class="row between"><h2 style="margin:0">${e(w.obra)}</h2><span class="muted subtext">OP ${e(w.op||'—')}</span></div><div class="stats"><div class="stat good"><strong>${c.cargado}</strong><span>Cargados</span></div><div class="stat pending"><strong>${c.pendiente}</strong><span>Pendientes</span></div><div class="stat"><strong>${c.total}</strong><span>Productos</span></div><div class="stat"><strong>${current.accessories.length}</strong><span>Accesorios</span></div></div><div class="export-buttons">${btn('↓ PDF para guías','export','primary',`data-kind="guide"`)}${btn('↓ PDF de control','export','',`data-kind="control"`)}${btn('↓ Códigos escaneados','export','',`data-kind="codes"`)}</div>${closed?`<div class="row" style="margin-top:16px">${btn('Compartir archivos del cierre','share-close','small','id="share-close" hidden')}<a class="button small" href="#/return/${current.load.id}">Registrar devolución</a></div><p id="close-file-status" class="muted subtext"></p>`:''}</section>${nav('close')}`;
    if(closed)prepareCloseFiles().catch(error);paintBackupOffer();
  }
  async function prepareCloseFiles(){
    const token=++closeToken,data=structuredClone(current),files=[];
    for(const kind of ['guide','control','codes']){try{files.push(makeFile(data,kind));}catch(err){toast(errorMessage(err));}}
    if(token!==closeToken||route.page!=='close'||current.load.id!==data.load.id)return;
    closeFiles=files;const status=$('#close-file-status');if(status)status.textContent=`${files.length} archivos listos para compartir o descargar.`;
    const ready=files.map(f=>new File([f.blob],f.name,{type:f.blob.type}));if($('#share-close'))$('#share-close').hidden=!(canShare(ready));
  }
  function makeFile(data,kind){return kind==='codes'?R.createCodes(data):R.createPDF(data,undefined,kind==='control');}
  function canShare(files){try{return !!(navigator.share&&navigator.canShare?.({files}));}catch{return false;}}
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);const message=`Descarga iniciada: ${name}. Búscalo en Descargas del navegador o en la carpeta que elegiste.`;toast(message);const status=$('#file-status');if(status)status.textContent=message;return message;}
  function fileDialog(file){const readyFile=new File([file.blob],file.name,{type:file.blob.type}),share=canShare([readyFile]);if(exportURL)URL.revokeObjectURL(exportURL);exportURL=URL.createObjectURL(file.blob);openModal('Documento listo',`<p style="overflow-wrap:anywhere"><strong>${e(file.name)}</strong></p><p id="file-status" role="status">${e(file.instructions||'Elige cómo guardar o enviar el archivo.')}</p><div class="stack">${share?btn('Compartir por WhatsApp, correo…','share-file','primary'):''}${btn('Descargar archivo','download-file',share?'':'primary')}${file.blob.type==='application/pdf'?`<a class="button" href="${exportURL}" target="_blank" rel="noopener">Ver PDF</a>`:''}</div>`);$('#modal-content')._file={...file,readyFile};if(!share&&!file.explicitSave){download(file.blob,file.name);file.onSaved?.().catch(error);}}
  const shortDate=value=>{const d=new Date(value);return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}`;};
  function backupFile(record){return {blob:new Blob([record.text],{type:'text/plain'}),name:`Respaldo_Tecma_${T.dateKey(record.at)}.txt`,onSaved:async()=>{
    await T.db.transaction('rw',T.db.meta,async()=>{const pending=await T.db.meta.get('backup:pending');if(pending?.value.at===record.at)await T.db.meta.delete('backup:pending');});
    if(pendingBackup?.at===record.at)pendingBackup=null;paintBackupOffer();
  }};}
  async function generateBackup(){
    const payload=await T.backup(),record={at:payload.exportedAt,text:JSON.stringify(payload,null,2)};pendingBackup=record;
    // La copia pendiente permite descargarla después de cerrar y volver a abrir la app.
    // No forma parte del siguiente respaldo: evita duplicar respaldos dentro de respaldos.
    try{await T.db.transaction('rw',T.db.meta,async()=>{await T.db.meta.put({key:'backup:pending',value:record});await T.db.meta.put({key:'backup:last',value:record.at});});}
    catch(err){toast('Respaldo generado, pero no se pudo conservar la copia pendiente. Descárgalo ahora.');console.error(err);}
    paintBackupOffer();return backupFile(record);
  }
  function prepareBackup(){const task=backupQueue.catch(()=>{}).then(generateBackup);backupQueue=task;return task;}
  function offerBackup(){return prepareBackup().catch(err=>{toast('Los datos se guardaron. No se pudo generar el respaldo automático; puedes reintentarlo desde el inicio.');console.error(err);});}
  function paintBackupOffer(){
    $('#backup-offer')?.remove();if(!pendingBackup||!['home','obra','close','control'].includes(route.page))return;
    const box=document.createElement('section');box.id='backup-offer';box.className='notice';box.innerHTML=`<p>Respaldo completo generado el ${shortDate(pendingBackup.at)}. Compártelo o descárgalo para conservar una copia fuera de la app.</p><div class="row">${btn('Guardar o compartir respaldo','save-backup','small')}${btn('Más tarde','later-backup','small quiet')}</div>`;
    const footer=app.querySelector('footer')||app.querySelector('.nav-bottom');if(footer)footer.before(box);else app.append(box);
  }
  async function exportWork(workId,kind){await scanQueue;const data=await T.loadData(current.load.id);fileDialog(makeFile(data,kind));}
  async function restoreFile(file){if(!file)return;if(file.size>100*1024*1024)throw new Error('El respaldo supera 100 MB. Prueba en un computador con más memoria.');let b;try{b=JSON.parse(await file.text());}catch{throw new Error('No se pudo leer el respaldo. Selecciona el archivo .txt o .json original.');}T.validateBackup(b);openModal('Importar respaldo',`<p>Se agregarán <strong>${b.loads.length} despachos</strong> y ${b.products.length} productos como copias. Tus datos actuales se conservan.</p><p>Si ya importaste este archivo, se agregarán copias de esos despachos.</p><div class="dialog-actions">${btn('Cancelar','cancel')}${btn('Importar respaldo','confirm-restore','primary')}</div>`);$('#modal-content')._backup=b;}

  function renderTransition(){
    current=null;route={page:'welcome'};const failed=transition.error;
    app.innerHTML=heading('Todo en un solo lugar','')+`<section class="card"><p>Se encontraron ${transition.count} cargas anteriores. Se integrarán a sus obras para que todo quede en un solo lugar. Primero se guardará un respaldo.</p>${failed?`<div class="notice error" role="alert">${e(failed)}</div>${transition.backup?`<p class="muted">El respaldo previo sigue disponible.</p>${btn('Guardar o compartir respaldo','save-integration-backup','small')}`:''}`:''}<div class="row" style="margin-top:16px">${btn(transitionBusy?'Integrando…':'Comenzar','begin-integration','primary',transitionBusy?'disabled':'')}</div></section>`;
  }
  async function beginIntegration(b){
    if(!transition||transitionBusy)return;transitionBusy=true;b.disabled=true;
    try{
      const record=await P.prepareTransition();if(!record){transition=null;await navigate();return;}
      transition.backup=record;pendingBackup=record;delete transition.error;
      fileDialog({...backupFile(record),explicitSave:true,instructions:'Guarda o comparte este respaldo. Después se integrarán tus despachos automáticamente.',onSaved:async()=>{
        if(transitionBusy||!transition)return;transitionBusy=true;closeModal();renderTransition();
        try{const result=await P.completeTransition(record);transition=null;transitionBusy=false;pendingBackup=null;history.replaceState(null,'','#/');await navigate();openModal('Todo quedó integrado',`<p>Se crearon <strong>${result.created} obras</strong> y se integraron <strong>${result.integrated} despachos</strong>.</p><p>Ya puedes consultar todo dentro de sus obras.</p><div class="dialog-actions">${btn('Ver obras','cancel','primary')}</div>`);}
        catch(err){transition.error=errorMessage(err);transitionBusy=false;renderTransition();}
      }});
    }catch(err){transitionBusy=false;if(err.backup)transition.backup=err.backup;transition.error=errorMessage(err);renderTransition();}
    finally{transitionBusy=false;if(b.isConnected)b.disabled=false;}
  }

  async function refresh(){if(current){current=await T.loadData(current.load.id);if(['scan','return'].includes(route.page))updateScan();else if(route.page==='detail')renderDetail();else if(route.page==='close')renderClose();}}
  async function navigate(){
    if(booting)return;if(transition){renderTransition();return;}const version=++renderVersion;
    await stopCamera();if(modal.open)closeModal();
    const parts=location.hash.replace(/^#\/?/,'').split('/');route={page:parts[0]||'home',id:parts[1],sub:parts[2]};feedback=null;recentReads=[];
    try{
      if(['scan','return','detail','close'].includes(route.page)){const data=await T.loadData(route.id);if(version!==renderVersion)return;current=data;if(['scan','detail'].includes(route.page)){await P.syncCatalog(route.id);current=await T.loadData(route.id);}}else current=null;
      if(route.page==='home')await renderHome();
      else if(route.page==='obra')await U.render(route);
      else if(['scan','return'].includes(route.page))renderScan();
      else if(route.page==='control')await TecmaControlUI.render(route);
      else if(route.page==='detail'){listLimit=100;detailQuery='';renderDetail();}
      else if(route.page==='close')renderClose();
      else location.hash='#/';
      paintBackupOffer();window.scrollTo(0,0);
    }catch(err){app.innerHTML=heading('No se pudo abrir',e(errorMessage(err)),`<a class="button" href="#/">Volver al inicio</a>`);}
  }
  document.addEventListener('click',async event=>{
    unlockAudio();const b=event.target.closest('[data-action]');if(!b||b.disabled)return;const action=b.dataset.action;
    try{
      if(action==='begin-integration'){await beginIntegration(b);return;}if(action==='save-integration-backup'){if(transition?.backup)fileDialog({...backupFile(transition.backup),onSaved:null,explicitSave:true});return;}if(transition&& !['share-file','download-file','cancel'].includes(action))return;
      if(await U.click(action,b))return;
      if(await TecmaControlUI.click(action,b))return;
      if(action==='cancel')closeModal();
      else if(action==='check-update'){const reg=await navigator.serviceWorker?.getRegistration();await reg?.update();toast(reg?.waiting?'Actualización lista. Cierra todas las ventanas de Tecma y vuelve a abrirla.':'Comprobación terminada. Si hay una actualización, cierra y vuelve a abrir Tecma.');}
      else if(action==='return-product'){await T.returnProduct(b.dataset.id);closeModal();await refresh();}
      else if(action==='share-close'){const files=closeFiles.map(f=>new File([f.blob],f.name,{type:f.blob.type}));try{await navigator.share({files,title:shortLoad(current.load)});}catch(err){if(err.name!=='AbortError')toast('Puedes descargar cada archivo con sus botones.');}}
      else if(action==='focus-more'){focusLimit+=20;paintFocusProducts();focusCapture();}
      else if(action==='focus-many'){openModal('Foco de OFI',`<form id="focus-form"><p class="muted">Sin selección se muestran todas. Puedes escanear fuera del foco.</p><div class="stack">${focusOrders().map(o=>`<label class="check-label"><input name="focus" type="checkbox" value="${e(o)}" ${current.load.focus?.includes(o)?'checked':''}>${e(P.orderLabel(o))}</label>`).join('')}</div><div class="dialog-actions">${btn('Cancelar','cancel')}<button type="submit" class="primary">Aplicar foco</button></div></form>`);}
      else if(action==='focus')focusCapture();
      else if(action==='camera')await startCamera();
      else if(action==='stop-camera'){await stopCamera();focusCapture();}
      else if(action==='torch')await toggleTorch();
      else if(action==='undo'){b.disabled=true;await scanQueue;const p=await T.undoScan(current.load.id);current.products=current.products.map(x=>x.id===p.id?p:x);feedback={style:'neutral',title:'Escaneo deshecho',numero:p.numero,message:`${p.tipo} · ${p.description}`,extra:`Estado: ${stateLabel(p.status)}`};updateScan();focusCapture();}
      else if(action==='dismiss-unknown'){feedback=null;updateScan();focusCapture();}
      else if(action==='unknown-accessory')accessoryModal(null,true);
      else if(action==='unknown-product'){const reading={...feedback};if(!reading.unknown)return;b.disabled=true;const task=scanQueue.then(()=>addScannedProduct(reading));scanQueue=task.catch(()=>{});await task;}
      else if(action==='clear-detail'){detailQuery='';listLimit=100;$('#detail-query').value='';paintDetailList();$('#detail-query').focus();}
      else if(action==='filter'){filter=b.dataset.filter;listLimit=100;renderDetail();}
      else if(action==='more-products'){listLimit+=100;const y=scrollY;renderDetail();scrollTo(0,y);}
      else if(action==='product')await productModal(b.dataset.id);
      else if(action==='accessory')accessoryModal(b.dataset.id);
      else if(action==='unit'){$('#accessory-unit').value=b.dataset.unit;if(!b.dataset.unit)$('#accessory-unit').focus();}
      else if(action==='delete-accessory'){const id=b.dataset.id;confirmModal('¿Eliminar accesorio?','Se quitará esta línea del despacho.','confirm-delete-accessory','Eliminar',true);$('#modal-content').dataset.accessory=id;}
      else if(action==='confirm-delete-accessory'){await T.deleteAccessory($('#modal-content').dataset.accessory);closeModal();await refresh();}
      else if(action==='edit-metadata')metadataModal();
      else if(action==='close'){b.disabled=true;await scanQueue;await T.setClosed(current.load.id,true);await refresh();void offerBackup();}
      else if(action==='reopen'){await T.setClosed(current.load.id,false);await refresh();}
      else if(action==='export'){b.disabled=true;await exportWork(b.dataset.work,b.dataset.kind);}
      else if(action==='share-file'){const f=$('#modal-content')._file;b.disabled=true;let saved=false;try{await navigator.share({files:[f.readyFile],title:f.name});saved=true;}catch(err){if(err.name!=='AbortError'){const message=download(f.blob,f.name);if($('#file-status'))$('#file-status').textContent='No se pudo compartir. '+message;saved=true;}}if(saved)await f.onSaved?.();}
      else if(action==='download-file'){const f=$('#modal-content')._file;download(f.blob,f.name);await f.onSaved?.();}
      else if(action==='backup'){b.disabled=true;const file=await prepareBackup();if(route.page==='home')await renderHome();paintBackupOffer();fileDialog(file);}
      else if(action==='save-backup'){if(pendingBackup)fileDialog(backupFile(pendingBackup));}
      else if(action==='later-backup')$('#backup-offer')?.remove();
      else if(action==='restore')$('#backup-file').click();
      else if(action==='confirm-restore'){b.disabled=true;const n=await T.restoreBackup($('#modal-content')._backup);closeModal();await renderHome();toast(`${n} despachos restaurados.`);}
    }catch(err){error(err);}finally{if(b.isConnected)b.disabled=false;}
  });
  document.addEventListener('submit',async event=>{
    const f=event.target;if(f.id==='obra-dispatch-form'){event.preventDefault();try{await U.submit(f);}catch(err){error(err);}return;}if(f.id==='focus-form'){event.preventDefault();try{await P.setFocus(current.load.id,[...new FormData(f).getAll('focus')]);closeModal();await refresh();paintFocus();focusCapture();}catch(err){error(err);}return;}if(f.id.startsWith('control-')){event.preventDefault();try{await TecmaControlUI.submit(f);}catch(err){error(err);}return;}if(!['manual-scan','product-form','scanned-product-form','accessory-form','metadata-form'].includes(f.id))return;event.preventDefault();const data=Object.fromEntries(new FormData(f)),submit=f.querySelector('[type="submit"]');
    try{
      if(f.id==='manual-scan'){const code=data.numero;f.reset();await queueScan(code,'manual');focusCapture();return;}
      submit.disabled=true;
      if(f.id==='product-form'||f.id==='scanned-product-form'){await T.changeProduct(f.dataset.id,{status:data.status,note:data.note,description:data.description,atril:data.atril,tipo:data.tipo,orden:data.orden});}
      else if(f.id==='accessory-form')await T.saveAccessory({...data,id:f.dataset.id||undefined,loadId:current.load.id});
      else if(f.id==='metadata-form'){const w=currentWork();await T.db.transaction('rw',T.db.loads,T.db.works,T.db.events,async()=>{const workPatch={},loadPatch={updatedAt:T.now()};for(const key of ['rutCliente','direccion','comuna','constructora'])workPatch[key]=T.clean(data[key]);for(const key of ['chofer','rutChofer','patente'])loadPatch[key]=T.clean(data[key]);await T.db.works.update(w.id,workPatch);await T.db.loads.update(current.load.id,loadPatch);await T.db.events.add({id:T.uid(),loadId:current.load.id,at:T.now(),kind:'metadata-edit',workId:w.id,before:{work:w,load:current.load},after:{work:workPatch,load:loadPatch}});});}
      closeModal();await refresh();toast('Cambios guardados.');
    }catch(err){error(err);}finally{if(submit?.isConnected)submit.disabled=false;}
  });
  document.addEventListener('change',async event=>{try{
    if(await U.change(event.target))return;
    if(await TecmaControlUI.change(event.target))return;
    if(event.target.id==='scan-ofi'){focusLimit=20;if(event.target.value==='custom')return;await P.setFocus(current.load.id,event.target.value==='all'?[]:[event.target.value.slice(4)]);await refresh();paintFocus();focusCapture();return;}
    if(event.target.id==='backup-file'){await restoreFile(event.target.files[0]);event.target.value='';}
  }catch(err){error(err);}});
  document.addEventListener('input',event=>{U.input(event.target);TecmaControlUI.input(event.target);if(event.target.id==='detail-query'){detailQuery=event.target.value;listLimit=100;paintDetailList();}});
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
  const bridge={btn,field,heading,toast,error,openModal,closeModal,fileDialog,download,offerBackup,paintBackupOffer};
  TecmaControlUI.init(bridge);U.init(bridge);
  // Solicitar persistencia sin esperar ni mostrar errores: nunca frena el inicio.
  try{Promise.resolve(navigator.storage?.persist?.()).catch(()=>{});}catch{}
  (async()=>{network();try{await T.db.open();transition=await P.transitionStatus();booting=false;pendingBackup=(await T.db.meta.get('backup:pending'))?.value||null;await navigate();offlineReady();}catch(err){app.innerHTML=heading('No se pudo iniciar',e(errorMessage(err)))+'<p>Usa una ventana normal de Chrome o Safari y permite guardar datos del sitio.</p>';}})();
})();
