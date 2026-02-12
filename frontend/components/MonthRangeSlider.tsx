import React, { useEffect, useMemo, useState } from 'react';

type ActiveThumb = 'start' | 'end' | null;

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
  const [activeThumb, setActiveThumb] = useState<ActiveThumb>(null);

  useEffect(() => {
    const clearActiveThumb = () => setActiveThumb(null);
    window.addEventListener('pointerup', clearActiveThumb);
    window.addEventListener('mouseup', clearActiveThumb);
    window.addEventListener('touchend', clearActiveThumb);
    return () => {
      window.removeEventListener('pointerup', clearActiveThumb);
      window.removeEventListener('mouseup', clearActiveThumb);
      window.removeEventListener('touchend', clearActiveThumb);
    };
  }, []);

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
  const isOverlap = startIndex === endIndex;
  const startZ = isOverlap ? 30 : activeThumb === 'start' ? 30 : 20;
  const endZ = isOverlap ? 10 : activeThumb === 'end' ? 30 : 20;

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

        <div className="relative h-8 group/month-slider">
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
            onMouseDown={() => setActiveThumb('start')}
            onTouchStart={() => setActiveThumb('start')}
            onChange={(e) => {
              const nextStartIndex = Number(e.target.value);
              const clampedStartIndex = Math.min(nextStartIndex, endIndex);
              onChange(monthOptions[clampedStartIndex], monthOptions[endIndex]);
            }}
            onMouseUp={() => setActiveThumb(null)}
            onTouchEnd={() => setActiveThumb(null)}
            className="month-range month-range-start absolute inset-0 w-full appearance-none bg-transparent pointer-events-none"
            style={{ zIndex: startZ }}
          />
          <input
            type="range"
            min={0}
            max={maxIndex}
            step={1}
            value={endIndex}
            onMouseDown={() => setActiveThumb('end')}
            onTouchStart={() => setActiveThumb('end')}
            onChange={(e) => {
              const nextEndIndex = Number(e.target.value);
              const clampedEndIndex = Math.max(nextEndIndex, startIndex);
              onChange(monthOptions[startIndex], monthOptions[clampedEndIndex]);
            }}
            onMouseUp={() => setActiveThumb(null)}
            onTouchEnd={() => setActiveThumb(null)}
            className="month-range month-range-end absolute inset-0 w-full appearance-none bg-transparent pointer-events-none"
            style={{ zIndex: endZ }}
          />
        </div>
      </div>

      <style>{`
        .month-range::-webkit-slider-runnable-track {
          height: 6px;
          background: transparent;
        }
        .month-range::-moz-range-track {
          height: 6px;
          background: transparent;
        }
        .month-range::-webkit-slider-thumb {
          pointer-events: auto;
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          margin-top: -5px;
          border-radius: 9999px;
          background: #007AFF;
          border: 2px solid #FFFFFF;
          box-shadow: 0 2px 6px rgba(0, 122, 255, 0.35);
          cursor: grab;
          transition: transform 120ms ease, box-shadow 120ms ease, background-color 120ms ease;
        }
        .month-range::-moz-range-thumb {
          pointer-events: auto;
          width: 16px;
          height: 16px;
          border-radius: 9999px;
          background: #007AFF;
          border: 2px solid #FFFFFF;
          box-shadow: 0 2px 6px rgba(0, 122, 255, 0.35);
          cursor: grab;
          transition: transform 120ms ease, box-shadow 120ms ease, background-color 120ms ease;
        }
        .month-range:hover::-webkit-slider-thumb {
          transform: scale(1.08);
          box-shadow: 0 3px 10px rgba(0, 122, 255, 0.45);
        }
        .month-range:hover::-moz-range-thumb {
          transform: scale(1.08);
          box-shadow: 0 3px 10px rgba(0, 122, 255, 0.45);
        }
        .month-range:active::-webkit-slider-thumb {
          transform: scale(1.15);
          box-shadow: 0 4px 12px rgba(0, 122, 255, 0.55);
          cursor: grabbing;
        }
        .month-range:active::-moz-range-thumb {
          transform: scale(1.15);
          box-shadow: 0 4px 12px rgba(0, 122, 255, 0.55);
          cursor: grabbing;
        }
      `}</style>
    </section>
  );
};

export default MonthRangeSlider;

