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
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME && key !== DYNAMIC_CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    if (url.origin !== location.origin) return;
    
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
                .catch(async () => {
                    const cached = await caches.match(event.request);
                    return cached || caches.match('content/home.html');
                })
        );
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(cached => cached || fetch(event.request))
    );
});

// Обработчик push-уведомлений
self.addEventListener('push', (event) => {
    console.log('Push получен:', event);
    
    let data = { title: 'Новое уведомление', body: '', reminderId: null };
    
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }
    
    const options = {
        body: data.body,
        icon: '/icons/icon-128.png',
        badge: '/icons/icon-48.png',
        vibrate: [200, 100, 200],
        data: { reminderId: data.reminderId }
    };
    
    // Добавляем кнопку "Отложить" только для напоминаний
    if (data.reminderId) {
        options.actions = [
            { action: 'snooze', title: '⏰ Отложить на 5 минут' }
        ];
    }
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Обработчик клика по уведомлению
self.addEventListener('notificationclick', (event) => {
    const notification = event.notification;
    const action = event.action;
    const reminderId = notification.data?.reminderId;
    
    notification.close();
    
    if (action === 'snooze' && reminderId) {
        // Отправляем запрос на сервер для откладывания
        event.waitUntil(
            fetch(`/snooze?reminderId=${reminderId}`, { method: 'POST' })
                .then(response => {
                    if (response.ok) {
                        console.log('Напоминание отложено на 5 минут');
                    }
                })
                .catch(err => console.error('Snooze error:', err))
        );
    } else {
        // Обычный клик — открываем приложение
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});