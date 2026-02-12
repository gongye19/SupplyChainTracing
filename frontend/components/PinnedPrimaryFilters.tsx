import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, ChevronDown, Check, Filter } from 'lucide-react';
import { CountryLocation, Filters } from '../types';
import MonthRangeSlider from './MonthRangeSlider';
import { useLanguage } from '../contexts/LanguageContext';

interface PinnedPrimaryFiltersProps {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  countries: CountryLocation[];
}

const PinnedPrimaryFilters: React.FC<PinnedPrimaryFiltersProps> = ({
  filters,
  setFilters,
  countries,
}) => {
  const { t } = useLanguage();
  const panelRef = useRef<HTMLDivElement>(null);
  const countriesRef = useRef<HTMLDivElement>(null);
  const [countriesOpen, setCountriesOpen] = useState(false);
  const [continentExpanded, setContinentExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (countriesRef.current && !countriesRef.current.contains(event.target as Node)) {
        setCountriesOpen(false);
      }
    };
    if (countriesOpen) {
      document.addEventListener('mousedown', onClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [countriesOpen]);

  const countriesByContinent = useMemo(() => {
    const groups = new Map<string, CountryLocation[]>();
    countries.forEach((country) => {
      const continent = country.continent?.trim() || 'Other';
      if (!groups.has(continent)) groups.set(continent, []);
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

    return Array.from(groups.entries())
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
  }, [countries]);

  useEffect(() => {
    if (countriesByContinent.length === 0) return;
    setContinentExpanded((prev) => {
      const next = { ...prev };
      countriesByContinent.forEach(([continent]) => {
        if (next[continent] === undefined) next[continent] = true;
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

  return (
    <div className="fixed top-24 left-5 z-40 w-[210px]" ref={panelRef}>
      <div className="bg-white rounded-[16px] border border-black/5 p-3 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#007AFF]">
            <Filter className="w-4 h-4" />
            <span className="text-[12px] font-bold uppercase tracking-widest text-[#1D1D1F]">
              {t('filters.filterControl')}
            </span>
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
            setFilters((prev) => ({ ...prev, startDate: startMonth, endDate: endMonth }));
          }}
        />

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
                                filters.selectedCountries.includes(country.countryCode)
                                  ? 'bg-[#007AFF] text-white font-bold'
                                  : 'text-[#1D1D1F] hover:bg-black/5'
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
      </div>
    </div>
  );
};

export default PinnedPrimaryFilters;

