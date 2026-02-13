import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Filters, HSCodeCategory, CountryLocation, Shipment } from '../types';
import { Building2, Package, Filter, ChevronDown, Check } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import MonthRangeSlider from './MonthRangeSlider';

interface SidebarFiltersProps {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  hsCodeCategories: HSCodeCategory[];
  countries: CountryLocation[];
  shipments: Shipment[]; // 实际数据，用于提取出现的品类和小类
  mode?: 'country' | 'hscode' | 'all';
}

const SidebarFilters: React.FC<SidebarFiltersProps> = ({ 
  filters, 
  setFilters, 
  hsCodeCategories, 
  countries, 
  shipments,
  mode = 'all',
}) => {
  const { t } = useLanguage();
  const [countriesOpen, setCountriesOpen] = useState(false);
  const [hsCodeCategoriesOpen, setHsCodeCategoriesOpen] = useState(false);
  const [hsCodeSubcategoriesOpen, setHsCodeSubcategoriesOpen] = useState(false);
  const [continentExpanded, setContinentExpanded] = useState<Record<string, boolean>>({});
  
  const countriesRef = useRef<HTMLDivElement>(null);
  const hsCodeCategoriesRef = useRef<HTMLDivElement>(null);
  const hsCodeSubcategoriesRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (countriesRef.current && !countriesRef.current.contains(event.target as Node)) {
        setCountriesOpen(false);
      }
      if (hsCodeCategoriesRef.current && !hsCodeCategoriesRef.current.contains(event.target as Node)) {
        setHsCodeCategoriesOpen(false);
      }
      if (hsCodeSubcategoriesRef.current && !hsCodeSubcategoriesRef.current.contains(event.target as Node)) {
        setHsCodeSubcategoriesOpen(false);
      }
    };

    if (countriesOpen || hsCodeCategoriesOpen || hsCodeSubcategoriesOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [countriesOpen, hsCodeCategoriesOpen, hsCodeSubcategoriesOpen]);
  
  // 从实际数据中提取可选的小类（HS Code 后2位）
  // 只显示已选择大类下实际出现的小类
  const availableSubcategories = useMemo(() => {
    if (filters.selectedHSCodeCategories.length === 0) {
      return [];
    }
    
    const subcategories = new Set<string>();
    shipments.forEach(shipment => {
      if (shipment.hsCode && shipment.hsCode.length >= 4) {
        const prefix = shipment.hsCode.slice(0, 2);
        const suffix = shipment.hsCode.slice(2, 4);
        if (filters.selectedHSCodeCategories.includes(prefix)) {
          subcategories.add(suffix);
        }
      }
    });
    
    return Array.from(subcategories).sort();
  }, [shipments, filters.selectedHSCodeCategories]);

  const toggleCountry = (countryCode: string) => {
    setFilters(prev => ({
      ...prev,
      selectedCountries: prev.selectedCountries.includes(countryCode)
        ? prev.selectedCountries.filter(c => c !== countryCode)
        : [...prev.selectedCountries, countryCode]
    }));
  };

  const countriesByContinent = useMemo(() => {
    const groups = new Map<string, CountryLocation[]>();
    countries.forEach((country) => {
      const continent = country.continent?.trim() || 'Other';
      if (!groups.has(continent)) {
        groups.set(continent, []);
      }
      groups.get(continent)!.push(country);
    });

    const continentPriority = [
      'Asia',
      'Europe',
      'North America',
      'South America',
      'Africa',
      'Oceania',
      'Antarctica',
      'Other',
    ];

    const orderedEntries = Array.from(groups.entries())
      .map(([continent, items]) => [
        continent,
        [...items].sort((a, b) => a.countryName.localeCompare(b.countryName)),
      ] as const)
      .sort((a, b) => {
        const ai = continentPriority.indexOf(a[0]);
        const bi = continentPriority.indexOf(b[0]);
        if (ai === -1 && bi === -1) return a[0].localeCompare(b[0]);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });

    return orderedEntries;
  }, [countries]);

  useEffect(() => {
    if (countriesByContinent.length === 0) return;
    setContinentExpanded((prev) => {
      const next = { ...prev };
      countriesByContinent.forEach(([continent]) => {
        if (next[continent] === undefined) {
          next[continent] = false;
        }
      });
      return next;
    });
  }, [countriesByContinent]);

  const toggleHSCodeCategory = (hsCode: string) => {
    setFilters(prev => {
      // 支持多选：如果已选中则移除，否则添加到数组
      const isCurrentlySelected = prev.selectedHSCodeCategories.includes(hsCode);
      const newCategories = isCurrentlySelected
        ? prev.selectedHSCodeCategories.filter(c => c !== hsCode) // 移除
        : [...prev.selectedHSCodeCategories, hsCode]; // 添加（支持多选）
      
      // 如果移除大类，同时清除该大类下的小类选择
      let newSubcategories = prev.selectedHSCodeSubcategories;
      if (isCurrentlySelected) {
        // 检查哪些小类属于被移除的大类
        const subcategoriesToRemove = new Set<string>();
        shipments.forEach(s => {
          if (s.hsCode && s.hsCode.length >= 4) {
            const prefix = s.hsCode.slice(0, 2);
            const suffix = s.hsCode.slice(2, 4);
            if (prefix === hsCode) {
              subcategoriesToRemove.add(suffix);
            }
          }
        });
        newSubcategories = prev.selectedHSCodeSubcategories.filter(s => !subcategoriesToRemove.has(s));
      }
      
      return {
        ...prev,
        selectedHSCodeCategories: newCategories,
        selectedHSCodeSubcategories: newSubcategories
      };
    });
  };

  const toggleHSCodeSubcategory = (suffix: string) => {
    setFilters(prev => ({
      ...prev,
      selectedHSCodeSubcategories: prev.selectedHSCodeSubcategories.includes(suffix)
        ? prev.selectedHSCodeSubcategories.filter(s => s !== suffix)
        : [...prev.selectedHSCodeSubcategories, suffix]
    }));
  };

  const showCountries = mode === 'all' || mode === 'country';
  const showHsCategories = mode === 'all' || mode === 'hscode';
  const showHsSubcategories = mode === 'all' || mode === 'hscode';

  return (
    <div className="flex flex-col gap-10 p-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[#007AFF]">
          <Filter className="w-4 h-4" />
          <span className="text-[12px] font-bold uppercase tracking-widest text-[#1D1D1F]">{t('filters.filterControl')}</span>
        </div>
        <button 
          onClick={() => {
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
            setFilters({ 
              startDate: '2021-01',
              endDate: `${currentYear}-${currentMonth}`,
              selectedCountries: [], 
              selectedHSCodeCategories: [],
              selectedHSCodeSubcategories: [],
              selectedCompanies: [],
            });
          }}
          className="text-[12px] text-[#007AFF] hover:underline font-semibold"
        >
          {t('filters.reset')}
        </button>
      </div>

      <MonthRangeSlider
        title="Time Range"
        startLabel="START"
        endLabel="END"
        minMonth="2021-01"
        startMonth={filters.startDate || '2021-01'}
        endMonth={filters.endDate}
        onChange={(startMonth, endMonth) => {
          setFilters(prev => ({ ...prev, startDate: startMonth, endDate: endMonth }));
        }}
      />

      {/* 国家筛选 */}
      {showCountries && (
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
                countriesByContinent.map(([continent, continentCountries]) => (
                  <div key={continent} className="mb-1 last:mb-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setContinentExpanded((prev) => ({
                          ...prev,
                          [continent]: !prev[continent],
                        }));
                      }}
                      className="w-full px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[#86868B] flex items-center justify-between rounded-[8px] hover:bg-black/5 transition-colors"
                    >
                      <span>{continent}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold normal-case">{continentCountries.length}</span>
                        <ChevronDown className={`w-3 h-3 transition-transform ${continentExpanded[continent] ? 'rotate-180' : ''}`} />
                      </div>
                    </button>
                    {continentExpanded[continent] && (
                      <div className="mt-1 space-y-0.5">
                        {continentCountries.map((country) => (
                <div 
                  key={country.countryCode}
                  onClick={() => toggleCountry(country.countryCode)}
                            className={`ml-2 px-3 py-2 text-[12px] flex items-center justify-between cursor-pointer rounded-[8px] transition-colors ${
                              filters.selectedCountries.includes(country.countryCode) ? 'bg-[#007AFF] text-white font-bold' : 'text-[#1D1D1F] hover:bg-black/5'
                            }`}
                >
                  <div className="flex flex-col">
                    <span>{country.countryName}</span>
                              <span className="text-[9px] uppercase font-bold opacity-60">{country.countryCode}</span>
                  </div>
                  {filters.selectedCountries.includes(country.countryCode) && <Check className="w-3.5 h-3.5" />}
                          </div>
                        ))}
                      </div>
                    )}
                </div>
                ))
              )}
            </div>
          )}
        </div>
      </section>
      )}

      {/* HS Code 品类筛选 - 按品类分组显示 */}
      {showHsCategories && (
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
                // 始终显示所有可用的 HS Code 大类选项，支持多选
                // 排序后显示
                const chaptersToShow = [...hsCodeCategories].sort((a, b) => a.hsCode.localeCompare(b.hsCode));
                
                return chaptersToShow.map(cat => (
                  <div 
                    key={cat.hsCode}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleHSCodeCategory(cat.hsCode);
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
      )}

      {/* HS Code 小类筛选 */}
      {showHsSubcategories && (
      <section className="space-y-2.5">
        <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-widest flex items-center gap-2.5">
          <Package className="w-4 h-4" /> {t('filters.hsCodeSubcategories') || 'HS Code Subcategories'}
        </label>
        <div className="relative" ref={hsCodeSubcategoriesRef}>
          <button 
            onClick={() => setHsCodeSubcategoriesOpen(!hsCodeSubcategoriesOpen)}
            disabled={filters.selectedHSCodeCategories.length === 0}
            className={`w-full bg-[#F5F5F7] border border-black/5 rounded-[12px] px-3 py-2.5 flex items-center justify-between text-[12px] font-semibold transition-all shadow-sm ${
              filters.selectedHSCodeCategories.length === 0
                ? 'opacity-50 cursor-not-allowed'
                : 'text-[#1D1D1F] hover:bg-[#EBEBEB] cursor-pointer'
            }`}
          >
            <span className="truncate">
              {filters.selectedHSCodeCategories.length === 0
                ? t('filters.selectCategoryFirst') || 'Please select category first'
                : filters.selectedHSCodeSubcategories.length === 0
                  ? t('filters.selectAll')
                  : `${filters.selectedHSCodeSubcategories.length} ${t('filters.selected')}`}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-[#86868B] transition-transform ${hsCodeSubcategoriesOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {hsCodeSubcategoriesOpen && filters.selectedHSCodeCategories.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white/90 backdrop-blur-xl border border-black/5 rounded-[16px] shadow-2xl z-50 max-h-72 overflow-y-auto custom-scrollbar p-1.5 animate-in fade-in zoom-in-95 duration-200">
              {availableSubcategories.length === 0 ? (
                <div className="px-3 py-2 text-[12px] text-[#86868B]">{t('filters.noSubcategories') || 'No subcategories found'}</div>
              ) : (
                availableSubcategories.map(suffix => (
                  <div 
                    key={suffix}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleHSCodeSubcategory(suffix);
                    }}
                    className={`px-3 py-2.5 text-[12px] flex items-center justify-between cursor-pointer rounded-[8px] transition-colors mb-0.5 last:mb-0 ${filters.selectedHSCodeSubcategories.includes(suffix) ? 'bg-[#007AFF] text-white font-bold' : 'text-[#1D1D1F] hover:bg-black/5'}`}
                  >
                    <span className="font-semibold flex-1">
                      {suffix}
                      {filters.selectedHSCodeCategories.length === 1 && (
                        <span className="ml-2 text-[10px] opacity-70">
                          ({filters.selectedHSCodeCategories[0]}{suffix})
                        </span>
                      )}
                    </span>
                    {filters.selectedHSCodeSubcategories.includes(suffix) && <Check className="w-3.5 h-3.5 flex-shrink-0 ml-2" />}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </section>
      )}

    </div>
  );
};

export default SidebarFilters;
