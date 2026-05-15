import type { CompanyDashboardControls, CompanyRankMetric, CompanyRoleFilter } from '../types';

export const ROLE_OPTIONS: Array<{ value: CompanyRoleFilter; label: string }> = [
  { value: '', label: 'All' },
  { value: 'importer', label: 'Import' },
  { value: 'exporter', label: 'Export' },
  { value: 'both', label: 'Both' },
];

export const RANK_METRIC_OPTIONS: Array<{ value: CompanyRankMetric; label: string }> = [
  { value: 'trade_value', label: 'Trade Value' },
  { value: 'trade_count', label: 'Trade Count' },
];

export const CONTINENT_OPTIONS = [
  { id: 'asia', label: 'Asia', countries: ['ARE', 'ARM', 'AZE', 'BGD', 'BHR', 'BRN', 'CHN', 'GEO', 'HKG', 'IDN', 'IND', 'ISR', 'JOR', 'JPN', 'KAZ', 'KHM', 'KOR', 'KWT', 'LAO', 'LKA', 'MAC', 'MMR', 'MNG', 'MYS', 'OMN', 'PAK', 'PHL', 'QAT', 'SAU', 'SGP', 'THA', 'TUR', 'TWN', 'VNM'] },
  { id: 'europe', label: 'Europe', countries: ['AUT', 'BEL', 'BGR', 'CHE', 'CZE', 'DEU', 'DNK', 'ESP', 'EST', 'FIN', 'FRA', 'GBR', 'GRC', 'HRV', 'HUN', 'IRL', 'ITA', 'LTU', 'LUX', 'LVA', 'NLD', 'NOR', 'POL', 'PRT', 'ROU', 'RUS', 'SVK', 'SVN', 'SWE', 'UKR'] },
  { id: 'north_america', label: 'North America', countries: ['CAN', 'CRI', 'DOM', 'GTM', 'HND', 'MEX', 'NIC', 'PAN', 'SLV', 'USA'] },
  { id: 'south_america', label: 'South America', countries: ['ARG', 'BOL', 'BRA', 'CHL', 'COL', 'ECU', 'PER', 'PRY', 'URY', 'VEN'] },
  { id: 'africa', label: 'Africa', countries: ['AGO', 'EGY', 'ETH', 'GHA', 'KEN', 'MAR', 'MUS', 'NGA', 'TUN', 'TZA', 'UGA', 'ZAF'] },
  { id: 'oceania', label: 'Oceania', countries: ['AUS', 'FJI', 'NZL'] },
];

export const HS_CATEGORY_LABELS: Record<string, string> = {
  '38': 'HS 38 Materials',
  '84': 'HS 84 Equipment',
  '85': 'HS 85 IC & Components',
  '90': 'HS 90 Instruments',
};

export const DEFAULT_COMPANY_CONTROLS: CompanyDashboardControls = {
  selectedBrand: '',
  selectedContinent: '',
  selectedCountry: '',
  selectedHsPrefix: '',
  selectedRole: '',
  rankMetric: 'trade_value',
};

export const getCompanyActiveCountries = (
  controls: CompanyDashboardControls,
  availableCountryCodes?: Set<string>
) => {
  if (controls.selectedCountry) return [controls.selectedCountry];
  if (!controls.selectedContinent) return [];

  const continent = CONTINENT_OPTIONS.find((item) => item.id === controls.selectedContinent);
  if (!continent) return [];
  if (!availableCountryCodes) return continent.countries;
  return continent.countries.filter((code) => availableCountryCodes.has(code));
};
