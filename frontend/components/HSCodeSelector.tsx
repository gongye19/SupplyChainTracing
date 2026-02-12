import React, { useState, useRef, useEffect } from 'react';
import { Package, ChevronDown, Check } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface HSCodeSelectorProps {
  selectedHSCodes: string[];
  onHSCodeChange: (hsCodes: string[]) => void;
  availableHSCodes?: string[];
}

const HSCodeSelector: React.FC<HSCodeSelectorProps> = ({
  selectedHSCodes,
  onHSCodeChange,
  availableHSCodes = [],
}) => {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 如果没有提供可用HS编码列表，使用常见的半导体相关HS编码
  const defaultHSCodes = availableHSCodes.length > 0 
    ? availableHSCodes 
    : ['381800', '848610', '848620', '848630', '848640', '848690', '854231', '854232', '854233', '854239', '903082', '903141'];

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = (hsCode: string) => {
    if (selectedHSCodes.includes(hsCode)) {
      onHSCodeChange(selectedHSCodes.filter(code => code !== hsCode));
    } else {
      onHSCodeChange([...selectedHSCodes, hsCode]);
    }
  };

  return (
    <section className="space-y-2.5" ref={dropdownRef}>
      <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-widest flex items-center gap-2.5">
        <Package className="w-4 h-4" /> {t('countryTrade.hsCodeFilter')}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full bg-[#F5F5F7] border border-black/5 rounded-[12px] px-3 py-2.5 flex items-center justify-between text-[12px] text-[#1D1D1F] font-semibold hover:bg-[#EBEBEB] transition-all shadow-sm"
        >
          <span className="truncate">
            {selectedHSCodes.length === 0
              ? t('countryTrade.selectAll')
              : `${selectedHSCodes.length} ${t('countryTrade.selected')}`}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-[#86868B] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white/90 backdrop-blur-xl border border-black/5 rounded-[16px] shadow-2xl z-50 max-h-72 overflow-y-auto custom-scrollbar p-1.5 animate-in fade-in zoom-in-95 duration-200">
            {defaultHSCodes.map((hsCode) => (
              <div
                key={hsCode}
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggle(hsCode);
                }}
                className={`px-3 py-2.5 text-[12px] flex items-center justify-between cursor-pointer rounded-[8px] transition-colors mb-0.5 last:mb-0 ${
                  selectedHSCodes.includes(hsCode)
                    ? 'bg-[#007AFF] text-white font-bold'
                    : 'text-[#1D1D1F] hover:bg-black/5'
                }`}
              >
                <span className={`font-semibold flex-1 ${selectedHSCodes.includes(hsCode) ? 'text-white' : 'text-[#1D1D1F]'}`}>
                  {hsCode}
                </span>
                {selectedHSCodes.includes(hsCode) && <Check className="w-3.5 h-3.5 flex-shrink-0 ml-2" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default HSCodeSelector;
