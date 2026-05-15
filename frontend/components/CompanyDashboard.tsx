import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, ChevronDown, ChevronLeft, ChevronRight, Package, Search, TrendingUp, Users, X } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { companiesAPI } from '../services/api';
import { CompanyDashboardControls, CompanyDashboardData, CompanyRankItem, CompanyRankMetric, CompanySearchResult } from '../types';
import {
  CONTINENT_OPTIONS,
  HS_CATEGORY_LABELS,
  ROLE_OPTIONS,
  getCompanyActiveCountries,
} from '../utils/companyDashboardFilters';

interface CompanyDashboardProps {
  startDate: string;
  endDate: string;
  controls: CompanyDashboardControls;
  setControls: React.Dispatch<React.SetStateAction<CompanyDashboardControls>>;
}

const HS2_COLOR_PALETTE: Record<string, string> = {
  '85': '#007AFF',
  '84': '#34C759',
  '38': '#FF9500',
  '90': '#AF52DE',
};

const getHsColor = (hsCode: string) => HS2_COLOR_PALETTE[hsCode.slice(0, 2)] || '#8E8E93';

const formatMoney = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
};

const roleLabel = (role: CompanyDashboardData['role']) => {
  if (role === 'both') return 'Importer / Exporter';
  if (role === 'importer') return 'Importer';
  if (role === 'exporter') return 'Exporter';
  return 'Company';
};

const SUGGESTED_COMPANIES = [
  { name: 'INTEL PRODUCTS VIETNAM', countryCode: 'VNM' },
  { name: 'NVIDIA SINGAPORE PTE LTD', countryCode: 'HKG' },
  { name: 'QUALCOMM CDMA TECHNOLOGIES ASIA PACIFIC', countryCode: 'SGP' },
];

const RESULTS_PER_PAGE = 10;

const CompanyDashboard: React.FC<CompanyDashboardProps> = ({ startDate, endDate, controls, setControls }) => {
  const [searchInput, setSearchInput] = useState('');
  const [filterOptions, setFilterOptions] = useState<{
    brands: { brandName: string }[];
    countries: { countryCode: string }[];
    hsCategories: { hsPrefix: string }[];
  }>({ brands: [], countries: [], hsCategories: [] });
  const [suggestions, setSuggestions] = useState<CompanySearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [results, setResults] = useState<CompanySearchResult[]>([]);
  const [resultPage, setResultPage] = useState(1);
  const [company, setCompany] = useState<CompanyDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suppressSuggestionsRef = useRef(false);
  const lastDashboardKeyRef = useRef('');

  useEffect(() => {
    let active = true;
    companiesAPI.getFilters()
      .then((data) => {
        if (active) setFilterOptions(data);
      })
      .catch(() => {
        if (active) setFilterOptions({ brands: [], countries: [], hsCategories: [] });
      });
    return () => {
      active = false;
    };
  }, []);

  const availableCountryCodes = useMemo(
    () => new Set(filterOptions.countries.map((item) => item.countryCode)),
    [filterOptions.countries]
  );

  const countryOptions = useMemo(() => {
    if (!controls.selectedContinent) return [];
    const selected = CONTINENT_OPTIONS.find((item) => item.id === controls.selectedContinent);
    const allowed = new Set((selected?.countries || []).filter((code) => availableCountryCodes.has(code)));
    return filterOptions.countries.filter((item) => allowed.has(item.countryCode));
  }, [availableCountryCodes, controls.selectedContinent, filterOptions.countries]);

  const brandOptions = useMemo(
    () => filterOptions.brands
      .slice()
      .sort((a, b) => a.brandName.localeCompare(b.brandName))
      .map((item) => ({ value: item.brandName, label: item.brandName })),
    [filterOptions.brands]
  );

  const activeCountries = useMemo(() => {
    return getCompanyActiveCountries(controls, availableCountryCodes);
  }, [availableCountryCodes, controls]);

  useEffect(() => {
    setResultPage(1);
  }, [searchInput, controls]);

  const countrySummary = (countryCode?: string, countryCount = 0) => {
    if (!countryCode) return 'N/A';
    if (countryCount > 1) return `${countryCode} +${countryCount - 1}`;
    return countryCode;
  };

  const rankMetricLabel = controls.rankMetric === 'trade_count' ? 'Trade Count' : 'Trade Value';
  const trendMetricKey = controls.rankMetric === 'trade_count' ? 'tradeCount' : 'sumOfUsd';
  const formatTrendMetric = (value: number) => (
    controls.rankMetric === 'trade_count' ? value.toLocaleString() : formatMoney(value)
  );
  const metaText = (brandName?: string, countryCode?: string, countryCount = 0, role?: CompanyDashboardData['role']) => (
    [brandName, countrySummary(countryCode, countryCount), role ? roleLabel(role) : undefined].filter(Boolean).join(' · ')
  );

  const updateControls = (patch: Partial<CompanyDashboardControls>) => {
    setControls((prev) => ({ ...prev, ...patch }));
  };

  const getDashboardKey = (name: string, countryCode?: string) => [
    name,
    countryCode || 'all-countries',
    startDate,
    endDate,
    controls.selectedHsPrefix || 'all-hs',
    controls.rankMetric,
  ].join('|');

  const loadCompany = async (name: string, countryCode?: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    suppressSuggestionsRef.current = true;
    setSuggestions([]);
    setShowSuggestions(false);
    setLoading(true);
    setSearching(false);
    setError(null);
    try {
      const data = await companiesAPI.getDashboard({
        name: trimmed,
        countryCode,
        startYearMonth: startDate,
        endYearMonth: endDate,
        hsCodePrefix: controls.selectedHsPrefix ? [controls.selectedHsPrefix] : undefined,
        metric: controls.rankMetric,
        limit: 10,
      });
      lastDashboardKeyRef.current = getDashboardKey(data.name, data.countryCode);
      setCompany(data);
      setSearchInput(data.name);
      setResults([]);
      setSuggestions([]);
      setShowSuggestions(false);
    } catch (err) {
      setCompany(null);
      setError(err instanceof Error ? err.message : 'Unable to load company');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const trimmed = searchInput.trim();
    if (suppressSuggestionsRef.current) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    if (trimmed.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const data = await companiesAPI.search({
          query: trimmed,
          brands: controls.selectedBrand ? [controls.selectedBrand] : undefined,
          countries: activeCountries,
          hsCodePrefix: controls.selectedHsPrefix ? [controls.selectedHsPrefix] : undefined,
          role: controls.selectedRole,
          metric: controls.rankMetric,
          limit: 10,
        });
        if (active && !suppressSuggestionsRef.current) {
          setSuggestions(data);
          setShowSuggestions(data.length > 0);
        }
      } catch {
        if (active && !suppressSuggestionsRef.current) {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [activeCountries, controls.rankMetric, controls.selectedBrand, controls.selectedHsPrefix, controls.selectedRole, searchInput]);

  const runSearch = async () => {
    const trimmed = searchInput.trim();
    suppressSuggestionsRef.current = true;
    setSuggestions([]);
    setShowSuggestions(false);
    setLoading(true);
    setSearching(false);
    setError(null);
    try {
      const data = await companiesAPI.search({
        query: trimmed,
        brands: controls.selectedBrand ? [controls.selectedBrand] : undefined,
        countries: activeCountries,
        hsCodePrefix: controls.selectedHsPrefix ? [controls.selectedHsPrefix] : undefined,
        role: controls.selectedRole,
        metric: controls.rankMetric,
        limit: 100,
      });
      setResults(data);
      setShowSuggestions(false);
      setResultPage(1);
      if (data.length === 0) {
        setCompany(null);
        lastDashboardKeyRef.current = '';
        setError('No company found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to search companies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const selectedName = company?.name;
    const selectedCountryCode = company?.countryCode;
    if (!selectedName) return;

    const dashboardKey = getDashboardKey(selectedName, selectedCountryCode);
    if (lastDashboardKeyRef.current === dashboardKey) return;

    let active = true;
    suppressSuggestionsRef.current = true;
    setSuggestions([]);
    setShowSuggestions(false);
    setLoading(true);
    setError(null);

    companiesAPI.getDashboard({
      name: selectedName,
      countryCode: selectedCountryCode,
      startYearMonth: startDate,
      endYearMonth: endDate,
      hsCodePrefix: controls.selectedHsPrefix ? [controls.selectedHsPrefix] : undefined,
      metric: controls.rankMetric,
      limit: 10,
    })
      .then((data) => {
        if (!active) return;
        lastDashboardKeyRef.current = getDashboardKey(data.name, data.countryCode);
        setCompany(data);
        setSearchInput(data.name);
        setResults([]);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to refresh company');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [company?.countryCode, company?.name, controls.rankMetric, controls.selectedHsPrefix, endDate, startDate]);

  const trendData = useMemo(
    () => company?.trends || [],
    [company]
  );

  const totalResultPages = Math.max(1, Math.ceil(results.length / RESULTS_PER_PAGE));
  const pagedResults = useMemo(
    () => results.slice((resultPage - 1) * RESULTS_PER_PAGE, resultPage * RESULTS_PER_PAGE),
    [resultPage, results]
  );

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-[#F5F5F7] p-6 gap-6">
      <div className="flex items-center gap-2 text-[12px] text-[#86868B] bg-white/80 backdrop-blur px-4 py-2.5 rounded-[12px] border border-black/5 w-fit shadow-sm">
        <span className="font-bold uppercase tracking-wider">Time Range</span>
        <span className="text-black/20">|</span>
        <span className="font-semibold text-[#1D1D1F]">{startDate} - {endDate}</span>
      </div>

      <div className="w-full max-w-4xl mx-auto">
        <div className="mb-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="lg:col-span-2">
            <BrandSelect
              label="Brand"
              value={controls.selectedBrand}
              onChange={(value) => updateControls({ selectedBrand: value })}
              options={brandOptions}
            />
          </div>
          <FilterChips
            label="Continent"
            value={controls.selectedContinent}
            onChange={(value) => updateControls({ selectedContinent: value, selectedCountry: '' })}
            options={CONTINENT_OPTIONS.map((item) => ({ value: item.id, label: item.label }))}
          />
          <FilterChips
            label="Country"
            value={controls.selectedCountry}
            onChange={(value) => updateControls({ selectedCountry: value })}
            options={countryOptions.map((item) => ({ value: item.countryCode, label: item.countryCode }))}
            disabled={!controls.selectedContinent}
            emptyText="Select continent first"
          />
          <FilterChips
            label="Category"
            value={controls.selectedHsPrefix}
            onChange={(value) => updateControls({ selectedHsPrefix: value })}
            options={filterOptions.hsCategories.map((item) => ({
              value: item.hsPrefix,
              label: HS_CATEGORY_LABELS[item.hsPrefix] || `HS ${item.hsPrefix}`,
            }))}
          />
          <FilterChips
            label="Role"
            value={controls.selectedRole}
            onChange={(value) => updateControls({ selectedRole: value as CompanyDashboardControls['selectedRole'] })}
            options={ROLE_OPTIONS.filter((option) => option.value).map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
        </div>

        <div className="bg-white rounded-[18px] border border-black/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-3">
          <div className="relative flex items-center bg-[#F5F5F7] rounded-[12px] border border-transparent focus-within:bg-white focus-within:border-[#007AFF]/30 transition-colors">
            <Search className="w-5 h-5 text-[#86868B] ml-4 shrink-0" />
            <input
              type="text"
              value={searchInput}
              onChange={(event) => {
                suppressSuggestionsRef.current = false;
                setSearchInput(event.target.value);
                setError(null);
              }}
              onFocus={() => {
                if (!suppressSuggestionsRef.current && suggestions.length > 0) setShowSuggestions(true);
              }}
              onBlur={() => {
                window.setTimeout(() => setShowSuggestions(false), 120);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') runSearch();
                if (event.key === 'Escape') setShowSuggestions(false);
              }}
              placeholder="No company name yet? Select filters above, then click Search to browse companies"
              className="flex-1 min-w-0 px-3 py-3 text-[15px] font-medium text-[#1D1D1F] placeholder:text-[#C7C7CC] bg-transparent outline-none"
            />
            {searchInput && (
              <button
                onClick={() => {
                  suppressSuggestionsRef.current = false;
                  setSearchInput('');
                  setResults([]);
                  setCompany(null);
                  lastDashboardKeyRef.current = '';
                  setSuggestions([]);
                  setShowSuggestions(false);
                  setError(null);
                  setSearching(false);
                }}
                className="mr-2 p-1.5 rounded-full hover:bg-black/5 transition-colors shrink-0"
                title="Clear"
              >
                <X className="w-4 h-4 text-[#86868B]" />
              </button>
            )}
            <button
              onClick={runSearch}
              disabled={loading}
              className="mr-1.5 min-w-[84px] px-4 py-2 bg-[#007AFF] text-white text-[13px] font-semibold rounded-[10px] hover:bg-[#0066CC] transition-colors disabled:opacity-60 shrink-0"
            >
              {loading || searching ? 'Loading' : 'Search'}
            </button>
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 bg-white border border-black/10 rounded-[14px] shadow-[0_14px_40px_rgba(0,0,0,0.14)] overflow-hidden">
                {suggestions.map((item) => (
                  <button
                    key={`${item.name}-${item.countryCode || 'NA'}-${item.role}`}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => loadCompany(item.name, item.countryCode)}
                    className="w-full px-4 py-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 text-left hover:bg-[#F5F5F7] border-b border-black/5 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-[#1D1D1F] truncate">{item.name}</div>
                      <div className="text-[11px] text-[#86868B] truncate">
                        {metaText(item.brandName, item.countryCode, item.countryCount, item.role)}
                      </div>
                    </div>
                    <div className="text-[11px] font-bold text-[#86868B] shrink-0">
                      {controls.rankMetric === 'trade_count' ? item.tradeCount.toLocaleString() : formatMoney(item.totalTradeValue)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {error && (
            <div className="mt-3 flex justify-center">
              <div className="w-fit max-w-full rounded-[12px] bg-[#FFF2F2] border border-[#FF3B30]/15 px-4 py-3 text-center text-[13px] font-semibold text-[#FF3B30]">
                {error}
              </div>
            </div>
          )}
        </div>

        {results.length > 0 && (
          <div className="mt-3 bg-white border border-black/5 rounded-[14px] shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-black/5 flex items-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#86868B]">
                {results.length.toLocaleString()} Companies
              </span>
            </div>
            {pagedResults.map((result) => (
              <button
                key={`${result.name}-${result.countryCode || 'NA'}-${result.role}`}
                onClick={() => loadCompany(result.name, result.countryCode)}
                className="w-full px-4 py-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 hover:bg-[#F5F5F7] border-b border-black/5 last:border-b-0 text-left"
              >
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-[#1D1D1F] truncate">{result.name}</div>
                  <div className="text-[11px] text-[#86868B] truncate">
                    {metaText(result.brandName, result.countryCode, result.countryCount, result.role)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[12px] font-bold text-[#1D1D1F]">
                    {controls.rankMetric === 'trade_count' ? result.tradeCount.toLocaleString() : formatMoney(result.totalTradeValue)}
                  </div>
                  <div className="text-[10px] text-[#86868B]">
                    {controls.rankMetric === 'trade_count' ? formatMoney(result.totalTradeValue) : `${result.tradeCount.toLocaleString()} trades`}
                  </div>
                </div>
              </button>
            ))}
            {totalResultPages > 1 && (
              <div className="px-3 py-2.5 border-t border-black/5 flex items-center justify-end gap-3">
                <span className="text-[11px] font-semibold text-[#86868B]">
                  Page {resultPage} / {totalResultPages}
                </span>
                <button
                  onClick={() => setResultPage((page) => Math.max(1, page - 1))}
                  disabled={resultPage <= 1}
                  className="w-8 h-8 rounded-[8px] bg-[#F5F5F7] flex items-center justify-center disabled:opacity-40 hover:bg-black/10 transition-colors"
                  title="Previous page"
                >
                  <ChevronLeft className="w-4 h-4 text-[#1D1D1F]" />
                </button>
                <button
                  onClick={() => setResultPage((page) => Math.min(totalResultPages, page + 1))}
                  disabled={resultPage >= totalResultPages}
                  className="w-8 h-8 rounded-[8px] bg-[#F5F5F7] flex items-center justify-center disabled:opacity-40 hover:bg-black/10 transition-colors"
                  title="Next page"
                >
                  <ChevronRight className="w-4 h-4 text-[#1D1D1F]" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {!company && !error && (
        <div className="flex flex-col items-center justify-start flex-1 pt-16 pb-24 gap-5 text-center">
          <div>
            <p className="text-[18px] font-bold text-[#1D1D1F] mb-1">Company Dashboard</p>
            <p className="text-[14px] text-[#86868B] max-w-sm">Search a company to view categories, suppliers, customers, and monthly trend.</p>
          </div>
          <div className="w-full max-w-3xl">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#86868B] mb-3">Popular Searches</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {SUGGESTED_COMPANIES.map((item) => (
                <button
                  key={`${item.name}-${item.countryCode}`}
                  onClick={() => loadCompany(item.name, item.countryCode)}
                  className="min-w-0 truncate px-3.5 py-2.5 rounded-[10px] text-[12px] font-semibold bg-white border border-black/[0.08] text-[#1D1D1F] hover:border-[#007AFF]/30 hover:text-[#007AFF] hover:bg-[#F0F7FF] transition-colors shadow-sm"
                  title={`${item.name} · ${item.countryCode}`}
                >
                  {item.name} · {item.countryCode}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {company && (
        <div className="flex flex-col gap-5">
          <div className="bg-white rounded-[20px] border border-black/5 shadow-sm px-6 py-5 flex items-center justify-between gap-6">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-[14px] bg-[#F5F5F7] flex items-center justify-center border border-black/5">
                <Building2 className="w-6 h-6 text-[#1D1D1F]" />
              </div>
              <div className="min-w-0">
                <h2 className="text-[18px] font-bold text-[#1D1D1F] truncate">{company.name}</h2>
                <div className="text-[12px] text-[#86868B] font-medium mt-0.5">
                  {metaText(company.brandName, company.countryCode, company.countryCount, company.role)}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-6 shrink-0">
              <Metric label="Total Value" value={formatMoney(company.totalTradeValue)} />
              <Metric label="Trade Count" value={company.totalTradeCount.toLocaleString()} />
              <Metric label="As Importer" value={formatMoney(company.importTradeValue)} />
              <Metric label="As Exporter" value={formatMoney(company.exportTradeValue)} />
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2 bg-white rounded-[20px] border border-black/5 shadow-sm p-6 min-w-0">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-[#007AFF]" />
                <span className="text-[15px] font-bold text-[#1D1D1F]">Monthly Trend</span>
              </div>
              <div className="h-[260px] min-h-[260px] min-w-0">
                {trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <AreaChart data={trendData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="companyTrend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#007AFF" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#007AFF" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" />
                      <XAxis dataKey="yearMonth" tick={{ fontSize: 10, fill: '#86868B' }} minTickGap={28} />
                      <YAxis tickFormatter={(value) => formatTrendMetric(Number(value))} tick={{ fontSize: 10, fill: '#86868B' }} width={72} />
                      <Tooltip formatter={(value: number) => [formatTrendMetric(Number(value)), rankMetricLabel]} />
                      <Area type="monotone" dataKey={trendMetricKey} stroke="#007AFF" fill="url(#companyTrend)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-[13px] text-[#86868B]">No trend data</div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-[20px] border border-black/5 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <Package className="w-4 h-4 text-[#34C759]" />
                <span className="text-[15px] font-bold text-[#1D1D1F]">HS Categories</span>
              </div>
              <div className="space-y-3">
                {company.categories.map((category) => (
                  <div key={category.hsCode}>
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getHsColor(category.hsCode) }} />
                        <span className="text-[12px] font-semibold text-[#1D1D1F] truncate">{category.hsCode}</span>
                      </div>
                      <span className="text-[11px] font-bold text-[#86868B]">{(category.sharePct * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 bg-[#F5F5F7] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(category.sharePct * 100, 100)}%`, backgroundColor: getHsColor(category.hsCode) }} />
                    </div>
                    <div className="text-[10px] text-[#86868B] mt-1">
                      {controls.rankMetric === 'trade_count'
                        ? `${category.tradeCount.toLocaleString()} trades`
                        : formatMoney(category.sumOfUsd)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <RankTable
              title="Top 10 Suppliers"
              subtitle={`Exporters selling to this company · ranked by ${rankMetricLabel}`}
              items={company.topSuppliers}
              accentColor="#007AFF"
              rankMetric={controls.rankMetric}
            />
            <RankTable
              title="Top 10 Customers"
              subtitle={`Importers buying from this company · ranked by ${rankMetricLabel}`}
              items={company.topCustomers}
              accentColor="#34C759"
              rankMetric={controls.rankMetric}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="text-right">
    <div className="text-[11px] text-[#86868B] font-bold uppercase tracking-wider mb-0.5">{label}</div>
    <div className="text-[18px] font-black text-[#1D1D1F] whitespace-nowrap">{value}</div>
  </div>
);

const BrandSelect: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}> = ({ label, value, onChange, options }) => {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const selectedLabel = options.find((option) => option.value === value)?.label || 'All Brands';
  const groups = useMemo(() => {
    const grouped = new Map<string, Array<{ value: string; label: string }>>();
    options.forEach((option) => {
      const first = option.label.trim().charAt(0).toUpperCase();
      const letter = /^[A-Z]$/.test(first) ? first : '#';
      grouped.set(letter, [...(grouped.get(letter) || []), option]);
    });
    return Array.from(grouped.entries()).map(([letter, items]) => ({ letter, items }));
  }, [options]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [isOpen]);

  const selectValue = (nextValue: string) => {
    onChange(nextValue);
    setIsOpen(false);
  };

  const jumpToLetter = (letter: string) => {
    groupRefs.current[letter]?.scrollIntoView({ block: 'start' });
  };

  return (
    <div ref={rootRef} className="relative rounded-[14px] border border-black/[0.08] bg-white p-3 min-w-0">
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#86868B]">{label}</span>
        {value && (
          <button
            type="button"
            onClick={() => selectValue('')}
            className="text-[10px] font-bold text-[#86868B] hover:text-[#1D1D1F] transition-colors"
          >
            Clear
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setIsOpen(false);
        }}
        className="w-full rounded-[10px] bg-[#F5F5F7] border border-transparent px-3.5 py-2.5 text-left text-[12px] font-semibold text-[#1D1D1F] outline-none transition-colors hover:bg-black/[0.06] focus:bg-white focus:border-[#007AFF]/30 flex items-center justify-between gap-3"
        aria-expanded={isOpen}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className={`h-4 w-4 text-[#86868B] shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute left-3 right-3 top-[calc(100%-4px)] z-30 overflow-hidden rounded-[14px] border border-black/10 bg-white shadow-[0_16px_40px_rgba(0,0,0,0.14)]">
          <div className="grid grid-cols-[38px_minmax(0,1fr)] max-h-[280px]">
            <div className="bg-[#F5F5F7] border-r border-black/5 p-1.5 overflow-y-auto">
              {groups.map((group) => (
                <button
                  key={group.letter}
                  type="button"
                  onClick={() => jumpToLetter(group.letter)}
                  className="w-full h-6 rounded-[6px] text-[10px] font-black text-[#86868B] hover:bg-white hover:text-[#007AFF] transition-colors"
                  title={`Jump to ${group.letter}`}
                >
                  {group.letter}
                </button>
              ))}
            </div>
            <div className="max-h-[280px] overflow-y-auto p-1.5">
              <button
                type="button"
                onClick={() => selectValue('')}
                className={`w-full px-3 py-2 rounded-[8px] text-left text-[12px] font-semibold transition-colors ${
                  value === '' ? 'bg-[#007AFF] text-white' : 'text-[#1D1D1F] hover:bg-[#F5F5F7]'
                }`}
              >
                All Brands
              </button>
              {groups.map((group) => (
                <div
                  key={group.letter}
                  ref={(node) => {
                    groupRefs.current[group.letter] = node;
                  }}
                >
                  <div className="sticky top-0 bg-white/95 backdrop-blur px-3 py-1.5 text-[10px] font-black text-[#86868B]">
                    {group.letter}
                  </div>
                  {group.items.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => selectValue(option.value)}
                      className={`w-full px-3 py-2 rounded-[8px] text-left text-[12px] font-semibold transition-colors ${
                        value === option.value ? 'bg-[#007AFF] text-white' : 'text-[#1D1D1F] hover:bg-[#F5F5F7]'
                      }`}
                      title={option.label}
                    >
                      <span className="block truncate">{option.label}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const FilterChips: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
  emptyText?: string;
}> = ({ label, value, onChange, options, disabled = false, emptyText = 'No options' }) => (
  <div className={`rounded-[14px] border border-black/[0.08] bg-white p-3 min-w-0 ${disabled ? 'opacity-75' : ''}`}>
    <div className="flex items-center justify-between gap-3 mb-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#86868B]">{label}</span>
      {value && !disabled && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="text-[10px] font-bold text-[#86868B] hover:text-[#1D1D1F] transition-colors"
        >
          Clear
        </button>
      )}
    </div>
    <div className="flex flex-wrap gap-1.5 max-h-[92px] overflow-y-auto pr-1">
      {disabled ? (
        <span className="px-2.5 py-1.5 rounded-[8px] bg-[#F5F5F7] text-[11px] font-semibold text-[#86868B]">
          {emptyText}
        </span>
      ) : (
        <>
          <button
            type="button"
            onClick={() => onChange('')}
            className={`px-2.5 py-1.5 rounded-[8px] text-[11px] font-semibold transition-colors ${
              value === '' ? 'bg-[#007AFF] text-white' : 'bg-[#F5F5F7] text-[#1D1D1F] hover:bg-black/10'
            }`}
          >
            All
          </button>
          {options.map((option) => (
            <button
              type="button"
              key={option.value}
              onClick={() => onChange(option.value)}
              className={`px-2.5 py-1.5 rounded-[8px] text-[11px] font-semibold transition-colors ${
                value === option.value ? 'bg-[#007AFF] text-white' : 'bg-[#F5F5F7] text-[#1D1D1F] hover:bg-black/10'
              }`}
              title={option.label}
            >
              {option.label}
            </button>
          ))}
          {options.length === 0 && (
            <span className="px-2.5 py-1.5 rounded-[8px] bg-[#F5F5F7] text-[11px] font-semibold text-[#86868B]">
              {emptyText}
            </span>
          )}
        </>
      )}
    </div>
  </div>
);

const RankTable: React.FC<{
  title: string;
  subtitle: string;
  items: CompanyRankItem[];
  accentColor: string;
  rankMetric: CompanyRankMetric;
}> = ({ title, subtitle, items, accentColor, rankMetric }) => (
  <div className="bg-white rounded-[20px] border border-black/5 shadow-sm p-6">
    <div className="flex items-center gap-2 mb-1">
      <Users className="w-4 h-4" style={{ color: accentColor }} />
      <span className="text-[15px] font-bold text-[#1D1D1F]">{title}</span>
    </div>
    <p className="text-[11px] text-[#86868B] mb-4">{subtitle}</p>
    <div className="flex flex-col gap-0.5">
      {items.length === 0 ? (
        <div className="text-[13px] text-[#86868B] py-8 text-center">No records</div>
      ) : (
        items.map((item) => (
          <div key={`${item.rank}-${item.company}-${item.countryCode || ''}`} className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] hover:bg-[#F5F5F7] transition-colors">
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0"
              style={{
                backgroundColor: item.rank <= 3 ? accentColor : '#F5F5F7',
                color: item.rank <= 3 ? '#fff' : '#86868B',
              }}
            >
              {item.rank}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-[#1D1D1F] truncate">{item.company}</div>
              <div className="text-[10px] text-[#86868B] truncate">
                {[item.brandName, item.countryCode || 'N/A'].filter(Boolean).join(' · ')}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[13px] font-bold text-[#1D1D1F]">
                {rankMetric === 'trade_count' ? `${item.tradeCount.toLocaleString()} trades` : formatMoney(item.sumOfUsd)}
              </div>
              <div className="text-[10px] text-[#86868B]">{(item.sharePct * 100).toFixed(1)}%</div>
            </div>
            <div className="w-14 h-1.5 bg-[#F5F5F7] rounded-full overflow-hidden shrink-0">
              <div className="h-full rounded-full" style={{ width: `${Math.min(item.sharePct * 100, 100)}%`, backgroundColor: accentColor, opacity: 0.7 }} />
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);

export default CompanyDashboard;
