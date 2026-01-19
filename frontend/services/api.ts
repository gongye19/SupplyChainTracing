import { Category, Transaction, Company, CompanyWithLocation, Location, Filters } from '../types';

// 前端在浏览器中运行，所以使用localhost（通过Vite代理或直接连接）
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  console.log('Fetching:', url);
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('API Error:', response.status, response.statusText, errorText);
    throw new Error(`API error (${response.status}): ${response.statusText}`);
  }

  const data = await response.json();
  console.log('API Response:', endpoint, data);
  return data;
}

// 品类API
export const categoriesAPI = {
  getAll: async (activeOnly: boolean = true): Promise<Category[]> => {
    const data = await fetchAPI<Category[]>(`/api/categories?active_only=${activeOnly}`);
    return data;
  },
  getById: async (id: string): Promise<Category> => {
    return fetchAPI<Category>(`/api/categories/${id}`);
  },
};

// 交易API
export interface TransactionListResponse {
  transactions: Transaction[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface TransactionStats {
  totalTransactions: number;
  totalValue: number;
  activeCountries: number;
  activeCompanies: number;
  categoryBreakdown: Array<{
    categoryId: string;
    categoryName: string;
    count: number;
    totalValue: number;
  }>;
  topRoutes: Array<{
    originCountry: string;
    destinationCountry: string;
    transactionCount: number;
    totalValue: number;
  }>;
}

export const transactionsAPI = {
  getTransactions: async (
    filters?: Partial<Filters>,
    page: number = 1,
    limit: number = 1000,
    options?: { signal?: AbortSignal }
  ): Promise<TransactionListResponse> => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('start_date', filters.startDate);
    if (filters?.endDate) params.append('end_date', filters.endDate);
    if (filters?.selectedCountries?.length) {
      filters.selectedCountries.forEach(code => params.append('origin_country', code));
    }
    if (filters?.selectedCategories?.length) {
      filters.selectedCategories.forEach(id => params.append('category_id', id));
    }
    if (filters?.selectedCompanies?.length) {
      filters.selectedCompanies.forEach(id => params.append('company_id', id));
    }
    if (filters?.minValue !== undefined) params.append('min_value', filters.minValue.toString());
    if (filters?.maxValue !== undefined) params.append('max_value', filters.maxValue.toString());
    if (filters?.status?.length) params.append('status', filters.status.join(','));

    params.append('page', page.toString());
    params.append('limit', limit.toString());

    const response = await fetchAPI<any>(`/api/transactions?${params.toString()}`, {
      signal: options?.signal
    });
    
    // 转换字段名从下划线格式到驼峰格式
    const transactions = response.transactions.map((t: any) => ({
      id: t.id,
      exporterCompanyId: t.exporter_company_id,
      exporterCompanyName: t.exporter_company_name,
      exporterCountryCode: t.exporter_country_code,
      exporterCountryName: t.exporter_country_name,
      importerCompanyId: t.importer_company_id,
      importerCompanyName: t.importer_company_name,
      importerCountryCode: t.importer_country_code,
      importerCountryName: t.importer_country_name,
      material: t.material,
      categoryId: t.category_id,
      categoryName: t.category_name,
      categoryColor: t.category_color,
      quantity: t.quantity,
      unit: t.unit,
      price: t.price,
      totalValue: t.total_value,
      transactionDate: t.transaction_date,
      status: t.status,
      notes: t.notes
    }));

    return {
      transactions,
      pagination: response.pagination
    };
  },
  getStats: async (filters?: Partial<Filters>): Promise<TransactionStats> => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('start_date', filters.startDate);
    if (filters?.endDate) params.append('end_date', filters.endDate);
    if (filters?.selectedCountries?.length) {
      filters.selectedCountries.forEach(code => params.append('origin_country', code));
    }
    if (filters?.selectedCategories?.length) {
      filters.selectedCategories.forEach(id => params.append('category_id', id));
    }
    if (filters?.selectedCompanies?.length) {
      filters.selectedCompanies.forEach(id => params.append('company_id', id));
    }
    if (filters?.minValue !== undefined) params.append('min_value', filters.minValue.toString());
    if (filters?.maxValue !== undefined) params.append('max_value', filters.maxValue.toString());
    if (filters?.status?.length) params.append('status', filters.status.join(','));

    return fetchAPI<TransactionStats>(`/api/transactions/stats?${params.toString()}`);
  },
};

// 位置API
export const locationsAPI = {
  getAll: async (type?: 'country' | 'city', countryCode?: string): Promise<Location[]> => {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (countryCode) params.append('country_code', countryCode);
    
    const data = await fetchAPI<Location[]>(`/api/locations?${params.toString()}`);
    return data.map((item: any) => ({
      id: item.id,
      type: item.type,
      countryCode: item.country_code,
      countryName: item.country_name,
      city: item.city,
      latitude: parseFloat(item.latitude),
      longitude: parseFloat(item.longitude),
      region: item.region,
      continent: item.continent,
      address: item.address,
    }));
  },
  getCountries: async (): Promise<Location[]> => {
    const data = await fetchAPI<Location[]>(`/api/locations/countries`);
    return data.map((item: any) => ({
      id: item.id,
      type: item.type,
      countryCode: item.country_code,
      countryName: item.country_name,
      city: item.city,
      latitude: parseFloat(item.latitude),
      longitude: parseFloat(item.longitude),
      region: item.region,
      continent: item.continent,
      address: item.address,
    }));
  },
  getCities: async (countryCode?: string): Promise<Location[]> => {
    const params = new URLSearchParams();
    if (countryCode) params.append('country_code', countryCode);
    
    const data = await fetchAPI<Location[]>(`/api/locations/cities?${params.toString()}`);
    return data.map((item: any) => ({
      id: item.id,
      type: item.type,
      countryCode: item.country_code,
      countryName: item.country_name,
      city: item.city,
      latitude: parseFloat(item.latitude),
      longitude: parseFloat(item.longitude),
      region: item.region,
      continent: item.continent,
      address: item.address,
    }));
  },
  getById: async (id: string): Promise<Location> => {
    const data = await fetchAPI<any>(`/api/locations/${id}`);
    return {
      id: data.id,
      type: data.type,
      countryCode: data.country_code,
      countryName: data.country_name,
      city: data.city,
      latitude: parseFloat(data.latitude),
      longitude: parseFloat(data.longitude),
      region: data.region,
      continent: data.continent,
      address: data.address,
    };
  },
  getByCity: async (countryCode: string, city: string): Promise<Location> => {
    const data = await fetchAPI<any>(`/api/locations/country/${countryCode}/city/${city}`);
    return {
      id: data.id,
      type: data.type,
      countryCode: data.country_code,
      countryName: data.country_name,
      city: data.city,
      latitude: parseFloat(data.latitude),
      longitude: parseFloat(data.longitude),
      region: data.region,
      continent: data.continent,
      address: data.address,
    };
  },
};

// 公司API - 添加获取带位置的公司列表
export const companiesAPI = {
  getAll: async (countryCode?: string, city?: string, type?: string, search?: string): Promise<Company[]> => {
    const params = new URLSearchParams();
    if (countryCode) params.append('country_code', countryCode);
    if (city) params.append('city', city);
    if (type) params.append('type', type);
    if (search) params.append('search', search);
    
    return fetchAPI<Company[]>(`/api/companies?${params.toString()}`);
  },
  getById: async (id: string): Promise<Company> => {
    return fetchAPI<Company>(`/api/companies/${id}`);
  },
  getWithLocations: async (countryCode?: string, city?: string, type?: string): Promise<CompanyWithLocation[]> => {
    const params = new URLSearchParams();
    if (countryCode) params.append('country_code', countryCode);
    if (city) params.append('city', city);
    if (type) params.append('type', type);
    
    const data = await fetchAPI<any[]>(`/api/companies/with-locations?${params.toString()}`);
    // 转换字段名从下划线格式到驼峰格式
    return data.map((item: any) => ({
      id: item.id,
      name: item.name,
      countryCode: item.country_code,
      countryName: item.country_name,
      city: item.city,
      type: item.type,
      industry: item.industry,
      website: item.website,
      latitude: parseFloat(item.latitude),
      longitude: parseFloat(item.longitude),
      region: item.region,
      continent: item.continent
    }));
  },
  getLocation: async (id: string): Promise<CompanyWithLocation> => {
    return fetchAPI<CompanyWithLocation>(`/api/companies/${id}/location`);
  },
};

// 聊天API
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  message: string;
  history?: ChatMessage[];
}

export interface ChatResponse {
  response: string;
}

export const chatAPI = {
  sendMessage: async (message: string, history?: ChatMessage[]): Promise<string> => {
    const request: ChatRequest = {
      message,
      history: history || []
    };
    
    const response = await fetchAPI<ChatResponse>('/api/chat', {
      method: 'POST',
      body: JSON.stringify(request)
    });
    
    return response.response;
  },
};

