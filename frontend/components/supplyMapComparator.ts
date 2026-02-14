import {
  Filters,
  Shipment,
  Transaction,
  CountryLocation,
  CompanyWithLocation,
  Category,
} from '../types';

type SupplyMapProps = {
  shipments: Shipment[];
  transactions: Transaction[];
  selectedCountries: string[];
  countries: CountryLocation[];
  companies: CompanyWithLocation[];
  categories: Category[];
  filters?: Filters;
  isPreview?: boolean;
};

const sameStringArray = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value, idx) => value === b[idx]);

const sameFilters = (a?: Filters, b?: Filters) => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.startDate === b.startDate &&
    a.endDate === b.endDate &&
    a.tradeDirection === b.tradeDirection &&
    sameStringArray(a.selectedCountries, b.selectedCountries) &&
    sameStringArray(a.selectedHSCode4Digit, b.selectedHSCode4Digit) &&
    sameStringArray(a.selectedCompanies, b.selectedCompanies) &&
    sameStringArray(a.selectedHSCodeCategories, b.selectedHSCodeCategories) &&
    sameStringArray(a.selectedHSCodeSubcategories, b.selectedHSCodeSubcategories)
  );
};

const sameShipments = (a: Shipment[], b: Shipment[]) =>
  a.length === b.length &&
  a.every((shipment, idx) => {
    const next = b[idx];
    return (
      shipment.id === next?.id &&
      shipment.originId === next?.originId &&
      shipment.destinationId === next?.destinationId &&
      shipment.value === next?.value &&
      shipment.tradeCount === next?.tradeCount &&
      shipment.weight === next?.weight &&
      shipment.quantity === next?.quantity
    );
  });

export const areSupplyMapPropsEqual = (prevProps: SupplyMapProps, nextProps: SupplyMapProps) => {
  return (
    sameShipments(prevProps.shipments, nextProps.shipments) &&
    prevProps.transactions.length === nextProps.transactions.length &&
    prevProps.transactions.every((t, i) => t.id === nextProps.transactions[i]?.id) &&
    sameStringArray(prevProps.selectedCountries, nextProps.selectedCountries) &&
    prevProps.countries.length === nextProps.countries.length &&
    prevProps.companies.length === nextProps.companies.length &&
    prevProps.companies.every((c, i) => c.id === nextProps.companies[i]?.id) &&
    prevProps.categories.length === nextProps.categories.length &&
    prevProps.isPreview === nextProps.isPreview &&
    sameFilters(prevProps.filters, nextProps.filters)
  );
};


