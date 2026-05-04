import React, { useEffect, useMemo, useState } from 'react';
import { Building2, ChevronLeft, ChevronRight, Package, Search, TrendingUp, Users, X } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { companiesAPI } from '../services/api';
import { CompanyDashboardData, CompanyFilterOptions, CompanyRankItem, CompanySearchResult } from '../types';

interface CompanyDashboardProps {
  startDate: string;
  endDate: string;
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
  'INTEL PRODUCTS VIETNAM CO LTD',
  'SAMSUNG ELECTRONICS CO LTD',
  'SAMSUNG ELECTRONICS VIETNAM CO LTD',
];

const ROLE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'importer', label: 'Import' },
  { value: 'exporter', label: 'Export' },
  { value: 'both', label: 'Both' },
] as const;

type CompanyRoleFilter = typeof ROLE_OPTIONS[number]['value'];

const RESULTS_PER_PAGE = 10;

const CONTINENT_OPTIONS = [
  { id: 'asia', label: 'Asia', countries: ['ARE', 'ARM', 'AZE', 'BGD', 'BHR', 'BRN', 'CHN', 'GEO', 'HKG', 'IDN', 'IND', 'ISR', 'JOR', 'JPN', 'KAZ', 'KHM', 'KOR', 'KWT', 'LAO', 'LKA', 'MAC', 'MMR', 'MNG', 'MYS', 'OMN', 'PAK', 'PHL', 'QAT', 'SAU', 'SGP', 'THA', 'TUR', 'TWN', 'VNM'] },
  { id: 'europe', label: 'Europe', countries: ['AUT', 'BEL', 'BGR', 'CHE', 'CZE', 'DEU', 'DNK', 'ESP', 'EST', 'FIN', 'FRA', 'GBR', 'GRC', 'HRV', 'HUN', 'IRL', 'ITA', 'LTU', 'LUX', 'LVA', 'NLD', 'NOR', 'POL', 'PRT', 'ROU', 'RUS', 'SVK', 'SVN', 'SWE', 'UKR'] },
  { id: 'north_america', label: 'North America', countries: ['CAN', 'CRI', 'DOM', 'GTM', 'HND', 'MEX', 'NIC', 'PAN', 'SLV', 'USA'] },
  { id: 'south_america', label: 'South America', countries: ['ARG', 'BOL', 'BRA', 'CHL', 'COL', 'ECU', 'PER', 'PRY', 'URY', 'VEN'] },
  { id: 'africa', label: 'Africa', countries: ['AGO', 'EGY', 'ETH', 'GHA', 'KEN', 'MAR', 'MUS', 'NGA', 'TUN', 'TZA', 'UGA', 'ZAF'] },
  { id: 'oceania', label: 'Oceania', countries: ['AUS', 'FJI', 'NZL'] },
];

const HS_CATEGORY_LABELS: Record<string, string> = {
  '38': 'HS 38 Materials',
  '84': 'HS 84 Equipment',
  '85': 'HS 85 IC & Components',
  '90': 'HS 90 Instruments',
};

const CompanyDashboard: React.FC<CompanyDashboardProps> = ({ startDate, endDate }) => {
  const [searchInput, setSearchInput] = useState('');
  const [selectedContinent, setSelectedContinent] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedHsPrefix, setSelectedHsPrefix] = useState('');
  const [selectedRole, setSelectedRole] = useState<CompanyRoleFilter>('');
  const [filterOptions, setFilterOptions] = useState<CompanyFilterOptions>({ countries: [], hsCategories: [] });
  const [results, setResults] = useState<CompanySearchResult[]>([]);
  const [resultPage, setResultPage] = useState(1);
  const [company, setCompany] = useState<CompanyDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    companiesAPI.getFilters()
      .then((data) => {
        if (active) setFilterOptions(data);
      })
      .catch(() => {
        if (active) setFilterOptions({ countries: [], hsCategories: [] });
      });
    return () => {
      active = false;
    };
  }, []);

  const availableCountryCodes = useMemo(
    () => new Set(filterOptions.countries.map((item) => item.countryCode)),
    [filterOptions.countries]
  );

  const continentCountryCodes = useMemo(() => {
    const selected = CONTINENT_OPTIONS.find((item) => item.id === selectedContinent);
    if (!selected) return [];
    return selected.countries.filter((code) => availableCountryCodes.has(code));
  }, [availableCountryCodes, selectedContinent]);

  const countryOptions = useMemo(() => {
    if (!selectedContinent) return filterOptions.countries;
    const allowed = new Set(continentCountryCodes);
    return filterOptions.countries.filter((item) => allowed.has(item.countryCode));
  }, [continentCountryCodes, filterOptions.countries, selectedContinent]);

  const activeCountries = useMemo(() => {
    if (selectedCountry) return [selectedCountry];
    if (selectedContinent) return continentCountryCodes;
    return [];
  }, [continentCountryCodes, selectedContinent, selectedCountry]);

  useEffect(() => {
    setResultPage(1);
  }, [searchInput, selectedContinent, selectedCountry, selectedHsPrefix, selectedRole]);

  const loadCompany = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    setSearching(false);
    setError(null);
    try {
      const data = await companiesAPI.getDashboard({
        name: trimmed,
        startYearMonth: startDate,
        endYearMonth: endDate,
        hsCodePrefix: selectedHsPrefix ? [selectedHsPrefix] : undefined,
        limit: 10,
      });
      setCompany(data);
      setSearchInput(data.name);
      setResults([]);
    } catch (err) {
      setCompany(null);
      setError(err instanceof Error ? err.message : 'Unable to load company');
    } finally {
      setLoading(false);
    }
  };

  const runSearch = async () => {
    const trimmed = searchInput.trim();
    setLoading(true);
    setSearching(false);
    setError(null);
    try {
      const data = await companiesAPI.search({
        query: trimmed,
        countries: activeCountries,
        hsCodePrefix: selectedHsPrefix ? [selectedHsPrefix] : undefined,
        role: selectedRole,
        limit: 100,
      });
      setResults(data);
      setResultPage(1);
      if (data.length === 0) {
        setCompany(null);
        setError('No company found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to search companies');
    } finally {
      setLoading(false);
    }
  };

  const trendData = useMemo(
    () => company?.trends.map((point) => ({ ...point, valueLabel: formatMoney(point.sumOfUsd) })) || [],
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
        <div className="bg-white rounded-[18px] border border-black/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-3">
          <div className="relative flex items-center bg-[#F5F5F7] rounded-[12px] border border-transparent focus-within:bg-white focus-within:border-[#007AFF]/30 transition-colors">
            <Search className="w-5 h-5 text-[#86868B] ml-4 shrink-0" />
            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') runSearch();
              }}
              placeholder="Search company name"
              className="flex-1 min-w-0 px-3 py-3 text-[15px] font-medium text-[#1D1D1F] placeholder:text-[#C7C7CC] bg-transparent outline-none"
            />
            {searchInput && (
              <button
                onClick={() => {
                  setSearchInput('');
                  setResults([]);
                  setCompany(null);
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
          </div>

          <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
            <FilterChips
              label="Continent"
              value={selectedContinent}
              onChange={(value) => {
                setSelectedContinent(value);
                setSelectedCountry('');
              }}
              options={CONTINENT_OPTIONS.map((item) => ({ value: item.id, label: item.label }))}
            />
            <FilterChips
              label="Country"
              value={selectedCountry}
              onChange={setSelectedCountry}
              options={countryOptions.map((item) => ({ value: item.countryCode, label: item.countryCode }))}
              disabled={!selectedContinent}
              emptyText="Select continent first"
            />
            <FilterChips
              label="Category"
              value={selectedHsPrefix}
              onChange={setSelectedHsPrefix}
              options={filterOptions.hsCategories.map((item) => ({
                value: item.hsPrefix,
                label: HS_CATEGORY_LABELS[item.hsPrefix] || `HS ${item.hsPrefix}`,
              }))}
            />
            <FilterChips
              label="Role"
              value={selectedRole}
              onChange={(value) => setSelectedRole(value as CompanyRoleFilter)}
              options={ROLE_OPTIONS.filter((option) => option.value).map((option) => ({
                value: option.value,
                label: option.label,
              }))}
            />
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              onClick={() => {
                setSelectedContinent('');
                setSelectedCountry('');
                setSelectedHsPrefix('');
                setSelectedRole('');
                setResults([]);
                setSearching(false);
              }}
              className="h-[34px] px-3 rounded-[9px] bg-[#F5F5F7] text-[12px] font-semibold text-[#86868B] hover:text-[#1D1D1F] transition-colors"
            >
              Clear Filters
            </button>
            <button
              onClick={runSearch}
              disabled={loading}
              className="h-[34px] px-4 rounded-[9px] bg-[#007AFF] text-white text-[12px] font-semibold hover:bg-[#0066CC] transition-colors disabled:opacity-60"
            >
              {loading ? 'Searching' : 'Apply Search'}
            </button>
          </div>
        </div>

        {results.length > 0 && (
          <div className="mt-3 bg-white border border-black/5 rounded-[14px] shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-black/5 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#86868B]">
                {results.length.toLocaleString()} Companies
              </span>
              <span className="text-[11px] font-semibold text-[#86868B]">
                Page {resultPage} / {totalResultPages}
              </span>
            </div>
            {pagedResults.map((result) => (
              <button
                key={`${result.name}-${result.countryCode || 'NA'}-${result.role}`}
                onClick={() => loadCompany(result.name)}
                className="w-full px-4 py-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 hover:bg-[#F5F5F7] border-b border-black/5 last:border-b-0 text-left"
              >
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-[#1D1D1F] truncate">{result.name}</div>
                  <div className="text-[11px] text-[#86868B]">{result.countryCode || 'N/A'} · {roleLabel(result.role)}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[12px] font-bold text-[#1D1D1F]">{formatMoney(result.totalTradeValue)}</div>
                  <div className="text-[10px] text-[#86868B]">{result.tradeCount.toLocaleString()} trades</div>
                </div>
              </button>
            ))}
            {totalResultPages > 1 && (
              <div className="px-3 py-2.5 border-t border-black/5 flex items-center justify-end gap-2">
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

      {error && (
        <div className="bg-white border border-black/5 rounded-[16px] px-5 py-4 text-[13px] font-semibold text-[#FF3B30] w-fit">
          {error}
        </div>
      )}

      {!company && !error && (
        <div className="flex flex-col items-center justify-start flex-1 pt-16 pb-24 gap-5 text-center">
          <div>
            <p className="text-[18px] font-bold text-[#1D1D1F] mb-1">Company Dashboard</p>
            <p className="text-[14px] text-[#86868B] max-w-sm">Search a company to view categories, suppliers, customers, and monthly trend.</p>
          </div>
          <div className="w-full max-w-3xl">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#86868B] mb-3">Popular Searches</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {SUGGESTED_COMPANIES.map((name) => (
                <button
                  key={name}
                  onClick={() => loadCompany(name)}
                  className="min-w-0 truncate px-3.5 py-2.5 rounded-[10px] text-[12px] font-semibold bg-white border border-black/[0.08] text-[#1D1D1F] hover:border-[#007AFF]/30 hover:text-[#007AFF] hover:bg-[#F0F7FF] transition-colors shadow-sm"
                  title={name}
                >
                  {name}
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
                  {company.countryCode || 'N/A'} · {roleLabel(company.role)}
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
                      <YAxis tickFormatter={formatMoney} tick={{ fontSize: 10, fill: '#86868B' }} width={62} />
                      <Tooltip formatter={(value: number) => [formatMoney(value), 'Trade Value']} />
                      <Area type="monotone" dataKey="sumOfUsd" stroke="#007AFF" fill="url(#companyTrend)" strokeWidth={2} />
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
                    <div className="text-[10px] text-[#86868B] mt-1">{formatMoney(category.sumOfUsd)} · {category.tradeCount.toLocaleString()} trades</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <RankTable
              title="Top 10 Suppliers"
              subtitle="Exporters selling to this company"
              items={company.topSuppliers}
              accentColor="#007AFF"
            />
            <RankTable
              title="Top 10 Customers"
              subtitle="Importers buying from this company"
              items={company.topCustomers}
              accentColor="#34C759"
            />
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
}> = ({ label, value, onChange, options, disabled = false, emptyText = 'No options' }) => {
  const visibleOptions = disabled ? [] : options;

  return (
    <div className={`rounded-[12px] border border-black/[0.08] bg-white p-3 min-w-0 ${disabled ? 'opacity-75' : ''}`}>
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
      <div className="flex flex-wrap gap-1.5 max-h-[96px] overflow-y-auto pr-1">
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
                value === ''
                  ? 'bg-[#007AFF] text-white'
                  : 'bg-[#F5F5F7] text-[#1D1D1F] hover:bg-black/10'
              }`}
            >
              All
            </button>
            {visibleOptions.map((option) => (
              <button
                type="button"
                key={option.value}
                onClick={() => onChange(option.value)}
                className={`px-2.5 py-1.5 rounded-[8px] text-[11px] font-semibold transition-colors ${
                  value === option.value
                    ? 'bg-[#007AFF] text-white'
                    : 'bg-[#F5F5F7] text-[#1D1D1F] hover:bg-black/10'
                }`}
                title={option.label}
              >
                {option.label}
              </button>
            ))}
            {visibleOptions.length === 0 && (
              <span className="px-2.5 py-1.5 rounded-[8px] bg-[#F5F5F7] text-[11px] font-semibold text-[#86868B]">
                {emptyText}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="text-right">
    <div className="text-[11px] text-[#86868B] font-bold uppercase tracking-wider mb-0.5">{label}</div>
    <div className="text-[18px] font-black text-[#1D1D1F] whitespace-nowrap">{value}</div>
  </div>
);

const RankTable: React.FC<{
  title: string;
  subtitle: string;
  items: CompanyRankItem[];
  accentColor: string;
}> = ({ title, subtitle, items, accentColor }) => (
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
              <div className="text-[10px] text-[#86868B]">{item.countryCode || 'N/A'} · {item.tradeCount.toLocaleString()} trades</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[13px] font-bold text-[#1D1D1F]">{formatMoney(item.sumOfUsd)}</div>
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
