/* 拓荒群島 離線快取 Service Worker */
const CACHE='frontier-4.3';
const ASSETS=[
  './','index.html','styles.css','manifest.webmanifest',
  'src/app.js','src/engine.js',
  'assets/ocean-chart.png',
  'assets/icon-192.png','assets/icon-512.png','assets/icon-maskable-512.png','assets/apple-touch-icon.png','assets/engine.mp3?v=1'
];

self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    const c=await caches.open(CACHE);
    // 逐個加，個別失敗都唔會令成個安裝失敗
    await Promise.allSettled(ASSETS.map(u=>c.add(u)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET'||new URL(req.url).origin!==location.origin)return;
  const path=new URL(req.url).pathname;
  const codey=req.mode==='navigate'||/\.(js|css|html|webmanifest)$/i.test(path);
  e.respondWith((async()=>{
    if(codey){
      // 程式／樣式／頁面：網絡優先，確保更新即時生效；離線先用快取
      try{const res=await fetch(req);if(res&&res.ok){const c=await caches.open(CACHE);c.put(req,res.clone())}return res;}
      catch(err){const hit=await caches.match(req,{ignoreSearch:true});if(hit)return hit;
        if(req.mode==='navigate')return (await caches.match('index.html'))||(await caches.match('./'));throw err;}
    }
    // 圖片／聲效等靜態資源：快取優先（忽略 ?v=）
    const hit=await caches.match(req,{ignoreSearch:true});
    if(hit)return hit;
    try{const res=await fetch(req);if(res&&res.ok&&res.type==='basic'){const c=await caches.open(CACHE);c.put(req,res.clone())}return res;}
    catch(err){if(req.mode==='navigate')return (await caches.match('index.html'))||(await caches.match('./'));throw err;}
  })());
});
