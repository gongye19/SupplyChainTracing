import React from 'react';
import { Package } from 'lucide-react';

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
  // 如果没有提供可用HS编码列表，使用常见的半导体相关HS编码
  const defaultHSCodes = availableHSCodes.length > 0 
    ? availableHSCodes 
    : ['381800', '848610', '848620', '848630', '848640', '848690', '854231', '854232', '854233', '854239', '903082', '903141'];

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

  return (
    <div className="bg-white border border-black/5 rounded-[20px] p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[16px] font-bold text-[#1D1D1F] flex items-center gap-2">
          <Package className="w-4 h-4 text-[#007AFF]" />
          HS编码筛选
        </h3>
        <button
          onClick={handleSelectAll}
          className="text-[12px] text-[#007AFF] hover:text-[#0051D5] font-medium"
        >
          {selectedHSCodes.length === defaultHSCodes.length ? '取消全选' : '全选'}
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
        {defaultHSCodes.map((hsCode) => (
          <label
            key={hsCode}
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#F5F5F7] cursor-pointer transition-colors"
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
          </label>
        ))}
      </div>
      
      {selectedHSCodes.length > 0 && (
        <div className="mt-4 pt-4 border-t border-black/5">
          <div className="text-[12px] text-[#86868B]">
            已选择: <span className="font-semibold text-[#1D1D1F]">{selectedHSCodes.length}</span> 个HS编码
          </div>
        </div>
      )}
    </div>
  );
};

export default HSCodeSelector;

