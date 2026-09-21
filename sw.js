'use strict';
// Cambiar VERSION al publicar una actualización. Nunca borra IndexedDB.
const VERSION='1.0.0';
const PREFIX='tecma-despachos:'+self.registration.scope+':';
const CACHE=PREFIX+VERSION;
const ASSETS=[
  './','./index.html','./styles.css','./app.js','./core.js','./reports.js',
  './manifest.json','./sw.js','./ejemplo.csv','./ejemplo-comas.csv','./GUIA.html','./README.md','./PRUEBAS.md',
  './icons/favicon.svg','./icons/icon-192.png','./icons/icon-512.png','./icons/maskable-512.png','./icons/apple-touch-icon.png',
  './lib/html5-qrcode.min.js','./lib/papaparse.min.js','./lib/jspdf.umd.min.js','./lib/jspdf.plugin.autotable.min.js','./lib/dexie.min.js',
  './lib/LICENSE-html5-qrcode.txt','./lib/LICENSE-papaparse.txt','./lib/LICENSE-jspdf.txt','./lib/LICENSE-jspdf-autotable.txt','./lib/LICENSE-dexie.txt','./lib/DEPENDENCIAS.json'
];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)));await self.clients.claim();})());});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE),cached=await cache.match(event.request,{ignoreSearch:true});if(cached)return cached;
    try{return await fetch(event.request);}catch(error){if(event.request.mode==='navigate')return (await cache.match('./index.html'));throw error;}
  })());
});
self.addEventListener('message',event=>{
  if(event.data?.type==='CHECK_CACHE')event.waitUntil((async()=>{const cache=await caches.open(CACHE);const results=await Promise.all(ASSETS.map(path=>cache.match(new URL(path,self.registration.scope).href)));event.ports[0]?.postMessage({ready:results.every(Boolean),version:VERSION});})());
});
