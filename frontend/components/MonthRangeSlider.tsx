import React, { useMemo } from 'react';

interface MonthRangeSliderProps {
  startMonth: string;
  endMonth: string;
  onChange: (startMonth: string, endMonth: string) => void;
  title: string;
  startLabel: string;
  endLabel: string;
  minMonth?: string;
}

const formatMonth = (value: string): string => {
  if (!value || !value.includes('-')) return value;
  const [year, month] = value.split('-');
  return `${year}-${month}`;
};

const MonthRangeSlider: React.FC<MonthRangeSliderProps> = ({
  startMonth,
  endMonth,
  onChange,
  title,
  startLabel,
  endLabel,
  minMonth = '2021-01',
}) => {
  const maxMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const monthOptions = useMemo(() => {
    const options: string[] = [];
    const [startY, startM] = minMonth.split('-').map(Number);
    const [endY, endM] = maxMonth.split('-').map(Number);
    const cursor = new Date(startY, startM - 1, 1);
    const end = new Date(endY, endM - 1, 1);

    while (cursor <= end) {
      options.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return options;
  }, [minMonth, maxMonth]);

  const safeStart = monthOptions.includes(startMonth) ? startMonth : minMonth;
  const safeEnd = monthOptions.includes(endMonth) ? endMonth : maxMonth;

  const startIndex = Math.max(0, monthOptions.indexOf(safeStart));
  const endIndex = Math.max(0, monthOptions.indexOf(safeEnd));
  const maxIndex = Math.max(0, monthOptions.length - 1);

  const left = maxIndex > 0 ? (Math.min(startIndex, endIndex) / maxIndex) * 100 : 0;
  const right = maxIndex > 0 ? 100 - (Math.max(startIndex, endIndex) / maxIndex) * 100 : 0;

  return (
    <section className="space-y-2.5">
      <div className="bg-[#F5F5F7] border border-black/5 rounded-[16px] p-4 shadow-sm">
        <h3 className="text-[14px] font-bold text-[#1D1D1F] mb-4">{title}</h3>

        <div className="flex items-center justify-between text-[11px] text-[#86868B] mb-3">
          <div className="flex flex-col">
            <span className="uppercase font-bold tracking-wider">{startLabel}</span>
            <span className="text-[12px] text-[#1D1D1F] font-semibold mt-1">{formatMonth(safeStart)}</span>
          </div>
          <div className="text-[#86868B]">→</div>
          <div className="flex flex-col items-end">
            <span className="uppercase font-bold tracking-wider">{endLabel}</span>
            <span className="text-[12px] text-[#1D1D1F] font-semibold mt-1">{formatMonth(safeEnd)}</span>
          </div>
        </div>

        <div className="relative h-8">
          <div className="absolute top-1/2 -translate-y-1/2 w-full h-1.5 rounded-full bg-[#D1D1D6]" />
          <div
            className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-[#007AFF]"
            style={{ left: `${left}%`, right: `${right}%` }}
          />

          <input
            type="range"
            min={0}
            max={maxIndex}
            step={1}
            value={startIndex}
            onChange={(e) => {
              const nextStartIndex = Number(e.target.value);
              const clampedStartIndex = Math.min(nextStartIndex, endIndex);
              onChange(monthOptions[clampedStartIndex], monthOptions[endIndex]);
            }}
            className="absolute inset-0 w-full appearance-none bg-transparent pointer-events-auto"
          />
          <input
            type="range"
            min={0}
            max={maxIndex}
            step={1}
            value={endIndex}
            onChange={(e) => {
              const nextEndIndex = Number(e.target.value);
              const clampedEndIndex = Math.max(nextEndIndex, startIndex);
              onChange(monthOptions[startIndex], monthOptions[clampedEndIndex]);
            }}
            className="absolute inset-0 w-full appearance-none bg-transparent pointer-events-auto"
          />
        </div>
      </div>
    </section>
  );
};

export default MonthRangeSlider;

