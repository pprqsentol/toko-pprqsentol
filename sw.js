const CACHE_NAME = 'kasir-toko-v56-delta-tumpang-tindih';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Library Supabase dimuat dari CDN oleh index.html. Tanpa disimpan di cache, aplikasi yang dibuka
// dalam keadaan offline (dan cache bawaan browser sudah kosong) bisa gagal jalan sama sekali.
// Diambil dengan mode 'cors' supaya statusnya bisa dicek (response 'opaque' tidak bisa dicek ok/tidaknya).
const SUPABASE_JS_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';

// Instal: simpan semua file inti ke cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache =>
        cache.addAll(ASSETS).then(() =>
          fetch(SUPABASE_JS_URL, { mode: 'cors' })
            .then(res => { if (res && res.ok) return cache.put(SUPABASE_JS_URL, res); })
            .catch(() => {}) // gagal ambil (mis. internet mati saat instal) TIDAK boleh membatalkan instalasi; nanti dicoba lagi saat dipakai
        )
      )
      .then(() => self.skipWaiting())
  );
});

// Aktivasi: hapus cache versi lama
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first, dengan fallback ke jaringan lalu ke index.html untuk navigasi
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return; // lewati request non-http (mis. dari ekstensi browser)

  // Library Supabase (CDN): pakai salinan di cache; kalau belum ada, ambil lalu simpan untuk pemakaian offline berikutnya.
  if (event.request.url === SUPABASE_JS_URL) {
    event.respondWith(
      caches.match(SUPABASE_JS_URL, { ignoreVary: true }).then(cached => {
        if (cached) return cached;
        return fetch(SUPABASE_JS_URL, { mode: 'cors' })
          .then(res => {
            if (res && res.ok) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(SUPABASE_JS_URL, clone));
            }
            return res;
          })
          .catch(() => fetch(event.request)); // cara lama sebagai cadangan
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request)
        .then(response => {
          // simpan salinan baru ke cache untuk pemakaian offline berikutnya
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // offline dan tidak ada di cache: untuk navigasi halaman, tampilkan index.html
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
