import React, { useState, useEffect, useRef } from 'react';
import { Filters, HSCodeCategory, CountryLocation, MonthlyCompanyFlow } from '../types';
import { Calendar, Building2, Package, Filter, ChevronDown, Check, Building } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface SidebarFiltersProps {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  hsCodeCategories: HSCodeCategory[];
  countries: CountryLocation[];
  companies: string[]; // 公司名称列表
  monthlyFlows: MonthlyCompanyFlow[]; // 实际数据，用于提取出现的品类
}

const SidebarFilters: React.FC<SidebarFiltersProps> = ({ 
  filters, 
  setFilters, 
  hsCodeCategories, 
  countries, 
  companies,
  monthlyFlows
}) => {
  const { t } = useLanguage();
  const [countriesOpen, setCountriesOpen] = useState(false);
  const [hsCodeCategoriesOpen, setHsCodeCategoriesOpen] = useState(false);
  const [companiesOpen, setCompaniesOpen] = useState(false);
  
  const countriesRef = useRef<HTMLDivElement>(null);
  const hsCodeCategoriesRef = useRef<HTMLDivElement>(null);
  const companiesRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (countriesRef.current && !countriesRef.current.contains(event.target as Node)) {
        setCountriesOpen(false);
      }
      if (hsCodeCategoriesRef.current && !hsCodeCategoriesRef.current.contains(event.target as Node)) {
        setHsCodeCategoriesOpen(false);
      }
      if (companiesRef.current && !companiesRef.current.contains(event.target as Node)) {
        setCompaniesOpen(false);
      }
    };

    if (countriesOpen || hsCodeCategoriesOpen || companiesOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [countriesOpen, hsCodeCategoriesOpen, companiesOpen]);

  // 生成年月选项（从2003-01到当前）
  const generateYearMonthOptions = () => {
    const options: string[] = [];
    const startYear = 2003;
    const startMonth = 1;
    const now = new Date();
    const endYear = now.getFullYear();
    const endMonth = now.getMonth() + 1;

    for (let year = startYear; year <= endYear; year++) {
      const monthStart = year === startYear ? startMonth : 1;
      const monthEnd = year === endYear ? endMonth : 12;
      for (let month = monthStart; month <= monthEnd; month++) {
        options.push(`${year}-${String(month).padStart(2, '0')}`);
      }
    }
    return options;
  };

  const yearMonthOptions = generateYearMonthOptions();

  const toggleCountry = (countryName: string) => {
    setFilters(prev => ({
      ...prev,
      selectedCountries: prev.selectedCountries.includes(countryName) 
        ? prev.selectedCountries.filter(c => c !== countryName)
        : [...prev.selectedCountries, countryName]
    }));
  };

  const toggleHSCodeCategory = (categoryId: string) => {
    setFilters(prev => ({
      ...prev,
      selectedHSCodeCategories: prev.selectedHSCodeCategories.includes(categoryId)
        ? prev.selectedHSCodeCategories.filter(c => c !== categoryId)
        : [...prev.selectedHSCodeCategories, categoryId]
    }));
  };

  const toggleCompany = (companyName: string) => {
    setFilters(prev => ({
      ...prev,
      selectedCompanies: prev.selectedCompanies.includes(companyName)
        ? prev.selectedCompanies.filter(c => c !== companyName)
        : [...prev.selectedCompanies, companyName]
    }));
  };

  return (
    <div className="flex flex-col gap-10 p-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[#007AFF]">
          <Filter className="w-4 h-4" />
          <span className="text-[12px] font-bold uppercase tracking-widest text-[#1D1D1F]">{t('filters.filterControl')}</span>
        </div>
        <button 
          onClick={() => setFilters({ 
            startYearMonth: yearMonthOptions[0] || '2003-01',
            endYearMonth: yearMonthOptions[yearMonthOptions.length - 1] || new Date().toISOString().slice(0, 7),
            selectedCountries: [], 
            selectedHSCodeCategories: [],
            selectedCompanies: []
          })}
          className="text-[12px] text-[#007AFF] hover:underline font-semibold"
        >
          {t('filters.reset')}
        </button>
      </div>

      {/* 时间范围 - 年月选择器 */}
      <section className="space-y-5">
        <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-widest flex items-center gap-2.5">
          <Calendar className="w-4 h-4" /> {t('filters.dateRange')}
        </label>
        
        <div className="space-y-3">
          {/* 起始年月 */}
          <div className="flex flex-col">
            <span className="text-[9px] text-[#86868B] uppercase font-bold tracking-wider mb-1">{t('filters.start')}</span>
            <select
              value={filters.startYearMonth}
              onChange={(e) => setFilters(prev => ({ ...prev, startYearMonth: e.target.value }))}
              className="w-full bg-[#F5F5F7] border border-black/5 rounded-[12px] px-3 py-2.5 pr-8 text-[12px] text-[#1D1D1F] font-semibold hover:bg-[#EBEBEB] transition-all shadow-sm appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2386868B%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><polyline points=%226 9 12 15 18 9%22></polyline></svg>')] bg-[length:16px_16px] bg-[right_0.75rem_center] bg-no-repeat"
            >
              {yearMonthOptions.map(ym => (
                <option key={ym} value={ym}>{ym}</option>
              ))}
            </select>
          </div>

          {/* 结束年月 */}
          <div className="flex flex-col">
            <span className="text-[9px] text-[#86868B] uppercase font-bold tracking-wider mb-1">{t('filters.end')}</span>
            <select
              value={filters.endYearMonth}
              onChange={(e) => setFilters(prev => ({ ...prev, endYearMonth: e.target.value }))}
              className="w-full bg-[#F5F5F7] border border-black/5 rounded-[12px] px-3 py-2.5 pr-8 text-[12px] text-[#1D1D1F] font-semibold hover:bg-[#EBEBEB] transition-all shadow-sm appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2386868B%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><polyline points=%226 9 12 15 18 9%22></polyline></svg>')] bg-[length:16px_16px] bg-[right_0.75rem_center] bg-no-repeat"
            >
              {yearMonthOptions.map(ym => (
                <option key={ym} value={ym}>{ym}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* 国家筛选 */}
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
                : `${filters.selectedCountries.length} ${t('filters.selected')}`}
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
                  onClick={() => toggleCountry(country.countryName)}
                  className={`px-3 py-2 text-[12px] flex items-center justify-between cursor-pointer rounded-[8px] transition-colors mb-0.5 last:mb-0 ${filters.selectedCountries.includes(country.countryName) ? 'bg-[#007AFF] text-white font-bold' : 'text-[#1D1D1F] hover:bg-black/5'}`}
                >
                  <div className="flex flex-col">
                    <span>{country.countryName}</span>
                    <span className={`text-[9px] uppercase font-bold opacity-60`}>{country.countryCode}</span>
                  </div>
                  {filters.selectedCountries.includes(country.countryName) && <Check className="w-3.5 h-3.5" />}
                </div>
                ))
              )}
            </div>
          )}
        </div>
      </section>

      {/* HS Code 品类筛选 - 按品类分组显示 */}
      <section className="space-y-2.5">
        <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-widest flex items-center gap-2.5">
          <Package className="w-4 h-4" /> {t('filters.categories')}
        </label>
        <div className="relative" ref={hsCodeCategoriesRef}>
          <button 
            onClick={() => setHsCodeCategoriesOpen(!hsCodeCategoriesOpen)}
            className="w-full bg-[#F5F5F7] border border-black/5 rounded-[12px] px-3 py-2.5 flex items-center justify-between text-[12px] text-[#1D1D1F] font-semibold hover:bg-[#EBEBEB] transition-all shadow-sm"
          >
            <span className="truncate">
              {filters.selectedHSCodeCategories.length === 0 
                ? t('filters.selectAll') 
                : `${filters.selectedHSCodeCategories.length} ${t('filters.selected')}`}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-[#86868B] transition-transform ${hsCodeCategoriesOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {hsCodeCategoriesOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white/90 backdrop-blur-xl border border-black/5 rounded-[16px] shadow-2xl z-50 max-h-72 overflow-y-auto custom-scrollbar p-1.5 animate-in fade-in zoom-in-95 duration-200">
              {hsCodeCategories.length === 0 ? (
                <div className="px-3 py-2 text-[12px] text-[#86868B]">{t('filters.loading')}</div>
              ) : (() => {
                // 从实际数据中提取出现的 HS Code（前两位）
                const actualHsCodes = new Set<string>();
                monthlyFlows.forEach(flow => {
                  if (flow.hsCodes) {
                    const codes = flow.hsCodes.split(',').map(code => code.trim());
                    codes.forEach(code => {
                      if (code.length >= 2) {
                        actualHsCodes.add(code.slice(0, 2)); // 取前两位
                      }
                    });
                  }
                });
                
                // 根据实际出现的 HS Code 找到对应的章节（显示 chapterName）
                const actualChapters: HSCodeCategory[] = [];
                actualHsCodes.forEach(hsCode => {
                  const category = hsCodeCategories.find(cat => cat.hsCode === hsCode);
                  if (category) {
                    actualChapters.push(category);
                  }
                });
                
                // 如果没有任何数据，显示所有章节（用于初始状态）
                const chaptersToShow = actualChapters.length > 0 
                  ? actualChapters.sort((a, b) => a.hsCode.localeCompare(b.hsCode))
                  : hsCodeCategories.sort((a, b) => a.hsCode.localeCompare(b.hsCode));
                
                return chaptersToShow.map(cat => (
                  <div 
                    key={cat.hsCode}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleHSCodeCategory(cat.hsCode); // 使用 hsCode（2位），而不是 categoryId
                    }}
                    className={`px-3 py-2.5 text-[12px] flex items-center justify-between cursor-pointer rounded-[8px] transition-colors mb-0.5 last:mb-0 ${filters.selectedHSCodeCategories.includes(cat.hsCode) ? 'bg-[#007AFF] text-white font-bold' : 'text-[#1D1D1F] hover:bg-black/5'}`}
                  >
                    <span 
                      className={`font-semibold flex-1 ${filters.selectedHSCodeCategories.includes(cat.hsCode) ? 'text-white' : 'text-[#1D1D1F]'}`}
                    >
                      {cat.chapterName} ({cat.hsCode})
                    </span>
                    {filters.selectedHSCodeCategories.includes(cat.hsCode) && <Check className="w-3.5 h-3.5 flex-shrink-0 ml-2" />}
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      </section>

      {/* 公司筛选 */}
      <section className="space-y-2.5">
        <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-widest flex items-center gap-2.5">
          <Building className="w-4 h-4" /> {t('filters.companies')}
        </label>
        <div className="relative" ref={companiesRef}>
          <button 
            onClick={() => setCompaniesOpen(!companiesOpen)}
            className="w-full bg-[#F5F5F7] border border-black/5 rounded-[12px] px-3 py-2.5 flex items-center justify-between text-[12px] text-[#1D1D1F] font-semibold hover:bg-[#EBEBEB] transition-all shadow-sm"
          >
            <span className="truncate">
              {filters.selectedCompanies.length === 0 
                ? t('filters.selectAll') 
                : `${filters.selectedCompanies.length} ${t('filters.selected')}`}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-[#86868B] transition-transform ${companiesOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {companiesOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white/90 backdrop-blur-xl border border-black/5 rounded-[16px] shadow-2xl z-50 max-h-72 overflow-y-auto custom-scrollbar p-1.5 animate-in fade-in zoom-in-95 duration-200">
              {companies.length === 0 ? (
                <div className="px-3 py-2 text-[12px] text-[#86868B]">{t('filters.loading')}</div>
              ) : (
                companies.map(companyName => (
                <div 
                  key={companyName}
                  onClick={() => toggleCompany(companyName)}
                  className={`px-3 py-2 text-[12px] flex items-center justify-between cursor-pointer rounded-[8px] transition-colors mb-0.5 last:mb-0 ${filters.selectedCompanies.includes(companyName) ? 'bg-[#007AFF] text-white font-bold' : 'text-[#1D1D1F] hover:bg-black/5'}`}
                >
                  <span className="truncate">{companyName}</span>
                  {filters.selectedCompanies.includes(companyName) && <Check className="w-3.5 h-3.5 flex-shrink-0 ml-2" />}
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
