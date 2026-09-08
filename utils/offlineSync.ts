
import { db, SyncItem } from './localDb';
import { OnlineDB } from './api';
import { ServiceOrder, Product, Sale, Transaction, AppSettings, User, Customer } from '../types';
import { ConnectionStatusManager } from './connectionStatus';

export class OfflineSync {
  private static isSyncing = false;

  static async init() {
    window.addEventListener('online', () => {
      console.log('App is online. Starting sync...');
      this.processQueue();
    });

    // Process queue on init if online
    if (navigator.onLine) {
      this.processQueue();
    }
  }

  static async processQueue() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const queue = await db.syncQueue.orderBy('timestamp').toArray();
      ConnectionStatusManager.refreshPendingCount();
      if (queue.length === 0) {
        this.isSyncing = false;
        return;
      }

      console.log(`Processing ${queue.length} items from sync queue...`);

      for (const item of queue) {
        let success = false;
        try {
          switch (item.type) {
            case 'orders':
              if (item.action === 'upsert') {
                const res = await OnlineDB.upsertOrders(item.tenantId, [item.data]);
                success = res.success;
              } else if (item.action === 'delete') {
                const res = await OnlineDB.deleteOS(item.data.id);
                success = res.success;
              }
              break;
            case 'products':
              if (item.action === 'upsert') {
                const res = await OnlineDB.upsertProducts(item.tenantId, [item.data]);
                success = res.success;
              } else if (item.action === 'delete') {
                const res = await OnlineDB.deleteProduct(item.data.id);
                success = res.success;
              }
              break;
            case 'sales':
              if (item.action === 'upsert') {
                const res = await OnlineDB.upsertSales(item.tenantId, [item.data]);
                success = res.success;
              } else if (item.action === 'delete') {
                const res = await OnlineDB.deleteSale(item.data.id);
                success = res.success;
              }
              break;
            case 'transactions':
              if (item.action === 'upsert') {
                const res = await OnlineDB.upsertTransactions(item.tenantId, [item.data]);
                success = res.success;
              } else if (item.action === 'delete') {
                const res = await OnlineDB.deleteTransaction(item.data.id);
                success = res.success;
              }
              break;
            case 'settings':
              const res = await OnlineDB.syncPush(item.tenantId, 'settings', item.data);
              success = res.success;
              break;
            case 'customers':
              if (item.action === 'upsert') {
                const res = await OnlineDB.upsertCustomers(item.tenantId, Array.isArray(item.data) ? item.data : [item.data]);
                success = res.success;
              } else if (item.action === 'delete') {
                const res = await OnlineDB.deleteCustomer(item.tenantId, item.data.id);
                success = res.success;
              }
              break;
          }
        } catch (err) {
          console.error('Error syncing item:', item, err);
          success = false;
        }

        if (success) {
          await db.syncQueue.delete(item.id!);
          ConnectionStatusManager.refreshPendingCount();
          ConnectionStatusManager.reportSuccess();
        } else {
          // If one fails, stop and wait for next online event or retry
          console.warn('Sync failed for item, stopping queue processing.');
          break;
        }
      }
    } finally {
      this.isSyncing = false;
      ConnectionStatusManager.refreshPendingCount();
    }
  }

  private static async enqueue(item: SyncItem) {
    await db.syncQueue.add(item);
    ConnectionStatusManager.refreshPendingCount();
  }

  static async saveOrder(tenantId: string, order: ServiceOrder) {
    await db.orders.put({ ...order, tenantId });
    if (navigator.onLine) {
      const res = await OnlineDB.upsertOrders(tenantId, [order]);
      if (res.success) return;
    }
    await this.enqueue({
      tenantId,
      type: 'orders',
      action: 'upsert',
      data: order,
      timestamp: Date.now()
    });
  }

  static async deleteOrder(tenantId: string, orderId: string) {
    const order = await db.orders.get(orderId);
    if (order) {
      await db.orders.update(orderId, { isDeleted: true });
    }
    if (navigator.onLine) {
      const res = await OnlineDB.deleteOS(orderId);
      if (res.success) return;
    }
    await this.enqueue({
      tenantId,
      type: 'orders',
      action: 'delete',
      data: { id: orderId },
      timestamp: Date.now()
    });
  }

  static async saveProduct(tenantId: string, product: Product) {
    await db.products.put({ ...product, tenantId });
    if (navigator.onLine) {
      const res = await OnlineDB.upsertProducts(tenantId, [product]);
      if (res.success) return;
    }
    await this.enqueue({
      tenantId,
      type: 'products',
      action: 'upsert',
      data: product,
      timestamp: Date.now()
    });
  }

  static async deleteProduct(tenantId: string, productId: string) {
    await db.products.delete(productId);
    if (navigator.onLine) {
      const res = await OnlineDB.deleteProduct(productId);
      if (res.success) return;
    }
    await this.enqueue({
      tenantId,
      type: 'products',
      action: 'delete',
      data: { id: productId },
      timestamp: Date.now()
    });
  }

  static async saveSale(tenantId: string, sale: Sale) {
    await db.sales.put({ ...sale, tenantId });
    if (navigator.onLine) {
      const res = await OnlineDB.upsertSales(tenantId, [sale]);
      if (res.success) return;
    }
    await this.enqueue({
      tenantId,
      type: 'sales',
      action: 'upsert',
      data: sale,
      timestamp: Date.now()
    });
  }

  static async deleteSale(tenantId: string, saleId: string) {
    const sale = await db.sales.get(saleId);
    if (sale) {
      await db.sales.update(saleId, { isDeleted: true });
    }
    if (navigator.onLine) {
      const res = await OnlineDB.deleteSale(saleId);
      if (res.success) return;
    }
    await this.enqueue({
      tenantId,
      type: 'sales',
      action: 'delete',
      data: { id: saleId },
      timestamp: Date.now()
    });
  }

  static async saveTransaction(tenantId: string, transaction: Transaction) {
    await db.transactions.put({ ...transaction, tenantId });
    if (navigator.onLine) {
      const res = await OnlineDB.upsertTransactions(tenantId, [transaction]);
      if (res.success) return;
    }
    await this.enqueue({
      tenantId,
      type: 'transactions',
      action: 'upsert',
      data: transaction,
      timestamp: Date.now()
    });
  }

  static async deleteTransaction(tenantId: string, transactionId: string) {
    const transaction = await db.transactions.get(transactionId);
    if (transaction) {
      await db.transactions.update(transactionId, { isDeleted: true });
    }
    if (navigator.onLine) {
      const res = await OnlineDB.deleteTransaction(transactionId);
      if (res.success) return;
    }
    await this.enqueue({
      tenantId,
      type: 'transactions',
      action: 'delete',
      data: { id: transactionId },
      timestamp: Date.now()
    });
  }

  static async saveUser(tenantId: string, user: User) {
    await db.users.put({ ...user, tenantId });
    // Users are currently managed mostly online, but we keep them local for switching
  }

  static async deleteUser(tenantId: string, userId: string) {
    await db.users.delete(userId);
  }

  static async saveSettings(tenantId: string, settings: AppSettings) {
    await db.settings.put({ ...settings, tenantId });
    if (navigator.onLine) {
      const res = await OnlineDB.syncPush(tenantId, 'settings', settings);
      if (res.success) return;
    }
    await this.enqueue({
      tenantId,
      type: 'settings',
      action: 'upsert',
      data: settings,
      timestamp: Date.now()
    });
  }

  static async saveCustomer(tenantId: string, customer: Customer) {
    await db.customers.put({ ...customer, tenantId });
    if (navigator.onLine) {
      const res = await OnlineDB.upsertCustomers(tenantId, [customer]);
      if (res.success) return;
    }
    await this.enqueue({
      tenantId,
      type: 'customers',
      action: 'upsert',
      data: customer,
      timestamp: Date.now()
    });
  }

  static async saveCustomers(tenantId: string, customers: Customer[]) {
    await db.customers.bulkPut(customers.map(c => ({ ...c, tenantId })));
    if (navigator.onLine) {
      const res = await OnlineDB.upsertCustomers(tenantId, customers);
      if (res.success) return;
    }
    await this.enqueue({
      tenantId,
      type: 'customers',
      action: 'upsert',
      data: customers,
      timestamp: Date.now()
    });
  }

  static async deleteCustomer(tenantId: string, customerId: string) {
    const customer = await db.customers.get(customerId);
    if (customer) {
      await db.customers.update(customerId, { isDeleted: true });
    }
    if (navigator.onLine) {
      const res = await OnlineDB.deleteCustomer(tenantId, customerId);
      if (res.success) return;
    }
    await this.enqueue({
      tenantId,
      type: 'customers',
      action: 'delete',
      data: { id: customerId },
      timestamp: Date.now()
    });
  }

  static async pullAllData(tenantId: string) {
    if (!navigator.onLine) return null;

    try {
      const [cloudSettings, cloudOrders, cloudProducts, cloudSales, cloudTransactions, cloudUsers, cloudCustomers] = await Promise.all([
        OnlineDB.syncPull(tenantId, 'settings'),
        OnlineDB.fetchOrders(tenantId),
        OnlineDB.fetchProducts(tenantId),
        OnlineDB.fetchSales(tenantId),
        OnlineDB.fetchTransactions(tenantId),
        OnlineDB.fetchUsers(tenantId),
        OnlineDB.fetchCustomers(tenantId)
      ]);

      // Se todas as fontes retornaram null (falha de rede/Supabase offline), mantém os dados locais
      if (cloudOrders === null && cloudProducts === null && cloudSales === null && cloudSettings === null) {
        return null;
      }

      if (cloudSettings) await db.settings.put({ ...cloudSettings, tenantId });
      if (Array.isArray(cloudUsers) && cloudUsers.length > 0) {
        await db.users.where('tenantId').equals(tenantId).delete();
        await db.users.bulkPut(cloudUsers.map((u: any) => ({ ...u, tenantId })));
      }
      if (Array.isArray(cloudOrders)) {
        await db.orders.where('tenantId').equals(tenantId).delete();
        await db.orders.bulkPut(cloudOrders.map((o: any) => ({ ...o, tenantId })));
      }
      if (Array.isArray(cloudProducts)) {
        await db.products.where('tenantId').equals(tenantId).delete();
        await db.products.bulkPut(cloudProducts.map((p: any) => ({ ...p, tenantId })));
      }
      if (Array.isArray(cloudSales)) {
        await db.sales.where('tenantId').equals(tenantId).delete();
        await db.sales.bulkPut(cloudSales.map((s: any) => ({ ...s, tenantId })));
      }
      if (Array.isArray(cloudTransactions)) {
        await db.transactions.where('tenantId').equals(tenantId).delete();
        await db.transactions.bulkPut(cloudTransactions.map((t: any) => ({ ...t, tenantId })));
      }
      if (Array.isArray(cloudCustomers)) {
        await db.customers.where('tenantId').equals(tenantId).delete();
        await db.customers.bulkPut(cloudCustomers.map((c: any) => ({ ...c, tenantId })));
      }

      return {
        settings: cloudSettings,
        orders: Array.isArray(cloudOrders) ? cloudOrders : [],
        products: Array.isArray(cloudProducts) ? cloudProducts : [],
        sales: Array.isArray(cloudSales) ? cloudSales : [],
        transactions: Array.isArray(cloudTransactions) ? cloudTransactions : [],
        users: Array.isArray(cloudUsers) ? cloudUsers : [],
        customers: Array.isArray(cloudCustomers) ? cloudCustomers : []
      };
    } catch (e) {
      console.warn('Conexão instável ao puxar dados da nuvem, mantendo dados locais salvos.');
      return null;
    }
  }

  static async getLocalData(tenantId: string) {
    const [settings, orders, products, sales, transactions, users, customers] = await Promise.all([
      db.settings.get(tenantId),
      db.orders.where('tenantId').equals(tenantId).toArray(),
      db.products.where('tenantId').equals(tenantId).toArray(),
      db.sales.where('tenantId').equals(tenantId).toArray(),
      db.transactions.where('tenantId').equals(tenantId).toArray(),
      db.users.where('tenantId').equals(tenantId).toArray(),
      db.customers.where('tenantId').equals(tenantId).toArray()
    ]);

    return { settings, orders, products, sales, transactions, users, customers: customers || [] };
  }
}
