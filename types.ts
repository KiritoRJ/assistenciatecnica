
export interface Tenant {
  id: string;
  storeName: string;
  adminUsername: string;
  adminPasswordHash: string;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  username?: string;
  role: 'admin' | 'vendedor' | 'tecnico';
  password?: string;
  photo: string | null;
}

export interface ServiceOrder {
  id: string;
  date: string;
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
}

export interface Product {
  id: string;
  name: string;
  photo: string | null;
  costPrice: number;
  salePrice: number;
  quantity: number;
}

export interface Sale {
  id: string;
  productId: string;
  productName: string;
  date: string;
  quantity: number;
  originalPrice: number;
  discount: number;
  finalPrice: number;
  costAtSale: number;
  paymentMethod?: string;
  sellerName?: string;
  transactionId?: string;
}

export interface AppSettings {
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  logoUrl: string | null;
  users: User[];
  isConfigured: boolean;
  // Personalização de Cores
  themePrimary: string;
  themeSidebar: string;
  themeBg: string;
  themeBottomTab: string;
  // PDF / Cupom
  pdfWarrantyText: string;
  pdfFontSize: number;
  pdfFontFamily: 'helvetica' | 'courier' | 'times';
  pdfPaperWidth: number;
  pdfTextColor: string;
  pdfBgColor: string;
  // Etiquetas Customizáveis do Cupom
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
}
