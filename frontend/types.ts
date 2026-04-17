
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
  selectedHSCodes: string[]; // HS Code 6位数组（如 ["854231", "381800"]）
  selectedHSCode4Digit: string[]; // HS Code 4位数组（如 ["8542", "3818"]）
  selectedHSCodeCategories: string[]; // HS Code 2位大类数组（如 ["42", "54", "62"]）
  selectedHSCodeSubcategories: string[]; // HS Code 2位小类数组（如 ["04", "07", "05"]）
  selectedCompanies: string[]; // 公司名称数组
}

// 国家原产地贸易统计数据（从 country_origin_trade_stats 表）和地图组件使用的合并接口
export interface Shipment {
  year: number;
  month: number;
  hsCode: string;
  originCountryCode: string;
  destinationCountryCode: string;
  totalValueUsd?: number;
  tradeCount: number;
  // 向后兼容字段
  countryOfOrigin?: string;
  destinationCountry?: string;
  date?: string;
  // 地图组件需要的字段
  categoryColor?: string;
  id?: string;
  originId?: string;
  destinationId?: string;
  material?: string;
  category?: string;
  value?: number;
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
  sumOfUsd: number;
  tradeCount: number;
}

// 国家贸易统计汇总
export interface CountryTradeStatSummary {
  totalCountries: number;
  totalTradeValue: number;
  totalTradeCount: number;
  avgSharePct: number;
}

// 国家贸易趋势
export interface CountryTradeTrend {
  yearMonth: string; // YYYY-MM
  sumOfUsd: number;
  tradeCount: number;
}

// Top国家
export interface TopCountry {
  countryCode: string;
  sumOfUsd: number;
  tradeCount: number;
  amountSharePct: number;
}

export interface CountryQuarterTop {
  year: number;
  quarter: number;
  countryCode: string;
  sumOfUsd: number;
  tradeCount: number;
}

export interface CountryAggregate {
  countryCode: string;
  sumOfUsd: number;
  tradeCount: number;
}

export interface CountryQuarterAggregate {
  year: number;
  quarter: number;
  countryCode: string;
  sumOfUsd: number;
  tradeCount: number;
}

export interface HSAggregate {
  hsCode: string;
  sumOfUsd: number;
  tradeCount: number;
}

export interface HSQuarterAggregate {
  year: number;
  quarter: number;
  hsCode: string;
  sumOfUsd: number;
  tradeCount: number;
}

// 国家贸易统计筛选条件
export interface CountryTradeFilters {
  hsCode?: string[];
  hsCodePrefix?: string[];
  tradeDirection?: 'import' | 'export' | 'all';
  year?: number;
  month?: number;
  country?: string[];
  industry?: string;
  startYearMonth?: string; // YYYY-MM
  endYearMonth?: string; // YYYY-MM
  limit?: number;
}
