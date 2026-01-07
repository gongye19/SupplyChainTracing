
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import SupplyMap from './components/SupplyMap';
import StatsPanel from './components/StatsPanel';
import SidebarFilters from './components/SidebarFilters';
import { Transaction, Filters, Category, CountryLocation, Location, CompanyWithLocation } from './types';
import { transactionsAPI, categoriesAPI, locationsAPI, companiesAPI } from './services/api';
import { Globe, BarChart3, Bell, Map as MapIcon, Package, TrendingUp, Users, Settings, Search, ChevronRight } from 'lucide-react';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<'map' | 'stats'>('map');
  
  const START_DATE = new Date('2023-01-01');
  const TODAY = new Date();
  const startDateStr = START_DATE.toISOString().split('T')[0];
  const endDateStr = TODAY.toISOString().split('T')[0];

  const [filters, setFilters] = useState<Filters>({
    startDate: startDateStr,
    endDate: endDateStr,
    selectedCountries: [],
    selectedCategories: [],
    selectedCompanies: []
  });

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [countries, setCountries] = useState<CountryLocation[]>([]);
  const [companies, setCompanies] = useState<CompanyWithLocation[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const [stats, setStats] = useState({
    transactions: 0,
    suppliers: 0,
    categories: 0
  });
  
  // 防抖定时器
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 加载初始数据
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setInitialLoading(true);
        console.log('Loading categories, countries, and companies...');
        const [catsData, locationsData, companiesData] = await Promise.all([
          categoriesAPI.getAll(),
          locationsAPI.getCountries(),
          companiesAPI.getWithLocations()
        ]);
        console.log('Categories loaded:', catsData);
        console.log('Countries loaded:', locationsData);
        console.log('Companies loaded:', companiesData);
        setCategories(catsData);
        // 将 Location 转换为 CountryLocation 格式（向后兼容，用于筛选器）
        const countriesData: CountryLocation[] = locationsData.map(loc => ({
          countryCode: loc.countryCode,
          countryName: loc.countryName,
          capitalLat: loc.latitude,
          capitalLng: loc.longitude,
          region: loc.region,
          continent: loc.continent
        }));
        setCountries(countriesData);
        setCompanies(companiesData);
      } catch (error) {
        console.error('Failed to load initial data:', error);
        alert('无法加载数据，请检查后端服务是否正常运行。错误: ' + (error as Error).message);
      } finally {
        setInitialLoading(false);
      }
    };
    loadInitialData();
  }, []);

  // 加载交易数据的函数
  const loadTransactions = useCallback(async (filtersToUse: Filters) => {
    try {
      setFilterLoading(true);
      console.log('Loading transactions with filters:', filtersToUse);
      const response = await transactionsAPI.getTransactions(filtersToUse, 1, 1000);
      console.log('Transactions loaded:', response.transactions.length);
      setTransactions(response.transactions);
      
      // 更新统计信息
      const uniqueCountries = new Set<string>();
      const uniqueCategories = new Set<string>();
      response.transactions.forEach(t => {
        uniqueCountries.add(t.exporterCountryCode);
        uniqueCountries.add(t.importerCountryCode);
        uniqueCategories.add(t.categoryId);
      });
      setStats({
        transactions: response.transactions.length,
        suppliers: uniqueCountries.size,
        categories: uniqueCategories.size
      });
    } catch (error) {
      console.error('Failed to load transactions:', error);
      alert('无法加载交易数据。错误: ' + (error as Error).message);
    } finally {
      setFilterLoading(false);
    }
  }, []);

  // 根据筛选条件加载交易数据（带防抖）
  useEffect(() => {
    // 只有在categories和companies加载完成后才加载交易数据
    if (categories.length === 0 || companies.length === 0) {
      return;
    }
    
    // 清除之前的定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // 设置防抖：拖动时延迟 300ms 再请求
    debounceTimerRef.current = setTimeout(() => {
      loadTransactions(filters);
    }, 300);
    
    // 清理函数
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [filters, categories.length, companies.length, loadTransactions]);

  // 将Transaction转换为Shipment格式（用于地图组件）- 使用 useMemo 优化
  const shipments = useMemo(() => {
    return transactions.map(t => ({
      id: t.id,
      originId: t.exporterCompanyId || t.exporterCountryCode, // 使用公司ID，如果没有则使用国家代码
      destinationId: t.importerCompanyId || t.importerCountryCode,
      exporterCompanyId: t.exporterCompanyId,
      importerCompanyId: t.importerCompanyId,
      exporterCompanyName: t.exporterCompanyName,
      importerCompanyName: t.importerCompanyName,
      material: t.material,
      category: t.categoryName,
      quantity: t.quantity,
      value: t.totalValue / 1000000, // 转换为百万美元
      status: t.status,
      timestamp: t.transactionDate
    }));
  }, [transactions]);

  // 调试信息
  useEffect(() => {
    console.log('Shipments for map:', shipments.length, shipments);
    console.log('Countries for map:', countries.length, countries);
    console.log('Categories for map:', categories.length, categories);
  }, [shipments, countries, categories]);

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F5F7] text-[#1D1D1F]">
      {/* Header */}
      <header className="h-16 border-b border-black/5 bg-white/80 backdrop-blur-xl flex items-center justify-between px-8 sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#1D1D1F] rounded-[10px] flex items-center justify-center">
               <Globe className="text-white w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">GlobalSupplyChainMap</h1>
          </div>
          <div className="h-4 w-[1px] bg-black/10"></div>
          <div className="relative hidden lg:block">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-black/30" />
            <input 
              type="text" 
              placeholder="Search supply network..." 
              className="bg-black/5 border-transparent focus:bg-black/10 rounded-full pl-9 pr-4 py-2 text-[13px] w-64 transition-all outline-none font-medium"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button className="p-2.5 text-black/60 hover:bg-black/5 rounded-full transition-all relative">
            <Bell className="w-4.5 h-4.5" />
            <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-[#FF3B30] rounded-full border border-white"></span>
          </button>
          <button className="p-2.5 text-black/60 hover:bg-black/5 rounded-full transition-all">
            <Settings className="w-4.5 h-4.5" />
          </button>
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#007AFF] to-[#5856D6] flex items-center justify-center text-white font-bold text-[11px] ml-2 shadow-sm">
            AD
          </div>
        </div>
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
                 Global Map
               </div>
               {activeView === 'map' && <ChevronRight className="w-3.5 h-3.5" />}
             </button>
             <button 
               onClick={() => setActiveView('stats')}
               className={`flex items-center justify-between px-4 py-3 rounded-[12px] transition-all text-[14px] font-semibold ${activeView === 'stats' ? 'bg-[#007AFF] text-white shadow-lg shadow-blue-500/20' : 'text-[#86868B] hover:bg-black/5'}`}
             >
               <div className="flex items-center gap-3">
                 <BarChart3 className="w-4 h-4" />
                 Intelligence Hub
               </div>
               {activeView === 'stats' && <ChevronRight className="w-3.5 h-3.5" />}
             </button>
           </div>

           <div className="h-[0.5px] bg-black/5"></div>

           <SidebarFilters 
             filters={filters} 
             setFilters={setFilters}
             categories={categories}
             countries={countries}
           />
           
           <div className="mt-auto pt-8 border-t border-black/5 space-y-4">
             <div className="bg-[#F5F5F7] p-4 rounded-[20px] space-y-3 border border-black/5">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-[#86868B]">
                    <TrendingUp className="w-4 h-4 text-[#007AFF]" />
                    <span className="text-[10px] uppercase font-bold tracking-wider">Flows</span>
                  </div>
                  <span className="text-sm font-bold">{stats.transactions}</span>
               </div>
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-[#86868B]">
                    <Users className="w-4 h-4 text-[#34C759]" />
                    <span className="text-[10px] uppercase font-bold tracking-wider">Nodes</span>
                  </div>
                  <span className="text-sm font-bold">{stats.suppliers}</span>
               </div>
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-[#86868B]">
                    <Package className="w-4 h-4 text-[#FF2D55]" />
                    <span className="text-[10px] uppercase font-bold tracking-wider">Classes</span>
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
                  <div className="text-[#86868B]">Loading...</div>
                </div>
              ) : (
                <>
                  {/* 筛选更新时的轻微提示（可选） */}
                  {filterLoading && (
                    <div className="absolute top-4 right-4 z-20 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs text-[#86868B] shadow-sm">
                      Updating...
                    </div>
                  )}
                  <SupplyMap 
                    shipments={shipments}
                    transactions={transactions}
                    selectedCountries={filters.selectedCountries}
                    countries={countries}
                    companies={companies}
                    categories={categories}
                  />
                </>
              )}
            </div>
          ) : (
            <div className="h-full overflow-y-auto custom-scrollbar pr-4">
              <div className="mb-10">
                <h2 className="text-[32px] font-bold tracking-tight text-[#1D1D1F]">Network Insights</h2>
                <p className="text-[#86868B] text-[16px] font-medium mt-1">Real-time performance metrics and material distribution.</p>
              </div>
              {initialLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-[#86868B]">Loading...</div>
                </div>
              ) : (
                <StatsPanel transactions={transactions} />
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default App;
