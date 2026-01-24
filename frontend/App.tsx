
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import SupplyMap from './components/SupplyMap';
import StatsPanel from './components/StatsPanel';
import SidebarFilters from './components/SidebarFilters';
import AIAssistant from './components/AIAssistant';
import { Transaction, Filters, HSCodeCategory, CountryLocation, Location, MonthlyCompanyFlow } from './types';
import { monthlyCompanyFlowsAPI, hsCodeCategoriesAPI, countryLocationsAPI, chatAPI, ChatMessage } from './services/api';
import { Globe, BarChart3, Map as MapIcon, Package, TrendingUp, Users, ChevronRight } from 'lucide-react';
import { useLanguage } from './contexts/LanguageContext';

const App: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  const [activeView, setActiveView] = useState<'map' | 'stats'>('map');
  
  const now = new Date();
  const startYearMonth = '2003-01';
  const endYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [filters, setFilters] = useState<Filters>({
    startYearMonth,
    endYearMonth,
    selectedCountries: [],
    selectedHSCodeCategories: [],
    selectedCompanies: []
  });

  const [monthlyFlows, setMonthlyFlows] = useState<MonthlyCompanyFlow[]>([]);
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
        console.log('Loading HS Code categories, countries...');
        const [hsCodeCatsData, locationsData] = await Promise.all([
          hsCodeCategoriesAPI.getAll(),
          countryLocationsAPI.getAll()
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
      } catch (error) {
        console.error('Failed to load initial data:', error);
        alert(t('app.loadDataError') + (error as Error).message);
      } finally {
        setInitialLoading(false);
      }
    };
    loadInitialData();
  }, []);

  // 加载聚合数据
  const loadMonthlyFlows = useCallback(async (filtersToUse: Filters, mode: 'preview' | 'final') => {
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

      console.log(`Loading monthly flows (${mode}) with filters:`, filtersToUse);
      const startTime = performance.now();
      const flows = await monthlyCompanyFlowsAPI.getAll(filtersToUse);
      const duration = performance.now() - startTime;

      if (controller.signal.aborted) {
        if (loadingTimer) window.clearTimeout(loadingTimer);
        return;
      }

      if (loadingTimer && duration < 100) {
        window.clearTimeout(loadingTimer);
      }

      console.log(`Monthly flows loaded (${mode}) in ${duration.toFixed(0)}ms:`, flows.length);
      setMonthlyFlows(flows);
      
      // 提取唯一的公司名称
      const uniqueCompanies = new Set<string>();
      flows.forEach(f => {
        uniqueCompanies.add(f.exporterName);
        uniqueCompanies.add(f.importerName);
      });
      setCompanies(Array.from(uniqueCompanies).sort());
      
      // 更新统计
      if (mode === 'final') {
        const uniqueCountries = new Set<string>();
        flows.forEach(f => {
          uniqueCountries.add(f.originCountry);
          uniqueCountries.add(f.destinationCountry);
        });
        // 计算实际显示的shipments数量（不是transaction_count的总和）
        // Transaction Flow 应该显示实际显示的shipments数量
        setStats({
          transactions: flows.length, // 显示实际shipments数量，而不是transaction_count总和
          suppliers: uniqueCountries.size,
          categories: new Set(flows.map(f => {
            const firstHsCode = f.hsCodes?.split(',')[0]?.trim()?.slice(0, 2) || '';
            return firstHsCode;
          }).filter(code => code)).size
        });
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      console.error('Failed to load monthly flows:', e);
      if (mode === 'final') {
        alert('无法加载数据。错误: ' + (e as Error).message);
      }
    } finally {
      if (mode === 'final' && !controller.signal.aborted) {
        setFilterLoading(false);
      }
    }
  }, []);

  // 调度器：任何 filters 变化 => 立刻 preview + 延迟 final
  const scheduleFetch = useCallback((nextFilters: Filters, reason: 'drag' | 'click') => {
    setIsInteracting(true);
    loadMonthlyFlows(nextFilters, 'preview');
    if (finalTimerRef.current) window.clearTimeout(finalTimerRef.current);
    finalTimerRef.current = window.setTimeout(() => {
      setIsInteracting(false);
      loadMonthlyFlows(filtersRef.current, 'final');
    }, reason === 'drag' ? 180 : 120);
  }, [loadMonthlyFlows]);

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

  // 将 MonthlyCompanyFlow 转换为 Shipment 格式（用于地图组件）
  const shipments = useMemo(() => {
    return monthlyFlows.map(flow => {
      // 从 HS Code 获取品类（处理空格和格式）
      const hsCodesArray = flow.hsCodes?.split(',').map(code => code.trim()) || [];
      const firstHsCode = hsCodesArray[0]?.slice(0, 2) || '';
      const hsCategory = hsCodeCategories.find(cat => cat.hsCode === firstHsCode);
      
      // 根据品类ID获取颜色
      let categoryColor = '#007AFF'; // 默认颜色
      if (hsCategory) {
        if (hsCategory.categoryId === 'equipment') {
          categoryColor = '#5856D6';
        } else if (hsCategory.categoryId === 'raw_material') {
          categoryColor = '#30B0C7';
        } else if (hsCategory.categoryId === 'logic') {
          categoryColor = '#007AFF';
        } else if (hsCategory.categoryId === 'memory') {
          categoryColor = '#FF9500';
        }
      }
      
      // 将国家名称转换为国家代码
      const originCountryCode = getCountryCode(flow.originCountry);
      const destinationCountryCode = getCountryCode(flow.destinationCountry);
      
      return {
        id: `${flow.yearMonth}-${flow.exporterName}-${flow.importerName}`,
        originId: originCountryCode, // 使用国家代码而不是名称
        destinationId: destinationCountryCode, // 使用国家代码而不是名称
        exporterCompanyName: flow.exporterName,
        importerCompanyName: flow.importerName,
        material: flow.hsCodes,
        category: hsCategory?.categoryName || 'Unknown', // 使用 HS Code 分类表中的品类名称
        categoryColor,
        quantity: flow.totalQuantity,
        value: flow.totalValueUsd / 1000000, // 转换为百万美元
        status: 'completed',
        timestamp: flow.firstTransactionDate
      };
    });
  }, [monthlyFlows, hsCodeCategories, getCountryCode]);

  // 调试信息
  useEffect(() => {
    console.log('Shipments for map:', shipments.length, shipments);
    console.log('Countries for map:', countries.length, countries);
    console.log('HS Code Categories:', hsCodeCategories.length, hsCodeCategories);
  }, [shipments, countries, hsCodeCategories]);

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
             monthlyFlows={monthlyFlows}
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
                    shipments={shipments}
                    transactions={[]}
                    selectedCountries={filters.selectedCountries}
                    countries={countries}
                    companies={[]}
                    categories={[]}
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
