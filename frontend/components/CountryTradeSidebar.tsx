import React from 'react';
import { CountryTradeFilters } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { Filter } from 'lucide-react';
import MonthRangeSlider from './MonthRangeSlider';

interface CountryTradeSidebarProps {
  filters: CountryTradeFilters;
  setFilters: React.Dispatch<React.SetStateAction<CountryTradeFilters>>;
}

const CountryTradeSidebar: React.FC<CountryTradeSidebarProps> = ({
  filters,
  setFilters,
}) => {
  const { t } = useLanguage();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const handleReset = () => {
    setFilters({
      hsCode: [],
      tradeDirection: 'import',
      industry: 'SemiConductor',
      startYearMonth: '2021-01',
      endYearMonth: currentMonth,
    });
  };

  return (
    <div className="flex flex-col gap-10 p-1">
      <div className="flex items-center justify-between">
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

      <section className="space-y-2.5">
        <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-widest">
          Trade Direction
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setFilters({ ...filters, tradeDirection: 'import' })}
            className={`px-3 py-2.5 rounded-[12px] text-[12px] font-semibold border transition-all ${
              (filters.tradeDirection || 'import') === 'import'
                ? 'bg-[#007AFF] text-white border-[#007AFF]'
                : 'bg-[#F5F5F7] text-[#1D1D1F] border-black/5 hover:bg-[#EBEBEB]'
            }`}
          >
            Import
          </button>
          <button
            type="button"
            onClick={() => setFilters({ ...filters, tradeDirection: 'export' })}
            className={`px-3 py-2.5 rounded-[12px] text-[12px] font-semibold border transition-all ${
              filters.tradeDirection === 'export'
                ? 'bg-[#007AFF] text-white border-[#007AFF]'
                : 'bg-[#F5F5F7] text-[#1D1D1F] border-black/5 hover:bg-[#EBEBEB]'
            }`}
          >
            Export
          </button>
        </div>
      </section>
    </div>
  );
};

export default CountryTradeSidebar;

