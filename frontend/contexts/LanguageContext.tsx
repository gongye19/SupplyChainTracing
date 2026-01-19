import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Language = 'en' | 'zh';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// 翻译文本
const translations: Record<Language, Record<string, string>> = {
  en: {
    // App
    'app.title': 'Supply Chain Intelligence',
    'app.loading': 'Loading...',
    'app.loadDataError': 'Failed to load data. Please check if the backend service is running. Error:',
    'app.networkInsights': 'Network Insights',
    'app.realTimeMetrics': 'Real-time performance metrics and material distribution analysis.',
    
    // Sidebar Filters
    'filters.dateRange': 'Date Range',
    'filters.countries': 'Countries',
    'filters.categories': 'Material Categories',
    'filters.companies': 'Companies',
    'filters.selectAll': 'Select All',
    'filters.clearAll': 'Clear All',
    'filters.loading': 'Loading...',
    
    // Stats Panel
    'stats.totalTransactions': 'Total Transactions',
    'stats.totalValue': 'Total Value',
    'stats.avgValue': 'Avg Value',
    'stats.topRoutes': 'Top Routes',
    'stats.categoryBreakdown': 'Category Breakdown',
    'stats.materialMix': 'Material Mix',
    'stats.transactionTrends': 'Transaction Trends',
    'stats.noData': 'No category data',
    'stats.origin': 'Origin',
    'stats.destination': 'Destination',
    'stats.value': 'Value',
    'stats.count': 'Count',
    'stats.category': 'Category',
    
    // Map
    'map.materialCategories': 'Material Categories',
    'map.materialName': 'Material Name',
    'map.direction': 'Direction',
    'map.transactionCount': 'Transaction Count',
    'map.totalValue': 'Total Value',
    'map.location': 'Location',
    
    // AI Assistant
    'ai.assistant': 'AI Assistant',
    'ai.supplyChainAnalysis': 'Supply Chain Intelligence',
    'ai.welcome': 'Hello! I am a supply chain intelligence assistant. I can help you analyze supply chain data. Feel free to ask me any questions!',
    'ai.placeholder': 'Enter your question...',
    'ai.clearChat': 'Clear Chat',
    'ai.close': 'Close',
    
    // Common
    'common.map': 'Map',
    'common.stats': 'Statistics',
  },
  zh: {
    // App
    'app.title': '供应链智能分析',
    'app.loading': '加载中...',
    'app.loadDataError': '无法加载数据，请检查后端服务是否正常运行。错误:',
    'app.networkInsights': '网络洞察',
    'app.realTimeMetrics': '实时性能指标和物料分布分析。',
    
    // Sidebar Filters
    'filters.dateRange': '日期范围',
    'filters.countries': '国家',
    'filters.categories': '物料品类',
    'filters.companies': '公司',
    'filters.selectAll': '全选',
    'filters.clearAll': '清除全部',
    'filters.loading': '加载中...',
    
    // Stats Panel
    'stats.totalTransactions': '总交易数',
    'stats.totalValue': '总价值',
    'stats.avgValue': '平均价值',
    'stats.topRoutes': '热门路线',
    'stats.categoryBreakdown': '品类分布',
    'stats.materialMix': '物料构成',
    'stats.transactionTrends': '交易趋势',
    'stats.noData': '暂无品类数据',
    'stats.origin': '起点',
    'stats.destination': '终点',
    'stats.value': '价值',
    'stats.count': '数量',
    'stats.category': '品类',
    
    // Map
    'map.materialCategories': '物料品类',
    'map.materialName': '物料名称',
    'map.direction': '交易向',
    'map.transactionCount': '交易数量',
    'map.totalValue': '总价值',
    'map.location': '位置',
    
    // AI Assistant
    'ai.assistant': 'AI 助手',
    'ai.supplyChainAnalysis': '供应链智能分析',
    'ai.welcome': '你好！我是供应链智能助手，可以帮助你分析供应链数据。有什么问题可以问我！',
    'ai.placeholder': '输入你的问题...',
    'ai.clearChat': '清空聊天记录',
    'ai.close': '关闭',
    
    // Common
    'common.map': '地图',
    'common.stats': '统计',
  },
};

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en'); // 默认英文

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

