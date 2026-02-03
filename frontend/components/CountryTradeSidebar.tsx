import React from 'react';
import { CountryTradeFilters } from '../types';
import HSCodeSelector from './HSCodeSelector';
import { useLanguage } from '../contexts/LanguageContext';

interface CountryTradeSidebarProps {
  filters: CountryTradeFilters;
  setFilters: React.Dispatch<React.SetStateAction<CountryTradeFilters>>;
}

const CountryTradeSidebar: React.FC<CountryTradeSidebarProps> = ({
  filters,
  setFilters,
}) => {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-6">
      <div className="h-[0.5px] bg-black/5"></div>
      
      {/* Filter Control Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-[#86868B]">
          <span className="text-[10px] uppercase font-bold tracking-wider">Filter Control</span>
        </div>

        {/* HS Code Filter */}
        <div>
          <HSCodeSelector
            selectedHSCodes={filters.hsCode || []}
            onHSCodeChange={(hsCodes) => setFilters({ ...filters, hsCode: hsCodes })}
          />
        </div>

        {/* Time Range Filter */}
        <div className="bg-white border border-black/5 rounded-[16px] p-4 shadow-sm">
          <h3 className="text-[14px] font-bold text-[#1D1D1F] mb-4">{t('countryTrade.timeRange')}</h3>
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-[11px] text-[#86868B] mb-2 block">{t('countryTrade.startMonth')}</label>
              <input
                type="month"
                value={filters.startYearMonth || '2021-01'}
                onChange={(e) => setFilters({ ...filters, startYearMonth: e.target.value })}
                className="w-full px-3 py-2 border border-black/10 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
              />
            </div>
            <div>
              <label className="text-[11px] text-[#86868B] mb-2 block">{t('countryTrade.endMonth')}</label>
              <input
                type="month"
                value={filters.endYearMonth || '2025-12'}
                onChange={(e) => setFilters({ ...filters, endYearMonth: e.target.value })}
                className="w-full px-3 py-2 border border-black/10 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CountryTradeSidebar;

