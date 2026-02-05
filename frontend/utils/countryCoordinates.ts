/**
 * 国家代码到坐标的映射表
 * 用于在 port_locations 表不存在时提供国家位置信息
 */

export interface CountryCoordinate {
  countryCode: string;
  countryName: string;
  capitalLat: number;
  capitalLng: number;
  region?: string;
  continent?: string;
}

// 常见国家的坐标映射（国家代码 -> 坐标信息）
export const COUNTRY_COORDINATES: Record<string, CountryCoordinate> = {
  'CHN': { countryCode: 'CHN', countryName: 'China', capitalLat: 39.9042, capitalLng: 116.4074, region: 'East Asia', continent: 'Asia' },
  'USA': { countryCode: 'USA', countryName: 'United States', capitalLat: 38.9072, capitalLng: -77.0369, region: 'North America', continent: 'North America' },
  'JPN': { countryCode: 'JPN', countryName: 'Japan', capitalLat: 35.6762, capitalLng: 139.6503, region: 'East Asia', continent: 'Asia' },
  'KOR': { countryCode: 'KOR', countryName: 'South Korea', capitalLat: 37.5665, capitalLng: 126.9780, region: 'East Asia', continent: 'Asia' },
  'TWN': { countryCode: 'TWN', countryName: 'Taiwan', capitalLat: 25.0330, capitalLng: 121.5654, region: 'East Asia', continent: 'Asia' },
  'DEU': { countryCode: 'DEU', countryName: 'Germany', capitalLat: 52.5200, capitalLng: 13.4050, region: 'Central Europe', continent: 'Europe' },
  'GBR': { countryCode: 'GBR', countryName: 'United Kingdom', capitalLat: 51.5074, capitalLng: -0.1278, region: 'Western Europe', continent: 'Europe' },
  'FRA': { countryCode: 'FRA', countryName: 'France', capitalLat: 48.8566, capitalLng: 2.3522, region: 'Western Europe', continent: 'Europe' },
  'NLD': { countryCode: 'NLD', countryName: 'Netherlands', capitalLat: 52.3676, capitalLng: 4.9041, region: 'Western Europe', continent: 'Europe' },
  'SGP': { countryCode: 'SGP', countryName: 'Singapore', capitalLat: 1.2897, capitalLng: 103.8501, region: 'Southeast Asia', continent: 'Asia' },
  'MYS': { countryCode: 'MYS', countryName: 'Malaysia', capitalLat: 3.1390, capitalLng: 101.6869, region: 'Southeast Asia', continent: 'Asia' },
  'THA': { countryCode: 'THA', countryName: 'Thailand', capitalLat: 13.7563, capitalLng: 100.5018, region: 'Southeast Asia', continent: 'Asia' },
  'VNM': { countryCode: 'VNM', countryName: 'Vietnam', capitalLat: 21.0285, capitalLng: 105.8542, region: 'Southeast Asia', continent: 'Asia' },
  'PHL': { countryCode: 'PHL', countryName: 'Philippines', capitalLat: 14.5995, capitalLng: 120.9842, region: 'Southeast Asia', continent: 'Asia' },
  'IDN': { countryCode: 'IDN', countryName: 'Indonesia', capitalLat: -6.2088, capitalLng: 106.8456, region: 'Southeast Asia', continent: 'Asia' },
  'IND': { countryCode: 'IND', countryName: 'India', capitalLat: 28.6139, capitalLng: 77.2090, region: 'South Asia', continent: 'Asia' },
  'HKG': { countryCode: 'HKG', countryName: 'Hong Kong', capitalLat: 22.3193, capitalLng: 114.1694, region: 'East Asia', continent: 'Asia' },
  'AUS': { countryCode: 'AUS', countryName: 'Australia', capitalLat: -35.2809, capitalLng: 149.1300, region: 'Oceania', continent: 'Oceania' },
  'CAN': { countryCode: 'CAN', countryName: 'Canada', capitalLat: 45.4215, capitalLng: -75.6972, region: 'North America', continent: 'North America' },
  'MEX': { countryCode: 'MEX', countryName: 'Mexico', capitalLat: 19.4326, capitalLng: -99.1332, region: 'North America', continent: 'North America' },
  'BRA': { countryCode: 'BRA', countryName: 'Brazil', capitalLat: -15.7942, capitalLng: -47.8822, region: 'South America', continent: 'South America' },
  'ITA': { countryCode: 'ITA', countryName: 'Italy', capitalLat: 41.9028, capitalLng: 12.4964, region: 'Southern Europe', continent: 'Europe' },
  'ESP': { countryCode: 'ESP', countryName: 'Spain', capitalLat: 40.4168, capitalLng: -3.7038, region: 'Southern Europe', continent: 'Europe' },
  'BEL': { countryCode: 'BEL', countryName: 'Belgium', capitalLat: 50.8503, capitalLng: 4.3517, region: 'Western Europe', continent: 'Europe' },
  'CHE': { countryCode: 'CHE', countryName: 'Switzerland', capitalLat: 46.2044, capitalLng: 6.1432, region: 'Central Europe', continent: 'Europe' },
  'SWE': { countryCode: 'SWE', countryName: 'Sweden', capitalLat: 59.3293, capitalLng: 18.0686, region: 'Northern Europe', continent: 'Europe' },
  'IRL': { countryCode: 'IRL', countryName: 'Ireland', capitalLat: 53.3498, capitalLng: -6.2603, region: 'Northern Europe', continent: 'Europe' },
  'CYP': { countryCode: 'CYP', countryName: 'Cyprus', capitalLat: 35.1856, capitalLng: 33.3823, region: 'Western Asia', continent: 'Asia' },
  'AZE': { countryCode: 'AZE', countryName: 'Azerbaijan', capitalLat: 40.4093, capitalLng: 49.8671, region: 'Western Asia', continent: 'Asia' },
  'CZE': { countryCode: 'CZE', countryName: 'Czech Republic', capitalLat: 50.0755, capitalLng: 14.4378, region: 'Central Europe', continent: 'Europe' },
  'POL': { countryCode: 'POL', countryName: 'Poland', capitalLat: 52.2297, capitalLng: 21.0122, region: 'Central Europe', continent: 'Europe' },
  'RUS': { countryCode: 'RUS', countryName: 'Russia', capitalLat: 55.7558, capitalLng: 37.6173, region: 'Eastern Europe', continent: 'Europe' },
  'TUR': { countryCode: 'TUR', countryName: 'Turkey', capitalLat: 39.9334, capitalLng: 32.8597, region: 'Western Asia', continent: 'Asia' },
  'SAU': { countryCode: 'SAU', countryName: 'Saudi Arabia', capitalLat: 24.7136, capitalLng: 46.6753, region: 'Western Asia', continent: 'Asia' },
  'ARE': { countryCode: 'ARE', countryName: 'United Arab Emirates', capitalLat: 24.4539, capitalLng: 54.3773, region: 'Western Asia', continent: 'Asia' },
  'ISR': { countryCode: 'ISR', countryName: 'Israel', capitalLat: 31.7683, capitalLng: 35.2137, region: 'Western Asia', continent: 'Asia' },
  'ZAF': { countryCode: 'ZAF', countryName: 'South Africa', capitalLat: -25.7461, capitalLng: 28.1881, region: 'Southern Africa', continent: 'Africa' },
  'EGY': { countryCode: 'EGY', countryName: 'Egypt', capitalLat: 30.0444, capitalLng: 31.2357, region: 'Northern Africa', continent: 'Africa' },
  'ARG': { countryCode: 'ARG', countryName: 'Argentina', capitalLat: -34.6037, capitalLng: -58.3816, region: 'South America', continent: 'South America' },
  'CHL': { countryCode: 'CHL', countryName: 'Chile', capitalLat: -33.4489, capitalLng: -70.6693, region: 'South America', continent: 'South America' },
  'NZL': { countryCode: 'NZL', countryName: 'New Zealand', capitalLat: -41.2865, capitalLng: 174.7762, region: 'Oceania', continent: 'Oceania' },
};

/**
 * 根据国家代码获取坐标
 */
export function getCountryCoordinate(countryCode: string): CountryCoordinate | null {
  return COUNTRY_COORDINATES[countryCode] || null;
}

/**
 * 根据国家代码列表生成 CountryLocation 数组
 */
export function getCountriesFromCodes(countryCodes: string[]): CountryCoordinate[] {
  const uniqueCodes = Array.from(new Set(countryCodes));
  return uniqueCodes
    .map(code => COUNTRY_COORDINATES[code])
    .filter((coord): coord is CountryCoordinate => coord !== undefined);
}

