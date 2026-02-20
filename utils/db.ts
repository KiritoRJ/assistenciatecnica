
const DB_NAME = 'AssistenciaProDB';
const DB_VERSION = 3;

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Store Global para o wandev gerenciar as lojas
      if (!db.objectStoreNames.contains('global_tenants')) {
        db.createObjectStore('global_tenants', { keyPath: 'adminUsername' });
      }

      // Stores isolados (usarão chaves prefixadas pelo tenantId)
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
      if (!db.objectStoreNames.contains('orders')) db.createObjectStore('orders');
      if (!db.objectStoreNames.contains('products')) db.createObjectStore('products');
      if (!db.objectStoreNames.contains('sales')) db.createObjectStore('sales');
      if (!db.objectStoreNames.contains('transactions')) db.createObjectStore('transactions');
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveData = async (storeName: string, key: string, data: any): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getData = async (storeName: string, key: string): Promise<any> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getAllTenants = async (): Promise<any[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('global_tenants', 'readonly');
    const store = transaction.objectStore('global_tenants');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveTenant = async (tenant: any): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('global_tenants', 'readwrite');
    const store = transaction.objectStore('global_tenants');
    const request = store.put(tenant);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};
