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
    'filters.filterControl': 'Filter Control',
    'filters.reset': 'Reset',
    'filters.dateRange': 'Date Range',
    'filters.start': 'Start',
    'filters.end': 'End',
    'filters.startDate': 'Start Date',
    'filters.endDate': 'End Date',
    'filters.countries': 'Countries',
    'filters.categories': 'Material Categories',
    'filters.companies': 'Companies',
    'filters.selectAll': 'Select All',
    'filters.allMaterialFlows': 'All Material Flows',
    'filters.selected': 'selected',
    'filters.clearAll': 'Clear All',
    'filters.loading': 'Loading...',
    'filters.noCompanies': 'No companies found',
    'filters.hsCodeSubcategories': 'HS Code Subcategories',
    'filters.selectCategoryFirst': 'Please select category first',
    'filters.noSubcategories': 'No subcategories found',
    
    // Stats Panel
    'stats.totalValue': 'Total Value',
    'stats.avgValue': 'Avg Value',
    'stats.topRoutes': 'Top Routes',
    'stats.categoryBreakdown': 'Category Breakdown',
    'stats.materialMix': 'Material Mix',
    'stats.transactionTrends': 'Transaction Trends',
    'stats.origin': 'Origin',
    'stats.destination': 'Destination',
    'stats.value': 'Value',
    'stats.count': 'Count',
    'stats.category': 'Category',
    'stats.transactionFlow': 'Transaction Flow',
    'stats.nodes': 'Nodes',
    'stats.categories': 'Categories',
    'stats.networkValue': 'Network Value',
    'stats.totalTransactions': 'Total Transactions',
    'stats.periods': 'periods',
    'stats.noData': 'No Data',
    'stats.allTransactions': 'All Transactions',
    'stats.transactions': 'transactions',
    'stats.logisticsRoute': 'Logistics Route',
    'stats.materialSpec': 'Material Spec',
    'stats.supplyStatus': 'Supply Status',
    'stats.transactionAmount': 'Transaction Amount',
    'stats.status.completed': 'Completed',
    'stats.status.inTransit': 'In Transit',
    'stats.status.pending': 'Pending',
    'stats.status.cancelled': 'Cancelled',
    'stats.noTransactionsFound': 'No transactions found',
    
    // Map
    'map.materialCategories': 'Material Categories',
    'map.materialName': 'Material Name',
    'map.direction': 'Direction',
    'map.transactionCount': 'Transaction Count',
    'map.totalValue': 'Total Value',
    'map.location': 'Location',
    'map.activeFilters': 'Filter Control',
    'map.unknownCompany': 'Unknown Company',
    'map.unknown': 'Unknown',
    'map.companiesAtLocation': 'companies at this location',
    'map.companyType.importer': 'Importer',
    'map.companyType.exporter': 'Exporter',
    'map.companyType.both': 'Importer/Exporter',
    
    // AI Assistant
    'ai.assistant': 'AI Assistant',
    'ai.supplyChainAnalysis': 'Supply Chain Intelligence',
    'ai.welcome': 'Hello! I am a supply chain intelligence assistant. I can help you analyze supply chain data. Feel free to ask me any questions!',
    'ai.placeholder': 'Enter your question...',
    'ai.clearChat': 'Clear Chat',
    'ai.close': 'Close',
    
    // Common
    'common.map': 'Trade Map',
    'common.stats': 'Trade Statistics',
    
    // Country Statistics
    'countryTrade.title': 'Country Statistics',
    'countryTrade.subtitle': 'Monthly trade statistics analysis by HS code and country',
    'countryTrade.hsCodeFilter': 'HS Code Filter',
    'countryTrade.selectAll': 'Select All',
    'countryTrade.clearAll': 'Clear All',
    'countryTrade.selected': 'selected',
    'countryTrade.timeRange': 'Time Range',
    'countryTrade.startMonth': 'Start Month',
    'countryTrade.endMonth': 'End Month',
    'countryTrade.tradeMap': 'Country Statistics Map',
    'countryTrade.totalTradeValue': 'Total Trade Value',
    'countryTrade.participatingCountries': 'Participating Countries',
    'countryTrade.transactionCount': 'Transaction Count',
    'countryTrade.avgMarketShare': 'Average Country Share (%)',
    'countryTrade.tradeTrends': 'Trade Trends',
    'countryTrade.marketShare': 'Market Share Distribution (Total in Selected Range)',
    'countryTrade.topCountries': 'Top 10 Countries by Trade Value (Total in Selected Range)',
    'countryTrade.tradeValue': 'Trade Value',
    'countryTrade.playByYear': 'Play by Year',
    'countryTrade.showTotal': 'Show Total',
    'countryTrade.playingYear': 'Playing year',
    'countryTrade.totalWithinSelection': 'Total within selected filter range',
    'countryTrade.low': 'Low',
    'countryTrade.high': 'High',
    'countryTrade.maxValue': 'Max Value',
    'countryTrade.loading': 'Loading...',
    'countryTrade.noData': 'No Data',
  },
  zh: {
    // App
    'app.title': '供应链智能分析',
    'app.loading': '加载中...',
    'app.loadDataError': '无法加载数据，请检查后端服务是否正常运行。错误:',
    'app.networkInsights': '网络洞察',
    'app.realTimeMetrics': '实时性能指标和物料分布分析。',
    
    // Sidebar Filters
    'filters.filterControl': '筛选控制',
    'filters.reset': '重置',
    'filters.dateRange': '日期范围',
    'filters.start': '起始',
    'filters.end': '结束',
    'filters.startDate': '起始日期',
    'filters.endDate': '结束日期',
    'filters.countries': '国家',
    'filters.categories': '物料品类',
    'filters.companies': '公司',
    'filters.selectAll': '全选',
    'filters.allMaterialFlows': '所有物料流',
    'filters.selected': '已选',
    'filters.clearAll': '清除全部',
    'filters.loading': '加载中...',
    'filters.noCompanies': '未找到公司',
    'filters.hsCodeSubcategories': 'HS Code 小类',
    'filters.selectCategoryFirst': '请先选择大类',
    'filters.noSubcategories': '未找到小类',
    
    // Stats Panel
    'stats.totalValue': '总价值',
    'stats.avgValue': '平均价值',
    'stats.topRoutes': '热门路线',
    'stats.categoryBreakdown': '品类分布',
    'stats.materialMix': '物料构成',
    'stats.transactionTrends': '交易趋势',
    'stats.origin': '起点',
    'stats.destination': '终点',
    'stats.value': '价值',
    'stats.count': '数量',
    'stats.category': '品类',
    'stats.transactionFlow': '交易流',
    'stats.nodes': '节点',
    'stats.categories': '品类',
    'stats.networkValue': '网络价值',
    'stats.totalTransactions': '交易总数',
    'stats.periods': '个周期',
    'stats.noData': '无数据',
    'stats.allTransactions': '所有交易',
    'stats.transactions': '笔交易',
    'stats.logisticsRoute': '物流路线',
    'stats.materialSpec': '物料规格',
    'stats.supplyStatus': '供应状态',
    'stats.transactionAmount': '交易额',
    'stats.status.completed': '已完成',
    'stats.status.inTransit': '运输中',
    'stats.status.pending': '待处理',
    'stats.status.cancelled': '已取消',
    'stats.noTransactionsFound': '未找到交易记录',
    
    // Map
    'map.materialCategories': '物料品类',
    'map.materialName': '物料名称',
    'map.direction': '交易向',
    'map.transactionCount': '交易数量',
    'map.totalValue': '总价值',
    'map.location': '位置',
    'map.activeFilters': '筛选控制',
    'map.unknownCompany': '未知公司',
    'map.unknown': '未知',
    'map.companiesAtLocation': 'companies at this location',
    'map.companiesAtLocationSuffix': '',
    'map.companyType.importer': '进口商',
    'map.companyType.exporter': '出口商',
    'map.companyType.both': '进出口商',
    
    // AI Assistant
    'ai.assistant': 'AI 助手',
    'ai.supplyChainAnalysis': '供应链智能分析',
    'ai.welcome': '你好！我是供应链智能助手，可以帮助你分析供应链数据。有什么问题可以问我！',
    'ai.placeholder': '输入你的问题...',
    'ai.clearChat': '清空聊天记录',
    'ai.close': '关闭',
    
    // Common
    'common.map': '贸易地图',
    'common.stats': '贸易统计',
    
    // Country Statistics
    'countryTrade.title': '国家统计',
    'countryTrade.subtitle': '按HS编码和国家的月度贸易统计分析',
    'countryTrade.hsCodeFilter': 'HS编码筛选',
    'countryTrade.selectAll': '全选',
    'countryTrade.clearAll': '取消全选',
    'countryTrade.selected': '已选择',
    'countryTrade.timeRange': '时间范围',
    'countryTrade.startMonth': '起始年月',
    'countryTrade.endMonth': '结束年月',
    'countryTrade.tradeMap': '国家统计地图',
    'countryTrade.totalTradeValue': '总贸易额',
    'countryTrade.participatingCountries': '参与国家',
    'countryTrade.transactionCount': '交易次数',
    'countryTrade.avgMarketShare': '平均国家份额(%)',
    'countryTrade.tradeTrends': '贸易趋势',
    'countryTrade.marketShare': '市场份额分布（筛选范围总和）',
    'countryTrade.topCountries': '按贸易额排名 Top 10 国家（筛选范围总和）',
    'countryTrade.tradeValue': '贸易额',
    'countryTrade.playByYear': '按年播放',
    'countryTrade.showTotal': '显示总和',
    'countryTrade.playingYear': '播放年份',
    'countryTrade.totalWithinSelection': '当前筛选范围总和',
    'countryTrade.low': '低',
    'countryTrade.high': '高',
    'countryTrade.maxValue': '最大值',
    'countryTrade.loading': '加载中...',
    'countryTrade.noData': '暂无数据',
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

