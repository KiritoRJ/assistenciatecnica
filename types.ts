
export interface Tenant {
  id: string;
  storeName: string;
  adminUsername: string;
  adminPasswordHash: string;
  createdAt: string;
  logoUrl?: string | null;
  subscriptionStatus?: 'trial' | 'active' | 'expired';
  subscriptionExpiresAt?: string;
  customMonthlyPrice?: number;
  customQuarterlyPrice?: number;
  customYearlyPrice?: number;
  lastPlanType?: 'monthly' | 'quarterly' | 'yearly';
  enabledFeatures?: {
    osTab: boolean;
    stockTab: boolean;
    salesTab: boolean;
    financeTab: boolean;
    profiles: boolean;
    xmlExportImport: boolean;
    hideFinancialReports?: boolean;
    promoBanner?: boolean;
  };
  maxUsers?: number;
  maxOS?: number;
  maxProducts?: number;
  printerSize?: 58 | 80;
  retentionMonths?: number;
}

export interface User {
  id: string;
  name: string;
  username?: string;
  role: 'admin' | 'colaborador';
  password?: string;
  photo: string | null;
  specialty?: 'Vendedor' | 'Técnico' | 'Outros';
  tenantId?: string;
}

// Interface que define a estrutura de uma Ordem de Serviço
export interface ServiceOrder {
  id: string;
  date: string; // Data de criação do registro no sistema
  entryDate: string; // DATA DE ENTRADA DO APARELHO (PT-BR)
  exitDate: string; // DATA DE SAÍDA DO APARELHO (PT-BR)
  customerName: string;
  phoneNumber: string;
  address: string;
  deviceBrand: string;
  deviceModel: string;
  defect: string;
  repairDetails: string;
  partsCost: number;
  serviceCost: number;
  total: number;
  status: 'Pendente' | 'Concluído' | 'Entregue';
  photos: string[];
  finishedPhotos?: string[];
  isDeleted?: boolean;
}

export interface Product {
  id: string;
  name: string;
  barcode?: string;
  photo: string | null;
  costPrice: number;
  salePrice: number;
  quantity: number;
  description?: string;
  additionalPhotos?: string[];
  promotionalPrice?: number;
  isPromotion?: boolean;
  videoUrl?: string;
}

export interface Sale {
  id: string;
  productId: string;
  productName: string;
  date: string;
  quantity: number;
  originalPrice: number;
  discount: number;
  surcharge?: number;
  finalPrice: number;
  costAtSale: number;
  paymentMethod?: string;
  paymentEntriesJson?: string;
  change?: number;
  sellerName?: string;
  transactionId?: string;
  isDeleted?: boolean;
}

export interface Transaction {
  id: string;
  type: 'entrada' | 'saida';
  description: string;
  amount: number;
  date: string;
  category?: string;
  paymentMethod?: string;
  isDeleted?: boolean;
  dueDate?: string;
  status?: 'pending' | 'paid' | 'overdue';
  installments?: {
    current: number;
    total: number;
  };
  recurrence?: 'monthly' | 'yearly';
}

export interface AppSettings {
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  logoUrl: string | null;
  users: User[];
  isConfigured: boolean;
  themePrimary: string;
  themeSidebar: string;
  themeBg: string;
  themeBottomTab: string;
  pdfWarrantyText: string;
  pdfFontSize: number;
  pdfFontFamily: 'helvetica' | 'courier' | 'times';
  pdfPaperWidth: number;
  printerSize?: 58 | 80;
  retentionMonths?: number;
  pdfTextColor: string;
  pdfBgColor: string;
  receiptHeaderSubtitle?: string;
  receiptLabelProtocol?: string;
  receiptLabelDate?: string;
  receiptLabelClientSection?: string;
  receiptLabelClientName?: string;
  receiptLabelClientPhone?: string;
  receiptLabelClientAddress?: string;
  receiptLabelServiceSection?: string;
  receiptLabelDevice?: string;
  receiptLabelDefect?: string;
  receiptLabelRepair?: string;
  receiptLabelTotal?: string;
  receiptLabelEntryPhotos?: string;
  receiptLabelExitPhotos?: string;
  itemsPerPage: 8 | 16 | 32 | 64;
  stockLayout?: 'small' | 'medium' | 'list';
  salesLayout?: 'small' | 'medium' | 'list';
  osLayout?: 'small' | 'medium' | 'large';
  catalogSlug?: string;
}
