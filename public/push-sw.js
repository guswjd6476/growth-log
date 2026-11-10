// 서비스 워커에 붙는 푸시 처리 (vite.config.ts 의 workbox.importScripts)
self.addEventListener('push', (e) => {
    let body = '';
    try {
        body = e.data?.json().body ?? '';
    } catch {
        body = e.data?.text() ?? '';
    }
    e.waitUntil(self.registration.showNotification('성장일지', { body, icon: '/icon-192.png', badge: '/icon-192.png' }));
});

self.addEventListener('notificationclick', (e) => {
    e.notification.close();
    e.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => (cs[0] ? cs[0].focus() : self.clients.openWindow('/'))),
    );
});
