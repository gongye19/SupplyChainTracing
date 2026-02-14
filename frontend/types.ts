
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
  startDate: string; // YYYY-MM 格式
  endDate: string;   // YYYY-MM 格式
  tradeDirection: 'import' | 'export';
  selectedCountries: string[]; // 国家代码数组（ISO3，如 CHN/USA）
  selectedHSCodeCategories: string[]; // HS Code 2位大类数组（如 ["42", "54", "62"]）
  selectedHSCodeSubcategories: string[]; // HS Code 2位小类数组（如 ["04", "07", "05"]）
  selectedCompanies: string[]; // 公司名称数组
}

// 国家原产地贸易统计数据（从 country_origin_trade_stats 表）和地图组件使用的合并接口
export interface Shipment {
  // 聚合统计数据字段（从 country_origin_trade_stats 表）
  year: number;
  month: number;
  hsCode: string; // 6位 HS Code
  industry?: string;
  originCountryCode: string; // 原产国代码
  destinationCountryCode: string; // 目的地国家代码
  weight?: number;
  quantity?: number;
  totalValueUsd?: number; // sum_of_usd
  weightAvgPrice?: number;
  quantityAvgPrice?: number;
  tradeCount: number;
  amountSharePct?: number;
  
  // 向后兼容字段（用于前端显示）
  countryOfOrigin?: string; // 原产国名称（从代码映射）
  destinationCountry?: string; // 目的地国家名称（从代码映射）
  date?: string; // YYYY-MM-DD（从 year, month 生成）
  
  // 地图组件需要的字段
  categoryColor?: string; // 品类颜色
  id?: string;
  originId?: string; // 原产国代码（用于地图）
  destinationId?: string; // 目的地国家代码（用于地图）
  material?: string;
  category?: string;
  value?: number; // 总价值（百万美元）
  status?: string;
  timestamp?: string;
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


// 向后兼容：CountryLocation 类型（用于筛选器等组件）
export interface CountryLocation {
  countryCode: string;
  countryName: string;
  capitalLat: number;
  capitalLng: number;
  region?: string;
  continent?: string;
}

// 国家月度贸易统计
export interface CountryMonthlyTradeStat {
  hsCode: string;
  year: number;
  month: number;
  countryCode: string;
  industry?: string;
  weight?: number;
  quantity?: number;
  sumOfUsd: number;
  weightAvgPrice?: number;
  quantityAvgPrice?: number;
  tradeCount: number;
  amountSharePct: number;
}

// 国家贸易统计汇总
export interface CountryTradeStatSummary {
  totalCountries: number;
  totalTradeValue: number;
  totalWeight?: number;
  totalQuantity?: number;
  totalTradeCount: number;
  avgSharePct: number;
}

// 国家贸易趋势
export interface CountryTradeTrend {
  yearMonth: string; // YYYY-MM
  sumOfUsd: number;
  weight?: number;
  quantity?: number;
  tradeCount: number;
}

// Top国家
export interface TopCountry {
  countryCode: string;
  sumOfUsd: number;
  weight?: number;
  quantity?: number;
  tradeCount: number;
  amountSharePct: number;
}

// 国家贸易统计筛选条件
export interface CountryTradeFilters {
  hsCode?: string[];
  year?: number;
  month?: number;
  country?: string[];
  industry?: string;
  startYearMonth?: string; // YYYY-MM
  endYearMonth?: string; // YYYY-MM
}
