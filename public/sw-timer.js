/* AdaptFit: tapping a timer notification brings the app back to the front. No network. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => 'focus' in c);
      if (open) return open.focus();
      return self.clients.openWindow ? self.clients.openWindow(self.registration.scope) : undefined;
    }),
  );
});
