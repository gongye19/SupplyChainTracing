import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Check, ChevronDown, Filter, Package, X } from 'lucide-react';
import { CountryLocation, Filters, HSCodeCategory, Shipment } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import MonthRangeSlider from './MonthRangeSlider';

interface SidebarFiltersProps {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  hsCodeCategories: HSCodeCategory[];
  countries: CountryLocation[];
  shipments: Shipment[];
  mode?: 'country' | 'hscode' | 'all';
}

const HS4_ANNOTATIONS: Record<string, string> = {
  '8542': 'Electronic integrated circuits',
  '8541': 'Semiconductor devices, diodes and transistors',
  '8486': 'Machines for semiconductor manufacturing',
  '3818': 'Chemical elements doped for electronics',
  '8471': 'Automatic data processing machines',
};

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
  const [hs4ModalOpen, setHs4ModalOpen] = useState(false);
  const [hs4Search, setHs4Search] = useState('');
  const [continentExpanded, setContinentExpanded] = useState<Record<string, boolean>>({});

  const countriesRef = useRef<HTMLDivElement>(null);
  const hsCodeCategoriesRef = useRef<HTMLDivElement>(null);
  const hsCodeSubcategoriesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (countriesRef.current && !countriesRef.current.contains(event.target as Node)) setCountriesOpen(false);
      if (hsCodeCategoriesRef.current && !hsCodeCategoriesRef.current.contains(event.target as Node)) setHsCodeCategoriesOpen(false);
      if (hsCodeSubcategoriesRef.current && !hsCodeSubcategoriesRef.current.contains(event.target as Node)) setHsCodeSubcategoriesOpen(false);
    };
    if (countriesOpen || hsCodeCategoriesOpen || hsCodeSubcategoriesOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [countriesOpen, hsCodeCategoriesOpen, hsCodeSubcategoriesOpen]);

  const availableSubcategories = useMemo(() => {
    if (filters.selectedHSCodeCategories.length === 0) return [];
    const subcategories = new Set<string>();
    shipments.forEach((shipment) => {
      if (!shipment.hsCode || shipment.hsCode.length < 4) return;
      const prefix = shipment.hsCode.slice(0, 2);
      const suffix = shipment.hsCode.slice(2, 4);
      if (filters.selectedHSCodeCategories.includes(prefix)) subcategories.add(suffix);
    });
    return Array.from(subcategories).sort();
  }, [shipments, filters.selectedHSCodeCategories]);

  const availableHS4Codes = useMemo(() => {
    const set = new Set<string>();
    shipments.forEach((shipment) => {
      if (shipment.hsCode && shipment.hsCode.length >= 4) set.add(shipment.hsCode.slice(0, 4));
    });
    if (set.size === 0) set.add('8542');
    return Array.from(set).sort();
  }, [shipments]);

  const filteredHS4Codes = useMemo(() => {
    const keyword = hs4Search.trim().toLowerCase();
    if (!keyword) return availableHS4Codes;
    return availableHS4Codes.filter((code4) => {
      const note = (HS4_ANNOTATIONS[code4] || '').toLowerCase();
      return code4.includes(keyword) || note.includes(keyword);
    });
  }, [availableHS4Codes, hs4Search]);

  const customSearchHS4 = useMemo(() => {
    const code = hs4Search.trim();
    return /^\d{4}$/.test(code) ? code : '';
  }, [hs4Search]);

  const countriesByContinent = useMemo(() => {
    const groups = new Map<string, CountryLocation[]>();
    countries.forEach((country) => {
      const continent = country.continent?.trim() || 'Other';
      if (!groups.has(continent)) groups.set(continent, []);
      groups.get(continent)!.push(country);
    });
    const continentPriority = ['Asia', 'Europe', 'North America', 'South America', 'Africa', 'Oceania', 'Antarctica', 'Other'];
    return Array.from(groups.entries())
      .map(([continent, items]) => [continent, [...items].sort((a, b) => a.countryName.localeCompare(b.countryName))] as const)
      .sort((a, b) => {
        const ai = continentPriority.indexOf(a[0]);
        const bi = continentPriority.indexOf(b[0]);
        if (ai === -1 && bi === -1) return a[0].localeCompare(b[0]);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
  }, [countries]);

  useEffect(() => {
    if (countriesByContinent.length === 0) return;
    setContinentExpanded((prev) => {
      const next = { ...prev };
      countriesByContinent.forEach(([continent]) => {
        if (next[continent] === undefined) next[continent] = false;
      });
      return next;
    });
  }, [countriesByContinent]);

  const toggleCountry = (countryCode: string) => {
    setFilters((prev) => ({
      ...prev,
      selectedCountries: prev.selectedCountries.includes(countryCode)
        ? prev.selectedCountries.filter((c) => c !== countryCode)
        : [...prev.selectedCountries, countryCode],
    }));
  };

  const toggleHSCodeCategory = (hsCode: string) => {
    setFilters((prev) => {
      const selected = prev.selectedHSCodeCategories.includes(hsCode);
      const newCategories = selected
        ? prev.selectedHSCodeCategories.filter((c) => c !== hsCode)
        : [...prev.selectedHSCodeCategories, hsCode];

      let newSubcategories = prev.selectedHSCodeSubcategories;
      if (selected) {
        const subcategoriesToRemove = new Set<string>();
        shipments.forEach((s) => {
          if (s.hsCode && s.hsCode.length >= 4 && s.hsCode.slice(0, 2) === hsCode) {
            subcategoriesToRemove.add(s.hsCode.slice(2, 4));
          }
        });
        newSubcategories = prev.selectedHSCodeSubcategories.filter((s) => !subcategoriesToRemove.has(s));
      }
      return {
        ...prev,
        selectedHSCodeCategories: newCategories,
        selectedHSCodeSubcategories: newSubcategories,
      };
    });
  };

  const toggleHSCodeSubcategory = (suffix: string) => {
    setFilters((prev) => ({
      ...prev,
      selectedHSCodeSubcategories: prev.selectedHSCodeSubcategories.includes(suffix)
        ? prev.selectedHSCodeSubcategories.filter((s) => s !== suffix)
        : [...prev.selectedHSCodeSubcategories, suffix],
    }));
  };

  const toggleHS4 = (code4: string) => {
    setFilters((prev) => {
      const exists = prev.selectedHSCode4Digit.includes(code4);
      const next4 = exists
        ? prev.selectedHSCode4Digit.filter((code) => code !== code4)
        : [...prev.selectedHSCode4Digit, code4];
      const nextCategories = Array.from(new Set(next4.map((code) => code.slice(0, 2))));
      const nextSubcategories = Array.from(new Set(next4.map((code) => code.slice(2, 4))));
      return {
        ...prev,
        selectedHSCode4Digit: next4,
        selectedHSCodeCategories: nextCategories,
        selectedHSCodeSubcategories: nextSubcategories,
      };
    });
  };

  const showCountries = mode === 'all' || mode === 'country';
  const showHsCategories = mode === 'all' || mode === 'hscode';
  const showHsSubcategories = mode === 'all' || mode === 'hscode';
  const showTradeDirection = mode === 'country' || mode === 'hscode';
  const showHs4ModalSelector = mode === 'hscode';

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
            setFilters((prev) => ({
              startDate: '2021-01',
              endDate: `${currentYear}-${currentMonth}`,
              tradeDirection: 'import',
              selectedCountries: mode === 'country' ? ['CHN'] : [],
              selectedHSCode4Digit: mode === 'hscode' ? ['8542'] : [],
              selectedHSCodeCategories: mode === 'hscode' ? ['85'] : [],
              selectedHSCodeSubcategories: mode === 'hscode' ? ['42'] : [],
              selectedCompanies: [],
            }));
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
          setFilters((prev) => ({ ...prev, startDate: startMonth, endDate: endMonth }));
        }}
      />

      {showTradeDirection && (
        <section className="space-y-2.5">
          <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-widest">Trade Direction</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setFilters((prev) => ({ ...prev, tradeDirection: 'import' }))}
              className={`px-3 py-2.5 rounded-[12px] text-[12px] font-semibold border transition-all ${
                filters.tradeDirection === 'import'
                  ? 'bg-[#007AFF] text-white border-[#007AFF]'
                  : 'bg-[#F5F5F7] text-[#1D1D1F] border-black/5 hover:bg-[#EBEBEB]'
              }`}
            >
              Import
            </button>
            <button
              type="button"
              onClick={() => setFilters((prev) => ({ ...prev, tradeDirection: 'export' }))}
              className={`px-3 py-2.5 rounded-[12px] text-[12px] font-semibold border transition-all ${
                filters.tradeDirection === 'export'
                  ? 'bg-[#007AFF] text-white border-[#007AFF]'
                  : 'bg-[#F5F5F7] text-[#1D1D1F] border-black/5 hover:bg-[#EBEBEB]'
              }`}
            >
              Export
            </button>
          </div>
        </section>
      )}

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
                {filters.selectedCountries.length === 0 ? t('filters.selectAll') : `${filters.selectedCountries.length} ${t('filters.selected')}`}
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
                          setContinentExpanded((prev) => ({ ...prev, [continent]: !prev[continent] }));
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

      {showHs4ModalSelector && (
        <section className="space-y-2.5">
          <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-widest flex items-center gap-2.5">
            <Package className="w-4 h-4" /> HS Code (4-digit)
          </label>
          <button
            type="button"
            onClick={() => setHs4ModalOpen(true)}
            className="w-full bg-[#F5F5F7] border border-black/5 rounded-[12px] px-3 py-2.5 flex items-center justify-between text-[12px] text-[#1D1D1F] font-semibold hover:bg-[#EBEBEB] transition-all shadow-sm"
          >
            <span className="truncate">
              {filters.selectedHSCode4Digit.length === 0
                ? 'Select HSCode'
                : filters.selectedHSCode4Digit.join(', ')}
            </span>
          </button>
        </section>
      )}

      {showHsCategories && !showHs4ModalSelector && (
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
                {filters.selectedHSCodeCategories.length === 0 ? t('filters.selectAll') : `${filters.selectedHSCodeCategories.length} ${t('filters.selected')}`}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-[#86868B] transition-transform ${hsCodeCategoriesOpen ? 'rotate-180' : ''}`} />
            </button>
            {hsCodeCategoriesOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white/90 backdrop-blur-xl border border-black/5 rounded-[16px] shadow-2xl z-50 max-h-72 overflow-y-auto custom-scrollbar p-1.5 animate-in fade-in zoom-in-95 duration-200">
                {hsCodeCategories.length === 0 ? (
                  <div className="px-3 py-2 text-[12px] text-[#86868B]">{t('filters.loading')}</div>
                ) : (
                  [...hsCodeCategories].sort((a, b) => a.hsCode.localeCompare(b.hsCode)).map((cat) => (
                    <div
                      key={cat.hsCode}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleHSCodeCategory(cat.hsCode);
                      }}
                      className={`px-3 py-2.5 text-[12px] flex items-center justify-between cursor-pointer rounded-[8px] transition-colors mb-0.5 last:mb-0 ${
                        filters.selectedHSCodeCategories.includes(cat.hsCode) ? 'bg-[#007AFF] text-white font-bold' : 'text-[#1D1D1F] hover:bg-black/5'
                      }`}
                    >
                      <span className="font-semibold flex-1">{cat.chapterName} ({cat.hsCode})</span>
                      {filters.selectedHSCodeCategories.includes(cat.hsCode) && <Check className="w-3.5 h-3.5 flex-shrink-0 ml-2" />}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {showHsSubcategories && !showHs4ModalSelector && (
        <section className="space-y-2.5">
          <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-widest flex items-center gap-2.5">
            <Package className="w-4 h-4" /> {t('filters.hsCodeSubcategories') || 'HS Code Subcategories'}
          </label>
          <div className="relative" ref={hsCodeSubcategoriesRef}>
            <button
              onClick={() => setHsCodeSubcategoriesOpen(!hsCodeSubcategoriesOpen)}
              disabled={filters.selectedHSCodeCategories.length === 0}
              className={`w-full bg-[#F5F5F7] border border-black/5 rounded-[12px] px-3 py-2.5 flex items-center justify-between text-[12px] font-semibold transition-all shadow-sm ${
                filters.selectedHSCodeCategories.length === 0 ? 'opacity-50 cursor-not-allowed' : 'text-[#1D1D1F] hover:bg-[#EBEBEB] cursor-pointer'
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
                  availableSubcategories.map((suffix) => (
                    <div
                      key={suffix}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleHSCodeSubcategory(suffix);
                      }}
                      className={`px-3 py-2.5 text-[12px] flex items-center justify-between cursor-pointer rounded-[8px] transition-colors mb-0.5 last:mb-0 ${
                        filters.selectedHSCodeSubcategories.includes(suffix) ? 'bg-[#007AFF] text-white font-bold' : 'text-[#1D1D1F] hover:bg-black/5'
                      }`}
                    >
                      <span className="font-semibold flex-1">{suffix}</span>
                      {filters.selectedHSCodeSubcategories.includes(suffix) && <Check className="w-3.5 h-3.5 flex-shrink-0 ml-2" />}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {hs4ModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/35">
          <div className="w-[min(92vw,560px)] max-h-[80vh] bg-white rounded-[20px] border border-black/10 shadow-2xl p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[16px] font-bold text-[#1D1D1F]">Select 4-digit HS Codes</div>
              <button
                onClick={() => setHs4ModalOpen(false)}
                className="p-1 rounded-full hover:bg-black/5 text-[#86868B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-[12px] text-[#86868B] mb-3">
              Default: 8542 (Electronic integrated circuits)
            </div>
            <input
              type="text"
              value={hs4Search}
              onChange={(e) => setHs4Search(e.target.value)}
              placeholder="Search HSCode, e.g. 8542"
              className="w-full mb-3 px-3 py-2.5 rounded-[10px] border border-black/10 bg-[#F8F8FA] text-[12px] text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/25"
            />
            {customSearchHS4 && !availableHS4Codes.includes(customSearchHS4) && (
              <button
                type="button"
                onClick={() => toggleHS4(customSearchHS4)}
                className="w-full mb-3 px-3 py-2 rounded-[10px] border border-dashed border-[#007AFF]/50 bg-[#F2F8FF] text-[#007AFF] text-[12px] font-semibold text-left"
              >
                Select typed HSCode: {customSearchHS4}
              </button>
            )}
            <div className="overflow-y-auto custom-scrollbar pr-1 space-y-1.5">
              {filteredHS4Codes.map((code4) => {
                const selected = filters.selectedHSCode4Digit.includes(code4);
                const note = HS4_ANNOTATIONS[code4] || `HS ${code4} product group`;
                return (
                  <button
                    key={code4}
                    type="button"
                    onClick={() => toggleHS4(code4)}
                    className={`w-full px-3 py-2.5 rounded-[10px] border text-left transition-all ${
                      selected
                        ? 'bg-[#007AFF] text-white border-[#007AFF]'
                        : 'bg-[#F8F8FA] text-[#1D1D1F] border-black/5 hover:bg-[#EFEFF3]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[13px]">{code4}</span>
                      {selected && <Check className="w-3.5 h-3.5" />}
                    </div>
                    <div className={`text-[11px] mt-1 ${selected ? 'text-white/85' : 'text-[#86868B]'}`}>{note}</div>
                  </button>
                );
              })}
              {filteredHS4Codes.length === 0 && (
                <div className="text-[12px] text-[#86868B] px-2 py-1">No matched HSCode</div>
              )}
            </div>
            <div className="flex justify-end mt-4">
              <button
                type="button"
                onClick={() => setHs4ModalOpen(false)}
                className="px-4 py-2 rounded-[10px] bg-[#007AFF] text-white text-[12px] font-semibold hover:opacity-90"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SidebarFilters;
