import { useEffect, useRef } from 'react';
import { Transaction, AppSettings, Product, ServiceOrder, Sale, User } from '../types';

export function useAppNotifications(
  transactions: Transaction[],
  products: Product[],
  orders: ServiceOrder[],
  sales: Sale[],
  settings: AppSettings | null,
  currentUser: User | null
) {
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (!('Notification' in window)) return;
    if (!settings || !currentUser || currentUser.role !== 'admin') return;

    // Initialize notifiedItems on first run to avoid spamming existing items
    if (isFirstRun.current) {
      const notifiedItems = JSON.parse(localStorage.getItem('notifiedItems') || '{}');
      let hasUpdates = false;

      // Mark existing OS and Sales as notified
      orders.forEach(o => {
        const key = `new-os-${o.id}`;
        if (!notifiedItems[key]) {
          notifiedItems[key] = true;
          hasUpdates = true;
        }
      });

      sales.forEach(s => {
        const key = `new-sale-${s.id}`;
        if (!notifiedItems[key]) {
          notifiedItems[key] = true;
          hasUpdates = true;
        }
      });

      if (hasUpdates) {
        localStorage.setItem('notifiedItems', JSON.stringify(notifiedItems));
      }
      isFirstRun.current = false;
      return;
    }

    const checkNotifications = async () => {
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }
      if (permission !== 'granted') return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const notifiedItems = JSON.parse(localStorage.getItem('notifiedItems') || '{}');
      let hasUpdates = false;

      const showNotification = (title: string, options: any, key: string) => {
        if (!notifiedItems[key]) {
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then((registration) => {
              registration.showNotification(title, {
                ...options,
                badge: '/icon.svg',
                vibrate: [200, 100, 200],
                tag: key,
                renotify: true
              });
            }).catch(() => {
              new Notification(title, options);
            });
          } else {
            new Notification(title, options);
          }
          notifiedItems[key] = true;
          hasUpdates = true;
        }
      };

      // 1. Contas a Pagar (Bills)
      if (settings.enableBillNotifications) {
        transactions.forEach((t) => {
          if (t.type === 'saida' && t.status === 'pending' && t.dueDate && !t.isDeleted) {
            const dueDate = new Date(t.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            const diffTime = dueDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays >= 0 && diffDays <= 3) {
              const key = `bill-${t.id}-${diffDays}`;
              showNotification('Conta a Pagar Próxima', {
                body: `A conta "${t.description}" vence ${diffDays === 0 ? 'hoje' : `em ${diffDays} dia(s)`}. Valor: R$ ${t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                icon: '/icon.svg',
              }, key);
            }
          }
        });
      }

      // 2. Contas a Receber (Receivables)
      if (settings.enableReceivableNotifications) {
        transactions.forEach((t) => {
          if (t.type === 'entrada' && t.status === 'pending' && t.dueDate && !t.isDeleted) {
            const dueDate = new Date(t.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            const diffTime = dueDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays >= 0 && diffDays <= 3) {
              const key = `receivable-${t.id}-${diffDays}`;
              showNotification('Conta a Receber Próxima', {
                body: `A entrada "${t.description}" vence ${diffDays === 0 ? 'hoje' : `em ${diffDays} dia(s)`}. Valor: R$ ${t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                icon: '/icon.svg',
              }, key);
            }
          }
        });
      }

      // 3. Estoque Baixo (Low Stock)
      if (settings.enableLowStockNotifications) {
        products.forEach((p) => {
          if (p.quantity < 3) {
            const key = `stock-${p.id}-${p.quantity}`;
            showNotification('Estoque Baixo', {
              body: `O produto "${p.name}" está com apenas ${p.quantity} unidades em estoque.`,
              icon: '/icon.svg',
            }, key);
          }
        });
      }

      // 4. Novas Ordens de Serviço (New OS)
      if (settings.enableNewOSNotifications) {
        orders.forEach((o) => {
          if (!o.isDeleted) {
            const key = `new-os-${o.id}`;
            showNotification('Nova Ordem de Serviço', {
              body: `Cliente: ${o.customerName}\nAparelho: ${o.deviceBrand} ${o.deviceModel}`,
              icon: '/icon.svg',
            }, key);
          }
        });
      }

      // 5. Novas Vendas (New Sales)
      if (settings.enableNewSaleNotifications) {
        sales.forEach((s) => {
          if (!s.isDeleted) {
            const key = `new-sale-${s.id}`;
            showNotification('Nova Venda Realizada', {
              body: `Vendedor: ${s.sellerName || 'N/A'}\nProduto: ${s.productName}\nValor: R$ ${s.finalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
              icon: '/icon.svg',
            }, key);
          }
        });
      }

      if (hasUpdates) {
        localStorage.setItem('notifiedItems', JSON.stringify(notifiedItems));
      }
    };

    checkNotifications();
    const interval = setInterval(checkNotifications, 60 * 1000); // Check every minute for real-time feel
    return () => clearInterval(interval);
  }, [transactions, products, orders, sales, settings, currentUser]);
}
