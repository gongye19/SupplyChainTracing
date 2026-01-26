import { Category, Transaction, Company, CompanyWithLocation, Location, Filters, MonthlyCompanyFlow, HSCodeCategory, Shipment } from '../types';

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
    const data = await fetchAPI<any[]>(`/api/categories?active_only=${activeOnly}`);
    // 转换字段名从下划线格式到驼峰格式
    return data.map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      displayName: cat.display_name || cat.displayName || cat.name,
      color: cat.color,
      icon: cat.icon,
      description: cat.description,
      sortOrder: cat.sort_order || cat.sortOrder || 0,
      isActive: cat.is_active !== undefined ? cat.is_active : (cat.isActive !== undefined ? cat.isActive : true)
    }));
  },
  getById: async (id: string): Promise<Category> => {
    const data = await fetchAPI<any>(`/api/categories/${id}`);
    // 转换字段名从下划线格式到驼峰格式
    return {
      id: data.id,
      name: data.name,
      displayName: data.display_name || data.displayName || data.name,
      color: data.color,
      icon: data.icon,
      description: data.description,
      sortOrder: data.sort_order || data.sortOrder || 0,
      isActive: data.is_active !== undefined ? data.is_active : (data.isActive !== undefined ? data.isActive : true)
    };
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

// 月度公司流量API（聚合表）
export const monthlyCompanyFlowsAPI = {
  getAll: async (filters?: Partial<Filters>): Promise<MonthlyCompanyFlow[]> => {
    const params = new URLSearchParams();
    if (filters?.startYearMonth) params.append('start_year_month', filters.startYearMonth);
    if (filters?.endYearMonth) params.append('end_year_month', filters.endYearMonth);
    if (filters?.selectedCountries?.length) {
      filters.selectedCountries.forEach(name => params.append('country', name));
    }
    if (filters?.selectedCompanies?.length) {
      filters.selectedCompanies.forEach(name => params.append('company', name));
    }
    if (filters?.selectedHSCodeCategories?.length) {
      // 使用 hs_code 参数（2位大类），而不是 category_id
      filters.selectedHSCodeCategories.forEach(hsCode => params.append('hs_code', hsCode));
    }

    const data = await fetchAPI<any[]>(`/api/monthly-company-flows?${params.toString()}`);
    return data.map((item: any) => ({
      yearMonth: item.year_month,
      exporterName: item.exporter_name,
      importerName: item.importer_name,
      originCountry: item.origin_country,
      destinationCountry: item.destination_country,
      hsCodes: item.hs_codes,
      transportMode: item.transport_mode,
      tradeTerm: item.trade_term,
      transactionCount: parseInt(item.transaction_count) || 0,
      totalValueUsd: parseFloat(item.total_value_usd) || 0,
      totalWeightKg: parseFloat(item.total_weight_kg) || 0,
      totalQuantity: parseFloat(item.total_quantity) || 0,
      firstTransactionDate: item.first_transaction_date,
      lastTransactionDate: item.last_transaction_date,
    }));
  },
};

// Shipments API（原始交易数据）
export const shipmentsAPI = {
  getAll: async (filters?: Partial<Filters>): Promise<Shipment[]> => {
    const params = new URLSearchParams();
    // 将 YYYY-MM 格式转换为日期范围
    if (filters?.startDate) {
      // 如果是 YYYY-MM 格式，转换为该月第一天
      if (filters.startDate.match(/^\d{4}-\d{2}$/)) {
        params.append('start_date', `${filters.startDate}-01`);
      } else {
        params.append('start_date', filters.startDate);
      }
    }
    if (filters?.endDate) {
      // 如果是 YYYY-MM 格式，转换为该月最后一天
      if (filters.endDate.match(/^\d{4}-\d{2}$/)) {
        const [year, month] = filters.endDate.split('-').map(Number);
        const lastDay = new Date(year, month, 0).getDate(); // 获取该月最后一天
        params.append('end_date', `${filters.endDate}-${String(lastDay).padStart(2, '0')}`);
      } else {
        params.append('end_date', filters.endDate);
      }
    }
    if (filters?.selectedCountries?.length) {
      filters.selectedCountries.forEach(name => params.append('country', name));
    }
    if (filters?.selectedCompanies?.length) {
      filters.selectedCompanies.forEach(name => params.append('company', name));
    }
    if (filters?.selectedHSCodeCategories?.length) {
      filters.selectedHSCodeCategories.forEach(prefix => params.append('hs_code_prefix', prefix));
    }
    if (filters?.selectedHSCodeSubcategories?.length) {
      filters.selectedHSCodeSubcategories.forEach(suffix => params.append('hs_code_suffix', suffix));
    }
    // 限制返回数量
    params.append('limit', '50000');

    const data = await fetchAPI<any[]>(`/api/shipments?${params.toString()}`);
    return data.map((item: any) => ({
      date: item.date,
      importerName: item.importer_name,
      exporterName: item.exporter_name,
      hsCode: item.hs_code,
      productEnglish: item.product_english,
      productDescription: item.product_description,
      weightKg: item.weight_kg,
      quantity: item.quantity,
      quantityUnit: item.quantity_unit,
      totalValueUsd: item.total_value_usd,
      unitPricePerKg: item.unit_price_per_kg,
      unitPricePerItem: item.unit_price_per_item,
      countryOfOrigin: item.country_of_origin,
      destinationCountry: item.destination_country,
      portOfDeparture: item.port_of_departure,
      portOfArrival: item.port_of_arrival,
      importExport: item.import_export,
      transportMode: item.transport_mode,
      tradeTerm: item.trade_term,
    }));
  },
};

// HS Code 品类API
export const hsCodeCategoriesAPI = {
  getAll: async (): Promise<HSCodeCategory[]> => {
    const data = await fetchAPI<any[]>(`/api/hs-code-categories`);
    return data.map((item: any) => ({
      hsCode: item.hs_code,
      chapterName: item.chapter_name,
    }));
  },
};

// 国家位置API（使用 country_locations 表）
export const countryLocationsAPI = {
  getAll: async (): Promise<Location[]> => {
    const data = await fetchAPI<any[]>(`/api/country-locations`);
    return data.map((item: any) => ({
      id: item.country_code,
      type: 'country' as const,
      countryCode: item.country_code,
      countryName: item.country_name,
      latitude: parseFloat(item.latitude),
      longitude: parseFloat(item.longitude),
      region: item.region,
      continent: item.continent,
    }));
  },
};

export const transactionsAPI = {
  getTransactions: async (
    filters?: Partial<Filters>,
    page: number = 1,
    limit: number = 1000,
    options?: { signal?: AbortSignal }
  ): Promise<TransactionListResponse> => {
    const params = new URLSearchParams();
    if (filters?.startYearMonth) params.append('start_year_month', filters.startYearMonth);
    if (filters?.endYearMonth) params.append('end_year_month', filters.endYearMonth);
    if (filters?.selectedCountries?.length) {
      filters.selectedCountries.forEach(name => params.append('country', name));
    }
    if (filters?.selectedHSCodeCategories?.length) {
      // 使用 hs_code 参数（2位大类），而不是 category_id
      filters.selectedHSCodeCategories.forEach(hsCode => params.append('hs_code', hsCode));
    }
    if (filters?.selectedCompanies?.length) {
      filters.selectedCompanies.forEach(name => params.append('company', name));
    }

    params.append('page', page.toString());
    params.append('limit', limit.toString());

    const response = await fetchAPI<any>(`/api/monthly-company-flows?${params.toString()}`, {
      signal: options?.signal
    });
    
    // 将聚合数据转换为 Transaction 格式（用于兼容）
    const transactions: Transaction[] = (response as MonthlyCompanyFlow[]).flatMap((flow: MonthlyCompanyFlow) => {
      // 这里可以根据需要展开聚合数据，或者直接返回聚合数据
      return [{
        id: `${flow.yearMonth}-${flow.exporterName}-${flow.importerName}`,
        exporterCompanyName: flow.exporterName,
        exporterCountryCode: flow.originCountry,
        exporterCountryName: flow.originCountry,
        importerCompanyName: flow.importerName,
        importerCountryCode: flow.destinationCountry,
        importerCountryName: flow.destinationCountry,
        material: flow.hsCodes,
        categoryId: '', // 需要从 HS Code 映射
        categoryName: '',
        categoryColor: '',
        quantity: flow.totalQuantity,
        totalValue: flow.totalValueUsd,
        transactionDate: flow.firstTransactionDate,
        status: 'completed' as const,
      }];
    });

    return {
      transactions,
      pagination: {
        total: transactions.length,
        page: 1,
        limit: transactions.length,
        totalPages: 1,
      }
    };
  },
  getStats: async (filters?: Partial<Filters>): Promise<TransactionStats> => {
    // 简化版统计，基于聚合表
    const flows = await monthlyCompanyFlowsAPI.getAll(filters);
    const totalValue = flows.reduce((sum, f) => sum + f.totalValueUsd, 0);
    const totalTransactions = flows.reduce((sum, f) => sum + f.transactionCount, 0);
    const countries = new Set<string>();
    flows.forEach(f => {
      countries.add(f.originCountry);
      countries.add(f.destinationCountry);
    });
    
    return {
      totalTransactions,
      totalValue,
      activeCountries: countries.size,
      activeCompanies: 0,
      categoryBreakdown: [],
      topRoutes: [],
    };
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
  sendMessage: async (
    message: string,
    history: ChatMessage[],
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: string) => void
  ): Promise<void> => {
    const request: ChatRequest = {
      message,
      history: history || []
    };
    
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';
    const url = `${API_BASE_URL}/api/chat`;
    
    console.log('Sending chat request to:', url);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Chat API error:', response.status, errorText);
        onError(`HTTP error! status: ${response.status}`);
        return;
      }
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        console.error('Response body is not readable');
        onError('Response body is not readable');
        return;
      }
      
      let buffer = '';
      let hasReceivedContent = false;
      
      console.log('Starting to read stream...');
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('Stream done, buffer:', buffer.substring(0, 100));
            // 处理剩余的 buffer
            if (buffer.trim()) {
              const lines = buffer.split('\n');
              for (const line of lines) {
                if (line.trim() && line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    console.log('Parsed final data:', data);
                    
                    if (data.error) {
                      console.error('Server error:', data.error);
                      onError(data.error);
                      return;
                    }
                    
                    if (data.done) {
                      console.log('Received done marker');
                      if (!hasReceivedContent) {
                        console.warn('Stream completed without content');
                      }
                      onComplete();
                      return;
                    }
                    
                    if (data.content) {
                      hasReceivedContent = true;
                      console.log('Received content chunk:', data.content.substring(0, 50));
                      onChunk(data.content);
                    }
                  } catch (e) {
                    console.error('Failed to parse SSE data:', e, line);
                  }
                }
              }
            }
            break;
          }
          
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 保留最后一个不完整的行
          
          for (const line of lines) {
            if (line.trim() && line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.error) {
                  console.error('Server error:', data.error);
                  onError(data.error);
                  return;
                }
                
                if (data.done) {
                  console.log('Received done marker');
                  if (!hasReceivedContent) {
                    console.warn('Stream completed without content');
                  }
                  onComplete();
                  return;
                }
                
                if (data.content) {
                  hasReceivedContent = true;
                  onChunk(data.content);
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e, line);
              }
            }
          }
        }
        
        // 如果流结束但没有收到 done 标记，也调用 onComplete
        console.log('Stream ended, hasReceivedContent:', hasReceivedContent);
        if (!hasReceivedContent) {
          console.warn('Stream ended without content or done marker');
        }
        onComplete();
      } catch (error) {
        console.error('Error reading stream:', error);
        onError(error instanceof Error ? error.message : 'Unknown error while reading stream');
      }
    } catch (error) {
      console.error('Error in sendMessage:', error);
      onError(error instanceof Error ? error.message : 'Unknown error');
    }
  },
};

