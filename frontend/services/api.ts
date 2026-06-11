import {
  Filters,
  HSCodeCategory,
  Shipment,
  CountryMonthlyTradeStat,
  CountryTradeStatSummary,
  CountryTradeTrend,
  TopCountry,
  CountryQuarterTop,
  CountryAggregate,
  CountryQuarterAggregate,
  HSAggregate,
  HSQuarterAggregate,
  CountryTradeFilters,
  CompanyDashboardData,
  CompanyFilterOptions,
  CompanySearchResult,
  InsightAgentPreviewRequest,
  InsightAgentPreviewResponse,
  InsightAgentStatus,
  Location,
} from '../types';
import { logger } from '../utils/logger';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

const readNumber = (...values: unknown[]) => {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  logger.debug('[API] Fetching', url);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[API] Error', response.status, response.statusText, errorText);
      throw new Error(`API error (${response.status}): ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      logger.error('[API] Network error', error);
      throw new Error(
        `无法连接到后端服务。请检查：\n1. 后端服务是否运行\n2. VITE_API_URL 环境变量是否正确设置\n当前 API URL: ${API_BASE_URL}`
      );
    }
    throw error;
  }
}

export const shipmentsAPI = {
  getFlows: async (
    filters?: Partial<Filters>,
    options?: { signal?: AbortSignal; limit?: number }
  ): Promise<Shipment[]> => {
    const params = new URLSearchParams();

    if (filters?.startDate) {
      if (filters.startDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        params.append('start_year_month', filters.startDate.substring(0, 7));
      } else if (filters.startDate.match(/^\d{4}-\d{2}$/)) {
        params.append('start_year_month', filters.startDate);
      }
    }
    if (filters?.endDate) {
      if (filters.endDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        params.append('end_year_month', filters.endDate.substring(0, 7));
      } else if (filters.endDate.match(/^\d{4}-\d{2}$/)) {
        params.append('end_year_month', filters.endDate);
      }
    }

    filters?.selectedCountries?.forEach(code => params.append('country', code));
    if (filters?.tradeDirection) params.append('trade_direction', filters.tradeDirection);
    filters?.selectedHSCodeCategories?.forEach(prefix => params.append('hs_code_prefix', prefix));
    params.append('limit', String(options?.limit ?? 20000));

    const data = await fetchAPI<any[]>(`/api/shipments/flows?${params.toString()}`, {
      signal: options?.signal,
    });
    return data.map((item: any) => {
      const totalValueUsd = readNumber(
        item.total_value_usd,
        item.totalValueUsd,
        item.sum_of_usd,
        item.sumOfUsd,
        item.total_trade_value,
        item.totalTradeValue
      );
      return {
        year: item.year,
        month: item.month,
        hsCode: item.hs_code,
        originCountryCode: item.origin_country_code,
        destinationCountryCode: item.destination_country_code,
        totalValueUsd,
        tradeCount: readNumber(item.trade_count, item.tradeCount),
        value: totalValueUsd / 1000000,
        countryOfOrigin: item.country_of_origin || item.origin_country_code,
        destinationCountry: item.destination_country || item.destination_country_code,
        date: item.date || undefined,
      };
    });
  },

  getAll: async (
    filters?: Partial<Filters>,
    options?: { signal?: AbortSignal; limit?: number }
  ): Promise<Shipment[]> => {
    const params = new URLSearchParams();
    
    // 日期筛选：转换为 YYYY-MM 格式
    if (filters?.startDate) {
      // 如果是 YYYY-MM-DD 格式，提取 YYYY-MM
      if (filters.startDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        params.append('start_year_month', filters.startDate.substring(0, 7));
      } else if (filters.startDate.match(/^\d{4}-\d{2}$/)) {
        params.append('start_year_month', filters.startDate);
      }
    }
    if (filters?.endDate) {
      // 如果是 YYYY-MM-DD 格式，提取 YYYY-MM
      if (filters.endDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        params.append('end_year_month', filters.endDate.substring(0, 7));
      } else if (filters.endDate.match(/^\d{4}-\d{2}$/)) {
        params.append('end_year_month', filters.endDate);
      }
    }
    
    // 国家筛选：使用国家代码（需要从国家名称转换为代码）
    if (filters?.selectedCountries?.length) {
      // 这里假设 selectedCountries 已经是国家代码，如果不是需要转换
      filters.selectedCountries.forEach(code => params.append('country', code));
    }

    if (filters?.tradeDirection) {
      params.append('trade_direction', filters.tradeDirection);
    }
    
    // HS Code 筛选：使用2位大类前缀
    if (filters?.selectedHSCodeCategories?.length) {
      filters.selectedHSCodeCategories.forEach(prefix => params.append('hs_code_prefix', prefix));
    }
    
    // 限制返回数量
    params.append('limit', String(options?.limit ?? 50000));

    const data = await fetchAPI<any[]>(`/api/shipments?${params.toString()}`, {
      signal: options?.signal,
    });
    return data.map((item: any) => {
      const totalValueUsd = readNumber(
        item.total_value_usd,
        item.totalValueUsd,
        item.sum_of_usd,
        item.sumOfUsd,
        item.total_trade_value,
        item.totalTradeValue
      );
      return {
        year: item.year,
        month: item.month,
        hsCode: item.hs_code,
        originCountryCode: item.origin_country_code,
        destinationCountryCode: item.destination_country_code,
        weight: item.weight,
        quantity: item.quantity,
        totalValueUsd,
        weightAvgPrice: item.weight_avg_price,
        quantityAvgPrice: item.quantity_avg_price,
        tradeCount: readNumber(item.trade_count, item.tradeCount),
        amountSharePct: readNumber(item.amount_share_pct, item.amountSharePct),
        // 向后兼容字段：旧地图组件的 value 单位是百万美元。
        value: totalValueUsd / 1000000,
        countryOfOrigin: item.country_of_origin || item.origin_country_code,
        destinationCountry: item.destination_country || item.destination_country_code,
        date: item.date || `${item.year}-${String(item.month).padStart(2, '0')}-01`,
      };
    });
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

// 国家位置API（直接使用后端 country-locations 端点，避免前端全量去重）
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
    
    logger.debug('[Chat] Sending request to:', url);
    
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
        logger.error('[Chat] API error:', response.status, errorText);
        onError(`HTTP error! status: ${response.status}`);
        return;
      }
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        logger.error('[Chat] Response body is not readable');
        onError('Response body is not readable');
        return;
      }
      
      let buffer = '';
      let hasReceivedContent = false;
      
      logger.debug('[Chat] Start reading stream');
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            logger.debug('[Chat] Stream done');
            // 处理剩余的 buffer
            if (buffer.trim()) {
              const lines = buffer.split('\n');
              for (const line of lines) {
                if (line.trim() && line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    if (data.error) {
                      logger.error('[Chat] Server error:', data.error);
                      onError(data.error);
                      return;
                    }
                    
                    if (data.done) {
                      if (!hasReceivedContent) {
                        logger.warn('[Chat] Stream completed without content');
                      }
                      onComplete();
                      return;
                    }
                    
                    if (data.content) {
                      hasReceivedContent = true;
                      onChunk(data.content);
                    }
                  } catch (e) {
                    logger.warn('[Chat] Failed to parse SSE data:', e, line);
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
                  logger.error('[Chat] Server error:', data.error);
                  onError(data.error);
                  return;
                }
                
                if (data.done) {
                  if (!hasReceivedContent) {
                    logger.warn('[Chat] Stream completed without content');
                  }
                  onComplete();
                  return;
                }
                
                if (data.content) {
                  hasReceivedContent = true;
                  onChunk(data.content);
                }
              } catch (e) {
                logger.warn('[Chat] Failed to parse SSE data:', e, line);
              }
            }
          }
        }
        
        // 如果流结束但没有收到 done 标记，也调用 onComplete
        logger.debug('[Chat] Stream ended. hasReceivedContent=', hasReceivedContent);
        if (!hasReceivedContent) {
          logger.warn('[Chat] Stream ended without content or done marker');
        }
        onComplete();
      } catch (error) {
        logger.error('[Chat] Error reading stream:', error);
        onError(error instanceof Error ? error.message : 'Unknown error while reading stream');
      }
    } catch (error) {
      logger.error('[Chat] Error in sendMessage:', error);
      onError(error instanceof Error ? error.message : 'Unknown error');
    }
  },
};

export const insightsAgentAPI = {
  getStatus: async (): Promise<InsightAgentStatus> => {
    const data = await fetchAPI<any>('/api/insights-agent/status');
    return {
      enabled: Boolean(data.enabled),
      name: data.name,
      supportedSources: data.supported_sources || [],
      message: data.message,
    };
  },

  preview: async (request: InsightAgentPreviewRequest = {}): Promise<InsightAgentPreviewResponse> => {
    const data = await fetchAPI<any>('/api/insights-agent/preview', {
      method: 'POST',
      body: JSON.stringify({
        brands: request.brands || [],
        start_year_month: request.startYearMonth,
        end_year_month: request.endYearMonth,
        include_news: request.includeNews ?? true,
        include_trade: request.includeTrade ?? true,
      }),
    });
    return {
      enabled: Boolean(data.enabled),
      message: data.message,
      requestedBrands: data.requested_brands || [],
    };
  },
};

// 国家贸易统计API
export const countryTradeStatsAPI = {
  getAll: async (filters?: CountryTradeFilters): Promise<CountryMonthlyTradeStat[]> => {
    const params = new URLSearchParams();
    if (filters?.hsCode?.length) {
      filters.hsCode.forEach(code => params.append('hs_code', code));
    }
    if (filters?.hsCodePrefix?.length) {
      filters.hsCodePrefix.forEach(prefix => params.append('hs_code_prefix', prefix));
    }
    if (filters?.year) {
      params.append('year', filters.year.toString());
    }
    if (filters?.month) {
      params.append('month', filters.month.toString());
    }
    if (filters?.country?.length) {
      filters.country.forEach(c => params.append('country', c));
    }
    if (filters?.tradeDirection) {
      params.append('trade_direction', filters.tradeDirection);
    }
    if (filters?.startYearMonth) {
      params.append('start_year_month', filters.startYearMonth);
    }
    if (filters?.endYearMonth) {
      params.append('end_year_month', filters.endYearMonth);
    }
    const limit = filters?.limit ?? 50000;
    params.append('limit', String(limit));

    const data = await fetchAPI<any[]>(`/api/country-trade-stats?${params.toString()}`);
    return data.map((item: any) => ({
      hsCode: item.hs_code,
      year: item.year,
      month: item.month,
      countryCode: item.country_code,
      weight: item.weight ? parseFloat(item.weight) : undefined,
      quantity: item.quantity ? parseFloat(item.quantity) : undefined,
      sumOfUsd: parseFloat(item.sum_of_usd) || 0,
      weightAvgPrice: item.weight_avg_price ? parseFloat(item.weight_avg_price) : undefined,
      quantityAvgPrice: item.quantity_avg_price ? parseFloat(item.quantity_avg_price) : undefined,
      tradeCount: parseInt(item.trade_count) || 0,
      amountSharePct: parseFloat(item.amount_share_pct) || 0,
    }));
  },

  getSummary: async (filters?: CountryTradeFilters): Promise<CountryTradeStatSummary> => {
    const params = new URLSearchParams();
    if (filters?.hsCode?.length) {
      filters.hsCode.forEach(code => params.append('hs_code', code));
    }
    if (filters?.year) {
      params.append('year', filters.year.toString());
    }
    if (filters?.month) {
      params.append('month', filters.month.toString());
    }
    if (filters?.country?.length) {
      filters.country.forEach(c => params.append('country', c));
    }
    if (filters?.tradeDirection) {
      params.append('trade_direction', filters.tradeDirection);
    }
    if (filters?.startYearMonth) {
      params.append('start_year_month', filters.startYearMonth);
    }
    if (filters?.endYearMonth) {
      params.append('end_year_month', filters.endYearMonth);
    }

    const data = await fetchAPI<any>(`/api/country-trade-stats/summary?${params.toString()}`);
    return {
      totalCountries: parseInt(data.total_countries) || 0,
      totalTradeValue: parseFloat(data.total_trade_value) || 0,
      totalWeight: data.total_weight ? parseFloat(data.total_weight) : undefined,
      totalQuantity: data.total_quantity ? parseFloat(data.total_quantity) : undefined,
      totalTradeCount: parseInt(data.total_trade_count) || 0,
      avgSharePct: parseFloat(data.avg_share_pct) || 0,
    };
  },

  getTrends: async (filters?: {
    hsCode?: string;
    country?: string;
    tradeDirection?: 'import' | 'export' | 'all';
    startYearMonth?: string;
    endYearMonth?: string;
  }): Promise<CountryTradeTrend[]> => {
    const params = new URLSearchParams();
    if (filters?.hsCode) {
      params.append('hs_code', filters.hsCode);
    }
    if (filters?.country) {
      params.append('country', filters.country);
    }
    if (filters?.tradeDirection) {
      params.append('trade_direction', filters.tradeDirection);
    }
    if (filters?.startYearMonth) {
      params.append('start_year_month', filters.startYearMonth);
    }
    if (filters?.endYearMonth) {
      params.append('end_year_month', filters.endYearMonth);
    }

    const data = await fetchAPI<any[]>(`/api/country-trade-stats/trends?${params.toString()}`);
    return data.map((item: any) => ({
      yearMonth: item.year_month,
      sumOfUsd: parseFloat(item.sum_of_usd) || 0,
      weight: item.weight ? parseFloat(item.weight) : undefined,
      quantity: item.quantity ? parseFloat(item.quantity) : undefined,
      tradeCount: parseInt(item.trade_count) || 0,
    }));
  },

  getTopCountries: async (
    filters?: {
      hsCode?: string[];
      year?: number;
      month?: number;
      country?: string[];
      tradeDirection?: 'import' | 'export' | 'all';
      metric?: 'trade_value' | 'trade_count';
      startYearMonth?: string;
      endYearMonth?: string;
      limit?: number;
    }
  ): Promise<TopCountry[]> => {
    const params = new URLSearchParams();
    if (filters?.hsCode?.length) {
      filters.hsCode.forEach(code => params.append('hs_code', code));
    }
    if (filters?.year) {
      params.append('year', filters.year.toString());
    }
    if (filters?.month) {
      params.append('month', filters.month.toString());
    }
    if (filters?.country?.length) {
      filters.country.forEach(c => params.append('country', c));
    }
    if (filters?.tradeDirection) {
      params.append('trade_direction', filters.tradeDirection);
    }
    if (filters?.metric) {
      params.append('metric', filters.metric);
    }
    if (filters?.startYearMonth) {
      params.append('start_year_month', filters.startYearMonth);
    }
    if (filters?.endYearMonth) {
      params.append('end_year_month', filters.endYearMonth);
    }
    params.append('limit', (filters?.limit || 10).toString());

    const data = await fetchAPI<any[]>(`/api/country-trade-stats/top-countries?${params.toString()}`);
    return data.map((item: any) => ({
      countryCode: item.country_code,
      sumOfUsd: parseFloat(item.sum_of_usd) || 0,
      weight: item.weight ? parseFloat(item.weight) : undefined,
      quantity: item.quantity ? parseFloat(item.quantity) : undefined,
      tradeCount: parseInt(item.trade_count) || 0,
      amountSharePct: parseFloat(item.amount_share_pct) || 0,
    }));
  },

  getAvailableHSCodes: async (): Promise<string[]> => {
    return fetchAPI<string[]>(`/api/country-trade-stats/hs-codes`);
  },

  getTopCountriesQuarterly: async (
    filters?: {
      hsCode?: string[];
      hsCodePrefix?: string[];
      country?: string[];
      tradeDirection?: 'import' | 'export' | 'all';
      metric?: 'trade_value' | 'trade_count';
      startYearMonth?: string;
      endYearMonth?: string;
      limit?: number;
    }
  ): Promise<CountryQuarterTop[]> => {
    const params = new URLSearchParams();
    if (filters?.hsCode?.length) {
      filters.hsCode.forEach((code) => params.append('hs_code', code));
    }
    if (filters?.hsCodePrefix?.length) {
      filters.hsCodePrefix.forEach((prefix) => params.append('hs_code_prefix', prefix));
    }
    if (filters?.country?.length) {
      filters.country.forEach((c) => params.append('country', c));
    }
    if (filters?.tradeDirection) {
      params.append('trade_direction', filters.tradeDirection);
    }
    if (filters?.metric) {
      params.append('metric', filters.metric);
    }
    if (filters?.startYearMonth) {
      params.append('start_year_month', filters.startYearMonth);
    }
    if (filters?.endYearMonth) {
      params.append('end_year_month', filters.endYearMonth);
    }
    params.append('limit', String(filters?.limit ?? 10));

    const data = await fetchAPI<any[]>(`/api/country-trade-stats/top-countries-quarterly?${params.toString()}`);
    return data.map((item: any) => ({
      year: item.year,
      quarter: item.quarter,
      countryCode: item.country_code,
      sumOfUsd: parseFloat(item.sum_of_usd) || 0,
      tradeCount: parseInt(item.trade_count) || 0,
    }));
  },

  getCountryAggregate: async (
    filters?: {
      hsCode?: string[];
      hsCodePrefix?: string[];
      country?: string[];
      tradeDirection?: 'import' | 'export' | 'all';
      startYearMonth?: string;
      endYearMonth?: string;
      limit?: number;
    }
  ): Promise<CountryAggregate[]> => {
    const params = new URLSearchParams();
    if (filters?.hsCode?.length) {
      filters.hsCode.forEach((code) => params.append('hs_code', code));
    }
    if (filters?.hsCodePrefix?.length) {
      filters.hsCodePrefix.forEach((prefix) => params.append('hs_code_prefix', prefix));
    }
    if (filters?.country?.length) {
      filters.country.forEach((c) => params.append('country', c));
    }
    if (filters?.tradeDirection) {
      params.append('trade_direction', filters.tradeDirection);
    }
    if (filters?.startYearMonth) {
      params.append('start_year_month', filters.startYearMonth);
    }
    if (filters?.endYearMonth) {
      params.append('end_year_month', filters.endYearMonth);
    }
    params.append('limit', String(filters?.limit ?? 300));
    const data = await fetchAPI<any[]>(`/api/country-trade-stats/country-aggregate?${params.toString()}`);
    return data.map((item: any) => ({
      countryCode: item.country_code,
      sumOfUsd: parseFloat(item.sum_of_usd) || 0,
      tradeCount: parseInt(item.trade_count) || 0,
    }));
  },

  getCountryQuarterly: async (
    filters?: {
      hsCode?: string[];
      hsCodePrefix?: string[];
      country?: string[];
      tradeDirection?: 'import' | 'export' | 'all';
      startYearMonth?: string;
      endYearMonth?: string;
      limit?: number;
    }
  ): Promise<CountryQuarterAggregate[]> => {
    const params = new URLSearchParams();
    if (filters?.hsCode?.length) {
      filters.hsCode.forEach((code) => params.append('hs_code', code));
    }
    if (filters?.hsCodePrefix?.length) {
      filters.hsCodePrefix.forEach((prefix) => params.append('hs_code_prefix', prefix));
    }
    if (filters?.country?.length) {
      filters.country.forEach((c) => params.append('country', c));
    }
    if (filters?.tradeDirection) {
      params.append('trade_direction', filters.tradeDirection);
    }
    if (filters?.startYearMonth) {
      params.append('start_year_month', filters.startYearMonth);
    }
    if (filters?.endYearMonth) {
      params.append('end_year_month', filters.endYearMonth);
    }
    params.append('limit', String(filters?.limit ?? 4000));
    const data = await fetchAPI<any[]>(`/api/country-trade-stats/country-quarterly?${params.toString()}`);
    return data.map((item: any) => ({
      year: item.year,
      quarter: item.quarter,
      countryCode: item.country_code,
      sumOfUsd: parseFloat(item.sum_of_usd) || 0,
      tradeCount: parseInt(item.trade_count) || 0,
    }));
  },

  getHSAggregate: async (
    filters?: {
      hsCode?: string[];
      hsCodePrefix?: string[];
      country?: string[];
      tradeDirection?: 'import' | 'export' | 'all';
      startYearMonth?: string;
      endYearMonth?: string;
      limit?: number;
    }
  ): Promise<HSAggregate[]> => {
    const params = new URLSearchParams();
    if (filters?.hsCode?.length) {
      filters.hsCode.forEach((code) => params.append('hs_code', code));
    }
    if (filters?.hsCodePrefix?.length) {
      filters.hsCodePrefix.forEach((prefix) => params.append('hs_code_prefix', prefix));
    }
    if (filters?.country?.length) {
      filters.country.forEach((c) => params.append('country', c));
    }
    if (filters?.tradeDirection) {
      params.append('trade_direction', filters.tradeDirection);
    }
    if (filters?.startYearMonth) {
      params.append('start_year_month', filters.startYearMonth);
    }
    if (filters?.endYearMonth) {
      params.append('end_year_month', filters.endYearMonth);
    }
    params.append('limit', String(filters?.limit ?? 200));
    const data = await fetchAPI<any[]>(`/api/country-trade-stats/hs-aggregate?${params.toString()}`);
    return data.map((item: any) => ({
      hsCode: item.hs_code,
      sumOfUsd: parseFloat(item.sum_of_usd) || 0,
      tradeCount: parseInt(item.trade_count) || 0,
    }));
  },

  getHSQuarterly: async (
    filters?: {
      hsCode?: string[];
      hsCodePrefix?: string[];
      country?: string[];
      tradeDirection?: 'import' | 'export' | 'all';
      startYearMonth?: string;
      endYearMonth?: string;
      limit?: number;
    }
  ): Promise<HSQuarterAggregate[]> => {
    const params = new URLSearchParams();
    if (filters?.hsCode?.length) {
      filters.hsCode.forEach((code) => params.append('hs_code', code));
    }
    if (filters?.hsCodePrefix?.length) {
      filters.hsCodePrefix.forEach((prefix) => params.append('hs_code_prefix', prefix));
    }
    if (filters?.country?.length) {
      filters.country.forEach((c) => params.append('country', c));
    }
    if (filters?.tradeDirection) {
      params.append('trade_direction', filters.tradeDirection);
    }
    if (filters?.startYearMonth) {
      params.append('start_year_month', filters.startYearMonth);
    }
    if (filters?.endYearMonth) {
      params.append('end_year_month', filters.endYearMonth);
    }
    params.append('limit', String(filters?.limit ?? 4000));
    const data = await fetchAPI<any[]>(`/api/country-trade-stats/hs-quarterly?${params.toString()}`);
    return data.map((item: any) => ({
      year: item.year,
      quarter: item.quarter,
      hsCode: item.hs_code,
      sumOfUsd: parseFloat(item.sum_of_usd) || 0,
      tradeCount: parseInt(item.trade_count) || 0,
    }));
  },
};

export const companiesAPI = {
  search: async (filters: {
    query?: string;
    brands?: string[];
    countries?: string[];
    hsCode?: string[];
    hsCodePrefix?: string[];
    role?: 'importer' | 'exporter' | 'both' | '';
    metric?: 'trade_value' | 'trade_count';
    limit?: number;
  }): Promise<CompanySearchResult[]> => {
    const params = new URLSearchParams();
    if (filters.query?.trim()) params.append('q', filters.query.trim());
    filters.brands?.forEach((brand) => params.append('brand', brand));
    filters.countries?.forEach((country) => params.append('country', country));
    filters.hsCode?.forEach((code) => params.append('hs_code', code));
    filters.hsCodePrefix?.forEach((prefix) => params.append('hs_code_prefix', prefix));
    if (filters.role) params.append('role', filters.role);
    if (filters.metric) params.append('metric', filters.metric);
    params.append('limit', String(filters.limit ?? 12));
    const data = await fetchAPI<any[]>(`/api/companies/search?${params.toString()}`);
    return data.map((item) => ({
      name: item.name,
      brandName: item.brand_name || undefined,
      countryCode: item.country_code || undefined,
      countryCount: parseInt(item.country_count) || 0,
      role: item.role || 'unknown',
      categoryLabels: Array.isArray(item.category_labels) ? item.category_labels.filter(Boolean) : [],
      totalTradeValue: parseFloat(item.total_trade_value) || 0,
      tradeCount: parseInt(item.trade_count) || 0,
    }));
  },

  getFilters: async (): Promise<CompanyFilterOptions> => {
    const data = await fetchAPI<any>('/api/companies/filters');
    return {
      brands: (data.brands || []).map((item: any) => ({
        brandName: item.brand_name,
        totalTradeValue: parseFloat(item.total_trade_value) || 0,
      })),
      countries: (data.countries || []).map((item: any) => ({
        countryCode: item.country_code,
        totalTradeValue: parseFloat(item.total_trade_value) || 0,
      })),
      hsCategories: (data.hs_categories || []).map((item: any) => ({
        hsPrefix: item.hs_prefix,
        totalTradeValue: parseFloat(item.total_trade_value) || 0,
        tradeCount: parseInt(item.trade_count) || 0,
      })),
    };
  },

  getDashboard: async (filters: {
    name: string;
    countryCode?: string;
    startYearMonth?: string;
    endYearMonth?: string;
    hsCode?: string[];
    hsCodePrefix?: string[];
    metric?: 'trade_value' | 'trade_count';
    limit?: number;
  }): Promise<CompanyDashboardData> => {
    const params = new URLSearchParams();
    params.append('name', filters.name);
    if (filters.countryCode) params.append('country_code', filters.countryCode);
    if (filters.startYearMonth) params.append('start_year_month', filters.startYearMonth);
    if (filters.endYearMonth) params.append('end_year_month', filters.endYearMonth);
    if (filters.hsCode?.length) filters.hsCode.forEach((code) => params.append('hs_code', code));
    if (filters.hsCodePrefix?.length) filters.hsCodePrefix.forEach((prefix) => params.append('hs_code_prefix', prefix));
    if (filters.metric) params.append('metric', filters.metric);
    params.append('limit', String(filters.limit ?? 10));

    const item = await fetchAPI<any>(`/api/companies/dashboard?${params.toString()}`);
    return {
      name: item.name,
      brandName: item.brand_name || undefined,
      countryCode: item.country_code || undefined,
      countryCount: parseInt(item.country_count) || 0,
      role: item.role || 'unknown',
      categoryLabels: Array.isArray(item.category_labels) ? item.category_labels.filter(Boolean) : [],
      totalTradeValue: parseFloat(item.total_trade_value) || 0,
      totalTradeCount: parseInt(item.total_trade_count) || 0,
      importTradeValue: parseFloat(item.import_trade_value) || 0,
      exportTradeValue: parseFloat(item.export_trade_value) || 0,
      categories: (item.categories || []).map((cat: any) => ({
        hsCode: cat.hs_code,
        label: cat.label,
        sumOfUsd: parseFloat(cat.sum_of_usd) || 0,
        tradeCount: parseInt(cat.trade_count) || 0,
        sharePct: parseFloat(cat.share_pct) || 0,
      })),
      topSuppliers: (item.top_suppliers || []).map((rank: any) => ({
        rank: parseInt(rank.rank) || 0,
        company: rank.company,
        brandName: rank.brand_name || undefined,
        countryCode: rank.country_code || undefined,
        sumOfUsd: parseFloat(rank.sum_of_usd) || 0,
        tradeCount: parseInt(rank.trade_count) || 0,
        sharePct: parseFloat(rank.share_pct) || 0,
      })),
      topCustomers: (item.top_customers || []).map((rank: any) => ({
        rank: parseInt(rank.rank) || 0,
        company: rank.company,
        brandName: rank.brand_name || undefined,
        countryCode: rank.country_code || undefined,
        sumOfUsd: parseFloat(rank.sum_of_usd) || 0,
        tradeCount: parseInt(rank.trade_count) || 0,
        sharePct: parseFloat(rank.share_pct) || 0,
      })),
      trends: (item.trends || []).map((point: any) => ({
        yearMonth: point.year_month,
        sumOfUsd: parseFloat(point.sum_of_usd) || 0,
        tradeCount: parseInt(point.trade_count) || 0,
      })),
    };
  },
};
