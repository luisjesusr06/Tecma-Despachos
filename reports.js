'use strict';
window.TecmaReports = (()=>{
  const T=Tecma;
  function combined(data){
    const first=data.works[0]||{id:'empty',obra:'Sin obra',op:''};
    const work={...first,obra:[...new Set(data.works.map(w=>w.obra))].join(' / ')||'Sin obra',op:[...new Set(data.works.map(w=>w.op).filter(Boolean))].join(', ')};
    return {...data,works:[work],products:data.products.map(p=>({...p,op:p.op||data.works.find(w=>w.id===p.workId)?.op||'',workId:work.id})),accessories:data.accessories.map(a=>({...a,op:data.works.find(w=>w.id===a.workId)?.op||'',workId:work.id}))};
  }
  const num=n=>new Intl.NumberFormat('es-CL',{maximumFractionDigits:20}).format(n);
  const safeName=value=>String(value||'SIN_OP').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,90)||'SIN_NOMBRE';
  const pdfText=v=>String(v??'').replace(/[^\x20-\x7e\xa0-\xff\n\r]/g,' ');
  const productDescription=p=>T.clean(p.description)||'SIN DESCRIPCIÓN';
  function guideRows(data,work){
    const groups=new Map();
    for(const p of data.products.filter(p=>p.workId===work.id&&p.status==='cargado')){
      const description=productDescription(p),key=JSON.stringify([p.op||work.op,p.tipo,description,p.orden,p.atril]);
      if(!groups.has(key))groups.set(key,{quantity:0,op:p.op||work.op,tipo:p.tipo,description,orden:p.orden,atril:p.atril});
      groups.get(key).quantity++;
    }
    return [...groups.values()].sort((a,b)=>T.natural.compare(a.tipo,b.tipo)||T.natural.compare(a.description,b.description)||T.natural.compare(a.orden,b.orden)||T.natural.compare(a.atril,b.atril)).map(p=>[num(p.quantity),p.op,p.tipo,p.description,p.orden,p.atril]).concat(data.accessories.filter(a=>a.workId===work.id).map(a=>[num(a.quantity),a.op||work.op,a.unit,a.description,'',a.atril]));
  }
  function createPDF(data,workId,control=false){
    if(!workId){data=combined(data);workId=data.works[0].id;}
    const work=data.works.find(w=>w.id===workId);if(!work)throw new Error('No se encontró la obra.');
    const {jsPDF}=window.jspdf,doc=new jsPDF({orientation:'portrait',unit:'mm',format:'letter'});
    const width=215.9,height=279.4,margin=14,load=data.load,when=load.closedAt||load.createdAt;
    doc.setProperties({title:control?'Control de despacho':'Detalle adjunto de guía electrónica',subject:work.obra,creator:'Tecma Despachos'});
    let headerEnd=0;const headerPages=new Set();
    function header(){
      const page=doc.internal.getCurrentPageInfo().pageNumber;if(headerPages.has(page))return;headerPages.add(page);
      doc.setTextColor(20,35,30);doc.setFont('helvetica','bold');doc.setFontSize(control?12:11.5);
      const title=control?'CONTROL DE DESPACHO':'DETALLE ADJUNTO DE GUÍA ELECTRÓNICA';
      doc.text(title,width/2,16,{align:'center'});doc.setDrawColor(70,90,80);doc.line(margin,20,width-margin,20);
      let y=27;doc.setFontSize(9);
      const fields=[['Obra',work.obra],['OP',work.op||'—'],['Fecha',T.date(when)],['RUT cliente',work.rutCliente],['Dirección',work.direccion],['Comuna',work.comuna],['Constructora',work.constructora],['Chofer',load.chofer],['RUT chofer',load.rutChofer],['Patente',load.patente]].filter(([,v])=>v);
      for(const [label,value]of fields){
        doc.setFont('helvetica','bold');doc.text(label+':',margin,y);doc.setFont('helvetica','normal');
        const lines=doc.splitTextToSize(pdfText(value),width-2*margin-29);doc.text(lines,margin+29,y);y+=Math.max(1,lines.length)*4.4+1;
      }
      headerEnd=y+4;
    }
    header();
    const table=(head,body,startY,extra={})=>doc.autoTable({head:[head],body:body.map(row=>row.map(pdfText)),startY,margin:{left:margin,right:margin,top:headerEnd,bottom:21},theme:'grid',styles:{font:'helvetica',fontSize:8.5,cellPadding:2.4,overflow:'linebreak',lineColor:[185,197,190],lineWidth:.15,textColor:[20,30,25]},headStyles:{fillColor:[30,65,49],textColor:[255,255,255],fontStyle:'bold',fontSize:8},rowPageBreak:'avoid',showHead:'everyPage',willDrawPage:()=>header(),...extra});
    if(!control){
      const rows=guideRows(data,work);
      table(['CANTIDAD','OP','CÓDIGO','DESCRIPCIÓN','N° OF','ATRIL'],rows.length?rows:[['','','','Sin productos cargados ni accesorios.','','']],headerEnd,{columnStyles:{0:{cellWidth:23,halign:'center'},1:{cellWidth:18},2:{cellWidth:22},3:{cellWidth:'auto'},4:{cellWidth:25},5:{cellWidth:22}}});
      let y=doc.lastAutoTable.finalY+20;
      if(y>height-25){doc.addPage();header();y=headerEnd+20;}
      doc.setDrawColor(70);doc.line(margin,y,110,y);doc.line(142,y,width-margin,y);doc.setFontSize(9);doc.setFont('helvetica','normal');doc.text('NOMBRE',margin,y+5);doc.text('FECHA',142,y+5);
    }else{
      const products=data.products.filter(p=>p.workId===work.id).sort((a,b)=>T.natural.compare(a.tipo,b.tipo)||T.natural.compare(a.numero,b.numero));
      const accessories=data.accessories.filter(a=>a.workId===work.id);let y=headerEnd;
      function section(title,head,rows,widths){
        if(y+28>height-22){doc.addPage();header();y=headerEnd;}
        doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(25,50,35);doc.text(`${title} (${rows.length})`,margin,y+4);
        table(head,rows.length?rows:[head.map((_,i)=>i===0?'Sin registros':'')],y+8,{columnStyles:widths||{}});y=doc.lastAutoTable.finalY+12;
      }
      // Las notas van en la columna de descripción: mismas columnas y anchos.
      const description=p=>[productDescription(p),p.note?'Nota: '+p.note:''].filter(Boolean).join('\n');
      const standard=products.filter(p=>!p.carryFrom?.length&&!p.unknown);
      section('Cargados',['NÚMERO','TIPO','DESCRIPCIÓN','HORA'],standard.filter(p=>p.status==='cargado').map(p=>[p.numero,p.tipo,description(p),`${T.date(p.scannedAt)}\n${T.time(p.scannedAt)}`]),{0:{cellWidth:23},1:{cellWidth:26},3:{cellWidth:29}});
      section('Pendientes sin escanear',['NÚMERO','TIPO','DESCRIPCIÓN'],standard.filter(p=>p.status==='pendiente').map(p=>[p.numero,p.tipo,description(p)]),{0:{cellWidth:23},1:{cellWidth:26}});
      if(products.some(p=>p.carryFrom?.length&&!p.unknown))section('Arrastrados de viajes anteriores',['NÚMERO','TIPO','DESCRIPCIÓN','HORA'],products.filter(p=>p.carryFrom?.length&&!p.unknown).map(p=>[p.numero,p.tipo,[description(p),'Estado: '+p.status,...p.carryFrom.map(o=>'Desde: '+o.name)].join('\n'),p.scannedAt?`${T.date(p.scannedAt)}\n${T.time(p.scannedAt)}`:'']),{0:{cellWidth:23},1:{cellWidth:26},3:{cellWidth:29}});
      if(products.some(p=>p.unknown))section('Agregados al escanear',['NÚMERO','TIPO','DESCRIPCIÓN','HORA'],products.filter(p=>p.unknown).map(p=>[p.numero,p.tipo,[description(p),'Estado: '+p.status,p.orden,...(p.carryFrom||[]).map(o=>'Desde: '+o.name),p.transferredTo?'Destino: '+(p.transferredTo.name||'Otra carga'):''].filter(Boolean).join('\n'),p.returnedAt?`${T.date(p.returnedAt)}\n${T.time(p.returnedAt)}`:p.scannedAt?`${T.date(p.scannedAt)}\n${T.time(p.scannedAt)}`:'']),{0:{cellWidth:23},1:{cellWidth:26},3:{cellWidth:29}});
      if(standard.some(p=>p.status==='devuelto'))section('Devueltos',['NÚMERO','TIPO','DESCRIPCIÓN','HORA'],standard.filter(p=>p.status==='devuelto').map(p=>[p.numero,p.tipo,description(p),`${T.date(p.returnedAt)}\n${T.time(p.returnedAt)}`]),{0:{cellWidth:23},1:{cellWidth:26},3:{cellWidth:29}});
      if(standard.some(p=>p.status==='trasladado'))section('Trasladados',['NÚMERO','TIPO','DESCRIPCIÓN'],standard.filter(p=>p.status==='trasladado').map(p=>[p.numero,p.tipo,description(p)+'\nDestino: '+(p.transferredTo?.name||'Otra carga')]),{0:{cellWidth:23},1:{cellWidth:26}});
      section('Accesorios',['CANTIDAD','UNIDAD','DESCRIPCIÓN','ATRIL'],accessories.map(a=>[num(a.quantity),a.unit,a.description,a.atril]),{0:{cellWidth:25},1:{cellWidth:23},3:{cellWidth:28}});
    }
    const pages=doc.getNumberOfPages();for(let n=1;n<=pages;n++){doc.setPage(n);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(80);doc.text(`Tecma · ${control?'Control de despacho':'Detalle para guías'}`,margin,height-10);doc.text(`${n} / ${pages}`,width-margin,height-10,{align:'right'});}
    return {blob:doc.output('blob'),name:`${control?'Control':'Despacho'}_${safeName(work.obra)}_${safeName(work.op)}_${T.dateKey(when)}.pdf`};
  }
  function createCodes(data,workId){if(!workId){data=combined(data);workId=data.works[0].id;}const work=data.works.find(w=>w.id===workId);const codes=data.products.filter(p=>p.workId===workId&&p.status==='cargado').map(p=>p.numero).sort(T.natural.compare);return {blob:new Blob(['\uFEFFnumero\r\n'+codes.join('\r\n')+(codes.length?'\r\n':'')],{type:'text/csv;charset=utf-8'}),name:`Codigos_${safeName(work.obra)}_${safeName(work.op)}_${T.dateKey(data.load.closedAt||data.load.createdAt)}.csv`};}
  function createClosure(data){
    const work=combined(data).works[0],when=data.load.closedAt||T.now();
    const payload={app:'tecma-despachos-cierre',version:1,exportedAt:T.now(),load:{...data.load,name:T.loadName(data.load,data.works,data.products)},works:data.works,products:data.products,accessories:data.accessories,ofis:T.ofis(data.products),returns:data.products.filter(p=>p.returnedAt).map(p=>({numero:p.numero,returnedAt:p.returnedAt}))};
    return {blob:new Blob([JSON.stringify(payload,null,2)],{type:'text/plain'}),name:`Cierre_${safeName(work.obra)}_${safeName(work.op)}_${T.dateKey(when)}.txt`};
  }
  return {combined,createClosure,guideRows,createPDF,createCodes,safeName,num};
})();
