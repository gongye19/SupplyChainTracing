import React, { useEffect, useRef } from 'react';
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
  const panelRef = useRef<HTMLDivElement>(null);
  const stickyHeaderRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const updateStickyHeaderPosition = () => {
      const panel = panelRef.current;
      const header = stickyHeaderRef.current;
      if (!panel || !header) return;

      const rect = panel.getBoundingClientRect();
      const visible = rect.bottom > 100 && rect.top < window.innerHeight;
      header.style.visibility = visible ? 'visible' : 'hidden';
      header.style.opacity = visible ? '1' : '0';
      header.style.left = `${Math.max(8, rect.left)}px`;
      header.style.top = '76px';
      header.style.width = `${Math.max(180, rect.width)}px`;
    };

    updateStickyHeaderPosition();
    window.addEventListener('scroll', updateStickyHeaderPosition, { passive: true });
    window.addEventListener('resize', updateStickyHeaderPosition);
    return () => {
      window.removeEventListener('scroll', updateStickyHeaderPosition);
      window.removeEventListener('resize', updateStickyHeaderPosition);
    };
  }, []);

  return (
    <div ref={panelRef} className="flex flex-col gap-10 p-1">
      <div className="h-10" />
      <div ref={stickyHeaderRef} className="fixed z-40 px-1 py-2 bg-white/95 backdrop-blur-sm border-b border-black/5 flex items-center justify-between transition-opacity duration-150">
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

