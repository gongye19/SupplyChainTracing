import React, { useState, useMemo } from 'react';
import { Search, Building2, Package, TrendingUp, TrendingDown, ChevronRight, X } from 'lucide-react';

interface CompanyDashboardProps {
  startDate: string;
  endDate: string;
}

// Mock 数据结构
interface CompanyData {
  name: string;
  country: string;
  countryCode: string;
  industry: string;
  categories: CategoryItem[];
  topSuppliers: RankItem[];
  topCustomers: RankItem[];
}

interface CategoryItem {
  hsCode: string;
  label: string;
  color: string;
  sharePercent: number;
  tradeValueB: number;
}

interface RankItem {
  rank: number;
  company: string;
  country: string;
  countryCode: string;
  tradeValueB: number;
  tradeCount: number;
  sharePercent: number;
  trend: 'up' | 'down' | 'flat';
}

const HS2_COLOR_PALETTE: Record<string, string> = {
  '85': '#007AFF',
  '84': '#34C759',
  '38': '#FF9500',
  '90': '#AF52DE',
  '73': '#FF2D55',
  '39': '#30B0C7',
};

const getHsColor = (hs2: string) => HS2_COLOR_PALETTE[hs2] || '#8E8E93';

// Mock 公司数据（后续接真实 API）
const MOCK_COMPANIES: Record<string, CompanyData> = {
  'TSMC': {
    name: 'Taiwan Semiconductor Manufacturing',
    country: 'Taiwan',
    countryCode: 'TWN',
    industry: 'Semiconductor Foundry',
    categories: [
      { hsCode: '854231', label: 'HS 85 · Integrated Circuits', color: getHsColor('85'), sharePercent: 68, tradeValueB: 142.3 },
      { hsCode: '854232', label: 'HS 85 · Memory Chips', color: getHsColor('85'), sharePercent: 18, tradeValueB: 37.8 },
      { hsCode: '848690', label: 'HS 84 · Semiconductor Equipment', color: getHsColor('84'), sharePercent: 9, tradeValueB: 18.9 },
      { hsCode: '903082', label: 'HS 90 · Test Instruments', color: getHsColor('90'), sharePercent: 5, tradeValueB: 10.5 },
    ],
    topSuppliers: [
      { rank: 1, company: 'Applied Materials', country: 'United States', countryCode: 'USA', tradeValueB: 8.2, tradeCount: 1243, sharePercent: 22.1, trend: 'up' },
      { rank: 2, company: 'ASML Holding', country: 'Netherlands', countryCode: 'NLD', tradeValueB: 7.6, tradeCount: 892, sharePercent: 20.5, trend: 'up' },
      { rank: 3, company: 'Lam Research', country: 'United States', countryCode: 'USA', tradeValueB: 5.1, tradeCount: 734, sharePercent: 13.8, trend: 'flat' },
      { rank: 4, company: 'Tokyo Electron', country: 'Japan', countryCode: 'JPN', tradeValueB: 4.8, tradeCount: 612, sharePercent: 12.9, trend: 'down' },
      { rank: 5, company: 'KLA Corporation', country: 'United States', countryCode: 'USA', tradeValueB: 3.2, tradeCount: 489, sharePercent: 8.6, trend: 'up' },
      { rank: 6, company: 'Shin-Etsu Chemical', country: 'Japan', countryCode: 'JPN', tradeValueB: 2.9, tradeCount: 1823, sharePercent: 7.8, trend: 'up' },
      { rank: 7, company: 'Sumitomo Chemical', country: 'Japan', countryCode: 'JPN', tradeValueB: 1.8, tradeCount: 1102, sharePercent: 4.9, trend: 'flat' },
      { rank: 8, company: 'Entegris', country: 'United States', countryCode: 'USA', tradeValueB: 1.4, tradeCount: 673, sharePercent: 3.8, trend: 'down' },
      { rank: 9, company: 'Merck KGaA', country: 'Germany', countryCode: 'DEU', tradeValueB: 1.1, tradeCount: 445, sharePercent: 3.0, trend: 'up' },
      { rank: 10, company: 'Air Products', country: 'United States', countryCode: 'USA', tradeValueB: 0.9, tradeCount: 312, sharePercent: 2.4, trend: 'flat' },
    ],
    topCustomers: [
      { rank: 1, company: 'Apple Inc.', country: 'United States', countryCode: 'USA', tradeValueB: 38.2, tradeCount: 2341, sharePercent: 26.8, trend: 'up' },
      { rank: 2, company: 'NVIDIA Corporation', country: 'United States', countryCode: 'USA', tradeValueB: 28.6, tradeCount: 1823, sharePercent: 20.1, trend: 'up' },
      { rank: 3, company: 'AMD', country: 'United States', countryCode: 'USA', tradeValueB: 16.4, tradeCount: 1234, sharePercent: 11.5, trend: 'up' },
      { rank: 4, company: 'Qualcomm', country: 'United States', countryCode: 'USA', tradeValueB: 12.8, tradeCount: 987, sharePercent: 9.0, trend: 'flat' },
      { rank: 5, company: 'MediaTek', country: 'Taiwan', countryCode: 'TWN', tradeValueB: 10.2, tradeCount: 1102, sharePercent: 7.2, trend: 'down' },
      { rank: 6, company: 'Broadcom Inc.', country: 'United States', countryCode: 'USA', tradeValueB: 8.9, tradeCount: 734, sharePercent: 6.3, trend: 'up' },
      { rank: 7, company: 'Intel Corporation', country: 'United States', countryCode: 'USA', tradeValueB: 7.3, tradeCount: 612, sharePercent: 5.1, trend: 'down' },
      { rank: 8, company: 'Samsung Electronics', country: 'South Korea', countryCode: 'KOR', tradeValueB: 5.8, tradeCount: 489, sharePercent: 4.1, trend: 'up' },
      { rank: 9, company: 'Sony Group', country: 'Japan', countryCode: 'JPN', tradeValueB: 4.2, tradeCount: 378, sharePercent: 2.9, trend: 'flat' },
      { rank: 10, company: 'Texas Instruments', country: 'United States', countryCode: 'USA', tradeValueB: 3.7, tradeCount: 312, sharePercent: 2.6, trend: 'down' },
    ],
  },
  'Samsung': {
    name: 'Samsung Electronics Co., Ltd.',
    country: 'South Korea',
    countryCode: 'KOR',
    industry: 'Integrated Device Manufacturer',
    categories: [
      { hsCode: '854232', label: 'HS 85 · Memory (DRAM/NAND)', color: getHsColor('85'), sharePercent: 52, tradeValueB: 98.4 },
      { hsCode: '854231', label: 'HS 85 · Logic Chips', color: getHsColor('85'), sharePercent: 24, tradeValueB: 45.4 },
      { hsCode: '848690', label: 'HS 84 · Semiconductor Equipment', color: getHsColor('84'), sharePercent: 14, tradeValueB: 26.5 },
      { hsCode: '381800', label: 'HS 38 · Photoresist Chemicals', color: getHsColor('38'), sharePercent: 10, tradeValueB: 18.9 },
    ],
    topSuppliers: [
      { rank: 1, company: 'ASML Holding', country: 'Netherlands', countryCode: 'NLD', tradeValueB: 9.8, tradeCount: 1102, sharePercent: 24.3, trend: 'up' },
      { rank: 2, company: 'Applied Materials', country: 'United States', countryCode: 'USA', tradeValueB: 7.2, tradeCount: 934, sharePercent: 17.9, trend: 'up' },
      { rank: 3, company: 'Lam Research', country: 'United States', countryCode: 'USA', tradeValueB: 5.8, tradeCount: 812, sharePercent: 14.4, trend: 'flat' },
      { rank: 4, company: 'Shin-Etsu Chemical', country: 'Japan', countryCode: 'JPN', tradeValueB: 4.1, tradeCount: 2341, sharePercent: 10.2, trend: 'up' },
      { rank: 5, company: 'Tokyo Electron', country: 'Japan', countryCode: 'JPN', tradeValueB: 3.9, tradeCount: 723, sharePercent: 9.7, trend: 'down' },
      { rank: 6, company: 'KLA Corporation', country: 'United States', countryCode: 'USA', tradeValueB: 2.8, tradeCount: 456, sharePercent: 7.0, trend: 'up' },
      { rank: 7, company: 'Sumitomo Chemical', country: 'Japan', countryCode: 'JPN', tradeValueB: 2.1, tradeCount: 1234, sharePercent: 5.2, trend: 'flat' },
      { rank: 8, company: 'Entegris', country: 'United States', countryCode: 'USA', tradeValueB: 1.7, tradeCount: 589, sharePercent: 4.2, trend: 'up' },
      { rank: 9, company: 'JSR Corporation', country: 'Japan', countryCode: 'JPN', tradeValueB: 1.3, tradeCount: 412, sharePercent: 3.2, trend: 'down' },
      { rank: 10, company: 'Air Products', country: 'United States', countryCode: 'USA', tradeValueB: 0.8, tradeCount: 289, sharePercent: 2.0, trend: 'flat' },
    ],
    topCustomers: [
      { rank: 1, company: 'Apple Inc.', country: 'United States', countryCode: 'USA', tradeValueB: 22.4, tradeCount: 1823, sharePercent: 20.1, trend: 'flat' },
      { rank: 2, company: 'Amazon Web Services', country: 'United States', countryCode: 'USA', tradeValueB: 18.6, tradeCount: 1234, sharePercent: 16.7, trend: 'up' },
      { rank: 3, company: 'Google LLC', country: 'United States', countryCode: 'USA', tradeValueB: 15.2, tradeCount: 987, sharePercent: 13.6, trend: 'up' },
      { rank: 4, company: 'Microsoft', country: 'United States', countryCode: 'USA', tradeValueB: 12.8, tradeCount: 823, sharePercent: 11.5, trend: 'up' },
      { rank: 5, company: 'Xiaomi', country: 'China', countryCode: 'CHN', tradeValueB: 9.4, tradeCount: 2341, sharePercent: 8.4, trend: 'down' },
      { rank: 6, company: 'OPPO', country: 'China', countryCode: 'CHN', tradeValueB: 7.8, tradeCount: 1823, sharePercent: 7.0, trend: 'down' },
      { rank: 7, company: 'Dell Technologies', country: 'United States', countryCode: 'USA', tradeValueB: 6.2, tradeCount: 712, sharePercent: 5.6, trend: 'flat' },
      { rank: 8, company: 'HP Inc.', country: 'United States', countryCode: 'USA', tradeValueB: 5.1, tradeCount: 634, sharePercent: 4.6, trend: 'down' },
      { rank: 9, company: 'Lenovo Group', country: 'China', countryCode: 'CHN', tradeValueB: 4.8, tradeCount: 589, sharePercent: 4.3, trend: 'up' },
      { rank: 10, company: 'Sony Group', country: 'Japan', countryCode: 'JPN', tradeValueB: 3.9, tradeCount: 423, sharePercent: 3.5, trend: 'flat' },
    ],
  },
  'ASML': {
    name: 'ASML Holding N.V.',
    country: 'Netherlands',
    countryCode: 'NLD',
    industry: 'Lithography Equipment',
    categories: [
      { hsCode: '848690', label: 'HS 84 · Photolithography Machines', color: getHsColor('84'), sharePercent: 78, tradeValueB: 28.6 },
      { hsCode: '903082', label: 'HS 90 · Optical Instruments', color: getHsColor('90'), sharePercent: 12, tradeValueB: 4.4 },
      { hsCode: '854239', label: 'HS 85 · Laser Components', color: getHsColor('85'), sharePercent: 7, tradeValueB: 2.6 },
      { hsCode: '381800', label: 'HS 38 · Specialty Chemicals', color: getHsColor('38'), sharePercent: 3, tradeValueB: 1.1 },
    ],
    topSuppliers: [
      { rank: 1, company: 'Zeiss Group', country: 'Germany', countryCode: 'DEU', tradeValueB: 3.8, tradeCount: 423, sharePercent: 28.4, trend: 'up' },
      { rank: 2, company: 'Cymer (Cymer LLC)', country: 'United States', countryCode: 'USA', tradeValueB: 2.4, tradeCount: 312, sharePercent: 17.9, trend: 'up' },
      { rank: 3, company: 'VDL Group', country: 'Netherlands', countryCode: 'NLD', tradeValueB: 1.9, tradeCount: 1234, sharePercent: 14.2, trend: 'flat' },
      { rank: 4, company: 'Trumpf GmbH', country: 'Germany', countryCode: 'DEU', tradeValueB: 1.2, tradeCount: 234, sharePercent: 9.0, trend: 'up' },
      { rank: 5, company: 'Berliner Glas', country: 'Germany', countryCode: 'DEU', tradeValueB: 0.9, tradeCount: 189, sharePercent: 6.7, trend: 'flat' },
      { rank: 6, company: 'Philips Photonics', country: 'Netherlands', countryCode: 'NLD', tradeValueB: 0.7, tradeCount: 156, sharePercent: 5.2, trend: 'down' },
      { rank: 7, company: 'II-VI Incorporated', country: 'United States', countryCode: 'USA', tradeValueB: 0.6, tradeCount: 134, sharePercent: 4.5, trend: 'up' },
      { rank: 8, company: 'Entegris', country: 'United States', countryCode: 'USA', tradeValueB: 0.5, tradeCount: 289, sharePercent: 3.7, trend: 'flat' },
      { rank: 9, company: 'MKS Instruments', country: 'United States', countryCode: 'USA', tradeValueB: 0.4, tradeCount: 112, sharePercent: 3.0, trend: 'down' },
      { rank: 10, company: 'Coherent Corp.', country: 'United States', countryCode: 'USA', tradeValueB: 0.3, tradeCount: 89, sharePercent: 2.2, trend: 'up' },
    ],
    topCustomers: [
      { rank: 1, company: 'TSMC', country: 'Taiwan', countryCode: 'TWN', tradeValueB: 12.4, tradeCount: 892, sharePercent: 33.4, trend: 'up' },
      { rank: 2, company: 'Samsung Electronics', country: 'South Korea', countryCode: 'KOR', tradeValueB: 9.8, tradeCount: 734, sharePercent: 26.4, trend: 'up' },
      { rank: 3, company: 'Intel Corporation', country: 'United States', countryCode: 'USA', tradeValueB: 5.2, tradeCount: 423, sharePercent: 14.0, trend: 'down' },
      { rank: 4, company: 'SK Hynix', country: 'South Korea', countryCode: 'KOR', tradeValueB: 3.8, tradeCount: 312, sharePercent: 10.2, trend: 'up' },
      { rank: 5, company: 'Micron Technology', country: 'United States', countryCode: 'USA', tradeValueB: 2.6, tradeCount: 234, sharePercent: 7.0, trend: 'flat' },
      { rank: 6, company: 'GlobalFoundries', country: 'United States', countryCode: 'USA', tradeValueB: 1.4, tradeCount: 156, sharePercent: 3.8, trend: 'up' },
      { rank: 7, company: 'SMIC', country: 'China', countryCode: 'CHN', tradeValueB: 0.6, tradeCount: 89, sharePercent: 1.6, trend: 'down' },
      { rank: 8, company: 'Tower Semiconductor', country: 'Israel', countryCode: 'ISR', tradeValueB: 0.4, tradeCount: 67, sharePercent: 1.1, trend: 'flat' },
      { rank: 9, company: 'UMC', country: 'Taiwan', countryCode: 'TWN', tradeValueB: 0.3, tradeCount: 45, sharePercent: 0.8, trend: 'up' },
      { rank: 10, company: 'Powerchip Technology', country: 'Taiwan', countryCode: 'TWN', tradeValueB: 0.2, tradeCount: 34, sharePercent: 0.5, trend: 'flat' },
    ],
  },
  'Intel': {
    name: 'Intel Corporation',
    country: 'United States',
    countryCode: 'USA',
    industry: 'Integrated Device Manufacturer',
    categories: [
      { hsCode: '854231', label: 'HS 85 · Processors & CPUs', color: getHsColor('85'), sharePercent: 61, tradeValueB: 34.2 },
      { hsCode: '848690', label: 'HS 84 · Manufacturing Equipment', color: getHsColor('84'), sharePercent: 19, tradeValueB: 10.7 },
      { hsCode: '854239', label: 'HS 85 · Network Chips', color: getHsColor('85'), sharePercent: 13, tradeValueB: 7.3 },
      { hsCode: '903082', label: 'HS 90 · Test & Measurement', color: getHsColor('90'), sharePercent: 7, tradeValueB: 3.9 },
    ],
    topSuppliers: [
      { rank: 1, company: 'ASML Holding', country: 'Netherlands', countryCode: 'NLD', tradeValueB: 5.2, tradeCount: 423, sharePercent: 21.8, trend: 'up' },
      { rank: 2, company: 'Applied Materials', country: 'United States', countryCode: 'USA', tradeValueB: 4.8, tradeCount: 712, sharePercent: 20.1, trend: 'flat' },
      { rank: 3, company: 'Lam Research', country: 'United States', countryCode: 'USA', tradeValueB: 3.6, tradeCount: 589, sharePercent: 15.1, trend: 'up' },
      { rank: 4, company: 'KLA Corporation', country: 'United States', countryCode: 'USA', tradeValueB: 2.9, tradeCount: 423, sharePercent: 12.2, trend: 'up' },
      { rank: 5, company: 'Tokyo Electron', country: 'Japan', countryCode: 'JPN', tradeValueB: 2.1, tradeCount: 312, sharePercent: 8.8, trend: 'down' },
      { rank: 6, company: 'Shin-Etsu Chemical', country: 'Japan', countryCode: 'JPN', tradeValueB: 1.8, tradeCount: 1823, sharePercent: 7.6, trend: 'up' },
      { rank: 7, company: 'Air Products', country: 'United States', countryCode: 'USA', tradeValueB: 1.2, tradeCount: 934, sharePercent: 5.0, trend: 'flat' },
      { rank: 8, company: 'Entegris', country: 'United States', countryCode: 'USA', tradeValueB: 0.9, tradeCount: 445, sharePercent: 3.8, trend: 'up' },
      { rank: 9, company: 'Merck KGaA', country: 'Germany', countryCode: 'DEU', tradeValueB: 0.7, tradeCount: 312, sharePercent: 2.9, trend: 'down' },
      { rank: 10, company: 'Cabot Microelectronics', country: 'United States', countryCode: 'USA', tradeValueB: 0.5, tradeCount: 234, sharePercent: 2.1, trend: 'flat' },
    ],
    topCustomers: [
      { rank: 1, company: 'Dell Technologies', country: 'United States', countryCode: 'USA', tradeValueB: 8.4, tradeCount: 1234, sharePercent: 22.3, trend: 'down' },
      { rank: 2, company: 'HP Inc.', country: 'United States', countryCode: 'USA', tradeValueB: 6.8, tradeCount: 987, sharePercent: 18.1, trend: 'down' },
      { rank: 3, company: 'Lenovo Group', country: 'China', countryCode: 'CHN', tradeValueB: 5.9, tradeCount: 823, sharePercent: 15.7, trend: 'flat' },
      { rank: 4, company: 'Amazon Web Services', country: 'United States', countryCode: 'USA', tradeValueB: 5.2, tradeCount: 712, sharePercent: 13.8, trend: 'up' },
      { rank: 5, company: 'Microsoft', country: 'United States', countryCode: 'USA', tradeValueB: 4.1, tradeCount: 589, sharePercent: 10.9, trend: 'up' },
      { rank: 6, company: 'Google LLC', country: 'United States', countryCode: 'USA', tradeValueB: 3.2, tradeCount: 423, sharePercent: 8.5, trend: 'up' },
      { rank: 7, company: 'Acer Inc.', country: 'Taiwan', countryCode: 'TWN', tradeValueB: 1.4, tradeCount: 312, sharePercent: 3.7, trend: 'down' },
      { rank: 8, company: 'Asus', country: 'Taiwan', countryCode: 'TWN', tradeValueB: 1.1, tradeCount: 289, sharePercent: 2.9, trend: 'flat' },
      { rank: 9, company: 'Supermicro', country: 'United States', countryCode: 'USA', tradeValueB: 0.8, tradeCount: 212, sharePercent: 2.1, trend: 'up' },
      { rank: 10, company: 'Foxconn', country: 'Taiwan', countryCode: 'TWN', tradeValueB: 0.6, tradeCount: 156, sharePercent: 1.6, trend: 'down' },
    ],
  },
};

const SUGGESTED_COMPANIES = ['TSMC', 'Samsung', 'ASML', 'Intel'];

const FLAG_EMOJI: Record<string, string> = {
  'TWN': '🇹🇼', 'USA': '🇺🇸', 'KOR': '🇰🇷', 'JPN': '🇯🇵', 'NLD': '🇳🇱',
  'DEU': '🇩🇪', 'CHN': '🇨🇳', 'ISR': '🇮🇱', 'GBR': '🇬🇧', 'FRA': '🇫🇷',
};

const TrendIcon: React.FC<{ trend: 'up' | 'down' | 'flat' }> = ({ trend }) => {
  if (trend === 'up') return <TrendingUp className="w-3.5 h-3.5 text-[#34C759]" />;
  if (trend === 'down') return <TrendingDown className="w-3.5 h-3.5 text-[#FF3B30]" />;
  return <span className="w-3.5 h-3.5 inline-block text-center text-[#8E8E93] text-[10px] leading-3.5">—</span>;
};

const CompanyDashboard: React.FC<CompanyDashboardProps> = ({ startDate, endDate }) => {
  const [query, setQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [notFound, setNotFound] = useState(false);

  const handleSearch = (name: string) => {
    const key = Object.keys(MOCK_COMPANIES).find(
      (k) => k.toLowerCase() === name.trim().toLowerCase()
    );
    if (key) {
      setCompany(MOCK_COMPANIES[key]);
      setNotFound(false);
      setQuery(name.trim());
      setSearchInput(name.trim());
    } else {
      setCompany(null);
      setNotFound(true);
    }
  };

  const handleClear = () => {
    setQuery('');
    setSearchInput('');
    setCompany(null);
    setNotFound(false);
  };

  const totalTradeValue = useMemo(() => {
    if (!company) return 0;
    return company.categories.reduce((s, c) => s + c.tradeValueB, 0);
  }, [company]);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-[#F5F5F7] p-6 gap-6">

      {/* 顶部 Time Range 提示条 */}
      <div className="flex items-center gap-2 text-[12px] text-[#86868B] bg-white/80 backdrop-blur px-4 py-2.5 rounded-[12px] border border-black/5 w-fit shadow-sm">
        <span className="font-bold uppercase tracking-wider">Time Range</span>
        <span className="text-black/20">|</span>
        <span className="font-semibold text-[#1D1D1F]">{startDate} — {endDate}</span>
        <span className="text-black/20">|</span>
        <span className="text-[#86868B] italic">Adjust in the left sidebar Filter Control</span>
      </div>

      {/* 搜索区域 */}
      <div className="flex flex-col items-center gap-4">
        <div className="w-full max-w-2xl">
          <div className="relative flex items-center bg-white rounded-[18px] border border-black/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden transition-shadow focus-within:shadow-[0_4px_32px_rgba(0,122,255,0.15)] focus-within:border-[#007AFF]/30">
            <Search className="w-5 h-5 text-[#86868B] ml-5 shrink-0" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(searchInput); }}
              placeholder="Search company name... (e.g. TSMC, Samsung, ASML, Intel)"
              className="flex-1 px-4 py-4 text-[15px] font-medium text-[#1D1D1F] placeholder:text-[#C7C7CC] bg-transparent outline-none"
            />
            {searchInput && (
              <button onClick={handleClear} className="mr-2 p-1.5 rounded-full hover:bg-black/5 transition-colors">
                <X className="w-4 h-4 text-[#86868B]" />
              </button>
            )}
            <button
              onClick={() => handleSearch(searchInput)}
              className="mr-2 px-5 py-2.5 bg-[#007AFF] text-white text-[13px] font-semibold rounded-[12px] hover:bg-[#0066CC] transition-colors shrink-0"
            >
              Search
            </button>
          </div>

          {/* 快捷公司建议 */}
          <div className="flex items-center gap-2 mt-3 flex-wrap justify-center">
            <span className="text-[11px] text-[#86868B] font-semibold uppercase tracking-wider">Try:</span>
            {SUGGESTED_COMPANIES.map((name) => (
              <button
                key={name}
                onClick={() => handleSearch(name)}
                className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold border transition-all ${
                  query === name
                    ? 'bg-[#007AFF] text-white border-[#007AFF] shadow-sm'
                    : 'bg-white text-[#1D1D1F] border-black/[0.08] hover:border-[#007AFF]/40 hover:text-[#007AFF] hover:bg-[#F0F7FF]'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Not found */}
      {notFound && !company && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <Building2 className="w-12 h-12 text-[#C7C7CC]" />
          <p className="text-[16px] font-semibold text-[#1D1D1F]">No company found</p>
          <p className="text-[13px] text-[#86868B]">Try searching for TSMC, Samsung, ASML, or Intel</p>
        </div>
      )}

      {/* 空态提示 */}
      {!company && !notFound && (
        <div className="flex flex-col items-center justify-center flex-1 py-24 gap-4 text-center">
          <div className="w-20 h-20 rounded-[24px] bg-white border border-black/5 shadow-sm flex items-center justify-center">
            <Building2 className="w-10 h-10 text-[#C7C7CC]" />
          </div>
          <div>
            <p className="text-[18px] font-bold text-[#1D1D1F] mb-1">Company Dashboard</p>
            <p className="text-[14px] text-[#86868B] max-w-sm">Search for a company to view its supply categories, top suppliers, and top customers.</p>
          </div>
          <div className="flex items-center gap-2 mt-2">
            {SUGGESTED_COMPANIES.map((name) => (
              <button
                key={name}
                onClick={() => handleSearch(name)}
                className="px-4 py-2 rounded-[10px] text-[13px] font-semibold bg-white border border-black/[0.08] text-[#007AFF] hover:bg-[#F0F7FF] hover:border-[#007AFF]/30 transition-all shadow-sm"
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 公司数据 */}
      {company && (
        <div className="flex flex-col gap-5">

          {/* 公司 Header 卡片 */}
          <div className="bg-white rounded-[20px] border border-black/5 shadow-sm px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-[14px] bg-[#F5F5F7] flex items-center justify-center text-[22px] font-black text-[#1D1D1F] border border-black/5">
                {FLAG_EMOJI[company.countryCode] || '🏢'}
              </div>
              <div>
                <h2 className="text-[18px] font-bold text-[#1D1D1F]">{company.name}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[12px] text-[#86868B] font-medium">{company.country}</span>
                  <span className="text-black/15">·</span>
                  <span className="text-[12px] text-[#007AFF] font-semibold">{company.industry}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-[11px] text-[#86868B] font-bold uppercase tracking-wider mb-0.5">Total Trade Value</div>
                <div className="text-[20px] font-black text-[#1D1D1F]">${totalTradeValue.toFixed(1)}B</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-[#86868B] font-bold uppercase tracking-wider mb-0.5">Categories</div>
                <div className="text-[20px] font-black text-[#1D1D1F]">{company.categories.length}</div>
              </div>
              <div className="h-10 w-[0.5px] bg-black/8"></div>
              <div className="text-right">
                <div className="text-[11px] text-[#86868B] font-bold uppercase tracking-wider mb-0.5">Period</div>
                <div className="text-[13px] font-bold text-[#1D1D1F]">{startDate}<br/><span className="text-[#86868B] font-medium">to</span> {endDate}</div>
              </div>
            </div>
          </div>

          {/* 品类分布 */}
          <div className="bg-white rounded-[20px] border border-black/5 shadow-sm p-6">
            <div className="text-[12px] font-bold uppercase tracking-widest text-[#86868B] mb-4">Supply Categories</div>
            <div className="flex gap-4 flex-wrap">
              {company.categories.map((cat) => (
                <div key={cat.hsCode} className="flex-1 min-w-[180px] bg-[#F5F5F7] rounded-[14px] p-4 border border-black/[0.04]">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="text-[12px] font-semibold text-[#1D1D1F] truncate">{cat.label}</span>
                  </div>
                  {/* 进度条 */}
                  <div className="h-1.5 bg-black/[0.06] rounded-full overflow-hidden mb-2.5">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${cat.sharePercent}%`, backgroundColor: cat.color }}
                    />
                  </div>
                  <div className="flex items-end justify-between">
                    <span className="text-[22px] font-black" style={{ color: cat.color }}>{cat.sharePercent}%</span>
                    <span className="text-[12px] font-semibold text-[#86868B]">${cat.tradeValueB.toFixed(1)}B</span>
                  </div>
                </div>
              ))}
            </div>
            {/* 合计条形图 */}
            <div className="mt-4 h-2 bg-[#F5F5F7] rounded-full overflow-hidden flex">
              {company.categories.map((cat) => (
                <div
                  key={cat.hsCode}
                  className="h-full transition-all duration-700"
                  style={{ width: `${cat.sharePercent}%`, backgroundColor: cat.color }}
                  title={`${cat.label}: ${cat.sharePercent}%`}
                />
              ))}
            </div>
          </div>

          {/* 供应商 & 客户 排名 */}
          <div className="grid grid-cols-2 gap-5">
            {/* Top 10 Suppliers */}
            <RankTable
              title="Top 10 Suppliers"
              subtitle="Companies supplying to this company"
              icon={<Package className="w-4 h-4 text-[#007AFF]" />}
              items={company.topSuppliers}
              accentColor="#007AFF"
            />
            {/* Top 10 Customers */}
            <RankTable
              title="Top 10 Customers"
              subtitle="Companies purchasing from this company"
              icon={<TrendingUp className="w-4 h-4 text-[#34C759]" />}
              items={company.topCustomers}
              accentColor="#34C759"
            />
          </div>

          {/* Data Notice */}
          <div className="flex items-center gap-2 text-[11px] text-[#86868B] bg-white/60 px-4 py-2.5 rounded-[10px] border border-black/[0.05] w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF9500]" />
            Demo data shown — live API integration coming soon
          </div>
        </div>
      )}
    </div>
  );
};

interface RankTableProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  items: RankItem[];
  accentColor: string;
}

const RankTable: React.FC<RankTableProps> = ({ title, subtitle, icon, items, accentColor }) => (
  <div className="bg-white rounded-[20px] border border-black/5 shadow-sm p-6">
    <div className="flex items-center gap-2 mb-1">
      {icon}
      <span className="text-[15px] font-bold text-[#1D1D1F]">{title}</span>
    </div>
    <p className="text-[11px] text-[#86868B] mb-4">{subtitle}</p>
    <div className="flex flex-col gap-0.5">
      {items.map((item) => (
        <div
          key={item.rank}
          className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] hover:bg-[#F5F5F7] transition-colors group"
        >
          {/* Rank */}
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0"
            style={{
              backgroundColor: item.rank <= 3 ? accentColor : '#F5F5F7',
              color: item.rank <= 3 ? '#fff' : '#86868B',
            }}
          >
            {item.rank}
          </span>
          {/* Flag + Name */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="text-[14px] shrink-0">{FLAG_EMOJI[item.countryCode] || '🏳️'}</span>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-[#1D1D1F] truncate">{item.company}</div>
              <div className="text-[10px] text-[#86868B]">{item.country}</div>
            </div>
          </div>
          {/* Trade value */}
          <div className="text-right shrink-0">
            <div className="text-[13px] font-bold text-[#1D1D1F]">${item.tradeValueB.toFixed(1)}B</div>
            <div className="text-[10px] text-[#86868B]">{item.sharePercent.toFixed(1)}%</div>
          </div>
          {/* Trend */}
          <div className="shrink-0">
            <TrendIcon trend={item.trend} />
          </div>
          {/* Share bar */}
          <div className="w-14 h-1.5 bg-[#F5F5F7] rounded-full overflow-hidden shrink-0">
            <div
              className="h-full rounded-full"
              style={{ width: `${item.sharePercent}%`, backgroundColor: accentColor, opacity: 0.7 }}
            />
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default CompanyDashboard;
