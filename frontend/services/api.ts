import {
  Filters,
  HSCodeCategory,
  Shipment,
  CountryMonthlyTradeStat,
  CountryTradeStatSummary,
  CountryTradeTrend,
  TopCountry,
  CountryTradeFilters,
  Location,
} from '../types';
import { logger } from '../utils/logger';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

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
    
    // HS Code 筛选：使用2位大类前缀
    if (filters?.selectedHSCodeCategories?.length) {
      filters.selectedHSCodeCategories.forEach(prefix => params.append('hs_code_prefix', prefix));
    }
    
    // 行业筛选（可选）
    // params.append('industry', 'SemiConductor');
    
    // 限制返回数量
    params.append('limit', String(options?.limit ?? 50000));

    const data = await fetchAPI<any[]>(`/api/shipments?${params.toString()}`, {
      signal: options?.signal,
    });
    return data.map((item: any) => ({
      year: item.year,
      month: item.month,
      hsCode: item.hs_code,
      industry: item.industry,
      originCountryCode: item.origin_country_code,
      destinationCountryCode: item.destination_country_code,
      weight: item.weight,
      quantity: item.quantity,
      totalValueUsd: item.total_value_usd,
      weightAvgPrice: item.weight_avg_price,
      quantityAvgPrice: item.quantity_avg_price,
      tradeCount: item.trade_count || 0,
      amountSharePct: item.amount_share_pct,
      // 向后兼容字段
      countryOfOrigin: item.country_of_origin || item.origin_country_code,
      destinationCountry: item.destination_country || item.destination_country_code,
      date: item.date || `${item.year}-${String(item.month).padStart(2, '0')}-01`,
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

// 国家贸易统计API
export const countryTradeStatsAPI = {
  getAll: async (filters?: CountryTradeFilters): Promise<CountryMonthlyTradeStat[]> => {
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
    if (filters?.industry) {
      params.append('industry', filters.industry);
    }
    if (filters?.startYearMonth) {
      params.append('start_year_month', filters.startYearMonth);
    }
    if (filters?.endYearMonth) {
      params.append('end_year_month', filters.endYearMonth);
    }
    params.append('limit', '10000');

    const data = await fetchAPI<any[]>(`/api/country-trade-stats?${params.toString()}`);
    return data.map((item: any) => ({
      hsCode: item.hs_code,
      year: item.year,
      month: item.month,
      countryCode: item.country_code,
      industry: item.industry,
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
    if (filters?.industry) {
      params.append('industry', filters.industry);
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
    industry?: string;
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
    if (filters?.industry) {
      params.append('industry', filters.industry);
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
      industry?: string;
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
    if (filters?.industry) {
      params.append('industry', filters.industry);
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
};

