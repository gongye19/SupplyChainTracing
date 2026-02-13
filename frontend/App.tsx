
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import SupplyMap from './components/SupplyMap';
import StatsPanel from './components/StatsPanel';
import SidebarFilters from './components/SidebarFilters';
import CountryTradeSidebar from './components/CountryTradeSidebar';
import AIAssistant from './components/AIAssistant';
import CountryTradeMap from './components/CountryTradeMap';
import CountryTradeStatsPanel from './components/CountryTradeStatsPanel';
import { Transaction, Filters, HSCodeCategory, CountryLocation, Location, Shipment, CountryMonthlyTradeStat, CountryTradeStatSummary, CountryTradeTrend, TopCountry, CountryTradeFilters } from './types';
import { shipmentsAPI, hsCodeCategoriesAPI, countryLocationsAPI, chatAPI, ChatMessage, countryTradeStatsAPI } from './services/api';
import { Globe, BarChart3, Map as MapIcon, Package, TrendingUp, Users, ChevronRight } from 'lucide-react';
import { useLanguage } from './contexts/LanguageContext';
import { getHSCodeColorCached } from './utils/hsCodeColors';
import { getCountriesFromCodes } from './utils/countryCoordinates';
import { logger } from './utils/logger';

const App: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  const [activeView, setActiveView] = useState<'map' | 'stats' | 'country-trade'>('country-trade');
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const startDate = '2021-01';
  const endDate = `${currentYear}-${currentMonth}`; // YYYY-MM

  const defaultFilters: Filters = {
    startDate,
    endDate,
    selectedCountries: [],
    selectedHSCodeCategories: [],
    selectedHSCodeSubcategories: [],
    selectedCompanies: []
  };
  const defaultMapFilters: Filters = {
    ...defaultFilters,
    selectedCountries: ['CHN'],
  };
  const [mapFilters, setMapFilters] = useState<Filters>(defaultMapFilters);
  const [statsFilters, setStatsFilters] = useState<Filters>(defaultFilters);

  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [hsCodeCategories, setHsCodeCategories] = useState<HSCodeCategory[]>([]);
  const [countries, setCountries] = useState<CountryLocation[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false); // 是否正在交互(拖动/快速点击)
  const [stats, setStats] = useState({
    transactions: 0,
    suppliers: 0,
    categories: 0
  });

  // 国家贸易统计相关状态
  const [countryTradeStats, setCountryTradeStats] = useState<CountryMonthlyTradeStat[]>([]);
  const [countryTradeSummary, setCountryTradeSummary] = useState<CountryTradeStatSummary | null>(null);
  const [countryTradeTrends, setCountryTradeTrends] = useState<CountryTradeTrend[]>([]);
  const [topCountries, setTopCountries] = useState<TopCountry[]>([]);
  const [countryTradeFilters, setCountryTradeFilters] = useState<CountryTradeFilters>({
    hsCode: [],
    industry: 'SemiConductor',
    startYearMonth: '2021-01',
    endYearMonth: endDate,
  });
  const [countryTradeLoading, setCountryTradeLoading] = useState(false);
  const [availableHSCodes, setAvailableHSCodes] = useState<string[]>([]);
  const [countryMapYearPlaying, setCountryMapYearPlaying] = useState(false);
  const [countryMapYearIndex, setCountryMapYearIndex] = useState(0);
  
  // Refs for preview/final scheduling
  const filtersRef = useRef(mapFilters);
  useEffect(() => { filtersRef.current = mapFilters; }, [mapFilters]);
  const abortRef = useRef<AbortController | null>(null);
  const finalTimerRef = useRef<number | null>(null);
  const countryTradeTimerRef = useRef<number | null>(null);
  const countryTradeCacheRef = useRef<
    Map<
      string,
      {
        statsData: CountryMonthlyTradeStat[];
        summaryData: CountryTradeStatSummary;
        trendsData: CountryTradeTrend[];
        topCountriesData: TopCountry[];
      }
    >
  >(new Map());
  const lastCountryTradeKeyRef = useRef<string>('');
  const shipmentsCacheRef = useRef<Map<string, Shipment[]>>(new Map());
  const lastRequestedKeyRef = useRef<string>('');
  // 标记是否正在拖动（用于时间滑块）
  const isDraggingRef = useRef<boolean>(false);

  const buildShipmentsCacheKey = useCallback((filtersToUse: Filters) => {
    const sortedCountries = [...(filtersToUse.selectedCountries || [])].sort().join(',');
    const sortedCategories = [...(filtersToUse.selectedHSCodeCategories || [])].sort().join(',');
    return [
      filtersToUse.startDate || '',
      filtersToUse.endDate || '',
      sortedCountries,
      sortedCategories,
    ].join('|');
  }, []);

  // 加载初始数据
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setInitialLoading(true);
        const [hsCodeCatsData, locationsData] = await Promise.all([
          hsCodeCategoriesAPI.getAll(),
          countryLocationsAPI.getAll(),
        ]);
        let allShipmentsData: Shipment[] = [];

        // 仅在分类或国家坐标接口为空时，才回退读取 shipments；
        // 且初始化时只加载 Trade Map 默认国家（CHN/USA），避免全量预加载。
        if (hsCodeCatsData.length === 0 || locationsData.length === 0) {
          allShipmentsData = await shipmentsAPI.getAll({
            startDate,
            endDate,
            selectedCountries: defaultMapFilters.selectedCountries,
          });
        }
        logger.debug('[Init] HS categories:', hsCodeCatsData.length, 'countries:', locationsData.length, 'shipments:', allShipmentsData.length);
        
        // 处理 HS Code Categories
        let finalHsCodeCats = hsCodeCatsData;
        if (finalHsCodeCats.length === 0 && allShipmentsData.length > 0) {
          // 从 shipments 数据中提取 HS Code 分类
          const hsCodeSet = new Set<string>();
          allShipmentsData.forEach(s => {
            if (s.hsCode && s.hsCode.length >= 2) {
              hsCodeSet.add(s.hsCode.slice(0, 2));
            }
          });
          finalHsCodeCats = Array.from(hsCodeSet).sort().map(code => ({
            hsCode: code,
            chapterName: `Chapter ${code}` // 默认名称，可以后续改进
          }));
          logger.debug('[Init] Generated HS categories from shipments:', finalHsCodeCats.length);
        }
        setHsCodeCategories(finalHsCodeCats);
        
        // 处理 Countries
        let finalCountries: CountryLocation[] = [];
        if (locationsData.length > 0) {
          // 使用 API 返回的数据
          finalCountries = locationsData.map(loc => ({
            countryCode: loc.countryCode,
            countryName: loc.countryName,
            capitalLat: loc.latitude,
            capitalLng: loc.longitude,
            region: loc.region,
            continent: loc.continent
          }));
        } else if (allShipmentsData.length > 0) {
          // 从 shipments 数据中提取国家代码
          const countryCodeSet = new Set<string>();
          allShipmentsData.forEach(s => {
            if (s.originCountryCode) countryCodeSet.add(s.originCountryCode);
            if (s.destinationCountryCode) countryCodeSet.add(s.destinationCountryCode);
          });
          
          // 使用国家坐标映射表生成 countries
          const countryCoords = getCountriesFromCodes(Array.from(countryCodeSet));
          finalCountries = countryCoords.map(coord => ({
            countryCode: coord.countryCode,
            countryName: coord.countryName,
            capitalLat: coord.capitalLat,
            capitalLng: coord.capitalLng,
            region: coord.region,
            continent: coord.continent
          }));
          logger.debug('[Init] Generated countries from shipments:', finalCountries.length);
        }
        setCountries(finalCountries);
        
        // 注意：聚合数据不包含公司信息，所以公司列表为空
        setCompanies([]);
        logger.debug('[Init] Company dimension disabled for aggregated dataset');
      } catch (error) {
        logger.error('Failed to load initial data:', error);
        alert(t('app.loadDataError') + (error as Error).message);
      } finally {
        setInitialLoading(false);
      }
    };
    loadInitialData();
  }, []);

  useEffect(() => {
    const loadAvailableHSCodes = async () => {
      try {
        const codes = await countryTradeStatsAPI.getAvailableHSCodes();
        setAvailableHSCodes(codes);
      } catch (error) {
        logger.warn('[HS Codes] fallback to local defaults:', error);
        setAvailableHSCodes([]);
      }
    };

    loadAvailableHSCodes();
  }, []);

  // 加载国家贸易统计数据
  useEffect(() => {
    if (activeView !== 'country-trade') return;

    const buildCountryTradeKey = () => {
      const hsCodes = [...(countryTradeFilters.hsCode || [])].sort().join(',');
      const countriesFilter = [...(countryTradeFilters.country || [])].sort().join(',');
      return [
        hsCodes,
        countriesFilter,
        countryTradeFilters.industry || '',
        countryTradeFilters.year || '',
        countryTradeFilters.month || '',
        countryTradeFilters.startYearMonth || '',
        countryTradeFilters.endYearMonth || '',
      ].join('|');
    };

    const loadCountryTradeData = async () => {
      try {
        const requestKey = buildCountryTradeKey();
        if (lastCountryTradeKeyRef.current === requestKey) {
          return;
        }
        lastCountryTradeKeyRef.current = requestKey;

        const cached = countryTradeCacheRef.current.get(requestKey);
        if (cached) {
          setCountryTradeStats(cached.statsData);
          setCountryTradeSummary(cached.summaryData);
          setCountryTradeTrends(cached.trendsData);
          setTopCountries(cached.topCountriesData);
          return;
        }

        setCountryTradeLoading(true);
        
        const [statsData, summaryData, trendsData, topCountriesData] = await Promise.all([
          countryTradeStatsAPI.getAll(countryTradeFilters),
          countryTradeStatsAPI.getSummary(countryTradeFilters),
          countryTradeStatsAPI.getTrends({
            hsCode: countryTradeFilters.hsCode?.[0],
            industry: countryTradeFilters.industry,
            startYearMonth: countryTradeFilters.startYearMonth,
            endYearMonth: countryTradeFilters.endYearMonth,
          }),
          countryTradeStatsAPI.getTopCountries({
            hsCode: countryTradeFilters.hsCode,
            country: countryTradeFilters.country,
            industry: countryTradeFilters.industry,
            startYearMonth: countryTradeFilters.startYearMonth,
            endYearMonth: countryTradeFilters.endYearMonth,
            limit: 10,
          }),
        ]);
        logger.debug('[Country Trade] loaded', {
          stats: statsData.length,
          summary: summaryData,
          trends: trendsData.length,
          topCountries: topCountriesData.length,
        });

        countryTradeCacheRef.current.set(requestKey, {
          statsData,
          summaryData,
          trendsData,
          topCountriesData,
        });
        
        setCountryTradeStats(statsData);
        setCountryTradeSummary(summaryData);
        setCountryTradeTrends(trendsData);
        setTopCountries(topCountriesData);
      } catch (error) {
        logger.error('Failed to load country trade data:', error);
        // 显示错误信息给用户
        alert(`加载国家贸易数据失败: ${error instanceof Error ? error.message : String(error)}\n\n请检查：\n1. 数据库是否已导入数据\n2. 后端服务是否正常运行\n3. 网络连接是否正常`);
      } finally {
        setCountryTradeLoading(false);
      }
    };

    // 确保 countries 数据已加载
    if (countries.length === 0) {
      logger.warn('Countries data not loaded yet, waiting...');
      return;
    }

    if (countryTradeTimerRef.current) window.clearTimeout(countryTradeTimerRef.current);
    countryTradeTimerRef.current = window.setTimeout(() => {
    loadCountryTradeData();
    }, 120);
    return () => {
      if (countryTradeTimerRef.current) window.clearTimeout(countryTradeTimerRef.current);
    };
  }, [activeView, countryTradeFilters, countries.length]);

  // 国家名称到国家代码的映射函数
  const getCountryCode = useCallback((countryName: string): string => {
    if (!countryName) return '';

    // 从 countries 列表中查找匹配的国家
    const country = countries.find(c => 
      c.countryName.toLowerCase() === countryName.toLowerCase() ||
      c.countryName === countryName
    );

    // 统一使用国家代码，不回退到国家名称
    return country?.countryCode || '';
  }, [countries]);

  // 加载原始交易数据
  const loadShipments = useCallback(async (filtersToUse: Filters, mode: 'preview' | 'final') => {
    const requestKey = buildShipmentsCacheKey(filtersToUse);

    if (lastRequestedKeyRef.current === `${mode}:${requestKey}`) {
      return;
    }
    lastRequestedKeyRef.current = `${mode}:${requestKey}`;

    const cached = shipmentsCacheRef.current.get(requestKey);
    if (cached) {
      setShipments(cached);
      if (mode === 'final') {
        const uniqueCountries = new Set<string>();
        cached.forEach(s => {
          uniqueCountries.add(s.countryOfOrigin);
          uniqueCountries.add(s.destinationCountry);
        });
        const countryPairs = new Set<string>();
        cached.forEach(s => {
          const originCode = s.originCountryCode || getCountryCode(s.countryOfOrigin || '');
          const destCode = s.destinationCountryCode || getCountryCode(s.destinationCountry || '');
          if (originCode && destCode) countryPairs.add(`${originCode}-${destCode}`);
        });
        const uniqueCategories = new Set<string>();
        cached.forEach(s => {
          if (s.hsCode && s.hsCode.length >= 2) uniqueCategories.add(s.hsCode.slice(0, 2));
        });
        setStats({
          transactions: countryPairs.size,
          suppliers: uniqueCountries.size,
          categories: uniqueCategories.size,
        });
      }
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let loadingTimer: number | null = null;
      if (mode === 'final') {
        loadingTimer = window.setTimeout(() => {
          if (!controller.signal.aborted) {
            setFilterLoading(true);
          }
        }, 100);
      }

      logger.debug(`[Shipments] Loading (${mode})`, filtersToUse);
      const startTime = performance.now();
      const data = await shipmentsAPI.getAll(filtersToUse, {
        signal: controller.signal,
        limit: mode === 'preview' ? 15000 : 50000,
      });
      const duration = performance.now() - startTime;

      if (controller.signal.aborted) {
        if (loadingTimer) window.clearTimeout(loadingTimer);
        return;
      }

      if (loadingTimer && duration < 100) {
        window.clearTimeout(loadingTimer);
      }

      logger.debug(`[Shipments] Loaded (${mode}) in ${duration.toFixed(0)}ms:`, data.length);
      shipmentsCacheRef.current.set(requestKey, data);
      setShipments(data);
      
      // 注意：不再从筛选结果中更新公司列表
      // 公司列表在初始加载时已经设置，保持不变
      // 这样筛选后公司列表不会减少
      
      // 更新统计
      if (mode === 'final') {
        const uniqueCountries = new Set<string>();
        data.forEach(s => {
          uniqueCountries.add(s.countryOfOrigin);
          uniqueCountries.add(s.destinationCountry);
        });
        
        // 按国家对聚合，计算唯一国家对数量（用于 Transaction Flow）
        const countryPairs = new Set<string>();
        data.forEach(s => {
          // 使用国家代码作为键（顺序固定：原产国-目的地国家）
          const originCode = s.originCountryCode || getCountryCode(s.countryOfOrigin || '');
          const destCode = s.destinationCountryCode || getCountryCode(s.destinationCountry || '');
          if (originCode && destCode) {
            const pair = `${originCode}-${destCode}`;
            countryPairs.add(pair);
          }
        });
        
        // 计算唯一品类数量（HS Code 前2位）
        const uniqueCategories = new Set<string>();
        data.forEach(s => {
          if (s.hsCode && s.hsCode.length >= 2) {
            uniqueCategories.add(s.hsCode.slice(0, 2));
          }
        });
        
        setStats({
          transactions: countryPairs.size, // 显示国家对数量（应该画的线数）
          suppliers: uniqueCountries.size, // 国家数量（Nodes）
          categories: uniqueCategories.size // HS Code 大类数量（Categories）
        });
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      logger.error('Failed to load shipments:', e);
      if (mode === 'final') {
        alert('无法加载数据。错误: ' + (e as Error).message);
      }
    } finally {
      if (mode === 'final' && !controller.signal.aborted) {
        setFilterLoading(false);
      }
    }
  }, [buildShipmentsCacheKey, getCountryCode]);

  // 调度器：map filters 变化 => 立刻 preview + 延迟 final
  const scheduleFetch = useCallback((nextFilters: Filters, reason: 'drag' | 'click') => {
    setIsInteracting(true);
    loadShipments(nextFilters, 'preview');
    if (finalTimerRef.current) window.clearTimeout(finalTimerRef.current);
    finalTimerRef.current = window.setTimeout(() => {
      setIsInteracting(false);
      loadShipments(filtersRef.current, 'final');
    }, reason === 'drag' ? 180 : 120);
  }, [loadShipments]);

  // 暴露拖动状态控制函数给子组件
  const setDragging = useCallback((dragging: boolean) => {
    isDraggingRef.current = dragging;
    setIsInteracting(dragging); // 拖动时 SupplyMap 进入 preview mode
  }, []);

  // 统一监听 map filters 变化：触发 scheduleFetch（仅在 Trade Map 视图）
  useEffect(() => {
    if (activeView !== 'map') {
      return;
    }
    if (hsCodeCategories.length === 0 || countries.length === 0) {
      return;
    }
    
    const reason: 'drag' | 'click' = isDraggingRef.current ? 'drag' : 'click';
    scheduleFetch(mapFilters, reason);

    return () => {
      if (finalTimerRef.current) window.clearTimeout(finalTimerRef.current);
    };
  }, [activeView, mapFilters, hsCodeCategories.length, countries.length, scheduleFetch]);

  // 将聚合统计数据按国家对聚合，转换为地图组件格式
  // 每个国家对（原产国 → 目的地国家）合并成一条线
  const shipmentsForMap = useMemo(() => {
    // 按国家对聚合所有交易
    const countryPairGroups = new Map<string, {
      originCountryCode: string;
      destinationCountryCode: string;
      shipments: Shipment[];
      totalValue: number;
      totalQuantity: number;
      totalWeight: number;
      totalTradeCount: number;
      hsCodes: Set<string>;
    }>();
    
    shipments.forEach(shipment => {
      // 使用原产国和目的地国家代码
      const originCountryCode = shipment.originCountryCode || getCountryCode(shipment.countryOfOrigin || '');
      const destinationCountryCode = shipment.destinationCountryCode || getCountryCode(shipment.destinationCountry || '');
      
      if (!originCountryCode || !destinationCountryCode) {
        return; // 跳过没有国家代码的交易
      }
      
      // 使用国家对作为聚合键（顺序固定，不能相反）
      const pairKey = `${originCountryCode}-${destinationCountryCode}`;
      
      if (!countryPairGroups.has(pairKey)) {
        countryPairGroups.set(pairKey, {
          originCountryCode,
          destinationCountryCode,
          shipments: [],
          totalValue: 0,
          totalQuantity: 0,
          totalWeight: 0,
          totalTradeCount: 0,
          hsCodes: new Set()
        });
      }
      
      const group = countryPairGroups.get(pairKey)!;
      group.shipments.push(shipment);
      group.totalValue += shipment.totalValueUsd || 0;
      group.totalQuantity += shipment.quantity || 0;
      group.totalWeight += shipment.weight || 0;
      group.totalTradeCount += shipment.tradeCount || 0;
      if (shipment.hsCode) {
        group.hsCodes.add(shipment.hsCode);
      }
    });
    
    // 转换为地图组件格式
    return Array.from(countryPairGroups.values()).map((group, index) => {
      // 获取所有品类（HS Code 前2位）
      const categoryCodes = Array.from(group.hsCodes).map(code => code.slice(0, 2));
      const uniqueCategories = Array.from(new Set(categoryCodes));
      
      // 使用第一个品类作为主要品类（用于颜色）
      const mainCategoryCode = uniqueCategories[0] || '';
      const hsCategory = hsCodeCategories.find(cat => cat.hsCode === mainCategoryCode);
      const categoryColor = getHSCodeColorCached(mainCategoryCode);
      
      // 获取国家名称（用于显示）
      const originCountry = countries.find(c => c.countryCode === group.originCountryCode);
      const destCountry = countries.find(c => c.countryCode === group.destinationCountryCode);
      
      return {
        id: `country-pair-${index}-${group.originCountryCode}-${group.destinationCountryCode}`,
        originId: group.originCountryCode,
        destinationId: group.destinationCountryCode,
        countryOfOrigin: originCountry?.countryName || group.originCountryCode,
        destinationCountry: destCountry?.countryName || group.destinationCountryCode,
        material: Array.from(group.hsCodes).join(','),
        category: hsCategory?.chapterName || 'Unknown',
        categoryColor,
        quantity: group.totalQuantity,
        value: group.totalValue / 1000000, // 转换为百万美元
        status: 'completed',
        timestamp: group.shipments[0]?.date || `${group.shipments[0]?.year}-${String(group.shipments[0]?.month).padStart(2, '0')}-01`,
        // 新增字段
        tradeCount: group.totalTradeCount,
        weight: group.totalWeight,
      };
    });
  }, [shipments, hsCodeCategories, countries, getCountryCode]);

  const countryTradeYears = useMemo(() => {
    return Array.from(new Set(countryTradeStats.map((item) => item.year))).sort((a, b) => a - b);
  }, [countryTradeStats]);

  useEffect(() => {
    if (!countryMapYearPlaying || countryTradeYears.length === 0) return;
    const timer = window.setInterval(() => {
      setCountryMapYearIndex((prev) => (prev + 1) % countryTradeYears.length);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [countryMapYearPlaying, countryTradeYears.length]);

  const displayedCountryTradeStats = useMemo(() => {
    if (!countryMapYearPlaying || countryTradeYears.length === 0) return countryTradeStats;
    const year = countryTradeYears[countryMapYearIndex];
    return countryTradeStats.filter((item) => item.year === year);
  }, [countryMapYearPlaying, countryTradeYears, countryMapYearIndex, countryTradeStats]);

  const displayedCountryTradeSummary = useMemo(() => {
    if (!countryTradeSummary) return null;
    if (!countryMapYearPlaying) return countryTradeSummary;

    const statsForYear = displayedCountryTradeStats;
    const totalCountries = new Set(statsForYear.map((s) => s.countryCode)).size;
    const totalTradeValue = statsForYear.reduce((acc, s) => acc + s.sumOfUsd, 0);
    const totalWeightVal = statsForYear.reduce((acc, s) => acc + (s.weight || 0), 0);
    const totalQuantityVal = statsForYear.reduce((acc, s) => acc + (s.quantity || 0), 0);
    const totalTradeCount = statsForYear.reduce((acc, s) => acc + s.tradeCount, 0);
    const avgSharePct =
      statsForYear.length > 0
        ? statsForYear.reduce((acc, s) => acc + s.amountSharePct, 0) / statsForYear.length
        : 0;

    return {
      totalCountries,
      totalTradeValue,
      totalWeight: totalWeightVal || undefined,
      totalQuantity: totalQuantityVal || undefined,
      totalTradeCount,
      avgSharePct,
    };
  }, [countryMapYearPlaying, countryTradeSummary, displayedCountryTradeStats]);

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F5F7] text-[#1D1D1F]">
      {/* Header */}
      <header className="h-16 border-b border-black/5 bg-white/80 backdrop-blur-xl flex items-center justify-between px-8 sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#1D1D1F] rounded-[10px] flex items-center justify-center">
               <Globe className="text-white w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">{t('app.title')}</h1>
          </div>
        </div>
        
        {/* Language Switcher */}
        <button
          onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')}
          className="px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition-all bg-[#F5F5F7] text-[#86868B] hover:bg-black/5"
          title={language === 'en' ? 'Switch to Chinese' : '切换到英文'}
        >
          {language === 'en' ? '中文' : 'EN'}
        </button>
      </header>

      <main className="flex-1 flex overflow-y-auto overflow-x-hidden">
        {/* Sidebar - Narrowed from 300px to 250px */}
        <aside className="w-[250px] border-r border-black/5 bg-white flex flex-col p-5 gap-8 overflow-visible self-start">
           <div className="flex flex-col gap-1.5">
             <button 
               onClick={() => setActiveView('country-trade')}
               className={`flex items-center justify-between px-4 py-3 rounded-[12px] transition-all text-[14px] font-semibold ${activeView === 'country-trade' ? 'bg-[#007AFF] text-white shadow-lg shadow-blue-500/20' : 'text-[#86868B] hover:bg-black/5'}`}
             >
               <div className="flex items-center gap-3">
                 <Globe className="w-4 h-4" />
                 {t('countryTrade.title')}
               </div>
               {activeView === 'country-trade' && <ChevronRight className="w-3.5 h-3.5" />}
             </button>
             <button 
               onClick={() => setActiveView('map')}
               className={`flex items-center justify-between px-4 py-3 rounded-[12px] transition-all text-[14px] font-semibold ${activeView === 'map' ? 'bg-[#007AFF] text-white shadow-lg shadow-blue-500/20' : 'text-[#86868B] hover:bg-black/5'}`}
             >
               <div className="flex items-center gap-3">
                 <MapIcon className="w-4 h-4" />
                 {t('common.map')}
               </div>
               {activeView === 'map' && <ChevronRight className="w-3.5 h-3.5" />}
             </button>
             <button 
               onClick={() => setActiveView('stats')}
               className={`flex items-center justify-between px-4 py-3 rounded-[12px] transition-all text-[14px] font-semibold ${activeView === 'stats' ? 'bg-[#007AFF] text-white shadow-lg shadow-blue-500/20' : 'text-[#86868B] hover:bg-black/5'}`}
             >
               <div className="flex items-center gap-3">
                 <BarChart3 className="w-4 h-4" />
                 {t('common.stats')}
               </div>
               {activeView === 'stats' && <ChevronRight className="w-3.5 h-3.5" />}
             </button>
           </div>

          <div className="h-[0.5px] bg-black/5"></div>
          {activeView === 'country-trade' ? (
            <CountryTradeSidebar
              filters={countryTradeFilters}
              setFilters={setCountryTradeFilters}
              availableHSCodes={availableHSCodes}
            />
          ) : activeView === 'map' ? (
            <SidebarFilters 
              filters={mapFilters} 
              setFilters={setMapFilters}
              hsCodeCategories={hsCodeCategories}
              countries={countries}
              shipments={shipments}
            />
          ) : (
            <SidebarFilters 
              filters={statsFilters} 
              setFilters={setStatsFilters}
              hsCodeCategories={hsCodeCategories}
              countries={countries}
              shipments={shipments}
            />
          )}
          
          {activeView !== 'country-trade' && (
            <div className="mt-auto pt-8 border-t border-black/5 space-y-4">
             <div className="bg-[#F5F5F7] p-4 rounded-[20px] space-y-3 border border-black/5">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-[#86868B]">
                    <TrendingUp className="w-4 h-4 text-[#007AFF]" />
                    <span className="text-[10px] uppercase font-bold tracking-wider">{t('stats.transactionFlow')}</span>
                  </div>
                  <span className="text-sm font-bold">{stats.transactions}</span>
               </div>
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-[#86868B]">
                    <Users className="w-4 h-4 text-[#34C759]" />
                    <span className="text-[10px] uppercase font-bold tracking-wider">{t('stats.nodes')}</span>
                  </div>
                  <span className="text-sm font-bold">{stats.suppliers}</span>
               </div>
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-[#86868B]">
                    <Package className="w-4 h-4 text-[#FF2D55]" />
                    <span className="text-[10px] uppercase font-bold tracking-wider">{t('stats.categories')}</span>
                  </div>
                  <span className="text-sm font-bold">{stats.categories}</span>
               </div>
             </div>
           </div>
          )}
        </aside>

        {/* Main Content Area */}
        <section className="flex-1 flex flex-col p-6 relative">
          {activeView === 'map' ? (
            <div className="h-full flex flex-col relative">
              {/* 地图内容 */}
              {initialLoading ? (
                <div className="flex items-center justify-center h-full absolute inset-0 bg-white/80 backdrop-blur-sm z-10">
                  <div className="w-10 h-10 rounded-full border-2 border-[#D1D1D6] border-t-[#007AFF] animate-spin" />
                </div>
              ) : (
                <>
                  <SupplyMap 
                    shipments={shipmentsForMap}
                    transactions={[]}
                    selectedCountries={mapFilters.selectedCountries}
                    countries={countries}
                    companies={[]}
                    categories={[]}
                    filters={mapFilters}
                    isPreview={isInteracting}
                  />
                </>
              )}
            </div>
          ) : activeView === 'stats' ? (
            <div className="pr-4">
              <div className="mb-10">
                <h2 className="text-[32px] font-bold tracking-tight text-[#1D1D1F]">{t('app.networkInsights')}</h2>
                <p className="text-[#86868B] text-[16px] font-medium mt-1">{t('app.realTimeMetrics')}</p>
              </div>
              {initialLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-[#86868B]">{t('app.loading')}</div>
                </div>
              ) : (
                <StatsPanel transactions={[]} />
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-6 pr-4">
              <div className="mb-4">
                <h2 className="text-[32px] font-bold tracking-tight text-[#1D1D1F]">{t('countryTrade.title')}</h2>
                <p className="text-[#86868B] text-[16px] font-medium mt-1">{t('countryTrade.subtitle')}</p>
              </div>

              <>
                <div className="bg-white border border-black/5 rounded-[28px] p-6 shadow-sm h-[600px] overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[18px] font-bold text-[#1D1D1F]">{t('countryTrade.tradeMap')}</h3>
                    <button
                      onClick={() => setCountryMapYearPlaying((prev) => !prev)}
                      className="text-[11px] px-3 py-1.5 rounded-full border border-black/10 text-[#007AFF] hover:bg-[#F5F5F7] font-semibold"
                    >
                      {countryMapYearPlaying ? (t('countryTrade.showTotal') || 'Show Total') : (t('countryTrade.playByYear') || 'Play by Year')}
                    </button>
                  </div>
                  <p className="text-[11px] text-[#86868B] mb-3">
                    {countryMapYearPlaying && countryTradeYears.length > 0
                      ? `${t('countryTrade.playingYear') || 'Playing year'}: ${countryTradeYears[countryMapYearIndex]}`
                      : (t('countryTrade.totalWithinSelection') || 'Total within selected filter range')}
                  </p>
                  <div className="h-[510px] pb-5">
                      <CountryTradeMap
                      stats={displayedCountryTradeStats}
                        countries={countries}
                        selectedHSCodes={countryTradeFilters.hsCode}
                      />
                    </div>
                  </div>

                {displayedCountryTradeSummary !== null && (
                  <CountryTradeStatsPanel
                    stats={displayedCountryTradeStats}
                    summary={displayedCountryTradeSummary}
                    trends={countryTradeTrends}
                    topCountries={topCountries}
                  />
                )}
                </>
            </div>
          )}

        </section>
      </main>

      {((activeView === 'map' && filterLoading) || (activeView === 'country-trade' && countryTradeLoading)) && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 rounded-full border-[3px] border-[#D1D1D6] border-t-[#007AFF] animate-spin bg-white/40 backdrop-blur-[1px]" />
        </div>
      )}

      {/* AI 助手 */}
      <AIAssistant 
        onSendMessage={async (
          message: string,
          history: ChatMessage[],
          onChunk: (chunk: string) => void,
          onComplete: () => void,
          onError: (error: string) => void
        ) => {
          await chatAPI.sendMessage(message, history, onChunk, onComplete, onError);
        }}
      />
    </div>
  );
};

export default App;
