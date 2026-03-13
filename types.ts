
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
  checklist?: string[];
  signature?: string;
  isDeleted?: boolean;
  technicianId?: string;
  sellerId?: string;
  paymentMethod?: 'Dinheiro' | 'Cartão' | 'PIX';
  paymentInstallments?: number;
}

export interface Product {
  id: string;
  name: string;
  category?: string;
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
  category?: string;
  date: string;
  quantity: number;
  originalPrice: number; // This is salePricePerUnitAtSale
  discount: number;
  surcharge?: number;
  finalPrice: number;
  costAtSale: number; // This is totalCostAtSale
  costPerUnitAtSale: number;
  salePricePerUnitAtSale: number;
  paymentMethod?: string;
  paymentEntriesJson?: string;
  change?: number;
  sellerName?: string;
  sellerId?: string;
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
  enableBillNotifications?: boolean;
  enableReceivableNotifications?: boolean;
  enableLowStockNotifications?: boolean;
  enableNewOSNotifications?: boolean;
  enableNewSaleNotifications?: boolean;
  salesBannerUrl?: string | null;
}

export interface Employee {
  id: string;
  tenantId: string;
  userId?: string;
  name: string;
  email?: string;
  phone?: string;
  cpf?: string;
  rg?: string;
  birthDate?: string;
  address?: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  };
  pixKey?: string;
  pixKeyType?: 'cpf' | 'email' | 'phone' | 'random';
  role: 'tecnico' | 'vendedor' | 'atendente' | 'gerente' | 'administrador';
  status: 'active' | 'inactive';
  admissionDate: string;
  photoUrl?: string;
  salaryBase: number;
  // Commission Settings
  commissionType: 'sales_percent' | 'profit_percent' | 'mixed';
  defaultCommissionPercent: number; // Used for sales (or profit if type is profit_percent)
  serviceCommissionPercent: number; // Specific for services
  goalMonthly: number;
  permissions: {
    open_os: boolean;
    sell: boolean;
    view_finance: boolean;
    edit_price: boolean;
    cancel_sale: boolean;
  };
}

export interface CommissionRule {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  targetType: 'global' | 'category' | 'product' | 'service';
  targetId?: string; // ID of category, product or service
  employeeId?: string; // If null, applies to all
  ruleType: 'percent' | 'fixed';
  calculationBase: 'gross_sale' | 'net_profit';
  value: number; // Percent or fixed value
  minAmount?: number; // Minimum sale amount for rule to apply
  requiresGoalMet?: boolean; // If true, only applies if monthly goal is met
  priority: number;
  isActive: boolean;
}

export interface GoalTier {
  id: string;
  tenantId: string;
  employeeId?: string; // If null, it's a global tier
  name: string;
  minAmount: number;
  bonusType: 'percent' | 'fixed';
  bonusValue: number;
  calculationBase: 'gross_sale' | 'net_profit';
}

export interface CommissionLog {
  id: string;
  employeeId: string;
  originType: 'sale' | 'service_order' | 'bonus';
  originId: string;
  description: string;
  saleAmount: number;
  profitAmount: number;
  commissionAmount: number;
  status: 'pending' | 'paid' | 'cancelled';
  paymentDate?: string;
  createdAt: string;
}
