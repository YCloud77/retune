// RETUNE service worker — makes the installed app launch instantly and work OFFLINE.
// Bump CACHE when any asset changes so returning users pull the new version.
var CACHE = 'retune-v5-12';
var CORE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './rigged.glb?v=13',
  './bgm.m4a?v=1',
  './breathing_bg.png'
];
// Narration lines (both languages) — small mp3s, precache so audio never waits.
var IDS = ['s01a','s01a2','s01b',
  's02a','s02b','s03a','s03a2','s03b','s04a','s04q1','s04q2','s04q3','s04c2',
  's05a','s05b','s06a','s06b'];
['ja','en'].forEach(function(lg){ IDS.forEach(function(id){ CORE.push('./audio/'+lg+'/'+id+'.mp3'); }); });

self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){
    // add individually so one missing file doesn't fail the whole install
    return Promise.all(CORE.map(function(u){ return c.add(u).catch(function(){}); }));
  }));
});

self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.map(function(k){ if(k!==CACHE) return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

// Cache-first for same-origin assets (offline + instant). Network passthrough for the rest
// (CDN three.js, the analytics endpoint — those must hit the network).
self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET'){ return; }
  var url = new URL(req.url);
  if(url.origin !== self.location.origin){ return; }   // let CDN & analytics go to network
  e.respondWith(
    caches.match(req).then(function(hit){
      if(hit) return hit;
      return fetch(req).then(function(res){
        if(res && res.status === 200){ var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); }); }
        return res;
      }).catch(function(){ return caches.match('./index.html'); });
    })
  );
});
