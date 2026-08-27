
import Dexie, { Table } from 'dexie';
import { ServiceOrder, Product, Sale, Transaction, AppSettings, User, Customer } from '../types';

export interface SyncItem {
  id?: number;
  tenantId: string;
  type: 'orders' | 'products' | 'sales' | 'transactions' | 'settings' | 'customers';
  action: 'upsert' | 'delete';
  data: any;
  timestamp: number;
}

export class AssistenciaProDB extends Dexie {
  orders!: Table<ServiceOrder & { tenantId: string }, string>;
  products!: Table<Product & { tenantId: string }, string>;
  sales!: Table<Sale & { tenantId: string }, string>;
  transactions!: Table<Transaction & { tenantId: string }, string>;
  settings!: Table<AppSettings & { tenantId: string }, string>;
  users!: Table<User & { tenantId: string }, string>;
  customers!: Table<Customer & { tenantId: string }, string>;
  syncQueue!: Table<SyncItem, number>;

  constructor() {
    super('AssistenciaPro_OfflineDB');
    this.version(1).stores({
      orders: 'id, tenantId, customerName, status, isDeleted',
      products: 'id, tenantId, name, barcode',
      sales: 'id, tenantId, productId, date, isDeleted',
      transactions: 'id, tenantId, type, date, isDeleted',
      settings: 'tenantId',
      users: 'id, tenantId, username, role',
      syncQueue: '++id, tenantId, type, action, timestamp'
    });
    this.version(2).stores({
      customers: 'id, tenantId, name, phoneNumber, isDeleted'
    });
  }
}

export const db = new AssistenciaProDB();
