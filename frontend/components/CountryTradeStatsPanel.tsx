import React, { useEffect, useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { TrendingUp, Globe, DollarSign, Package } from 'lucide-react';
import { CountryMonthlyTradeStat, CountryTradeStatSummary, CountryTradeTrend, TopCountry } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface CountryTradeStatsPanelProps {
  stats: CountryMonthlyTradeStat[];
  summary: CountryTradeStatSummary;
  trends: CountryTradeTrend[];
  topCountries: TopCountry[];
}

const COLORS = ['#007AFF', '#5856D6', '#34C759', '#FF9500', '#FF2D55', '#30B0C7', '#AF52DE', '#FF3B30'];
const quarterLabelMap: Record<number, string> = {
  1: '1-3',
  2: '4-6',
  3: '7-9',
  4: '10-12',
};

const CountryTradeStatsPanel: React.FC<CountryTradeStatsPanelProps> = ({
  stats,
  summary,
  trends,
  topCountries,
}) => {
  const { t } = useLanguage();
  const [marketByQuarterPlaying, setMarketByQuarterPlaying] = useState(false);
  const [topByQuarterPlaying, setTopByQuarterPlaying] = useState(false);
  const [marketQuarterPaused, setMarketQuarterPaused] = useState(false);
  const [topQuarterPaused, setTopQuarterPaused] = useState(false);
  const [marketQuarterIndex, setMarketQuarterIndex] = useState(0);
  const [topQuarterIndex, setTopQuarterIndex] = useState(0);
  
  // 格式化货币
  const formatCurrency = (value: number) => {
    if (value >= 1000000000) {
      return `$${(value / 1000000000).toFixed(2)}B`;
    } else if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(2)}K`;
    }
    return `$${value.toFixed(2)}`;
  };

  // 市场份额饼图数据
  const marketShareData = useMemo(() => {
    return topCountries.slice(0, 8).map((country, index) => ({
      name: country.countryCode,
      value: country.sumOfUsd,
      percentage: country.amountSharePct * 100,
      color: COLORS[index % COLORS.length],
    }));
  }, [topCountries]);

  // Top国家柱状图数据
  const topCountriesData = useMemo(() => {
    return topCountries.slice(0, 10).map(country => ({
      name: country.countryCode,
      value: country.sumOfUsd / 1000000000, // 转换为十亿美元(B)
      share: country.amountSharePct * 100,
    }));
  }, [topCountries]);

  const quarterlyTopData = useMemo(() => {
    const quarterMap = new Map<string, { year: number; quarter: number; countryMap: Map<string, number> }>();
    stats.forEach((item) => {
      const quarter = Math.floor((item.month - 1) / 3) + 1;
      const key = `${item.year}-Q${quarter}`;
      if (!quarterMap.has(key)) {
        quarterMap.set(key, { year: item.year, quarter, countryMap: new Map<string, number>() });
      }
      const countryMap = quarterMap.get(key)!.countryMap;
      countryMap.set(item.countryCode, (countryMap.get(item.countryCode) || 0) + item.sumOfUsd);
    });

    const periods = Array.from(quarterMap.values()).sort((a, b) =>
      a.year === b.year ? a.quarter - b.quarter : a.year - b.year
    );
    const byQuarter = periods.map((period) => {
      const countryMap = period.countryMap;
      const sorted = Array.from(countryMap.entries())
        .sort((a, b) => b[1] - a[1]);
      const total = sorted.reduce((acc, [, value]) => acc + value, 0) || 1;
      const top10 = sorted.slice(0, 10);
      return {
        label: `${period.year} (${quarterLabelMap[period.quarter]})`,
        marketShare: top10.slice(0, 8).map(([name, value], index) => ({
          name,
          value,
          percentage: (value / total) * 100,
          color: COLORS[index % COLORS.length],
        })),
        topCountries: top10.map(([name, value]) => ({
          name,
          value: value / 1000000000,
          share: (value / total) * 100,
        })),
      };
    });
    return byQuarter;
  }, [stats]);

  useEffect(() => {
    if (quarterlyTopData.length === 0) {
      setMarketQuarterIndex(0);
      setTopQuarterIndex(0);
      return;
    }
    if (marketQuarterIndex >= quarterlyTopData.length) {
      setMarketQuarterIndex(0);
    }
    if (topQuarterIndex >= quarterlyTopData.length) {
      setTopQuarterIndex(0);
    }
  }, [quarterlyTopData.length, marketQuarterIndex, topQuarterIndex]);

  useEffect(() => {
    if (!marketByQuarterPlaying || marketQuarterPaused || quarterlyTopData.length === 0) return;
    const timer = window.setInterval(() => {
      setMarketQuarterIndex((prev) => (prev + 1) % quarterlyTopData.length);
    }, 2200);
    return () => window.clearInterval(timer);
  }, [marketByQuarterPlaying, marketQuarterPaused, quarterlyTopData.length]);

  useEffect(() => {
    if (!topByQuarterPlaying || topQuarterPaused || quarterlyTopData.length === 0) return;
    const timer = window.setInterval(() => {
      setTopQuarterIndex((prev) => (prev + 1) % quarterlyTopData.length);
    }, 1400);
    return () => window.clearInterval(timer);
  }, [topByQuarterPlaying, topQuarterPaused, quarterlyTopData.length]);

  const marketQuarterData =
    quarterlyTopData.length > 0
      ? (quarterlyTopData[marketQuarterIndex] || quarterlyTopData[0])
      : null;
  const topQuarterData =
    quarterlyTopData.length > 0
      ? (quarterlyTopData[topQuarterIndex] || quarterlyTopData[0])
      : null;

  const displayMarketShareData = marketByQuarterPlaying && marketQuarterData
    ? marketQuarterData.marketShare
    : marketShareData;
  const displayTopCountriesData = topByQuarterPlaying && topQuarterData
    ? topQuarterData.topCountries
    : topCountriesData;
  const displayMarketQuarter = marketByQuarterPlaying && marketQuarterData ? marketQuarterData.label : null;
  const displayTopQuarter = topByQuarterPlaying && topQuarterData ? topQuarterData.label : null;

  return (
    <div className="space-y-6">
      {/* KPI卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-black/5 p-6 rounded-[20px] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-medium text-[#86868B] uppercase">{t('countryTrade.totalTradeValue')}</span>
            <DollarSign className="w-5 h-5 text-[#007AFF]" />
          </div>
          <div className="text-[24px] font-bold text-[#1D1D1F]">
            {formatCurrency(summary.totalTradeValue)}
          </div>
        </div>

        <div className="bg-white border border-black/5 p-6 rounded-[20px] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-medium text-[#86868B] uppercase">{t('countryTrade.participatingCountries')}</span>
            <Globe className="w-5 h-5 text-[#34C759]" />
          </div>
          <div className="text-[24px] font-bold text-[#1D1D1F]">
            {summary.totalCountries}
          </div>
        </div>

        <div className="bg-white border border-black/5 p-6 rounded-[20px] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-medium text-[#86868B] uppercase">{t('countryTrade.transactionCount')}</span>
            <Package className="w-5 h-5 text-[#FF9500]" />
          </div>
          <div className="text-[24px] font-bold text-[#1D1D1F]">
            {summary.totalTradeCount.toLocaleString()}
          </div>
        </div>

      </div>

      {/* 趋势图（拆分为两张） */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-black/5 p-8 rounded-[28px] shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[18px] font-bold text-[#1D1D1F] flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#007AFF]" />
              {t('countryTrade.tradeTrends')}
            </h3>
          </div>
          <div className="h-[320px]">
            {trends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends}>
                  <defs>
                    <linearGradient id="tradeValueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#007AFF" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#007AFF" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="yearMonth" 
                    stroke="#86868B" 
                    fontSize={11} 
                    fontWeight={600} 
                    axisLine={false} 
                    tickLine={false}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis 
                    stroke="#86868B" 
                    fontSize={11} 
                    fontWeight={600} 
                    axisLine={false} 
                    tickLine={false}
                    tickFormatter={(value) => formatCurrency(value)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #E5E5E7',
                      borderRadius: '12px',
                      padding: '12px',
                    }}
                    formatter={(value: number) => [formatCurrency(value), 'Trade Value']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="sumOfUsd" 
                    stroke="#007AFF" 
                    strokeWidth={2}
                    fill="url(#tradeValueGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-[#86868B]">
                {t('countryTrade.noData')}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-black/5 p-8 rounded-[28px] shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[18px] font-bold text-[#1D1D1F] flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#34C759]" />
              Trade Count Trends
            </h3>
          </div>
          <div className="h-[320px]">
            {trends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends}>
                  <defs>
                    <linearGradient id="tradeCountGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#34C759" stopOpacity={0.18}/>
                      <stop offset="95%" stopColor="#34C759" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="yearMonth" 
                    stroke="#86868B" 
                    fontSize={11} 
                    fontWeight={600} 
                    axisLine={false} 
                    tickLine={false}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis 
                    stroke="#86868B" 
                    fontSize={11} 
                    fontWeight={600} 
                    axisLine={false} 
                    tickLine={false}
                    tickFormatter={(value) => Number(value).toLocaleString()}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #E5E5E7',
                      borderRadius: '12px',
                      padding: '12px',
                    }}
                    formatter={(value: number) => [Number(value).toLocaleString(), 'Trade Count']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="tradeCount" 
                    stroke="#34C759" 
                    strokeWidth={2}
                    fill="url(#tradeCountGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-[#86868B]">
                {t('countryTrade.noData')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 市场份额和Top国家 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 市场份额饼图 */}
        <div className="bg-white border border-black/5 p-8 rounded-[28px] shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[18px] font-bold text-[#1D1D1F]">{t('countryTrade.marketShare')}</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMarketQuarterPaused((prev) => !prev)}
                disabled={!marketByQuarterPlaying}
                className={`text-[11px] px-3 py-1.5 rounded-full border font-semibold ${
                  marketByQuarterPlaying
                    ? 'border-black/10 text-[#1D1D1F] hover:bg-[#F5F5F7]'
                    : 'border-black/10 text-[#B0B0B5] cursor-not-allowed'
                }`}
              >
                {marketQuarterPaused ? 'Continue' : 'Pause'}
              </button>
              <button
                onClick={() => {
                  setMarketByQuarterPlaying((prev) => {
                    const next = !prev;
                    if (next) setMarketQuarterPaused(false);
                    return next;
                  });
                }}
                className="text-[11px] px-3 py-1.5 rounded-full border border-black/10 text-[#007AFF] hover:bg-[#F5F5F7] font-semibold"
              >
                {marketByQuarterPlaying ? (t('countryTrade.showTotal') || 'Show Total') : 'Play by Quarter'}
              </button>
            </div>
          </div>
          <p className="text-[11px] text-[#86868B] mb-4">
            {marketByQuarterPlaying && displayMarketQuarter
              ? `Playing quarter: ${displayMarketQuarter}`
              : (t('countryTrade.totalWithinSelection') || 'Total within selected filter range')}
          </p>
          <div className="h-[300px] grid grid-cols-[minmax(0,1fr)_170px] gap-2 items-center">
            {displayMarketShareData.length > 0 ? (
              <>
                <div className="h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={displayMarketShareData}
                        cx="50%"
                        cy="50%"
                        outerRadius={88}
                        fill="#8884d8"
                        dataKey="value"
                        startAngle={90}
                        endAngle={-270}
                        label={false}
                        labelLine={false}
                        isAnimationActive={marketByQuarterPlaying}
                        animationDuration={850}
                        animationEasing="ease-in-out"
                      >
                        {displayMarketShareData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="h-full flex flex-col justify-center gap-2 pr-1">
                  {displayMarketShareData.map((item) => (
                    <div key={item.name} className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span
                        className="text-[15px] font-semibold truncate"
                        style={{ color: item.color }}
                      >
                        {item.name}: {item.percentage.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="col-span-2 flex items-center justify-center h-full text-[#86868B]">
                暂无数据
              </div>
            )}
          </div>
        </div>

        {/* Top国家柱状图 */}
        <div className="bg-white border border-black/5 p-8 rounded-[28px] shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[18px] font-bold text-[#1D1D1F]">{t('countryTrade.topCountries')}</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTopQuarterPaused((prev) => !prev)}
                disabled={!topByQuarterPlaying}
                className={`text-[11px] px-3 py-1.5 rounded-full border font-semibold ${
                  topByQuarterPlaying
                    ? 'border-black/10 text-[#1D1D1F] hover:bg-[#F5F5F7]'
                    : 'border-black/10 text-[#B0B0B5] cursor-not-allowed'
                }`}
              >
                {topQuarterPaused ? 'Continue' : 'Pause'}
              </button>
              <button
                onClick={() => {
                  setTopByQuarterPlaying((prev) => {
                    const next = !prev;
                    if (next) setTopQuarterPaused(false);
                    return next;
                  });
                }}
                className="text-[11px] px-3 py-1.5 rounded-full border border-black/10 text-[#007AFF] hover:bg-[#F5F5F7] font-semibold"
              >
                {topByQuarterPlaying ? (t('countryTrade.showTotal') || 'Show Total') : 'Play by Quarter'}
              </button>
            </div>
          </div>
          <p className="text-[11px] text-[#86868B] mb-4">
            {topByQuarterPlaying && displayTopQuarter
              ? `Playing quarter: ${displayTopQuarter}`
              : (t('countryTrade.totalWithinSelection') || 'Total within selected filter range')}
          </p>
          <div className="h-[300px]">
            {displayTopCountriesData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={displayTopCountriesData}>
                  <XAxis 
                    dataKey="name" 
                    stroke="#86868B" 
                    fontSize={11} 
                    fontWeight={600} 
                    axisLine={false} 
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="#86868B" 
                    fontSize={11} 
                    fontWeight={600} 
                    axisLine={false} 
                    tickLine={false}
                    tickFormatter={(value) => `$${value.toFixed(2)}B`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #E5E5E7',
                      borderRadius: '12px',
                      padding: '12px',
                    }}
                    formatter={(value: number) => `$${value.toFixed(2)}B`}
                  />
                  <Bar dataKey="value" fill="#007AFF" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-[#86868B]">
                暂无数据
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CountryTradeStatsPanel;

