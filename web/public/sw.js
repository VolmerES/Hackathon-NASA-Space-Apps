// Fly Me to the Moon service worker: lets the app open again without a connection.
// - Pages: network first, the saved copy if offline (so a new version always wins when online).
// - Everything else from this site (code, NASA data, Moon textures): the saved copy at once,
//   refreshed in the background, so a second visit starts fast and works offline.
// Only same-origin GET requests are handled; nothing leaves the browser.
const CACHE = 'lunar-landing-v8' // bump to drop files no longer used (v2: Plotly removed; v7: data URLs now carry ?v=<build>; v8: DSN antennas, and builds that reused the v7 name)
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png', '/moon/moon_fallback_wide.jpg', '/moon/moon_fallback_tall.jpg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('/', copy))
          return res
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  event.respondWith(
    caches.open(CACHE).then(async (c) => {
      const hit = await c.match(req)
      const fresh = fetch(req)
        .then((res) => {
          if (res.ok) {
            c.put(req, res.clone())
            // A data file of a new build (?v=…): drop the copies of older builds.
            if (url.searchParams.has('v'))
              c.keys().then((ks) => ks.forEach((k) => { const u = new URL(k.url); if (u.pathname === url.pathname && u.search !== url.search) c.delete(k) }))
          }
          return res
        })
        .catch(() => hit)
      if (hit) {
        event.waitUntil(fresh)
        return hit
      }
      return fresh
    }),
  )
})
