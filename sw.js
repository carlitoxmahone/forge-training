const CACHE = "forge-static-0.11.0";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./src/css/tokens.css",
  "./src/css/app.css",
  "./src/css/workout.css",
  "./src/css/history.css",
  "./src/css/summary.css",
  "./src/css/routine-editor.css",
  "./src/css/coach-history.css",
  "./src/css/exercise-modes.css",
  "./src/js/app.js",
  "./src/js/sessionFlow.js",
  "./src/js/exerciseHistory.js",
  "./src/js/workoutSummary.js",
  "./src/js/routineEditor.js",
  "./src/js/data/routines.js",
  "./src/js/core/utils.js",
  "./src/js/core/storage.js",
  "./src/js/core/workout.js",
  "./src/js/core/coach.js",
  "./src/js/core/exerciseModes.js",
  "./src/js/views/dashboardView.js",
  "./src/js/views/routineView.js",
  "./src/js/views/workoutView.js",
  "./src/js/views/progressView.js",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith("forge-") && key !== CACHE)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
