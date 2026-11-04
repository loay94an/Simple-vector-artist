const CACHE_NAME = "rasem-vector-v4";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(
        SHELL.map(url => cache.add(url))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith("rasem-vector-") &&
          key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then(response => {
        if(response.ok) {
          const copy=response.clone();
          caches.open(CACHE_NAME).then(cache =>
            cache.put("./index.html",copy));
        }
        return response;
      }).catch(() =>
        caches.match(request).then(cached =>
          cached || caches.match("./index.html"))
      )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const network=fetch(request).then(response => {
        if(response.ok) {
          caches.open(CACHE_NAME).then(cache =>
            cache.put(request,response.clone()));
        }
        return response;
      });
      return cached || network;
    })
  );
});
