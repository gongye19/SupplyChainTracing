
import React, { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from 'react';
import StatsPanel from './components/StatsPanel';
import SidebarFilters from './components/SidebarFilters';
import CountryTradeSidebar from './components/CountryTradeSidebar';
import type { TopCountriesDatum } from './components/TopCountriesHorizontalBar';
import { Transaction, Filters, HSCodeCategory, CountryLocation, Location, Shipment, CountryMonthlyTradeStat, CountryTradeStatSummary, CountryTradeTrend, TopCountry, CountryTradeFilters, CountryQuarterTop, CountryAggregate, CountryQuarterAggregate, HSAggregate, HSQuarterAggregate } from './types';
import { shipmentsAPI, hsCodeCategoriesAPI, countryLocationsAPI, chatAPI, ChatMessage, countryTradeStatsAPI } from './services/api';
import { Globe, Map as MapIcon, Package, TrendingUp, Users, ChevronRight, Filter, Building2 } from 'lucide-react';
import { useLanguage } from './contexts/LanguageContext';
import MonthRangeSlider from './components/MonthRangeSlider';
import { getCountriesFromCodes } from './utils/countryCoordinates';
import { logger } from './utils/logger';

const SupplyMap = lazy(() => import('./components/SupplyMap'));
const AIAssistant = lazy(() => import('./components/AIAssistant'));
const CountryTradeMap = lazy(() => import('./components/CountryTradeMap'));
const CountryTradeStatsPanel = lazy(() => import('./components/CountryTradeStatsPanel'));
const TopCountriesHorizontalBar = lazy(() => import('./components/TopCountriesHorizontalBar'));
const CompanyDashboard = lazy(() => import('./components/CompanyDashboard'));

const HS2_COLOR_PALETTE = [
  '#007AFF', '#34C759', '#FF9500', '#AF52DE', '#FF2D55', '#30B0C7',
  '#5856D6', '#FF3B30', '#64D2FF', '#FFD60A', '#32D74B', '#BF5AF2',
];

const getHs2Color = (hs2: string): string => {
  if (!hs2) return '#8E8E93';
  const numeric = Number.parseInt(hs2, 10);
  if (Number.isNaN(numeric)) return '#8E8E93';
  return HS2_COLOR_PALETTE[numeric % HS2_COLOR_PALETTE.length];
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 24;

type CacheEntry<T> = {
  data: T;
  ts: number;
};

const CompanyDashboardSidebar: React.FC<{
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
}> = ({ filters, setFilters }) => {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return (
    <div className="flex flex-col gap-8 p-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[#007AFF]">
          <Filter className="w-4 h-4" />
          <span className="text-[12px] font-bold uppercase tracking-widest text-[#1D1D1F]">Filter Control</span>
        </div>
        <button
          onClick={() => setFilters((prev) => ({ ...prev, startDate: '2021-01', endDate: currentMonth }))}
          className="text-[12px] text-[#007AFF] hover:underline font-semibold"
        >
          Reset
        </button>
      </div>
      <div className="flex flex-col gap-3">
        <MonthRangeSlider
          title="Time Range"
          startLabel="START"
          endLabel="END"
          minMonth="2021-01"
          startMonth={filters.startDate || '2021-01'}
          endMonth={filters.endDate}
          onChange={(startMonth, endMonth) => setFilters((prev) => ({ ...prev, startDate: startMonth, endDate: endMonth }))}
        />
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  const [activeView, setActiveView] = useState<'map-country' | 'map-hscode' | 'global-stats' | 'company-dashboard'>('global-stats');
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const startDate = '2021-01';
  const endDate = `${currentYear}-${currentMonth}`; // YYYY-MM

  const defaultFilters: Filters = {
    startDate,
    endDate,
    tradeDirection: 'import',
    selectedCountries: [],
    selectedHSCodes: [],
    selectedHSCode4Digit: [],
    selectedHSCodeCategories: [],
    selectedHSCodeSubcategories: [],
    selectedCompanies: []
  };
  const defaultCountryMapFilters: Filters = {
    ...defaultFilters,
    selectedCountries: ['CHN'],
  };
  const defaultHsMapFilters: Filters = {
    ...defaultFilters,
    selectedHSCodes: ['854231'],
    selectedHSCode4Digit: [],
    selectedHSCodeCategories: [],
    selectedHSCodeSubcategories: [],
  };
  const [mapCountryFilters, setMapCountryFilters] = useState<Filters>(defaultCountryMapFilters);
  const [mapHsFilters, setMapHsFilters] = useState<Filters>(defaultHsMapFilters);
  const [companyDashboardFilters, setCompanyDashboardFilters] = useState<Filters>(defaultFilters);

  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [countryOverallQuarterlyValue, setCountryOverallQuarterlyValue] = useState<CountryQuarterTop[]>([]);
  const [countryOverallQuarterlyCount, setCountryOverallQuarterlyCount] = useState<CountryQuarterTop[]>([]);
  const [countryOverallTotalValueTop, setCountryOverallTotalValueTop] = useState<TopCountriesDatum[]>([]);
  const [countryOverallTotalCountTop, setCountryOverallTotalCountTop] = useState<TopCountriesDatum[]>([]);
  const [hsCodeCategories, setHsCodeCategories] = useState<HSCodeCategory[]>([]);
  const [availableHSCodes, setAvailableHSCodes] = useState<string[]>([]);
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
  const [topCountriesQuarterly, setTopCountriesQuarterly] = useState<CountryQuarterTop[]>([]);
  const [hsCodeMapCountryTotals, setHsCodeMapCountryTotals] = useState<CountryAggregate[]>([]);
  const [hsCodeMapCountryQuarterly, setHsCodeMapCountryQuarterly] = useState<CountryQuarterAggregate[]>([]);
  const [hsCodeMapOverallTotals, setHsCodeMapOverallTotals] = useState<HSAggregate[]>([]);
  const [hsCodeMapOverallQuarterly, setHsCodeMapOverallQuarterly] = useState<HSQuarterAggregate[]>([]);
  const [countryTradeFilters, setCountryTradeFilters] = useState<CountryTradeFilters>({
    hsCode: [],
    tradeDirection: 'import',
    industry: 'SemiConductor',
    startYearMonth: '2021-01',
    endYearMonth: endDate,
  });
  const [countryTradeLoading, setCountryTradeLoading] = useState(false);
  const [hsCodeMapLoading, setHsCodeMapLoading] = useState(false);
  const [countryMapYearPlaying, setCountryMapYearPlaying] = useState(false);
  const [countryMapYearIndex, setCountryMapYearIndex] = useState(0);
  const [countryMapQuarterPaused, setCountryMapQuarterPaused] = useState(false);
  const [countryOverallValueQuarterPlaying, setCountryOverallValueQuarterPlaying] = useState(false);
  const [countryOverallValueQuarterPaused, setCountryOverallValueQuarterPaused] = useState(false);
  const [countryOverallValueQuarterIndex, setCountryOverallValueQuarterIndex] = useState(0);
  const [countryOverallCountQuarterPlaying, setCountryOverallCountQuarterPlaying] = useState(false);
  const [countryOverallCountQuarterPaused, setCountryOverallCountQuarterPaused] = useState(false);
  const [countryOverallCountQuarterIndex, setCountryOverallCountQuarterIndex] = useState(0);
  const [hsCodeMapQuarterPlaying, setHsCodeMapQuarterPlaying] = useState(false);
  const [hsCodeMapQuarterPaused, setHsCodeMapQuarterPaused] = useState(false);
  const [hsCodeMapQuarterIndex, setHsCodeMapQuarterIndex] = useState(0);
  const [hsCodeOverallCountQuarterPlaying, setHsCodeOverallCountQuarterPlaying] = useState(false);
  const [hsCodeOverallCountQuarterPaused, setHsCodeOverallCountQuarterPaused] = useState(false);
  const [hsCodeOverallCountQuarterIndex, setHsCodeOverallCountQuarterIndex] = useState(0);
  const [hsCodeOverallValueQuarterPlaying, setHsCodeOverallValueQuarterPlaying] = useState(false);
  const [hsCodeOverallValueQuarterPaused, setHsCodeOverallValueQuarterPaused] = useState(false);
  const [hsCodeOverallValueQuarterIndex, setHsCodeOverallValueQuarterIndex] = useState(0);

  // Refs for preview/final scheduling
  const currentMapFilters = activeView === 'map-country' ? mapCountryFilters : mapHsFilters;
  const filtersRef = useRef(currentMapFilters);
  useEffect(() => { filtersRef.current = currentMapFilters; }, [currentMapFilters]);
  const abortRef = useRef<AbortController | null>(null);
  const countryOverallAbortRef = useRef<AbortController | null>(null);
  const finalTimerRef = useRef<number | null>(null);
  const countryTradeTimerRef = useRef<number | null>(null);
  const hsCodeMapTimerRef = useRef<number | null>(null);
  const countryTradeCacheRef = useRef<
    Map<
      string,
      CacheEntry<{
        statsData: CountryMonthlyTradeStat[];
        summaryData: CountryTradeStatSummary;
        trendsData: CountryTradeTrend[];
        topCountriesData: TopCountry[];
        topCountriesQuarterlyData: CountryQuarterTop[];
      }>
    >
  >(new Map());
  const lastCountryTradeKeyRef = useRef<string>('');
  const shipmentsCacheRef = useRef<Map<string, CacheEntry<Shipment[]>>>(new Map());
  const hsCodeMapCacheRef = useRef<Map<string, CacheEntry<{
    countryTotals: CountryAggregate[];
    countryQuarterly: CountryQuarterAggregate[];
  }>>>(new Map());
  const hsCodeMapOverallCacheRef = useRef<Map<string, CacheEntry<{
    hsTotals: HSAggregate[];
    hsQuarterly: HSQuarterAggregate[];
  }>>>(new Map());
  const lastRequestedKeyRef = useRef<string>('');
  const lastHsCodeMapKeyRef = useRef<string>('');
  const lastHsCodeMapOverallKeyRef = useRef<string>('');
  // 标记是否正在拖动（用于时间滑块）
  const isDraggingRef = useRef<boolean>(false);

  const getCached = useCallback(<T,>(cache: Map<string, CacheEntry<T>>, key: string): T | null => {
    const hit = cache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.ts > CACHE_TTL_MS) {
      cache.delete(key);
      return null;
    }
    return hit.data;
  }, []);

  const setCached = useCallback(<T,>(cache: Map<string, CacheEntry<T>>, key: string, data: T) => {
    cache.set(key, { data, ts: Date.now() });
    if (cache.size > MAX_CACHE_ENTRIES) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) cache.delete(oldestKey);
    }
  }, []);

  const buildShipmentsCacheKey = useCallback((filtersToUse: Filters) => {
    const sortedCountries = [...(filtersToUse.selectedCountries || [])].sort().join(',');
    const sortedCategories = [...(filtersToUse.selectedHSCodeCategories || [])].sort().join(',');
    return [
      filtersToUse.startDate || '',
      filtersToUse.endDate || '',
      filtersToUse.tradeDirection || '',
      sortedCountries,
      sortedCategories,
    ].join('|');
  }, []);

  // 加载初始数据
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setInitialLoading(true);
        const [hsCodeCatsData, locationsData, hsCodesData] = await Promise.all([
          hsCodeCategoriesAPI.getAll(),
          countryLocationsAPI.getAll(),
          countryTradeStatsAPI.getAvailableHSCodes(),
        ]);
        let allShipmentsData: Shipment[] = [];

        // 仅在分类或国家坐标接口为空时，才回退读取 shipments；
        // 且初始化时只加载 Trade Map 默认国家（CHN/USA），避免全量预加载。
        if (hsCodeCatsData.length === 0 || locationsData.length === 0) {
          allShipmentsData = await shipmentsAPI.getAll({
            startDate,
            endDate,
            selectedCountries: defaultCountryMapFilters.selectedCountries,
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
        setAvailableHSCodes(hsCodesData);
        
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

  // 加载国家贸易统计数据
  useEffect(() => {
    if (activeView !== 'global-stats') return;
    const requestFilters: CountryTradeFilters = {
      ...countryTradeFilters,
      limit: 8000,
    };

    const buildCountryTradeKey = () => {
      const hsCodes = [...(requestFilters.hsCode || [])].sort().join(',');
      const countriesFilter = [...(requestFilters.country || [])].sort().join(',');
      return [
        hsCodes,
        requestFilters.tradeDirection || 'all',
        countriesFilter,
        requestFilters.industry || '',
        requestFilters.year || '',
        requestFilters.month || '',
        requestFilters.startYearMonth || '',
        requestFilters.endYearMonth || '',
      ].join('|');
    };

    const loadCountryTradeData = async () => {
      try {
        const requestKey = buildCountryTradeKey();
        if (lastCountryTradeKeyRef.current === requestKey) {
          return;
        }
        lastCountryTradeKeyRef.current = requestKey;

        const cached = getCached(countryTradeCacheRef.current, requestKey);
        if (cached) {
          setCountryTradeStats(cached.statsData);
          setCountryTradeSummary(cached.summaryData);
          setCountryTradeTrends(cached.trendsData);
          setTopCountries(cached.topCountriesData);
          setTopCountriesQuarterly(cached.topCountriesQuarterlyData);
          return;
        }

        setCountryTradeLoading(true);
        
        const [quarterlyCountryData, summaryData, trendsData, topCountriesData, topCountriesQuarterlyData] = await Promise.all([
          countryTradeStatsAPI.getCountryQuarterly({
            hsCode: requestFilters.hsCode,
            hsCodePrefix: requestFilters.hsCodePrefix,
            country: requestFilters.country,
            tradeDirection: requestFilters.tradeDirection,
            startYearMonth: requestFilters.startYearMonth,
            endYearMonth: requestFilters.endYearMonth,
            limit: requestFilters.limit,
          }),
          countryTradeStatsAPI.getSummary(requestFilters),
          countryTradeStatsAPI.getTrends({
            hsCode: requestFilters.hsCode?.[0],
            industry: requestFilters.industry,
            tradeDirection: requestFilters.tradeDirection,
            startYearMonth: requestFilters.startYearMonth,
            endYearMonth: requestFilters.endYearMonth,
          }),
          countryTradeStatsAPI.getTopCountries({
            hsCode: requestFilters.hsCode,
            country: requestFilters.country,
            industry: requestFilters.industry,
            tradeDirection: requestFilters.tradeDirection,
            startYearMonth: requestFilters.startYearMonth,
            endYearMonth: requestFilters.endYearMonth,
            limit: 10,
          }),
          countryTradeStatsAPI.getTopCountriesQuarterly({
            hsCode: requestFilters.hsCode,
            country: requestFilters.country,
            tradeDirection: requestFilters.tradeDirection,
            startYearMonth: requestFilters.startYearMonth,
            endYearMonth: requestFilters.endYearMonth,
            metric: 'trade_value',
            limit: 10,
          }),
        ]);
        const statsData: CountryMonthlyTradeStat[] = quarterlyCountryData.map((item) => ({
          hsCode: 'ALL',
          year: item.year,
          month: (item.quarter - 1) * 3 + 1,
          countryCode: item.countryCode,
          sumOfUsd: item.sumOfUsd,
          tradeCount: item.tradeCount,
        }));
        logger.debug('[Country Trade] loaded', {
          stats: statsData.length,
          summary: summaryData,
          trends: trendsData.length,
          topCountries: topCountriesData.length,
          topCountriesQuarterly: topCountriesQuarterlyData.length,
        });

        setCached(countryTradeCacheRef.current, requestKey, {
          statsData,
          summaryData,
          trendsData,
          topCountriesData,
          topCountriesQuarterlyData,
        });
        
        setCountryTradeStats(statsData);
        setCountryTradeSummary(summaryData);
        setCountryTradeTrends(trendsData);
        setTopCountries(topCountriesData);
        setTopCountriesQuarterly(topCountriesQuarterlyData);
      } catch (error) {
        logger.error('Failed to load country trade data:', error);
        // 显示错误信息给用户
        alert(`加载国家贸易数据失败: ${error instanceof Error ? error.message : String(error)}\n\n请检查：\n1. 数据库是否已导入数据\n2. 后端服务是否正常运行\n3. 网络连接是否正常`);
      } finally {
        setCountryTradeLoading(false);
      }
    };

    if (countryTradeTimerRef.current) window.clearTimeout(countryTradeTimerRef.current);
    countryTradeTimerRef.current = window.setTimeout(() => {
    loadCountryTradeData();
    }, 120);
    return () => {
      if (countryTradeTimerRef.current) window.clearTimeout(countryTradeTimerRef.current);
    };
  }, [activeView, countryTradeFilters, getCached, setCached]);

  useEffect(() => {
    if (activeView !== 'map-hscode') return;

    const selectedHsCodes = [...(mapHsFilters.selectedHSCodes || [])].sort();
    const tradeDirection = mapHsFilters.tradeDirection || 'import';
    const startYearMonth = mapHsFilters.startDate;
    const endYearMonth = mapHsFilters.endDate;

    // 地图用：按选中 HSCode + 方向过滤，不限国家，展示全球所有国家分布
    const mapFilters = {
      hsCode: selectedHsCodes,
      tradeDirection,
      startYearMonth,
      endYearMonth,
    } as const;

    // 排名图用：不限 HSCode，只按方向过滤，得到全球 HS 品类排名
    const rankFilters = {
      tradeDirection,
      startYearMonth,
      endYearMonth,
    } as const;

    const requestKey = [
      startYearMonth || '',
      endYearMonth || '',
      selectedHsCodes.join(','),
      tradeDirection,
    ].join('|');
    const overallKey = [
      startYearMonth || '',
      endYearMonth || '',
      tradeDirection,
    ].join('|');

    const loadHsCodeMapData = async () => {
      try {
        if (lastHsCodeMapKeyRef.current === requestKey && lastHsCodeMapOverallKeyRef.current === overallKey) {
          return;
        }
        lastHsCodeMapKeyRef.current = requestKey;
        lastHsCodeMapOverallKeyRef.current = overallKey;

        const cachedSelected = getCached(hsCodeMapCacheRef.current, requestKey);
        const cachedOverall = getCached(hsCodeMapOverallCacheRef.current, overallKey);
        if (cachedSelected && cachedOverall) {
          setHsCodeMapCountryTotals(cachedSelected.countryTotals);
          setHsCodeMapCountryQuarterly(cachedSelected.countryQuarterly);
          setHsCodeMapOverallTotals(cachedOverall.hsTotals);
          setHsCodeMapOverallQuarterly(cachedOverall.hsQuarterly);
          return;
        }

        setHsCodeMapLoading(true);
        const [countryTotals, countryQuarterly, hsTotals, hsQuarterly] = await Promise.all([
          // 地图数据：全球所有国家，按选中 HSCode + 方向
          selectedHsCodes.length > 0 ? countryTradeStatsAPI.getCountryAggregate({
            ...mapFilters,
            limit: 300,
          }) : Promise.resolve([]),
          selectedHsCodes.length > 0 ? countryTradeStatsAPI.getCountryQuarterly({
            ...mapFilters,
            limit: 5000,
          }) : Promise.resolve([]),
          // 排名图：全球 HS 品类，只按方向过滤
          countryTradeStatsAPI.getHSAggregate({
            ...rankFilters,
            limit: 200,
          }),
          countryTradeStatsAPI.getHSQuarterly({
            ...rankFilters,
            limit: 5000,
          }),
        ]);
        setCached(hsCodeMapCacheRef.current, requestKey, { countryTotals, countryQuarterly });
        setCached(hsCodeMapOverallCacheRef.current, overallKey, { hsTotals, hsQuarterly });
        setHsCodeMapCountryTotals(countryTotals);
        setHsCodeMapCountryQuarterly(countryQuarterly);
        setHsCodeMapOverallTotals(hsTotals);
        setHsCodeMapOverallQuarterly(hsQuarterly);
      } catch (error) {
        logger.error('Failed to load HSCode map monthly stats:', error);
      } finally {
        setHsCodeMapLoading(false);
      }
    };

    if (hsCodeMapTimerRef.current) window.clearTimeout(hsCodeMapTimerRef.current);
    hsCodeMapTimerRef.current = window.setTimeout(() => {
      loadHsCodeMapData();
    }, 120);

    return () => {
      if (hsCodeMapTimerRef.current) window.clearTimeout(hsCodeMapTimerRef.current);
    };
  }, [activeView, mapHsFilters.endDate, mapHsFilters.selectedHSCodes, mapHsFilters.startDate, mapHsFilters.tradeDirection, getCached, setCached]);

  const countryNameToCodeMap = useMemo(() => {
    const map = new Map<string, string>();
    countries.forEach((country) => {
      map.set(country.countryName, country.countryCode);
      map.set(country.countryName.toLowerCase(), country.countryCode);
    });
    return map;
  }, [countries]);

  const countryCodeToNameMap = useMemo(() => {
    const map = new Map<string, string>();
    countries.forEach((country) => {
      map.set(country.countryCode, country.countryName);
    });
    return map;
  }, [countries]);

  const hsCodeCategoryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    hsCodeCategories.forEach((cat) => {
      map.set(cat.hsCode, cat.chapterName);
    });
    return map;
  }, [hsCodeCategories]);

  // 国家名称到国家代码的映射函数
  const getCountryCode = useCallback((countryName: string): string => {
    if (!countryName) return '';
    return countryNameToCodeMap.get(countryName) || countryNameToCodeMap.get(countryName.toLowerCase()) || '';
  }, [countryNameToCodeMap]);

  // 加载原始交易数据
  const loadShipments = useCallback(async (filtersToUse: Filters, mode: 'preview' | 'final') => {
    const requestKey = buildShipmentsCacheKey(filtersToUse);

    if (lastRequestedKeyRef.current === `${mode}:${requestKey}`) {
      return;
    }
    lastRequestedKeyRef.current = `${mode}:${requestKey}`;

    const cached = getCached(shipmentsCacheRef.current, requestKey);
    if (cached) {
      setShipments(cached);
      if (mode === 'final') {
        const uniqueCountries = new Set<string>();
        cached.forEach(s => {
          uniqueCountries.add(s.countryOfOrigin);
          uniqueCountries.add(s.destinationCountry);
        });
        const countryPairHs2 = new Set<string>();
        cached.forEach(s => {
          const originCode = s.originCountryCode || getCountryCode(s.countryOfOrigin || '');
          const destCode = s.destinationCountryCode || getCountryCode(s.destinationCountry || '');
          const hs2 = s.hsCode?.slice(0, 2) || '';
          if (originCode && destCode && hs2) countryPairHs2.add(`${originCode}-${destCode}-${hs2}`);
        });
        const uniqueCategories = new Set<string>();
        cached.forEach(s => {
          if (s.hsCode && s.hsCode.length >= 2) uniqueCategories.add(s.hsCode.slice(0, 2));
        });
        setStats({
          transactions: countryPairHs2.size,
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
        limit: mode === 'preview' ? 5000 : 20000,
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
      setCached(shipmentsCacheRef.current, requestKey, data);
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
        
        // 按国家对+HS2 聚合，计算唯一连线数
        const countryPairHs2 = new Set<string>();
        data.forEach(s => {
          // 使用国家代码作为键（顺序固定：原产国-目的地国家）
          const originCode = s.originCountryCode || getCountryCode(s.countryOfOrigin || '');
          const destCode = s.destinationCountryCode || getCountryCode(s.destinationCountry || '');
          const hs2 = s.hsCode?.slice(0, 2) || '';
          if (originCode && destCode && hs2) {
            const pair = `${originCode}-${destCode}-${hs2}`;
            countryPairHs2.add(pair);
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
          transactions: countryPairHs2.size, // 显示国家对+HS2 数量（线数）
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
  }, [buildShipmentsCacheKey, getCountryCode, getCached, setCached]);

  // 调度器：拖动时 preview + final，点击时仅 final
  const scheduleFetch = useCallback((nextFilters: Filters, reason: 'drag' | 'click') => {
    if (finalTimerRef.current) window.clearTimeout(finalTimerRef.current);
    if (reason === 'drag') {
      setIsInteracting(true);
      loadShipments(nextFilters, 'preview');
      finalTimerRef.current = window.setTimeout(() => {
        setIsInteracting(false);
        loadShipments(filtersRef.current, 'final');
      }, 220);
      return;
    }
    setIsInteracting(false);
    loadShipments(nextFilters, 'final');
  }, [loadShipments]);

  // 暴露拖动状态控制函数给子组件
  const setDragging = useCallback((dragging: boolean) => {
    isDraggingRef.current = dragging;
    setIsInteracting(dragging); // 拖动时 SupplyMap 进入 preview mode
  }, []);

  // 统一监听 map filters 变化：触发 scheduleFetch（仅在 Trade Map 视图）
  useEffect(() => {
    if (activeView !== 'map-country') {
      return;
    }
    if (hsCodeCategories.length === 0 || countries.length === 0) {
      return;
    }
    
    const reason: 'drag' | 'click' = isDraggingRef.current ? 'drag' : 'click';
    scheduleFetch(currentMapFilters, reason);

    return () => {
      if (finalTimerRef.current) window.clearTimeout(finalTimerRef.current);
    };
  }, [activeView, currentMapFilters, hsCodeCategories.length, countries.length, scheduleFetch]);

  const filteredShipmentsForCurrentMap = useMemo(() => {
    const activeFilters = currentMapFilters;
    const isHsCodeMapView = activeView === 'map-hscode';
    const focusCountries = new Set(activeFilters.selectedCountries || []);
    const hs4Set = new Set(activeFilters.selectedHSCode4Digit || []);
    const hasHs4Filter = hs4Set.size > 0;
    const subcategorySet = new Set(activeFilters.selectedHSCodeSubcategories || []);
    const hasSubcategoryFilter = subcategorySet.size > 0;
    const direction = activeFilters.tradeDirection || 'import';

    return shipments.filter((shipment) => {
      if (isHsCodeMapView && !hasHs4Filter) {
        return false;
      }
      if (isHsCodeMapView && hasHs4Filter) {
        const hs4 = shipment.hsCode?.slice(0, 4);
        if (!hs4 || !hs4Set.has(hs4)) return false;
      }
      if (hasSubcategoryFilter) {
        const sub = shipment.hsCode?.slice(2, 4);
        if (!sub || !subcategorySet.has(sub)) return false;
      }
      if (isHsCodeMapView) return true;
      if (focusCountries.size === 0) return true;
      const origin = shipment.originCountryCode;
      const dest = shipment.destinationCountryCode;
      if (direction === 'import') {
        return !!dest && focusCountries.has(dest);
      }
      return !!origin && focusCountries.has(origin);
    });
  }, [shipments, currentMapFilters, activeView]);

  // 将聚合统计数据按国家对聚合，转换为地图组件格式
  const shipmentsForMap = useMemo(() => {
    // 按国家对聚合所有交易
    const countryPairGroups = new Map<string, {
      originCountryCode: string;
      destinationCountryCode: string;
      hs2: string;
      shipments: Shipment[];
      totalValue: number;
      totalTradeCount: number;
    }>();
    
    filteredShipmentsForCurrentMap.forEach(shipment => {
      // 使用原产国和目的地国家代码
      const originCountryCode = shipment.originCountryCode || getCountryCode(shipment.countryOfOrigin || '');
      const destinationCountryCode = shipment.destinationCountryCode || getCountryCode(shipment.destinationCountry || '');
      
      if (!originCountryCode || !destinationCountryCode) {
        return; // 跳过没有国家代码的交易
      }
      
      const hs2 = shipment.hsCode?.slice(0, 2) || '00';
      // 使用国家对+HS2 作为聚合键，同一国家对不同品类显示不同线条
      const pairKey = `${originCountryCode}-${destinationCountryCode}-${hs2}`;
      
      if (!countryPairGroups.has(pairKey)) {
        countryPairGroups.set(pairKey, {
          originCountryCode,
          destinationCountryCode,
          hs2,
          shipments: [],
          totalValue: 0,
          totalTradeCount: 0,
        });
      }
      
      const group = countryPairGroups.get(pairKey)!;
      group.shipments.push(shipment);
      group.totalValue += shipment.totalValueUsd || 0;
      group.totalTradeCount += shipment.tradeCount || 0;
    });
    
    // 转换为地图组件格式
    return Array.from(countryPairGroups.values()).map((group, index) => {
      const categoryColor = getHs2Color(group.hs2);
      
      return {
        id: `country-pair-${index}-${group.originCountryCode}-${group.destinationCountryCode}`,
        originId: group.originCountryCode,
        destinationId: group.destinationCountryCode,
        countryOfOrigin: countryCodeToNameMap.get(group.originCountryCode) || group.originCountryCode,
        destinationCountry: countryCodeToNameMap.get(group.destinationCountryCode) || group.destinationCountryCode,
        material: `HS2-${group.hs2}`,
        category: hsCodeCategoryNameMap.get(group.hs2) || `HS ${group.hs2}`,
        categoryColor,
        value: group.totalValue / 1000000, // 转换为百万美元
        status: 'completed',
        timestamp: group.shipments[0]?.date || `${group.shipments[0]?.year}-${String(group.shipments[0]?.month).padStart(2, '0')}-01`,
        tradeCount: group.totalTradeCount,
        hsCode: `${group.hs2}0000`,
      };
    });
  }, [filteredShipmentsForCurrentMap, hsCodeCategoryNameMap, countryCodeToNameMap, getCountryCode]);

  const hsCodeMapQuarters = useMemo(() => {
    const quarterSet = new Map<string, { year: number; quarter: number; label: string }>();
    hsCodeMapCountryQuarterly.forEach((item) => {
      const quarter = item.quarter;
      const key = `${item.year}-Q${quarter}`;
      if (!quarterSet.has(key)) {
        const quarterRange = quarter === 1 ? '1-3' : quarter === 2 ? '4-6' : quarter === 3 ? '7-9' : '10-12';
        quarterSet.set(key, {
          year: item.year,
          quarter,
          label: `${item.year} (${quarterRange})`,
        });
      }
    });
    return Array.from(quarterSet.values()).sort((a, b) => (a.year === b.year ? a.quarter - b.quarter : a.year - b.year));
  }, [hsCodeMapCountryQuarterly]);

  const hsCodeOverallQuarters = useMemo(() => {
    const quarterSet = new Map<string, { year: number; quarter: number; label: string }>();
    hsCodeMapOverallQuarterly.forEach((item) => {
      const quarter = item.quarter;
      const key = `${item.year}-Q${quarter}`;
      if (!quarterSet.has(key)) {
        const quarterRange = quarter === 1 ? '1-3' : quarter === 2 ? '4-6' : quarter === 3 ? '7-9' : '10-12';
        quarterSet.set(key, {
          year: item.year,
          quarter,
          label: `${item.year} (${quarterRange})`,
        });
      }
    });
    return Array.from(quarterSet.values()).sort((a, b) => (a.year === b.year ? a.quarter - b.quarter : a.year - b.year));
  }, [hsCodeMapOverallQuarterly]);

  useEffect(() => {
    if (hsCodeMapQuarters.length === 0) {
      setHsCodeMapQuarterIndex(0);
      return;
    }
    if (hsCodeMapQuarterIndex >= hsCodeMapQuarters.length) {
      setHsCodeMapQuarterIndex(0);
    }
  }, [hsCodeMapQuarterIndex, hsCodeMapQuarters.length]);

  useEffect(() => {
    if (!hsCodeMapQuarterPlaying || hsCodeMapQuarterPaused || hsCodeMapQuarters.length === 0) return;
    const timer = window.setInterval(() => {
      setHsCodeMapQuarterIndex((prev) => (prev + 1) % hsCodeMapQuarters.length);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [hsCodeMapQuarterPlaying, hsCodeMapQuarterPaused, hsCodeMapQuarters.length]);

  useEffect(() => {
    if (hsCodeOverallQuarters.length === 0) {
      setHsCodeOverallCountQuarterIndex(0);
      setHsCodeOverallValueQuarterIndex(0);
      return;
    }
    if (hsCodeOverallCountQuarterIndex >= hsCodeOverallQuarters.length) {
      setHsCodeOverallCountQuarterIndex(0);
    }
    if (hsCodeOverallValueQuarterIndex >= hsCodeOverallQuarters.length) {
      setHsCodeOverallValueQuarterIndex(0);
    }
  }, [hsCodeOverallCountQuarterIndex, hsCodeOverallValueQuarterIndex, hsCodeOverallQuarters.length]);

  useEffect(() => {
    if (!hsCodeOverallCountQuarterPlaying || hsCodeOverallCountQuarterPaused || hsCodeOverallQuarters.length === 0) return;
    const timer = window.setInterval(() => {
      setHsCodeOverallCountQuarterIndex((prev) => (prev + 1) % hsCodeOverallQuarters.length);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [hsCodeOverallCountQuarterPlaying, hsCodeOverallCountQuarterPaused, hsCodeOverallQuarters.length]);

  useEffect(() => {
    if (!hsCodeOverallValueQuarterPlaying || hsCodeOverallValueQuarterPaused || hsCodeOverallQuarters.length === 0) return;
    const timer = window.setInterval(() => {
      setHsCodeOverallValueQuarterIndex((prev) => (prev + 1) % hsCodeOverallQuarters.length);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [hsCodeOverallValueQuarterPlaying, hsCodeOverallValueQuarterPaused, hsCodeOverallQuarters.length]);

  const displayedHsCodeMapStats = useMemo(() => {
    if (!hsCodeMapQuarterPlaying || hsCodeMapQuarters.length === 0) {
      return hsCodeMapCountryTotals.map((item) => ({
        hsCode: 'ALL',
        year: 0,
        month: 0,
        countryCode: item.countryCode,
        sumOfUsd: item.sumOfUsd,
        tradeCount: item.tradeCount,
      }));
    }
    const quarter = hsCodeMapQuarters[hsCodeMapQuarterIndex];
    if (!quarter) {
      return hsCodeMapCountryTotals.map((item) => ({
        hsCode: 'ALL',
        year: 0,
        month: 0,
        countryCode: item.countryCode,
        sumOfUsd: item.sumOfUsd,
        tradeCount: item.tradeCount,
      }));
    }
    return hsCodeMapCountryQuarterly
      .filter((item) => item.year === quarter.year && item.quarter === quarter.quarter)
      .map((item) => ({
      hsCode: 'ALL',
      year: 0,
      month: 0,
      countryCode: item.countryCode,
      sumOfUsd: item.sumOfUsd,
      tradeCount: item.tradeCount,
    }));
  }, [hsCodeMapCountryQuarterly, hsCodeMapCountryTotals, hsCodeMapQuarterIndex, hsCodeMapQuarterPlaying, hsCodeMapQuarters]);

  const hsCodeMapFilterSummary = useMemo(() => {
    const selectedHsCodes = mapHsFilters.selectedHSCodes || [];
    const hsLabel =
      selectedHsCodes.length === 0
        ? 'All'
        : selectedHsCodes.length <= 4
          ? selectedHsCodes.join(', ')
          : `${selectedHsCodes.slice(0, 4).join(', ')} +${selectedHsCodes.length - 4}`;
    return {
      time: `${mapHsFilters.startDate} ~ ${mapHsFilters.endDate}`,
      direction: mapHsFilters.tradeDirection === 'import' ? 'Import' : 'Export',
      hsCodes: hsLabel,
    };
  }, [mapHsFilters]);

  const buildTopCountries = useCallback(
    (
      data: Shipment[],
      direction: 'import' | 'export',
      metric: 'tradeValue' | 'tradeCount'
    ): TopCountriesDatum[] => {
      const aggregate = new Map<string, { tradeValue: number; tradeCount: number }>();
      data.forEach((shipment) => {
        const countryCode = direction === 'import'
          ? shipment.destinationCountryCode
          : shipment.originCountryCode;
        if (!countryCode) return;
        const prev = aggregate.get(countryCode) || { tradeValue: 0, tradeCount: 0 };
        aggregate.set(countryCode, {
          tradeValue: prev.tradeValue + (shipment.totalValueUsd || 0),
          tradeCount: prev.tradeCount + (shipment.tradeCount || 0),
        });
      });

      return Array.from(aggregate.entries())
        .map(([countryCode, value]) => {
          const countryName = countryCodeToNameMap.get(countryCode) || countryCode;
          return {
            countryCode,
            countryName,
            value: metric === 'tradeValue' ? value.tradeValue : value.tradeCount,
          };
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);
    },
    [countryCodeToNameMap]
  );

  const topCategoriesByHSCodeOverallCount = useMemo(() => {
    if (activeView !== 'map-hscode') return [];
    if (!hsCodeOverallCountQuarterPlaying || hsCodeOverallQuarters.length === 0) {
      return hsCodeMapOverallTotals
        .map((item) => ({
          countryCode: item.hsCode,
          countryName: `HS ${item.hsCode}`,
          value: item.tradeCount,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);
    }
    const quarter = hsCodeOverallQuarters[hsCodeOverallCountQuarterIndex];
    if (!quarter) return [];
    return hsCodeMapOverallQuarterly
      .filter((item) => item.year === quarter.year && item.quarter === quarter.quarter)
      .map((item) => ({
        countryCode: item.hsCode,
        countryName: `HS ${item.hsCode}`,
        value: item.tradeCount,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [activeView, hsCodeMapOverallQuarterly, hsCodeMapOverallTotals, hsCodeOverallCountQuarterIndex, hsCodeOverallCountQuarterPlaying, hsCodeOverallQuarters]);

  const topCategoriesByHSCodeOverallValue = useMemo(() => {
    if (activeView !== 'map-hscode') return [];
    if (!hsCodeOverallValueQuarterPlaying || hsCodeOverallQuarters.length === 0) {
      return hsCodeMapOverallTotals
        .map((item) => ({
          countryCode: item.hsCode,
          countryName: `HS ${item.hsCode}`,
          value: item.sumOfUsd,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);
    }
    const quarter = hsCodeOverallQuarters[hsCodeOverallValueQuarterIndex];
    if (!quarter) return [];
    return hsCodeMapOverallQuarterly
      .filter((item) => item.year === quarter.year && item.quarter === quarter.quarter)
      .map((item) => ({
        countryCode: item.hsCode,
        countryName: `HS ${item.hsCode}`,
        value: item.sumOfUsd,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [activeView, hsCodeMapOverallQuarterly, hsCodeMapOverallTotals, hsCodeOverallQuarters, hsCodeOverallValueQuarterIndex, hsCodeOverallValueQuarterPlaying]);

  const topCountriesByCountryMapValue = useMemo(() => {
    if (activeView !== 'map-country') return [];
    return buildTopCountries(filteredShipmentsForCurrentMap, mapCountryFilters.tradeDirection || 'import', 'tradeValue');
  }, [activeView, buildTopCountries, filteredShipmentsForCurrentMap, mapCountryFilters.tradeDirection]);

  const topCountriesByCountryMapCount = useMemo(() => {
    if (activeView !== 'map-country') return [];
    return buildTopCountries(filteredShipmentsForCurrentMap, mapCountryFilters.tradeDirection || 'import', 'tradeCount');
  }, [activeView, buildTopCountries, filteredShipmentsForCurrentMap, mapCountryFilters.tradeDirection]);

  const formatQuarterLabel = useCallback((year: number, quarter: number) => {
    const quarterRange = quarter === 1 ? '1-3' : quarter === 2 ? '4-6' : quarter === 3 ? '7-9' : '10-12';
    return `${year} (${quarterRange})`;
  }, []);

  const buildQuarterKey = useCallback((year: number, quarter: number) => `${year}-Q${quarter}`, []);

  const countryOverallQuarters = useMemo(() => {
    const quarterSet = new Map<string, { year: number; quarter: number; label: string }>();
    [...countryOverallQuarterlyValue, ...countryOverallQuarterlyCount].forEach((item) => {
      const key = buildQuarterKey(item.year, item.quarter);
      if (!quarterSet.has(key)) {
        quarterSet.set(key, {
          year: item.year,
          quarter: item.quarter,
          label: formatQuarterLabel(item.year, item.quarter),
        });
      }
    });
    return Array.from(quarterSet.values()).sort((a, b) => (a.year === b.year ? a.quarter - b.quarter : a.year - b.year));
  }, [buildQuarterKey, countryOverallQuarterlyCount, countryOverallQuarterlyValue, formatQuarterLabel]);

  useEffect(() => {
    if (countryOverallQuarters.length === 0) {
      setCountryOverallValueQuarterIndex(0);
      setCountryOverallCountQuarterIndex(0);
      return;
    }
    if (countryOverallValueQuarterIndex >= countryOverallQuarters.length) {
      setCountryOverallValueQuarterIndex(0);
    }
    if (countryOverallCountQuarterIndex >= countryOverallQuarters.length) {
      setCountryOverallCountQuarterIndex(0);
    }
  }, [countryOverallValueQuarterIndex, countryOverallCountQuarterIndex, countryOverallQuarters.length]);

  useEffect(() => {
    if (!countryOverallValueQuarterPlaying || countryOverallValueQuarterPaused || countryOverallQuarters.length === 0) return;
    const timer = window.setInterval(() => {
      setCountryOverallValueQuarterIndex((prev) => (prev + 1) % countryOverallQuarters.length);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [countryOverallValueQuarterPlaying, countryOverallValueQuarterPaused, countryOverallQuarters.length]);

  useEffect(() => {
    if (!countryOverallCountQuarterPlaying || countryOverallCountQuarterPaused || countryOverallQuarters.length === 0) return;
    const timer = window.setInterval(() => {
      setCountryOverallCountQuarterIndex((prev) => (prev + 1) % countryOverallQuarters.length);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [countryOverallCountQuarterPlaying, countryOverallCountQuarterPaused, countryOverallQuarters.length]);

  const topCountriesByCountryOverallValue = useMemo(() => {
    if (!countryOverallValueQuarterPlaying || countryOverallQuarters.length === 0) {
      return countryOverallTotalValueTop;
    }
    const quarter = countryOverallQuarters[countryOverallValueQuarterIndex];
    if (!quarter) return countryOverallTotalValueTop;
    return countryOverallQuarterlyValue
      .filter((item) => item.year === quarter.year && item.quarter === quarter.quarter)
      .map((item) => ({
        countryCode: item.countryCode,
        countryName: countryCodeToNameMap.get(item.countryCode) || item.countryCode,
        value: item.sumOfUsd,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [countryCodeToNameMap, countryOverallQuarters, countryOverallQuarterlyValue, countryOverallTotalValueTop, countryOverallValueQuarterIndex, countryOverallValueQuarterPlaying]);

  const topCountriesByCountryOverallCount = useMemo(() => {
    if (!countryOverallCountQuarterPlaying || countryOverallQuarters.length === 0) {
      return countryOverallTotalCountTop;
    }
    const quarter = countryOverallQuarters[countryOverallCountQuarterIndex];
    if (!quarter) return countryOverallTotalCountTop;
    return countryOverallQuarterlyCount
      .filter((item) => item.year === quarter.year && item.quarter === quarter.quarter)
      .map((item) => ({
        countryCode: item.countryCode,
        countryName: countryCodeToNameMap.get(item.countryCode) || item.countryCode,
        value: item.tradeCount,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [countryCodeToNameMap, countryOverallCountQuarterIndex, countryOverallCountQuarterPlaying, countryOverallQuarterlyCount, countryOverallQuarters, countryOverallTotalCountTop]);

  useEffect(() => {
    if (activeView !== 'map-country') return;
    countryOverallAbortRef.current?.abort();
    const controller = new AbortController();
    countryOverallAbortRef.current = controller;

    const loadOverallCountryStats = async () => {
      try {
        const baseFilters = {
          tradeDirection: mapCountryFilters.tradeDirection || 'import',
          startYearMonth: mapCountryFilters.startDate,
          endYearMonth: mapCountryFilters.endDate,
          limit: 10,
        } as const;
        const [totalValueTop, totalCountTop, quarterlyValue, quarterlyCount] = await Promise.all([
          countryTradeStatsAPI.getTopCountries({
            ...baseFilters,
            metric: 'trade_value',
          }),
          countryTradeStatsAPI.getTopCountries({
            ...baseFilters,
            metric: 'trade_count',
          }),
          countryTradeStatsAPI.getTopCountriesQuarterly({
            ...baseFilters,
            metric: 'trade_value',
          }),
          countryTradeStatsAPI.getTopCountriesQuarterly({
            ...baseFilters,
            metric: 'trade_count',
          }),
        ]);
        if (!controller.signal.aborted) {
          setCountryOverallTotalValueTop(totalValueTop.map((item) => ({
            countryCode: item.countryCode,
            countryName: countryCodeToNameMap.get(item.countryCode) || item.countryCode,
            value: item.sumOfUsd,
          })));
          setCountryOverallTotalCountTop(totalCountTop.map((item) => ({
            countryCode: item.countryCode,
            countryName: countryCodeToNameMap.get(item.countryCode) || item.countryCode,
            value: item.tradeCount,
          })));
          setCountryOverallQuarterlyValue(quarterlyValue);
          setCountryOverallQuarterlyCount(quarterlyCount);
        }
      } catch (error: any) {
        if (error?.name === 'AbortError') return;
        logger.error('Failed to load overall country rankings data:', error);
      }
    };

    loadOverallCountryStats();
    return () => controller.abort();
  }, [activeView, mapCountryFilters.startDate, mapCountryFilters.endDate, mapCountryFilters.tradeDirection, countryCodeToNameMap]);

  const countryTradeQuarters = useMemo(() => {
    const quarterSet = new Map<string, { year: number; quarter: number; label: string; months: number[] }>();
    countryTradeStats.forEach((item) => {
      const quarter = Math.floor((item.month - 1) / 3) + 1;
      const key = `${item.year}-Q${quarter}`;
      if (!quarterSet.has(key)) {
        const months = quarter === 1 ? [1, 2, 3] : quarter === 2 ? [4, 5, 6] : quarter === 3 ? [7, 8, 9] : [10, 11, 12];
        const quarterRange = quarter === 1 ? '1-3' : quarter === 2 ? '4-6' : quarter === 3 ? '7-9' : '10-12';
        quarterSet.set(key, {
          year: item.year,
          quarter,
          months,
          label: `${item.year} (${quarterRange})`,
        });
      }
    });
    return Array.from(quarterSet.values()).sort((a, b) => (a.year === b.year ? a.quarter - b.quarter : a.year - b.year));
  }, [countryTradeStats]);

  useEffect(() => {
    if (!countryMapYearPlaying || countryMapQuarterPaused || countryTradeQuarters.length === 0) return;
    const timer = window.setInterval(() => {
      setCountryMapYearIndex((prev) => (prev + 1) % countryTradeQuarters.length);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [countryMapYearPlaying, countryMapQuarterPaused, countryTradeQuarters.length]);

  const displayedCountryTradeStats = useMemo(() => {
    if (!countryMapYearPlaying || countryTradeQuarters.length === 0) return countryTradeStats;
    const quarter = countryTradeQuarters[countryMapYearIndex];
    if (!quarter) return countryTradeStats;
    return countryTradeStats.filter(
      (item) => item.year === quarter.year && quarter.months.includes(item.month)
    );
  }, [countryMapYearPlaying, countryTradeQuarters, countryMapYearIndex, countryTradeStats]);

  const displayedCountryTradeSummary = useMemo(() => {
    if (!countryTradeSummary) return null;
    if (!countryMapYearPlaying) return countryTradeSummary;

    const statsForYear = displayedCountryTradeStats;
    const totalCountries = new Set(statsForYear.map((s) => s.countryCode)).size;
    const totalTradeValue = statsForYear.reduce((acc, s) => acc + s.sumOfUsd, 0);
    const totalTradeCount = statsForYear.reduce((acc, s) => acc + s.tradeCount, 0);

    return {
      totalCountries,
      totalTradeValue,
      totalTradeCount,
      avgSharePct: 0,
    };
  }, [countryMapYearPlaying, countryTradeSummary, displayedCountryTradeStats]);

  const lazyFallback = (
    <div className="h-full flex items-center justify-center text-sm text-[#86868B]">
      Loading visualization...
    </div>
  );

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
        <aside className="w-[280px] border-r border-black/5 bg-white flex flex-col p-5 gap-8 overflow-visible self-start">
           <div className="flex flex-col gap-1.5">
             <button 
               onClick={() => setActiveView('global-stats')}
               className={`flex items-center justify-between px-4 py-3 rounded-[12px] transition-all text-[14px] font-semibold ${activeView === 'global-stats' ? 'bg-[#007AFF] text-white shadow-lg shadow-blue-500/20' : 'text-[#86868B] hover:bg-black/5'}`}
             >
              <div className="flex items-center gap-3 min-w-0">
                 <Globe className="w-4 h-4" />
                <span className="whitespace-nowrap">{t('countryTrade.title')}</span>
               </div>
               {activeView === 'global-stats' && <ChevronRight className="w-3.5 h-3.5" />}
             </button>
             <button 
               onClick={() => setActiveView('map-country')}
               className={`flex items-center justify-between px-4 py-3 rounded-[12px] transition-all text-[14px] font-semibold ${activeView === 'map-country' ? 'bg-[#007AFF] text-white shadow-lg shadow-blue-500/20' : 'text-[#86868B] hover:bg-black/5'}`}
             >
              <div className="flex items-center gap-3 min-w-0">
                 <MapIcon className="w-4 h-4" />
                <span className="whitespace-nowrap">Trade Map by Country</span>
               </div>
               {activeView === 'map-country' && <ChevronRight className="w-3.5 h-3.5" />}
             </button>
             <button 
               onClick={() => setActiveView('map-hscode')}
               className={`flex items-center justify-between px-4 py-3 rounded-[12px] transition-all text-[14px] font-semibold ${activeView === 'map-hscode' ? 'bg-[#007AFF] text-white shadow-lg shadow-blue-500/20' : 'text-[#86868B] hover:bg-black/5'}`}
             >
              <div className="flex items-center gap-3 min-w-0">
                 <Package className="w-4 h-4" />
                <span className="whitespace-nowrap">Trade Map by HSCode</span>
               </div>
               {activeView === 'map-hscode' && <ChevronRight className="w-3.5 h-3.5" />}
             </button>
             <button
               onClick={() => setActiveView('company-dashboard')}
               className={`flex items-center justify-between px-4 py-3 rounded-[12px] transition-all text-[14px] font-semibold ${activeView === 'company-dashboard' ? 'bg-[#007AFF] text-white shadow-lg shadow-blue-500/20' : 'text-[#86868B] hover:bg-black/5'}`}
             >
               <div className="flex items-center gap-3 min-w-0">
                 <Building2 className="w-4 h-4" />
                 <span className="whitespace-nowrap">Company Dashboard</span>
               </div>
               {activeView === 'company-dashboard' && <ChevronRight className="w-3.5 h-3.5" />}
             </button>
           </div>

          <div className="h-[0.5px] bg-black/5"></div>
          {activeView === 'global-stats' ? (
            <CountryTradeSidebar
              filters={countryTradeFilters}
              setFilters={setCountryTradeFilters}
            />
          ) : activeView === 'map-country' ? (
            <SidebarFilters 
              filters={mapCountryFilters} 
              setFilters={setMapCountryFilters}
              hsCodeCategories={hsCodeCategories}
              availableHSCodes={availableHSCodes}
              countries={countries}
              shipments={shipments}
              mode="country"
            />
          ) : activeView === 'map-hscode' ? (
            <SidebarFilters 
              filters={mapHsFilters} 
              setFilters={setMapHsFilters}
              hsCodeCategories={hsCodeCategories}
              availableHSCodes={availableHSCodes}
              countries={countries}
              shipments={shipments}
              mode="hscode"
            />
          ) : (
            <CompanyDashboardSidebar
              filters={companyDashboardFilters}
              setFilters={setCompanyDashboardFilters}
            />
          )}
          
          {activeView === 'map-country' && (
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
          <Suspense fallback={lazyFallback}>
          {activeView === 'map-country' || activeView === 'map-hscode' ? (
            <div className="flex flex-col gap-6 pr-4">
              {/* 地图内容 */}
              {initialLoading ? (
                <div className="flex items-center justify-center h-[600px] bg-white/80 backdrop-blur-sm z-10 rounded-[28px] border border-black/5">
                  <div className="w-10 h-10 rounded-full border-2 border-[#D1D1D6] border-t-[#007AFF] animate-spin" />
                </div>
              ) : (
                <>
                  {activeView === 'map-country' ? (
                    <>
                      <div className="mb-4">
                        <h2 className="text-[32px] font-bold tracking-tight text-[#1D1D1F]">Trade Map by Country</h2>
                        <p className="text-[#86868B] text-[16px] font-medium mt-1">
                          Country-level trade flow analysis
                        </p>
                      </div>
                      <div className="bg-white border border-black/5 rounded-[28px] p-6 shadow-sm h-[640px] overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-[18px] font-bold text-[#1D1D1F]">Country Trade Flow Map</h3>
                        </div>
                        <div className="h-[540px]">
                          <SupplyMap 
                            shipments={shipmentsForMap}
                            transactions={[]}
                            selectedCountries={currentMapFilters.selectedCountries}
                            countries={countries}
                            companies={[]}
                            categories={[]}
                            filters={currentMapFilters}
                            isPreview={isInteracting}
                          />
                        </div>
                      </div>
                      <div className="space-y-6">
                        <div>
                          <div className="text-[12px] font-bold uppercase tracking-widest text-[#86868B] mb-3">
                            Selected Rankings
                          </div>
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            <TopCountriesHorizontalBar
                              title="Selected Trade Value Ranking"
                              data={topCountriesByCountryMapValue}
                              valueFormatter={(value) => `$${(value / 1000000000).toFixed(2)}B`}
                              barColor="#007AFF"
                              metaLines={[
                                `Time: ${mapCountryFilters.startDate} ~ ${mapCountryFilters.endDate}`,
                                `Direction: ${mapCountryFilters.tradeDirection === 'import' ? 'Import' : 'Export'}`,
                              ]}
                            />
                            <TopCountriesHorizontalBar
                              title="Selected Trade Amount Ranking"
                              data={topCountriesByCountryMapCount}
                              valueFormatter={(value) => Math.round(value).toLocaleString()}
                              barColor="#34C759"
                              metaLines={[
                                `Time: ${mapCountryFilters.startDate} ~ ${mapCountryFilters.endDate}`,
                                `Direction: ${mapCountryFilters.tradeDirection === 'import' ? 'Import' : 'Export'}`,
                              ]}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="text-[12px] font-bold uppercase tracking-widest text-[#86868B] mb-3">
                            Overall Rankings
                          </div>
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            <TopCountriesHorizontalBar
                              title="Overall Top 10 Trade Value Ranking"
                              data={topCountriesByCountryOverallValue}
                              valueFormatter={(value) => `$${(value / 1000000000).toFixed(2)}B`}
                              barColor="#5856D6"
                              headerActions={
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setCountryOverallValueQuarterPaused((prev) => !prev)}
                                    disabled={!countryOverallValueQuarterPlaying}
                                    className={`text-[11px] px-3 py-1.5 rounded-full border font-semibold ${
                                      countryOverallValueQuarterPlaying
                                        ? 'border-black/10 text-[#1D1D1F] hover:bg-[#F5F5F7]'
                                        : 'border-black/10 text-[#B0B0B5] cursor-not-allowed'
                                    }`}
                                  >
                                    {countryOverallValueQuarterPaused ? 'Continue' : 'Pause'}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setCountryOverallValueQuarterPlaying((prev) => {
                                        const next = !prev;
                                        if (next) setCountryOverallValueQuarterPaused(false);
                                        return next;
                                      });
                                    }}
                                    className="text-[11px] px-3 py-1.5 rounded-full border border-black/10 text-[#007AFF] hover:bg-[#F5F5F7] font-semibold"
                                  >
                                    {countryOverallValueQuarterPlaying ? 'Show Total' : 'Play by Quarter'}
                                  </button>
                                </div>
                              }
                              headerSubtext={
                                countryOverallValueQuarterPlaying && countryOverallQuarters.length > 0
                                  ? `Playing quarter: ${countryOverallQuarters[countryOverallValueQuarterIndex]?.label || ''}`
                                  : 'Total within selected filter range'
                              }
                              metaLines={[
                                `Time: ${countryOverallValueQuarterPlaying && countryOverallQuarters.length > 0 ? countryOverallQuarters[countryOverallValueQuarterIndex]?.label || '' : `${mapCountryFilters.startDate} ~ ${mapCountryFilters.endDate}`}`,
                                `Direction: ${mapCountryFilters.tradeDirection === 'import' ? 'Import' : 'Export'}`,
                              ]}
                            />
                            <TopCountriesHorizontalBar
                              title="Overall Top 10 Trade Amount Ranking"
                              data={topCountriesByCountryOverallCount}
                              valueFormatter={(value) => Math.round(value).toLocaleString()}
                              barColor="#FF9500"
                              headerActions={
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setCountryOverallCountQuarterPaused((prev) => !prev)}
                                    disabled={!countryOverallCountQuarterPlaying}
                                    className={`text-[11px] px-3 py-1.5 rounded-full border font-semibold ${
                                      countryOverallCountQuarterPlaying
                                        ? 'border-black/10 text-[#1D1D1F] hover:bg-[#F5F5F7]'
                                        : 'border-black/10 text-[#B0B0B5] cursor-not-allowed'
                                    }`}
                                  >
                                    {countryOverallCountQuarterPaused ? 'Continue' : 'Pause'}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setCountryOverallCountQuarterPlaying((prev) => {
                                        const next = !prev;
                                        if (next) setCountryOverallCountQuarterPaused(false);
                                        return next;
                                      });
                                    }}
                                    className="text-[11px] px-3 py-1.5 rounded-full border border-black/10 text-[#007AFF] hover:bg-[#F5F5F7] font-semibold"
                                  >
                                    {countryOverallCountQuarterPlaying ? 'Show Total' : 'Play by Quarter'}
                                  </button>
                                </div>
                              }
                              headerSubtext={
                                countryOverallCountQuarterPlaying && countryOverallQuarters.length > 0
                                  ? `Playing quarter: ${countryOverallQuarters[countryOverallCountQuarterIndex]?.label || ''}`
                                  : 'Total within selected filter range'
                              }
                              metaLines={[
                                `Time: ${countryOverallCountQuarterPlaying && countryOverallQuarters.length > 0 ? countryOverallQuarters[countryOverallCountQuarterIndex]?.label || '' : `${mapCountryFilters.startDate} ~ ${mapCountryFilters.endDate}`}`,
                                `Direction: ${mapCountryFilters.tradeDirection === 'import' ? 'Import' : 'Export'}`,
                              ]}
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-white border border-black/5 rounded-[28px] p-6 shadow-sm h-[630px] overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-[18px] font-bold text-[#1D1D1F]">Trade Map by HSCode</h3>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setHsCodeMapQuarterPaused((prev) => !prev)}
                              disabled={!hsCodeMapQuarterPlaying}
                              className={`text-[11px] px-3 py-1.5 rounded-full border font-semibold ${
                                hsCodeMapQuarterPlaying
                                  ? 'border-black/10 text-[#1D1D1F] hover:bg-[#F5F5F7]'
                                  : 'border-black/10 text-[#B0B0B5] cursor-not-allowed'
                              }`}
                            >
                              {hsCodeMapQuarterPaused ? 'Continue' : 'Pause'}
                            </button>
                            <button
                              onClick={() => {
                                setHsCodeMapQuarterPlaying((prev) => {
                                  const next = !prev;
                                  if (next) setHsCodeMapQuarterPaused(false);
                                  return next;
                                });
                              }}
                              className="text-[11px] px-3 py-1.5 rounded-full border border-black/10 text-[#007AFF] hover:bg-[#F5F5F7] font-semibold"
                            >
                              {hsCodeMapQuarterPlaying ? 'Show Total' : 'Play by Quarter'}
                            </button>
                          </div>
                        </div>
                        <p className="text-[11px] text-[#86868B] mb-3">
                          {hsCodeMapQuarterPlaying && hsCodeMapQuarters.length > 0
                            ? `Playing quarter: ${hsCodeMapQuarters[hsCodeMapQuarterIndex]?.label || ''}`
                            : 'Total within selected filter range'}
                        </p>
                        <div className="h-[510px] pb-5 relative">
                          <div className="absolute left-3 top-3 z-30 w-fit">
                            <div className="bg-white border border-black/10 rounded-[14px] shadow-md px-4 py-3 text-[11px] text-[#1D1D1F]">
                              <div className="text-[10px] uppercase tracking-wider text-[#86868B] font-bold mb-1 flex items-center gap-1.5">
                                <Filter className="w-3.5 h-3.5" />
                                Filter Control
                              </div>
                              <div><span className="text-[#86868B]">Time:</span> {hsCodeMapFilterSummary.time}</div>
                              <div><span className="text-[#86868B]">Direction:</span> {hsCodeMapFilterSummary.direction}</div>
                              <div className="max-w-[340px] truncate"><span className="text-[#86868B]">HS Code:</span> {hsCodeMapFilterSummary.hsCodes}</div>
                            </div>
                          </div>
                          <div className="absolute inset-0">
                            <CountryTradeMap
                              stats={displayedHsCodeMapStats}
                              countries={countries}
                              selectedHSCodes={[]}
                              colorMetric="tradeCount"
                            />
                            {hsCodeMapQuarterPlaying && hsCodeMapQuarters.length > 0 && (
                              <div className="absolute left-5 bottom-4 pointer-events-none">
                                <div className="text-[72px] font-black text-[#1D1D1F]/20 tracking-wide select-none leading-none">
                                  {hsCodeMapQuarters[hsCodeMapQuarterIndex]?.label}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="text-[12px] font-bold uppercase tracking-widest text-[#86868B] mb-3">
                          Overall Rankings
                        </div>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                          <TopCountriesHorizontalBar
                            title="Overall Top 10 Categories by Trade Amount"
                            data={topCategoriesByHSCodeOverallCount}
                            valueFormatter={(value) => Math.round(value).toLocaleString()}
                            barColor="#34C759"
                            headerActions={
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setHsCodeOverallCountQuarterPaused((prev) => !prev)}
                                  disabled={!hsCodeOverallCountQuarterPlaying}
                                  className={`text-[11px] px-3 py-1.5 rounded-full border font-semibold ${
                                    hsCodeOverallCountQuarterPlaying
                                      ? 'border-black/10 text-[#1D1D1F] hover:bg-[#F5F5F7]'
                                      : 'border-black/10 text-[#B0B0B5] cursor-not-allowed'
                                  }`}
                                >
                                  {hsCodeOverallCountQuarterPaused ? 'Continue' : 'Pause'}
                                </button>
                                <button
                                  onClick={() => {
                                    setHsCodeOverallCountQuarterPlaying((prev) => {
                                      const next = !prev;
                                      if (next) setHsCodeOverallCountQuarterPaused(false);
                                      return next;
                                    });
                                  }}
                                  className="text-[11px] px-3 py-1.5 rounded-full border border-black/10 text-[#007AFF] hover:bg-[#F5F5F7] font-semibold"
                                >
                                  {hsCodeOverallCountQuarterPlaying ? 'Show Total' : 'Play by Quarter'}
                                </button>
                              </div>
                            }
                            headerSubtext={
                              hsCodeOverallCountQuarterPlaying && hsCodeOverallQuarters.length > 0
                                ? `Playing quarter: ${hsCodeOverallQuarters[hsCodeOverallCountQuarterIndex]?.label || ''}`
                                : 'Total within selected filter range'
                            }
                            metaLines={[
                              `Time: ${hsCodeOverallCountQuarterPlaying && hsCodeOverallQuarters.length > 0 ? hsCodeOverallQuarters[hsCodeOverallCountQuarterIndex]?.label || '' : hsCodeMapFilterSummary.time}`,
                              `Direction: ${hsCodeMapFilterSummary.direction}`,
                              'HS Code: All',
                            ]}
                          />
                          <TopCountriesHorizontalBar
                            title="Overall Top 10 Categories by Trade Value"
                            data={topCategoriesByHSCodeOverallValue}
                            valueFormatter={(value) => `$${(value / 1000000000).toFixed(2)}B`}
                            barColor="#FF9500"
                            headerActions={
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setHsCodeOverallValueQuarterPaused((prev) => !prev)}
                                  disabled={!hsCodeOverallValueQuarterPlaying}
                                  className={`text-[11px] px-3 py-1.5 rounded-full border font-semibold ${
                                    hsCodeOverallValueQuarterPlaying
                                      ? 'border-black/10 text-[#1D1D1F] hover:bg-[#F5F5F7]'
                                      : 'border-black/10 text-[#B0B0B5] cursor-not-allowed'
                                  }`}
                                >
                                  {hsCodeOverallValueQuarterPaused ? 'Continue' : 'Pause'}
                                </button>
                                <button
                                  onClick={() => {
                                    setHsCodeOverallValueQuarterPlaying((prev) => {
                                      const next = !prev;
                                      if (next) setHsCodeOverallValueQuarterPaused(false);
                                      return next;
                                    });
                                  }}
                                  className="text-[11px] px-3 py-1.5 rounded-full border border-black/10 text-[#007AFF] hover:bg-[#F5F5F7] font-semibold"
                                >
                                  {hsCodeOverallValueQuarterPlaying ? 'Show Total' : 'Play by Quarter'}
                                </button>
                              </div>
                            }
                            headerSubtext={
                              hsCodeOverallValueQuarterPlaying && hsCodeOverallQuarters.length > 0
                                ? `Playing quarter: ${hsCodeOverallQuarters[hsCodeOverallValueQuarterIndex]?.label || ''}`
                                : 'Total within selected filter range'
                            }
                            metaLines={[
                              `Time: ${hsCodeOverallValueQuarterPlaying && hsCodeOverallQuarters.length > 0 ? hsCodeOverallQuarters[hsCodeOverallValueQuarterIndex]?.label || '' : hsCodeMapFilterSummary.time}`,
                              `Direction: ${hsCodeMapFilterSummary.direction}`,
                              'HS Code: All',
                            ]}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          ) : activeView === 'global-stats' ? (
            <div className="flex flex-col gap-6 pr-4">
              <div className="mb-4">
                <h2 className="text-[32px] font-bold tracking-tight text-[#1D1D1F]">Global Statistics</h2>
                <p className="text-[#86868B] text-[16px] font-medium mt-1">{t('countryTrade.subtitle')}</p>
              </div>

              <>
                <div className="bg-white border border-black/5 rounded-[28px] p-6 shadow-sm h-[600px] overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[18px] font-bold text-[#1D1D1F]">{t('countryTrade.tradeMap')}</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCountryMapQuarterPaused((prev) => !prev)}
                        disabled={!countryMapYearPlaying}
                        className={`text-[11px] px-3 py-1.5 rounded-full border font-semibold ${
                          countryMapYearPlaying
                            ? 'border-black/10 text-[#1D1D1F] hover:bg-[#F5F5F7]'
                            : 'border-black/10 text-[#B0B0B5] cursor-not-allowed'
                        }`}
                      >
                        {countryMapQuarterPaused ? 'Continue' : 'Pause'}
                      </button>
                      <button
                        onClick={() => {
                          setCountryMapYearPlaying((prev) => {
                            const next = !prev;
                            if (next) setCountryMapQuarterPaused(false);
                            return next;
                          });
                        }}
                        className="text-[11px] px-3 py-1.5 rounded-full border border-black/10 text-[#007AFF] hover:bg-[#F5F5F7] font-semibold"
                      >
                        {countryMapYearPlaying ? (t('countryTrade.showTotal') || 'Show Total') : 'Play by Quarter'}
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-[#86868B] mb-3">
                    {countryMapYearPlaying && countryTradeQuarters.length > 0
                      ? `Playing quarter: ${countryTradeQuarters[countryMapYearIndex]?.label || ''}`
                      : (t('countryTrade.totalWithinSelection') || 'Total within selected filter range')}
                  </p>
                  <div className="h-[510px] pb-5 relative">
                      <div className="absolute inset-x-0 top-0 bottom-5">
                        <CountryTradeMap
                          stats={displayedCountryTradeStats}
                          countries={countries}
                          selectedHSCodes={countryTradeFilters.hsCode}
                        />
                        {countryMapYearPlaying && countryTradeQuarters.length > 0 && (
                          <div className="absolute left-5 bottom-4 pointer-events-none">
                            <div className="text-[72px] font-black text-[#1D1D1F]/20 tracking-wide select-none leading-none">
                              {countryTradeQuarters[countryMapYearIndex]?.label}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                {displayedCountryTradeSummary !== null && (
                  <CountryTradeStatsPanel
                    stats={countryTradeStats}
                    summary={displayedCountryTradeSummary}
                    trends={countryTradeTrends}
                    topCountries={topCountries}
                    topCountriesQuarterly={topCountriesQuarterly}
                  />
                )}
                </>
            </div>
          ) : (
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
          ) : activeView === 'company-dashboard' ? (
            <CompanyDashboard
              startDate={companyDashboardFilters.startDate}
              endDate={companyDashboardFilters.endDate}
            />
          ) : null}
          </Suspense>

        </section>
      </main>

      {((activeView === 'map-country' && filterLoading) || (activeView === 'map-hscode' && hsCodeMapLoading) || (activeView === 'global-stats' && countryTradeLoading)) && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 rounded-full border-[3px] border-[#D1D1D6] border-t-[#007AFF] animate-spin bg-white/40 backdrop-blur-[1px]" />
        </div>
      )}

      {/* AI 助手 */}
      <Suspense fallback={null}>
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
      </Suspense>
    </div>
  );
};

export default App;
