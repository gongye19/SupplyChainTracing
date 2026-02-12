import React from 'react';
import { CountryTradeFilters } from '../types';
import HSCodeSelector from './HSCodeSelector';
import { useLanguage } from '../contexts/LanguageContext';
import { Filter } from 'lucide-react';
import MonthRangeSlider from './MonthRangeSlider';

interface CountryTradeSidebarProps {
  filters: CountryTradeFilters;
  setFilters: React.Dispatch<React.SetStateAction<CountryTradeFilters>>;
  availableHSCodes: string[];
}

const CountryTradeSidebar: React.FC<CountryTradeSidebarProps> = ({
  filters,
  setFilters,
  availableHSCodes,
}) => {
  const { t } = useLanguage();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const handleReset = () => {
    setFilters({
      hsCode: [],
      industry: 'SemiConductor',
      startYearMonth: '2021-01',
      endYearMonth: currentMonth,
    });
  };

  return (
    <div className="flex flex-col gap-10 p-1">
      <div className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-white/95 backdrop-blur-sm border-b border-black/5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[#007AFF]">
          <Filter className="w-4 h-4" />
          <span className="text-[12px] font-bold uppercase tracking-widest text-[#1D1D1F]">{t('filters.filterControl')}</span>
        </div>
        <button
          onClick={handleReset}
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
        startMonth={filters.startYearMonth || '2021-01'}
        endMonth={filters.endYearMonth || currentMonth}
        onChange={(startMonth, endMonth) => {
          setFilters({ ...filters, startYearMonth: startMonth, endYearMonth: endMonth });
        }}
      />

      {/* HS Code Filter */}
      <div>
        <HSCodeSelector
          selectedHSCodes={filters.hsCode || []}
          onHSCodeChange={(hsCodes) => setFilters({ ...filters, hsCode: hsCodes })}
          availableHSCodes={availableHSCodes}
        />
      </div>
    </div>
  );
};

export default CountryTradeSidebar;

