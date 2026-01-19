
import React, { useState, useEffect, useRef } from 'react';
import { Filters, Category, CountryLocation, CompanyWithLocation } from '../types';
import { Calendar, Building2, Package, Filter, ChevronDown, Check, Building } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface SidebarFiltersProps {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  categories: Category[];
  countries: CountryLocation[];
  companies: CompanyWithLocation[];
  onDragChange?: (isDragging: boolean) => void;
}

const SidebarFilters: React.FC<SidebarFiltersProps> = ({ filters, setFilters, categories, countries, companies, onDragChange }) => {
  const { t, language } = useLanguage();
  const [countriesOpen, setCountriesOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [companiesOpen, setCompaniesOpen] = useState(false);
  const [activeThumb, setActiveThumb] = useState<'start' | 'end' | null>(null);
  const countriesRef = useRef<HTMLDivElement>(null);
  const categoriesRef = useRef<HTMLDivElement>(null);
  const companiesRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  
  // rAF throttle for smooth dragging
  const rafRef = useRef<number | null>(null);
  const latestXRef = useRef<number | null>(null);

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (countriesRef.current && !countriesRef.current.contains(event.target as Node)) {
        setCountriesOpen(false);
      }
      if (categoriesRef.current && !categoriesRef.current.contains(event.target as Node)) {
        setCategoriesOpen(false);
      }
      if (companiesRef.current && !companiesRef.current.contains(event.target as Node)) {
        setCompaniesOpen(false);
      }
    };

    if (countriesOpen || categoriesOpen || companiesOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [countriesOpen, categoriesOpen, companiesOpen]);

  // 全局鼠标事件，确保拖动状态正确重置
  useEffect(() => {
    const handlePointerUp = () => {
      setActiveThumb(null);
    };

    document.addEventListener('pointerup', handlePointerUp);
    return () => {
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  // 清理 rAF
  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const START_DATE = new Date('2023-01-01');
  const TODAY = new Date();

  // 工具函数 - 按月计算
  const MIN_GAP = 1; // 最小间隔：1个月

  // 计算两个日期之间的月份差
  const toMonthIndex = (dateStr: string) => {
    const d = new Date(dateStr);
    const yearDiff = d.getFullYear() - START_DATE.getFullYear();
    const monthDiff = d.getMonth() - START_DATE.getMonth();
    return yearDiff * 12 + monthDiff;
  };

  // 从月份索引恢复日期（该月的第一天）
  const fromMonthIndex = (idx: number) => {
    const d = new Date(START_DATE);
    d.setMonth(d.getMonth() + idx);
    // 设置为该月的第一天
    d.setDate(1);
    return d.toISOString().split('T')[0];
  };

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));

  // 计算总月数
  const totalMonths = Math.max(1, toMonthIndex(TODAY.toISOString().split('T')[0]) + 1);

  // 推挤逻辑
  function applyDragLeft(nextLeft: number, left: number, right: number, max: number) {
    nextLeft = clamp(nextLeft, 0, max);

    if (nextLeft <= right - MIN_GAP) return { left: nextLeft, right };

    let newLeft = nextLeft;
    let newRight = newLeft + MIN_GAP;
    if (newRight > max) {
      newRight = max;
      newLeft = newRight - MIN_GAP;
    }
    return { left: newLeft, right: newRight };
  }

  function applyDragRight(nextRight: number, left: number, right: number, max: number) {
    nextRight = clamp(nextRight, 0, max);

    if (nextRight >= left + MIN_GAP) return { left, right: nextRight };

    let newRight = nextRight;
    let newLeft = newRight - MIN_GAP;
    if (newLeft < 0) {
      newLeft = 0;
      newRight = newLeft + MIN_GAP;
    }
    return { left: newLeft, right: newRight };
  }

  // 格式化日期显示
  const formatDateDisplay = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // 计算当前位置（按月）
  const left = clamp(toMonthIndex(filters.startDate), 0, totalMonths);
  const right = clamp(toMonthIndex(filters.endDate), 0, totalMonths);

  // 确保百分比在 0-100% 范围内
  const leftPct = clamp((left / totalMonths) * 100, 0, 100);
  const rightPct = clamp((right / totalMonths) * 100, 0, 100);

  // 从鼠标位置获取索引（月份）
  const getIndexFromClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    // 考虑 thumb 的半径（9px），确保 thumb 不会超出边界
    const thumbRadius = 9;
    const trackWidth = rect.width - thumbRadius * 2;
    const x = clamp(clientX - rect.left - thumbRadius, 0, trackWidth);
    const ratio = trackWidth === 0 ? 0 : x / trackWidth;
    return Math.round(ratio * totalMonths);
  };

  // 拖动处理
  const onPointerDownThumb = (thumb: 'start' | 'end') => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setActiveThumb(thumb);
    // 通知父组件开始拖动
    onDragChange?.(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!activeThumb) return;

    latestXRef.current = e.clientX;

    if (rafRef.current != null) return;

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const x = latestXRef.current;
      if (x == null) return;

      const nextIdx = getIndexFromClientX(x);

    setFilters(prev => {
      const curL = toMonthIndex(prev.startDate);
      const curR = toMonthIndex(prev.endDate);

      const res =
        activeThumb === 'start'
          ? applyDragLeft(nextIdx, curL, curR, totalMonths)
          : applyDragRight(nextIdx, curL, curR, totalMonths);

      return { ...prev, startDate: fromMonthIndex(res.left), endDate: fromMonthIndex(res.right) };
      });
    });
  };

  const onPointerUp = () => {
    setActiveThumb(null);
    // 通知父组件拖动结束
    onDragChange?.(false);
  };

  const toggleCountry = (code: string) => {
    setFilters(prev => ({
      ...prev,
      selectedCountries: prev.selectedCountries.includes(code) 
        ? prev.selectedCountries.filter(c => c !== code)
        : [...prev.selectedCountries, code]
    }));
  };

  const toggleCategory = (categoryId: string) => {
    setFilters(prev => ({
      ...prev,
      selectedCategories: prev.selectedCategories.includes(categoryId)
        ? prev.selectedCategories.filter(c => c !== categoryId)
        : [...prev.selectedCategories, categoryId]
    }));
    // 点击后不关闭下拉框，让用户可以多选
  };

  const toggleCompany = (companyId: string) => {
    setFilters(prev => ({
      ...prev,
      selectedCompanies: prev.selectedCompanies.includes(companyId)
        ? prev.selectedCompanies.filter(c => c !== companyId)
        : [...prev.selectedCompanies, companyId]
    }));
  };

  return (
    <div className="flex flex-col gap-10 p-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[#007AFF]">
          <Filter className="w-4 h-4" />
          <span className="text-[12px] font-bold uppercase tracking-widest text-[#1D1D1F]">筛选控制</span>
        </div>
        <button 
          onClick={() => setFilters({ 
            startDate: START_DATE.toISOString().split('T')[0], 
            endDate: TODAY.toISOString().split('T')[0], 
            selectedCountries: [], 
            selectedCategories: [],
            selectedCompanies: []
          })}
          className="text-[12px] text-[#007AFF] hover:underline font-semibold"
        >
          重置
        </button>
      </div>

      {/* Date Range - Dual Slider */}
      <section className="space-y-5">
        <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-widest flex items-center gap-2.5">
          <Calendar className="w-4 h-4" /> 时间范围
        </label>
        
        <div className="space-y-2">
          {/* Date Display */}
          <div className="flex items-center justify-between px-1">
            <div className="flex flex-col">
              <span className="text-[9px] text-[#86868B] uppercase font-bold tracking-wider">起始</span>
              <span className="text-[12px] text-[#1D1D1F] font-semibold mt-0.5">
                {formatDateDisplay(filters.startDate)}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[9px] text-[#86868B] uppercase font-bold tracking-wider">结束</span>
              <span className="text-[12px] text-[#1D1D1F] font-semibold mt-0.5">
                {formatDateDisplay(filters.endDate)}
              </span>
            </div>
          </div>

          {/* Custom Dual Slider Container */}
          <div className="relative py-1.5 select-none">
            {/* Track */}
            <div
              ref={trackRef}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className="relative h-6"
            >
              {/* background track */}
              <div className="absolute top-1/2 left-0 right-0 h-1.5 bg-[#EBEBEB] rounded-full -translate-y-1/2" />

              {/* active range */}
              <div
                className="absolute top-1/2 h-1.5 bg-[#007AFF] rounded-full -translate-y-1/2 transition-all"
                style={{ left: `${leftPct}%`, width: `${rightPct - leftPct}%` }}
              />

              {/* left thumb */}
              <div
                role="slider"
                aria-label="起始日期"
                aria-valuemin={0}
                aria-valuemax={totalMonths}
                aria-valuenow={left}
                onPointerDown={onPointerDownThumb('start')}
                className="absolute top-1/2 w-[18px] h-[18px] rounded-full bg-[#007AFF] border-[3px] border-white cursor-pointer -translate-y-1/2 transition-all hover:scale-110 active:scale-115"
                style={{
                  left: `max(0px, calc(${leftPct}% - 9px))`,
                  boxShadow: activeThumb === 'start' 
                    ? '0 3px 12px rgba(0, 122, 255, 0.4), 0 0 0 1px rgba(0, 0, 0, 0.05)' 
                    : '0 2px 8px rgba(0, 122, 255, 0.3), 0 0 0 1px rgba(0, 0, 0, 0.05)'
                }}
              />

              {/* right thumb */}
              <div
                role="slider"
                aria-label="结束日期"
                aria-valuemin={0}
                aria-valuemax={totalMonths}
                aria-valuenow={right}
                onPointerDown={onPointerDownThumb('end')}
                className="absolute top-1/2 w-[18px] h-[18px] rounded-full bg-[#007AFF] border-[3px] border-white cursor-pointer -translate-y-1/2 transition-all hover:scale-110 active:scale-115"
                style={{
                  left: `min(calc(100% - 18px), calc(${rightPct}% - 9px))`,
                  boxShadow: activeThumb === 'end' 
                    ? '0 3px 12px rgba(0, 122, 255, 0.4), 0 0 0 1px rgba(0, 0, 0, 0.05)' 
                    : '0 2px 8px rgba(0, 122, 255, 0.3), 0 0 0 1px rgba(0, 0, 0, 0.05)'
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Countries Dropdown */}
      <section className="space-y-2.5">
        <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-widest flex items-center gap-2.5">
          <Building2 className="w-4 h-4" /> {t('filters.countries')}
        </label>
        <div className="relative" ref={countriesRef}>
          <button 
            onClick={() => setCountriesOpen(!countriesOpen)}
            className="w-full bg-[#F5F5F7] border border-black/5 rounded-[12px] px-3 py-2.5 flex items-center justify-between text-[12px] text-[#1D1D1F] font-semibold hover:bg-[#EBEBEB] transition-all shadow-sm"
          >
            <span className="truncate">
              {filters.selectedCountries.length === 0 
                ? t('filters.selectAll') 
                : `${filters.selectedCountries.length} ${language === 'zh' ? 'selected' : 'selected'}`}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-[#86868B] transition-transform ${countriesOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {countriesOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white/90 backdrop-blur-xl border border-black/5 rounded-[16px] shadow-2xl z-50 max-h-72 overflow-y-auto custom-scrollbar p-1.5 animate-in fade-in zoom-in-95 duration-200">
              {countries.length === 0 ? (
                <div className="px-3 py-2 text-[12px] text-[#86868B]">{t('filters.loading')}</div>
              ) : (
                countries.map(country => (
                <div 
                  key={country.countryCode}
                  onClick={() => toggleCountry(country.countryCode)}
                  className={`px-3 py-2 text-[12px] flex items-center justify-between cursor-pointer rounded-[8px] transition-colors mb-0.5 last:mb-0 ${filters.selectedCountries.includes(country.countryCode) ? 'bg-[#007AFF] text-white font-bold' : 'text-[#1D1D1F] hover:bg-black/5'}`}
                >
                  <div className="flex flex-col">
                    <span>{country.countryName}</span>
                    <span className={`text-[9px] uppercase font-bold opacity-60`}>{country.countryCode}</span>
                  </div>
                  {filters.selectedCountries.includes(country.countryCode) && <Check className="w-3.5 h-3.5" />}
                </div>
                ))
              )}
            </div>
          )}
        </div>
      </section>

      {/* Categories Dropdown */}
      <section className="space-y-2.5">
        <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-widest flex items-center gap-2.5">
          <Package className="w-4 h-4" /> {t('filters.categories')}
        </label>
        <div className="relative" ref={categoriesRef}>
          <button 
            onClick={() => setCategoriesOpen(!categoriesOpen)}
            className="w-full bg-[#F5F5F7] border border-black/5 rounded-[12px] px-3 py-2.5 flex items-center justify-between text-[12px] text-[#1D1D1F] font-semibold hover:bg-[#EBEBEB] transition-all shadow-sm"
          >
            <span className="truncate">
              {filters.selectedCategories.length === 0 
                ? '所有物料流' 
                : `已选 ${filters.selectedCategories.length} 个`}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-[#86868B] transition-transform ${categoriesOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {categoriesOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white/90 backdrop-blur-xl border border-black/5 rounded-[16px] shadow-2xl z-50 max-h-72 overflow-y-auto custom-scrollbar p-1.5 animate-in fade-in zoom-in-95 duration-200">
              {categories.length === 0 ? (
                <div className="px-3 py-2 text-[12px] text-[#86868B]">{t('filters.loading')}</div>
              ) : (
                categories.map(cat => (
                <div 
                  key={cat.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCategory(cat.id);
                  }}
                  className={`px-3 py-2.5 text-[12px] flex items-center justify-between cursor-pointer rounded-[8px] transition-colors mb-0.5 last:mb-0 ${filters.selectedCategories.includes(cat.id) ? 'bg-[#007AFF] text-white font-bold' : 'text-[#1D1D1F] hover:bg-black/5'}`}
                >
                  <span 
                    className={`font-semibold flex-1 ${filters.selectedCategories.includes(cat.id) ? 'text-white' : 'text-[#1D1D1F]'}`}
                    style={{ 
                      whiteSpace: 'nowrap',
                      overflow: 'visible',
                      textOverflow: 'clip'
                    }}
                  >
                    {cat.displayName || cat.name || cat.id}
                  </span>
                  {filters.selectedCategories.includes(cat.id) && <Check className="w-3.5 h-3.5 flex-shrink-0 ml-2" />}
                </div>
                ))
              )}
            </div>
          )}
        </div>
      </section>

      {/* Companies Dropdown */}
      <section className="space-y-2.5">
        <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-widest flex items-center gap-2.5">
          <Building className="w-4 h-4" /> 公司
        </label>
        <div className="relative" ref={companiesRef}>
          <button 
            onClick={() => setCompaniesOpen(!companiesOpen)}
            className="w-full bg-[#F5F5F7] border border-black/5 rounded-[12px] px-3 py-2.5 flex items-center justify-between text-[12px] text-[#1D1D1F] font-semibold hover:bg-[#EBEBEB] transition-all shadow-sm"
          >
            <span className="truncate">
              {filters.selectedCompanies.length === 0 
                ? t('filters.selectAll') 
                : `${filters.selectedCompanies.length} ${language === 'zh' ? 'selected' : 'selected'}`}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-[#86868B] transition-transform ${companiesOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {companiesOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white/90 backdrop-blur-xl border border-black/5 rounded-[16px] shadow-2xl z-50 max-h-72 overflow-y-auto custom-scrollbar p-1.5 animate-in fade-in zoom-in-95 duration-200">
              {companies.length === 0 ? (
                <div className="px-3 py-2 text-[12px] text-[#86868B]">{t('filters.loading')}</div>
              ) : (
                companies.map(company => (
                <div 
                  key={company.id}
                  onClick={() => toggleCompany(company.id)}
                  className={`px-3 py-2 text-[12px] flex items-center justify-between cursor-pointer rounded-[8px] transition-colors mb-0.5 last:mb-0 ${filters.selectedCompanies.includes(company.id) ? 'bg-[#007AFF] text-white font-bold' : 'text-[#1D1D1F] hover:bg-black/5'}`}
                >
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="truncate">{company.name}</span>
                    <span className={`text-[9px] uppercase font-bold ${filters.selectedCompanies.includes(company.id) ? 'text-white/80' : 'text-[#86868B]'}`}>
                      {company.city}, {company.countryCode}
                    </span>
                  </div>
                  {filters.selectedCompanies.includes(company.id) && <Check className="w-3.5 h-3.5 flex-shrink-0 ml-2" />}
                </div>
                ))
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default SidebarFilters;
