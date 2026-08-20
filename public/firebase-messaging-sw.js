importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'FCM_API_KEY',
  authDomain: 'FCM_AUTH_DOMAIN',
  projectId: 'FCM_PROJECT_ID',
  storageBucket: 'FCM_STORAGE_BUCKET',
  messagingSenderId: 'FCM_SENDER_ID',
  appId: 'FCM_APP_ID',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { notification, data } = payload;
  if (!notification) return;
  const title = notification.title || 'Next Boost Peru';
  const options = {
    body: notification.body || '',
    icon: '/vite.svg',
    badge: '/vite.svg',
    data: data || {},
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = new URL('/', self.location.origin).href;
  event.waitUntil(clients.openWindow(urlToOpen));
});
