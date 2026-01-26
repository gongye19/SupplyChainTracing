
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import SupplyMap from './components/SupplyMap';
import StatsPanel from './components/StatsPanel';
import SidebarFilters from './components/SidebarFilters';
import AIAssistant from './components/AIAssistant';
import { Transaction, Filters, HSCodeCategory, CountryLocation, Location, Shipment } from './types';
import { shipmentsAPI, hsCodeCategoriesAPI, countryLocationsAPI, chatAPI, ChatMessage } from './services/api';
import { Globe, BarChart3, Map as MapIcon, Package, TrendingUp, Users, ChevronRight } from 'lucide-react';
import { useLanguage } from './contexts/LanguageContext';
import { getHSCodeColorCached } from './utils/hsCodeColors';

const App: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  const [activeView, setActiveView] = useState<'map' | 'stats'>('map');
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const startDate = '2003-01';
  const endDate = `${currentYear}-${currentMonth}`; // YYYY-MM

  const [filters, setFilters] = useState<Filters>({
    startDate,
    endDate,
    selectedCountries: [],
    selectedHSCodeCategories: [],
    selectedHSCodeSubcategories: [],
    selectedCompanies: []
  });

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
  
  // Refs for preview/final scheduling
  const filtersRef = useRef(filters);
  useEffect(() => { filtersRef.current = filters; }, [filters]);
  const abortRef = useRef<AbortController | null>(null);
  const finalTimerRef = useRef<number | null>(null);
  // 标记是否正在拖动（用于时间滑块）
  const isDraggingRef = useRef<boolean>(false);

  // 加载初始数据
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setInitialLoading(true);
        console.log('Loading HS Code categories, countries, companies...');
        const [hsCodeCatsData, locationsData, allShipmentsData] = await Promise.all([
          hsCodeCategoriesAPI.getAll(),
          countryLocationsAPI.getAll(),
          // 获取所有公司（不带任何筛选，只获取公司列表）
          shipmentsAPI.getAll({ startDate: '2003-01', endDate: '2099-12' })
        ]);
        console.log('HS Code Categories loaded:', hsCodeCatsData);
        console.log('Countries loaded:', locationsData);
        setHsCodeCategories(hsCodeCatsData);
        // 将 Location 转换为 CountryLocation 格式
        const countriesData: CountryLocation[] = locationsData.map(loc => ({
          countryCode: loc.countryCode,
          countryName: loc.countryName,
          capitalLat: loc.latitude,
          capitalLng: loc.longitude,
          region: loc.region,
          continent: loc.continent
        }));
        setCountries(countriesData);
        
        // 从所有数据中提取公司列表（保持不变，不受筛选影响）
        const allCompanies = new Set<string>();
        allShipmentsData.forEach(s => {
          allCompanies.add(s.exporterName);
          allCompanies.add(s.importerName);
        });
        setCompanies(Array.from(allCompanies).sort());
        console.log('All companies loaded:', Array.from(allCompanies).sort());
      } catch (error) {
        console.error('Failed to load initial data:', error);
        alert(t('app.loadDataError') + (error as Error).message);
      } finally {
        setInitialLoading(false);
      }
    };
    loadInitialData();
  }, []);

  // 国家名称到国家代码的映射函数
  const getCountryCode = useCallback((countryName: string): string => {
    if (!countryName) return '';
    
    // 特殊映射（处理数据中的特殊情况）
    const specialMappings: Record<string, string> = {
      'Dubai': 'AE',
      'United Arab Emirates': 'AE',
      'UAE': 'AE',
    };
    
    if (specialMappings[countryName]) {
      return specialMappings[countryName];
    }
    
    // 从 countries 列表中查找匹配的国家
    const country = countries.find(c => 
      c.countryName.toLowerCase() === countryName.toLowerCase() ||
      c.countryName === countryName
    );
    
    return country?.countryCode || countryName; // 如果找不到，返回原名称（作为后备）
  }, [countries]);

  // 加载原始交易数据
  const loadShipments = useCallback(async (filtersToUse: Filters, mode: 'preview' | 'final') => {
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

      console.log(`Loading shipments (${mode}) with filters:`, filtersToUse);
      if (filtersToUse.selectedHSCodeSubcategories?.length > 0) {
        console.log(`  - HS Code 大类:`, filtersToUse.selectedHSCodeCategories);
        console.log(`  - HS Code 小类:`, filtersToUse.selectedHSCodeSubcategories);
      }
      const startTime = performance.now();
      const data = await shipmentsAPI.getAll(filtersToUse);
      const duration = performance.now() - startTime;

      if (controller.signal.aborted) {
        if (loadingTimer) window.clearTimeout(loadingTimer);
        return;
      }

      if (loadingTimer && duration < 100) {
        window.clearTimeout(loadingTimer);
      }

      console.log(`Shipments loaded (${mode}) in ${duration.toFixed(0)}ms:`, data.length);
      if (data.length > 0) {
        const hsCodes = new Set(data.map(s => s.hsCode).filter(Boolean));
        console.log(`  - 包含的 HS Codes:`, Array.from(hsCodes).sort());
      }
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
          const originCode = getCountryCode(s.countryOfOrigin);
          const destCode = getCountryCode(s.destinationCountry);
          const pair = `${originCode}-${destCode}`;
          countryPairs.add(pair);
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
      console.error('Failed to load shipments:', e);
      if (mode === 'final') {
        alert('无法加载数据。错误: ' + (e as Error).message);
      }
    } finally {
      if (mode === 'final' && !controller.signal.aborted) {
        setFilterLoading(false);
      }
    }
  }, [getCountryCode]);

  // 调度器：任何 filters 变化 => 立刻 preview + 延迟 final
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

  // 统一监听 filters 变化：触发 scheduleFetch
  useEffect(() => {
    if (hsCodeCategories.length === 0 || countries.length === 0) {
      return;
    }
    
    const reason: 'drag' | 'click' = isDraggingRef.current ? 'drag' : 'click';
    scheduleFetch(filters, reason);

    return () => {
      if (finalTimerRef.current) window.clearTimeout(finalTimerRef.current);
    };
  }, [filters, hsCodeCategories.length, countries.length, scheduleFetch]);

  // 将原始 shipments 按国家对聚合，转换为地图组件格式
  // 每个国家对（原产国 → 目的地国家）合并成一条线，顺序不能相反
  const shipmentsForMap = useMemo(() => {
    // 按国家对聚合所有交易
    const countryPairGroups = new Map<string, {
      originId: string;
      destinationId: string;
      shipments: Shipment[];
      totalValue: number;
      totalQuantity: number;
      hsCodes: Set<string>;
      companies: Set<string>; // 统计涉及的公司对
    }>();
    
    shipments.forEach(shipment => {
      const originCountryCode = getCountryCode(shipment.countryOfOrigin);
      const destinationCountryCode = getCountryCode(shipment.destinationCountry);
      // 使用原产国-目的地国家作为聚合键（顺序固定，不能相反）
      const pairKey = `${originCountryCode}-${destinationCountryCode}`;
      
      if (!countryPairGroups.has(pairKey)) {
        countryPairGroups.set(pairKey, {
          originId: originCountryCode,
          destinationId: destinationCountryCode,
          shipments: [],
          totalValue: 0,
          totalQuantity: 0,
          hsCodes: new Set(),
          companies: new Set()
        });
      }
      
      const group = countryPairGroups.get(pairKey)!;
      group.shipments.push(shipment);
      group.totalValue += shipment.totalValueUsd || 0;
      group.totalQuantity += shipment.quantity || 0;
      if (shipment.hsCode) {
        group.hsCodes.add(shipment.hsCode);
      }
      // 记录涉及的公司对
      group.companies.add(`${shipment.exporterName} → ${shipment.importerName}`);
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
      
      // 获取涉及的公司名称（用于显示）
      const companyNames = Array.from(group.companies);
      const exporterName = companyNames.length > 0 ? companyNames[0].split(' → ')[0] : '';
      const importerName = companyNames.length > 0 ? companyNames[0].split(' → ')[1] : '';
      
      return {
        id: `country-pair-${index}-${group.originId}-${group.destinationId}`,
        originId: group.originId,
        destinationId: group.destinationId,
        exporterCompanyName: exporterName, // 主要出口商（用于显示）
        importerCompanyName: importerName, // 主要进口商（用于显示）
        material: Array.from(group.hsCodes).join(','),
        category: hsCategory?.chapterName || 'Unknown',
        categoryColor,
        quantity: group.totalQuantity,
        value: group.totalValue / 1000000, // 转换为百万美元
        status: 'completed',
        timestamp: group.shipments[0]?.date || ''
      };
    });
  }, [shipments, hsCodeCategories, getCountryCode]);

  // 调试信息
  useEffect(() => {
    console.log('Shipments (raw):', shipments.length);
    console.log('Shipments for map (按国家对聚合):', shipmentsForMap.length);
    if (shipmentsForMap.length > 0) {
      console.log('  - 国家对:', shipmentsForMap.map(s => `${s.originId} → ${s.destinationId}`));
      console.log('  - 总价值:', shipmentsForMap.map(s => `$${s.value.toFixed(2)}M`));
    }
    console.log('Countries for map:', countries.length);
    console.log('HS Code Categories:', hsCodeCategories.length);
  }, [shipments, shipmentsForMap, countries, hsCodeCategories]);

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

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar - Narrowed from 300px to 250px */}
        <aside className="w-[250px] border-r border-black/5 bg-white flex flex-col p-5 gap-8 overflow-y-auto custom-scrollbar">
           <div className="flex flex-col gap-1.5">
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

           <SidebarFilters 
             filters={filters} 
             setFilters={setFilters}
             hsCodeCategories={hsCodeCategories}
             countries={countries}
             companies={companies}
             shipments={shipments}
           />
           
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
        </aside>

        {/* Main Content Area */}
        <section className="flex-1 flex flex-col p-6 relative">
          {activeView === 'map' ? (
            <div className="h-full flex flex-col relative">
              {/* 只在初始加载时显示 loading，筛选更新时不显示 */}
              {initialLoading ? (
                <div className="flex items-center justify-center h-full absolute inset-0 bg-white/80 backdrop-blur-sm z-10">
                  <div className="text-[#86868B]">{t('app.loading')}</div>
                </div>
              ) : (
                <>
                  {/* 筛选更新时的轻微提示（可选） */}
                  {filterLoading && (
                    <div className="absolute top-4 right-4 z-20 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs text-[#86868B] shadow-sm">
                      更新中...
                    </div>
                  )}
                  <SupplyMap 
                    shipments={shipmentsForMap}
                    transactions={[]}
                    selectedCountries={filters.selectedCountries}
                    countries={countries}
                    companies={[]}
                    categories={[]}
                    filters={filters}
                    isPreview={isInteracting}
                  />
                </>
              )}
            </div>
          ) : (
            <div className="h-full overflow-y-auto custom-scrollbar pr-4">
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
          )}
        </section>
      </main>

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
