import {
  Filters,
  Shipment,
  CountryLocation,
} from '../types';

type SupplyMapProps = {
  shipments: Shipment[];
  selectedCountries: string[];
  countries: CountryLocation[];
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
    sameStringArray(a.selectedHSCodes, b.selectedHSCodes) &&
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
      shipment.totalValueUsd === next?.totalValueUsd &&
      shipment.tradeCount === next?.tradeCount &&
      shipment.weight === next?.weight &&
      shipment.quantity === next?.quantity
    );
  });

export const areSupplyMapPropsEqual = (prevProps: SupplyMapProps, nextProps: SupplyMapProps) => {
  return (
    sameShipments(prevProps.shipments, nextProps.shipments) &&
    sameStringArray(prevProps.selectedCountries, nextProps.selectedCountries) &&
    prevProps.countries.length === nextProps.countries.length &&
    prevProps.isPreview === nextProps.isPreview &&
    sameFilters(prevProps.filters, nextProps.filters)
  );
};
