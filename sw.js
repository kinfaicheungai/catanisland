/* 拓荒群島 離線快取 Service Worker */
const CACHE='frontier-3.4';
const ASSETS=[
  './','index.html','styles.css','manifest.webmanifest',
  'src/app.js','src/engine.js',
  'assets/ocean-chart.png',
  'assets/icon-192.png','assets/icon-512.png','assets/icon-maskable-512.png','assets/apple-touch-icon.png'
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
  e.respondWith((async()=>{
    // 快取優先（忽略 ?v= 版本查詢字串），搵唔到先上網，再快取落嚟
    const hit=await caches.match(req,{ignoreSearch:true});
    if(hit)return hit;
    try{
      const res=await fetch(req);
      if(res&&res.ok&&res.type==='basic'){const c=await caches.open(CACHE);c.put(req,res.clone())}
      return res;
    }catch(err){
      // 離線又未快取：導航請求就返首頁
      if(req.mode==='navigate')return (await caches.match('index.html'))||(await caches.match('./'));
      throw err;
    }
  })());
});
