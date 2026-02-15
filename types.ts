
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

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'vendedor' | 'tecnico';
  password?: string;
  photo: string | null;
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
  logoUrl: string | null;
  users: User[];
  isConfigured: boolean;
  // Configurações de PDF
  pdfWarrantyText: string;
  pdfFontSize: number;
  pdfFontFamily: 'helvetica' | 'courier' | 'times';
  pdfPaperWidth: number;
  pdfTextColor: string;
  pdfBgColor: string;
}
