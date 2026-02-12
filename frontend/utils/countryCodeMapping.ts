import { CountryLocation } from '../types';

const ISO2_TO_ISO3: Record<string, string> = {
  AU: 'AUS', BD: 'BGD', BR: 'BRA', CN: 'CHN', EG: 'EGY',
  FR: 'FRA', DE: 'DEU', IN: 'IND', ID: 'IDN', IT: 'ITA',
  JP: 'JPN', MY: 'MYS', MX: 'MEX', NL: 'NLD', PK: 'PAK',
  PH: 'PHL', SG: 'SGP', KR: 'KOR', ES: 'ESP', TH: 'THA',
  TR: 'TUR', AE: 'ARE', GB: 'GBR', US: 'USA', VN: 'VNM',
  TW: 'TWN', IS: 'ISR', IE: 'IRL',
};

const COUNTRY_NAME_TO_ISO3: Record<string, string> = {
  Taiwan: 'TWN',
  'Taiwan, Province of China': 'TWN',
  'Taiwan Province of China': 'TWN',
  'Republic of China': 'TWN',
  'United States': 'USA',
  'United States of America': 'USA',
  USA: 'USA',
  'United Kingdom': 'GBR',
  UK: 'GBR',
  'Great Britain': 'GBR',
  China: 'CHN',
  "People's Republic of China": 'CHN',
  'South Korea': 'KOR',
  'Korea, South': 'KOR',
  'Republic of Korea': 'KOR',
  Netherlands: 'NLD',
  Holland: 'NLD',
  'United Arab Emirates': 'ARE',
  UAE: 'ARE',
  Dubai: 'ARE',
  Japan: 'JPN',
  Germany: 'DEU',
  France: 'FRA',
  Italy: 'ITA',
  Spain: 'ESP',
  Brazil: 'BRA',
  Mexico: 'MEX',
  India: 'IND',
  Thailand: 'THA',
  Vietnam: 'VNM',
  Philippines: 'PHL',
  Indonesia: 'IDN',
  Malaysia: 'MYS',
  Singapore: 'SGP',
  Bangladesh: 'BGD',
  Pakistan: 'PAK',
  Egypt: 'EGY',
  Turkey: 'TUR',
  Australia: 'AUS',
  Korea: 'KOR',
};

export const resolveCountryIso3 = (
  props: Record<string, unknown>,
  countryLocationMap: Map<string, CountryLocation>
): string | undefined => {
  const countryName = String(props.name || '');
  let countryCode: string | undefined;

  if (countryName) {
    const matchedCountry = Array.from(countryLocationMap.values()).find(
      (loc) => loc.countryName && loc.countryName.toLowerCase() === countryName.toLowerCase()
    );
    if (matchedCountry) {
      const code2 = matchedCountry.countryCode;
      countryCode = ISO2_TO_ISO3[code2] || code2;
    }

    if (!countryCode && COUNTRY_NAME_TO_ISO3[countryName]) {
      countryCode = COUNTRY_NAME_TO_ISO3[countryName];
    }

    if (!countryCode) {
      const countryNameLower = countryName.toLowerCase();
      for (const [name, code] of Object.entries(COUNTRY_NAME_TO_ISO3)) {
        if (countryNameLower.includes(name.toLowerCase()) || name.toLowerCase().includes(countryNameLower)) {
          countryCode = code;
          break;
        }
      }
    }
  }

  if (!countryCode) {
    countryCode =
      String(props.ISO_A3 || props.iso_a3 || props.ISO3 || props.iso3 ||
        props.ISO_A3_EH || props.ISO_A3_TL || props.ADM0_A3 || props.adm0_a3 ||
        props.ISO_A3_ || props.iso_a3_ || props.ADM0_A3_IS || props.adm0_a3_is || '');
  }

  return countryCode || undefined;
};


