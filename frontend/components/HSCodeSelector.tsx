import React, { useState, useRef, useEffect } from 'react';
import { Package, ChevronDown, Check, X } from 'lucide-react';
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

  const handleSelectAll = () => {
    if (selectedHSCodes.length === defaultHSCodes.length) {
      onHSCodeChange([]);
    } else {
      onHSCodeChange([...defaultHSCodes]);
    }
  };

  const handleClearAll = () => {
    onHSCodeChange([]);
  };

  return (
    <div className="bg-white border border-black/5 rounded-[16px] p-4 shadow-sm" ref={dropdownRef}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[14px] font-bold text-[#1D1D1F] flex items-center gap-2">
          <Package className="w-4 h-4 text-[#007AFF]" />
          {t('countryTrade.hsCodeFilter')}
        </h3>
      </div>
      
      {/* 下拉选择框 */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-3 py-2.5 border border-black/10 rounded-lg bg-white text-[13px] font-medium text-[#1D1D1F] hover:border-[#007AFF] focus:outline-none focus:ring-2 focus:ring-[#007AFF] transition-colors"
        >
          <span className="truncate">
            {selectedHSCodes.length === 0
              ? t('countryTrade.selectAll')
              : selectedHSCodes.length === defaultHSCodes.length
              ? t('countryTrade.selectAll') + ` (${selectedHSCodes.length})`
              : `${selectedHSCodes.length} ${t('countryTrade.selected') === '已选择' ? '个已选择' : 'selected'}`}
          </span>
          <ChevronDown className={`w-4 h-4 text-[#86868B] transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
        </button>

        {/* 下拉菜单 */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-black/10 rounded-lg shadow-lg max-h-[300px] overflow-y-auto">
            {/* 操作按钮 */}
            <div className="sticky top-0 bg-white border-b border-black/5 px-3 py-2 flex items-center justify-between">
              <button
                onClick={handleSelectAll}
                className="text-[11px] text-[#007AFF] hover:text-[#0051D5] font-medium"
              >
                {selectedHSCodes.length === defaultHSCodes.length ? t('countryTrade.clearAll') : t('countryTrade.selectAll')}
              </button>
              {selectedHSCodes.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-[11px] text-[#FF2D55] hover:text-[#D70015] font-medium flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  {t('countryTrade.clearAll')}
                </button>
              )}
            </div>

            {/* 选项列表 */}
            <div className="py-1">
              {defaultHSCodes.map((hsCode) => (
                <label
                  key={hsCode}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-[#F5F5F7] cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedHSCodes.includes(hsCode)}
                    onChange={() => handleToggle(hsCode)}
                    className="w-4 h-4 text-[#007AFF] border-gray-300 rounded focus:ring-[#007AFF]"
                  />
                  <span className="text-[13px] font-medium text-[#1D1D1F]">
                    {hsCode}
                  </span>
                  {selectedHSCodes.includes(hsCode) && (
                    <Check className="w-3.5 h-3.5 text-[#007AFF] ml-auto" />
                  )}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* 已选择的标签 */}
      {selectedHSCodes.length > 0 && (
        <div className="mt-3 pt-3 border-t border-black/5">
          <div className="flex flex-wrap gap-2">
            {selectedHSCodes.slice(0, 3).map((hsCode) => (
              <span
                key={hsCode}
                className="inline-flex items-center gap-1 px-2 py-1 bg-[#F5F5F7] rounded text-[11px] font-medium text-[#1D1D1F]"
              >
                {hsCode}
                <button
                  onClick={() => handleToggle(hsCode)}
                  className="hover:text-[#FF2D55]"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {selectedHSCodes.length > 3 && (
              <span className="inline-flex items-center px-2 py-1 bg-[#F5F5F7] rounded text-[11px] font-medium text-[#86868B]">
                +{selectedHSCodes.length - 3}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HSCodeSelector;
