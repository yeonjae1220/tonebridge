// Firebase Messaging service worker — handles background push notifications.
// This file must be at the root of the web build output (web/firebase-messaging-sw.js).
// Firebase web apiKey is a public identifier, not a secret.

importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBIsm_sp3e49I6bSCn-IUnrxoQu5U0QvTs',
  authDomain: 'tonebridge-44c8a.firebaseapp.com',
  projectId: 'tonebridge-44c8a',
  storageBucket: 'tonebridge-44c8a.firebasestorage.app',
  messagingSenderId: '890326583669',
  appId: '1:890326583669:web:102b2e7be1cc9f110c2b3c',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  const title = payload.notification?.title ?? 'ToneBridge';
  const body = payload.notification?.body ?? '';
  self.registration.showNotification(title, {
    body,
    icon: '/icons/Icon-192.png',
  });
});
