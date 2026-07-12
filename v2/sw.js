// RETUNE service worker — makes the installed app launch instantly and work OFFLINE.
// Bump CACHE when any asset changes so returning users pull the new version.
var CACHE = 'retune-own-3';
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
['ja','en','zh','ko'].forEach(function(lg){ IDS.forEach(function(id){ CORE.push('./audio/'+lg+'/'+id+'.mp3'); }); });

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

// Strategy:
//   HTML (the page itself) = NETWORK-FIRST  → always show the freshest version when online,
//     fall back to cache only when offline. This ends the "stale index.html / old subtitles"
//     problem: updates appear immediately without needing a manual double-reload.
//   Everything else (glb, audio, bgm, icons — versioned/immutable) = CACHE-FIRST → instant + offline.
//   Cross-origin (CDN three.js, analytics) = network passthrough.
self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET'){ return; }
  var url = new URL(req.url);
  if(url.origin !== self.location.origin){ return; }   // let CDN & analytics go to network
  // Media elements (video/bgm/narration) ask for byte ranges, and WebKit — especially the
  // installed PWA launched offline — requires a real 206; a cached full-200 body breaks playback.
  // The Cache API only stores full responses, so slice the cached body ourselves.
  var range = req.headers.get('range');
  if(range){
    e.respondWith(
      caches.match(req.url).then(function(hit){
        if(!hit) return fetch(req);   // network answers range requests itself
        return hit.arrayBuffer().then(function(buf){
          var m = /bytes=(\d*)-(\d*)/.exec(range) || [];
          var size = buf.byteLength;
          var start = m[1] ? parseInt(m[1],10) : Math.max(0, size - (parseInt(m[2],10) || 0));
          var end = (m[1] && m[2]) ? Math.min(parseInt(m[2],10), size-1) : size-1;
          if(start > end || start >= size){
            return new Response(null, {status:416, headers:{'Content-Range':'bytes */'+size}});
          }
          return new Response(buf.slice(start, end+1), {
            status:206, statusText:'Partial Content',
            headers:{
              'Content-Type': hit.headers.get('Content-Type') || 'application/octet-stream',
              'Content-Range': 'bytes '+start+'-'+end+'/'+size,
              'Content-Length': String(end-start+1),
              'Accept-Ranges': 'bytes'
            }
          });
        });
      })
    );
    return;
  }
  var isHTML = req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
  if(isHTML){
    e.respondWith(
      fetch(req).then(function(res){
        if(res && res.status === 200){ var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); }); }
        return res;
      }).catch(function(){ return caches.match(req).then(function(h){ return h || caches.match('./index.html'); }); })
    );
    return;
  }
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
