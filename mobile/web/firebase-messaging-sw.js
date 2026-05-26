// Firebase Messaging has been removed from this app.
// This stub replaces the old service worker that loaded Firebase CDN scripts,
// which caused Content Security Policy eval() violations.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));
