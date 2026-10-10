// 오프라인용 서비스 워커: 온라인이면 항상 새 파일(네트워크 우선), 안 되면 저장해 둔 파일
const CACHE = 'fretmaster-v4';
const ASSETS = [
  './',
  'index.html',
  'style.css',
  'pitch.js',
  'chords.js',
  'guide.js',
  'scales.js',
  'ear.js',
  'metronome.js',
  'drum.js',
  'triads.js',
  'intervals.js',
  'jam.js',
  'log.js',
  'change.js',
  'stats.js',
  'staff.js',
  'analyze.js',
  'build.js',
  'app.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-64.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    // 브라우저 HTTP 캐시도 건너뛰고 서버에 확인 (바뀌지 않았으면 304라 가벼움) → 배포가 바로 반영됨
    fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(async () => {
        const hit = await caches.match(req, { ignoreSearch: true });
        if (hit) return hit;
        if (req.mode === 'navigate') return caches.match('index.html');
        return Response.error();
      }),
  );
});
