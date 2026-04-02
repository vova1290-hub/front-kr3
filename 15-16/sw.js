const CACHE_NAME = 'app-shell-v1';
const DYNAMIC_CACHE_NAME = 'dynamic-v1';

const ASSETS = [
    'index.html',
    'style.css',
    'app.js',
    'manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Кэширование статических файлов');
                return cache.addAll(ASSETS);
            })
            .then(() => self.skipWaiting())
            .catch(err => console.error('Ошибка кэширования:', err))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME && key !== DYNAMIC_CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        }).then(() => {
            console.log('Service Worker активирован');
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Пропускаем запросы к другим сайтам (например, CDN)
    if (url.origin !== location.origin) {
        return;
    }
    
    // Для динамических страниц (content/*) - сначала сеть, потом кэш
    if (url.pathname.startsWith('/content/')) {
        event.respondWith(
            fetch(event.request)
                .then(networkRes => {
                    const resClone = networkRes.clone();
                    caches.open(DYNAMIC_CACHE_NAME).then(cache => {
                        cache.put(event.request, resClone);
                    });
                    return networkRes;
                })
                .catch(() => {
                    return caches.match(event.request)
                        .then(cached => {
                            if (cached) return cached;
                            return caches.match('content/home.html');
                        });
                })
        );
    } 
    // Для статических файлов - сначала кэш, потом сеть
    else {
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    if (response) {
                        return response;
                    }
                    return fetch(event.request).catch(() => {
                        return new Response('Страница не найдена', { status: 404 });
                    });
                })
        );
    }
});