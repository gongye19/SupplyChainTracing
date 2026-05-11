import React from 'react';
import { Filter } from 'lucide-react';
import MonthRangeSlider from './MonthRangeSlider';
import type { CompanyDashboardControls, Filters } from '../types';
import {
  DEFAULT_COMPANY_CONTROLS,
  RANK_METRIC_OPTIONS,
} from '../utils/companyDashboardFilters';

interface CompanyDashboardSidebarProps {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  controls: CompanyDashboardControls;
  setControls: React.Dispatch<React.SetStateAction<CompanyDashboardControls>>;
}

const CompanyDashboardSidebar: React.FC<CompanyDashboardSidebarProps> = ({
  filters,
  setFilters,
  controls,
  setControls,
}) => {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const updateControls = (patch: Partial<CompanyDashboardControls>) => {
    setControls((prev) => ({ ...prev, ...patch }));
  };

  const resetAll = () => {
    setFilters((prev) => ({ ...prev, startDate: '2021-01', endDate: currentMonth }));
    setControls(DEFAULT_COMPANY_CONTROLS);
  };

  return (
    <div className="flex flex-col gap-6 p-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[#007AFF]">
          <Filter className="w-4 h-4" />
          <span className="text-[12px] font-bold uppercase tracking-widest text-[#1D1D1F]">Company Control</span>
        </div>
        <button
          onClick={resetAll}
          className="text-[12px] text-[#007AFF] hover:underline font-semibold"
        >
          Reset
        </button>
      </div>

      <MonthRangeSlider
        title="Time Range"
        startLabel="START"
        endLabel="END"
        minMonth="2021-01"
        startMonth={filters.startDate || '2021-01'}
        endMonth={filters.endDate}
        onChange={(startMonth, endMonth) => setFilters((prev) => ({ ...prev, startDate: startMonth, endDate: endMonth }))}
      />

      <div className="flex flex-col gap-3">
        <SidebarChips
          label="Rank By"
          value={controls.rankMetric}
          onChange={(value) => updateControls({ rankMetric: (value || 'trade_value') as CompanyDashboardControls['rankMetric'] })}
          options={RANK_METRIC_OPTIONS}
          includeAll={false}
        />
      </div>
    </div>
  );
};

const SidebarChips: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
  emptyText?: string;
  includeAll?: boolean;
}> = ({ label, value, onChange, options, disabled = false, emptyText = 'No options', includeAll = true }) => (
  <div className={`rounded-[16px] bg-[#F5F5F7] border border-black/5 p-3 ${disabled ? 'opacity-70' : ''}`}>
    <div className="flex items-center justify-between gap-3 mb-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#86868B]">{label}</span>
      {value && !disabled && includeAll && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="text-[10px] font-bold text-[#86868B] hover:text-[#1D1D1F] transition-colors"
        >
          Clear
        </button>
      )}
    </div>
    <div className="flex flex-wrap gap-1.5 max-h-[132px] overflow-y-auto pr-1">
      {disabled ? (
        <span className="px-2.5 py-1.5 rounded-[8px] bg-white text-[11px] font-semibold text-[#86868B]">
          {emptyText}
        </span>
      ) : (
        <>
          {includeAll && (
            <button
              type="button"
              onClick={() => onChange('')}
              className={`px-2.5 py-1.5 rounded-[8px] text-[11px] font-semibold transition-colors ${
                value === '' ? 'bg-[#007AFF] text-white' : 'bg-white text-[#1D1D1F] hover:bg-black/5'
              }`}
            >
              All
            </button>
          )}
          {options.map((option) => (
            <button
              type="button"
              key={option.value}
              onClick={() => onChange(option.value)}
              className={`px-2.5 py-1.5 rounded-[8px] text-[11px] font-semibold transition-colors ${
                value === option.value ? 'bg-[#007AFF] text-white' : 'bg-white text-[#1D1D1F] hover:bg-black/5'
              }`}
              title={option.label}
            >
              {option.label}
            </button>
          ))}
          {options.length === 0 && (
            <span className="px-2.5 py-1.5 rounded-[8px] bg-white text-[11px] font-semibold text-[#86868B]">
              {emptyText}
            </span>
          )}
        </>
      )}
    </div>
  </div>
);

export default CompanyDashboardSidebar;
