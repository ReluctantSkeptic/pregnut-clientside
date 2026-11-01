/* PregNut service worker: app shell + offline fallback. Network-first; only same-origin GETs are handled. */
const VERSION = 'pregnut-v1';
const SHELL = ["/pwa/offline.html","/manifest.webmanifest","/pwa/icon-192.png","/pwa/icon-512.png","/pwa/pwa.js"];
const OFFLINE = '/pwa/offline.html';
const SKIP = ["/api/","/cdn-cgi/"];
const RUNTIME = ['style', 'script', 'font', 'manifest'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('pregnut-') && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Pages serves /offline.html via a redirect to /offline; a redirected response can't answer a navigation, so copy it.
function clean(res) {
  if (!res || !res.redirected) return res;
  return res.blob().then((body) => new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers }));
}
function cacheable(res) {
  if (!res || !res.ok || res.type !== 'basic') return false;
  const cc = res.headers.get('cache-control') || '';
  return !/no-store|private/i.test(cc);
}
async function put(req, res) {
  const c = await caches.open(VERSION);
  await c.put(req, res);
  const keys = await c.keys();
  if (keys.length > 80) await c.delete(keys.find((k) => !SHELL.includes(new URL(k.url).pathname)));
}
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (SKIP.some((p) => url.pathname.startsWith(p))) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => {
      if (cacheable(res)) { const copy = res.clone(); e.waitUntil(put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((m) => m || caches.match(OFFLINE)).then(clean)));
    return;
  }
  if (RUNTIME.includes(req.destination) || SHELL.includes(url.pathname)) {
    e.respondWith(fetch(req).then((res) => {
      if (cacheable(res)) { const copy = res.clone(); e.waitUntil(put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((m) => m || Response.error())));
  }
});
