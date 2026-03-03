import { useEffect } from 'react';
import { Transaction, AppSettings } from '../types';

export function useBillNotifications(transactions: Transaction[], settings: AppSettings | null) {
  useEffect(() => {
    if (!('Notification' in window)) return;
    if (!settings?.enableBillNotifications) return;

    const checkBills = async () => {
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }
      if (permission !== 'granted') return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const notifiedBills = JSON.parse(localStorage.getItem('notifiedBills') || '{}');
      let hasUpdates = false;

      transactions.forEach((t) => {
        if (t.type === 'saida' && t.status === 'pending' && t.dueDate && !t.isDeleted) {
          const dueDate = new Date(t.dueDate);
          dueDate.setHours(0, 0, 0, 0);

          const diffTime = dueDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          // Notify if exactly 3 days away, or 2, 1, 0 days away if not notified yet
          if (diffDays >= 0 && diffDays <= 3) {
            const notificationKey = `${t.id}-${diffDays}`;
            if (!notifiedBills[notificationKey]) {
              const title = 'Conta a Pagar Próxima';
              const options = {
                body: `A conta "${t.description}" vence ${diffDays === 0 ? 'hoje' : `em ${diffDays} dia(s)`}. Valor: R$ ${t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                icon: '/icon.svg',
                badge: '/icon.svg',
                vibrate: [200, 100, 200],
                tag: notificationKey,
                renotify: true
              };

              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then((registration) => {
                  registration.showNotification(title, options);
                }).catch(() => {
                  new Notification(title, options);
                });
              } else {
                new Notification(title, options);
              }

              notifiedBills[notificationKey] = true;
              hasUpdates = true;
            }
          }
        }
      });

      if (hasUpdates) {
        localStorage.setItem('notifiedBills', JSON.stringify(notifiedBills));
      }
    };

    // Check immediately
    checkBills();

    // And check every hour while the app is open
    const interval = setInterval(checkBills, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [transactions, settings?.enableBillNotifications]);
}
