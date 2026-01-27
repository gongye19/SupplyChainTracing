
// 品类信息
export interface Category {
  id: string;
  name: string;
  displayName: string;
  color: string;
  icon?: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
}

// 公司信息
export interface Company {
  id: string;
  name: string;
  countryCode: string;
  countryName: string;
  city: string;
  type: 'importer' | 'exporter' | 'both';
  industry?: string;
  website?: string;
}

// 公司信息（带位置）
export interface CompanyWithLocation extends Company {
  latitude: number;
  longitude: number;
  region?: string;
  continent?: string;
}

// 交易记录
export interface Transaction {
  id: string;
  exporterCompanyId?: string;
  exporterCompanyName?: string;
  exporterCountryCode: string;
  exporterCountryName: string;
  importerCompanyId?: string;
  importerCompanyName?: string;
  importerCountryCode: string;
  importerCountryName: string;
  material: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  quantity: number;
  unit?: string;
  price: number;
  totalValue: number;
  transactionDate: string;
  status: 'completed' | 'in-transit' | 'pending' | 'cancelled';
  notes?: string;
}

// 位置信息
export interface Location {
  id: string;
  type: 'country' | 'city';
  countryCode: string;
  countryName: string;
  city?: string;
  latitude: number;
  longitude: number;
  region?: string;
  continent?: string;
  address?: string;
}

// 筛选条件
export interface Filters {
  startDate: string; // YYYY-MM-DD 格式
  endDate: string;   // YYYY-MM-DD 格式
  selectedCountries: string[]; // 国家名称数组
  selectedHSCodeCategories: string[]; // HS Code 2位大类数组（如 ["42", "54", "62"]）
  selectedHSCodeSubcategories: string[]; // HS Code 2位小类数组（如 ["04", "07", "05"]）
  selectedCompanies: string[]; // 公司名称数组
}

// 原始交易数据（从 shipments_raw 表）
export interface Shipment {
  date: string; // YYYY-MM-DD
  importerName: string;
  exporterName: string;
  hsCode: string; // 4位 HS Code
  productEnglish?: string;
  productDescription?: string;
  weightKg?: number;
  quantity?: number;
  quantityUnit?: string;
  totalValueUsd?: number;
  unitPricePerKg?: number;
  unitPricePerItem?: number;
  countryOfOrigin: string;
  destinationCountry: string;
  portOfDeparture?: string;
  portOfArrival?: string;
  importExport?: string;
  transportMode?: string;
  tradeTerm?: string;
}

// 月度公司流量（聚合表）
export interface MonthlyCompanyFlow {
  yearMonth: string;
  exporterName: string;
  importerName: string;
  originCountry: string;
  destinationCountry: string;
  hsCodes: string; // 逗号分隔的HS Code列表
  transportMode: string;
  tradeTerm: string;
  transactionCount: number;
  totalValueUsd: number;
  totalWeightKg: number;
  totalQuantity: number;
  firstTransactionDate: string;
  lastTransactionDate: string;
}

// HS Code 品类
export interface HSCodeCategory {
  hsCode: string; // 前2位章节
  chapterName: string;
}

// 向后兼容的 Shipment 接口（用于地图组件）
export interface Shipment {
  categoryColor?: string; // 品类颜色，直接从交易数据获取
  id: string;
  originId: string;
  destinationId: string;
  portOfDeparture?: string; // 出发港口
  portOfArrival?: string; // 到达港口
  countryOfOrigin?: string; // 原产国名称
  destinationCountry?: string; // 目的地国家名称
  exporterCompanyName?: string;
  importerCompanyName?: string;
  material: string;
  category: string;
  quantity: number;
  value: number;
  status: string;
  timestamp: string;
}

// 向后兼容：CountryLocation 类型（用于筛选器等组件）
export interface CountryLocation {
  countryCode: string;
  countryName: string;
  capitalLat: number;
  capitalLng: number;
  region?: string;
  continent?: string;
}
