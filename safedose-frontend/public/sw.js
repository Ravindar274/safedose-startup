// public/sw.js — SafeDose Service Worker

self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'SafeDose Reminder', {
      body:      data.body || 'Time to take your medication.',
      icon:      '/favicon.ico',
      badge:     '/favicon.ico',
      tag:       data.tag || 'safedose-reminder',
      renotify:  true,
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/patient/dashboard'));
});
