const CACHE_NAME = 'edu-platform-v3-ultra';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/java.js',
    '/1234.jpg',
    '/manifest.json',
    'https://cdn.jsdelivr.net/npm/chart.js'
];

// محرك IndexedDB مدمج داخل الـ Service Worker للعمل في الخلفية (Background Sync)
const dbHelper = {
    openDB: () => new Promise((resolve, reject) => {
        const request = indexedDB.open('EduPlatformOfflineDB', 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('offline_analytics')) {
                db.createObjectStore('offline_analytics', { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    }),
    saveAnalytics: async (data) => {
        const db = await dbHelper.openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('offline_analytics', 'readwrite');
            tx.objectStore('offline_analytics').add({ payload: data, timestamp: Date.now() });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject();
        });
    },
    getAnalytics: async () => {
        const db = await dbHelper.openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('offline_analytics', 'readonly');
            const request = tx.objectStore('offline_analytics').getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject();
        });
    },
    clearAnalytics: async (id) => {
        const db = await dbHelper.openDB();
        return new Promise((resolve) => {
            const tx = db.transaction('offline_analytics', 'readwrite');
            tx.objectStore('offline_analytics').delete(id);
            tx.oncomplete = () => resolve();
        });
    }
};

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Cache Opened: Caching App Shell');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// اعتراض الطلبات ودعم الأوفلاين الكامل
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                return cachedResponse;
            });
            return cachedResponse || fetchPromise;
        })
    );
});

// الاستماع لحدث عودة الإنترنت (Background Sync) لرفع الإجابات
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-exam-analytics') {
        event.waitUntil(syncOfflineAnalytics());
    }
});

async function syncOfflineAnalytics() {
    try {
        const pendingData = await dbHelper.getAnalytics();
        if (pendingData.length === 0) return;

        // إرسال رسالة للواجهة الأمامية لتقوم هي بالرفع على Firebase لأن الـ SW لا يدعم Firebase SDK مباشرة
        const clientsList = await self.clients.matchAll();
        for (const client of clientsList) {
            client.postMessage({
                type: 'SYNC_ANALYTICS',
                data: pendingData
            });
        }
    } catch (err) {
        console.error("Error syncing offline data:", err);
    }
}
