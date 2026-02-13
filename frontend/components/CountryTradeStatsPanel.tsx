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

const CountryTradeStatsPanel: React.FC<CountryTradeStatsPanelProps> = ({
  stats,
  summary,
  trends,
  topCountries,
}) => {
  const { t } = useLanguage();
  const [marketByYearPlaying, setMarketByYearPlaying] = useState(false);
  const [topByYearPlaying, setTopByYearPlaying] = useState(false);
  const [marketYearIndex, setMarketYearIndex] = useState(0);
  const [topYearIndex, setTopYearIndex] = useState(0);
  
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

  const yearlyTopData = useMemo(() => {
    const yearlyMap = new Map<number, Map<string, number>>();
    stats.forEach((item) => {
      if (!yearlyMap.has(item.year)) {
        yearlyMap.set(item.year, new Map<string, number>());
      }
      const countryMap = yearlyMap.get(item.year)!;
      countryMap.set(item.countryCode, (countryMap.get(item.countryCode) || 0) + item.sumOfUsd);
    });

    const years = Array.from(yearlyMap.keys()).sort((a, b) => a - b);
    const byYear = years.map((year) => {
      const countryMap = yearlyMap.get(year)!;
      const sorted = Array.from(countryMap.entries())
        .sort((a, b) => b[1] - a[1]);
      const total = sorted.reduce((acc, [, value]) => acc + value, 0) || 1;
      const top10 = sorted.slice(0, 10);
      return {
        year,
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
    return byYear;
  }, [stats]);

  useEffect(() => {
    if (!marketByYearPlaying || yearlyTopData.length === 0) return;
    const timer = window.setInterval(() => {
      setMarketYearIndex((prev) => (prev + 1) % yearlyTopData.length);
    }, 2200);
    return () => window.clearInterval(timer);
  }, [marketByYearPlaying, yearlyTopData.length]);

  useEffect(() => {
    if (!topByYearPlaying || yearlyTopData.length === 0) return;
    const timer = window.setInterval(() => {
      setTopYearIndex((prev) => (prev + 1) % yearlyTopData.length);
    }, 1400);
    return () => window.clearInterval(timer);
  }, [topByYearPlaying, yearlyTopData.length]);

  const displayMarketShareData = marketByYearPlaying && yearlyTopData.length > 0
    ? yearlyTopData[marketYearIndex].marketShare
    : marketShareData;
  const displayTopCountriesData = topByYearPlaying && yearlyTopData.length > 0
    ? yearlyTopData[topYearIndex].topCountries
    : topCountriesData;
  const displayMarketYear = marketByYearPlaying && yearlyTopData.length > 0 ? yearlyTopData[marketYearIndex].year : null;
  const displayTopYear = topByYearPlaying && yearlyTopData.length > 0 ? yearlyTopData[topYearIndex].year : null;

  return (
    <div className="space-y-6">
      {/* KPI卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

        <div className="bg-white border border-black/5 p-6 rounded-[20px] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-medium text-[#86868B] uppercase">{t('countryTrade.avgMarketShare')}</span>
            <TrendingUp className="w-5 h-5 text-[#5856D6]" />
          </div>
          <div className="text-[24px] font-bold text-[#1D1D1F]">
            {(summary.avgSharePct * 100).toFixed(2)}%
          </div>
        </div>
      </div>

      {/* 趋势图 */}
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
                  <linearGradient id="tradeGradient" x1="0" y1="0" x2="0" y2="1">
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
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Area 
                  type="monotone" 
                  dataKey="sumOfUsd" 
                  stroke="#007AFF" 
                  strokeWidth={2}
                  fill="url(#tradeGradient)" 
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

      {/* 市场份额和Top国家 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 市场份额饼图 */}
        <div className="bg-white border border-black/5 p-8 rounded-[28px] shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[18px] font-bold text-[#1D1D1F]">{t('countryTrade.marketShare')}</h3>
            <button
              onClick={() => setMarketByYearPlaying((prev) => !prev)}
              className="text-[11px] px-3 py-1.5 rounded-full border border-black/10 text-[#007AFF] hover:bg-[#F5F5F7] font-semibold"
            >
              {marketByYearPlaying ? (t('countryTrade.showTotal') || 'Show Total') : (t('countryTrade.playByYear') || 'Play by Year')}
            </button>
          </div>
          <p className="text-[11px] text-[#86868B] mb-4">
            {marketByYearPlaying && displayMarketYear
              ? `${t('countryTrade.playingYear') || 'Playing year'}: ${displayMarketYear}`
              : (t('countryTrade.totalWithinSelection') || 'Total within selected filter range')}
          </p>
          <div className="h-[300px]">
            {displayMarketShareData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={displayMarketShareData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    isAnimationActive={marketByYearPlaying}
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
            ) : (
              <div className="flex items-center justify-center h-full text-[#86868B]">
                暂无数据
              </div>
            )}
          </div>
        </div>

        {/* Top国家柱状图 */}
        <div className="bg-white border border-black/5 p-8 rounded-[28px] shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[18px] font-bold text-[#1D1D1F]">{t('countryTrade.topCountries')}</h3>
            <button
              onClick={() => setTopByYearPlaying((prev) => !prev)}
              className="text-[11px] px-3 py-1.5 rounded-full border border-black/10 text-[#007AFF] hover:bg-[#F5F5F7] font-semibold"
            >
              {topByYearPlaying ? (t('countryTrade.showTotal') || 'Show Total') : (t('countryTrade.playByYear') || 'Play by Year')}
            </button>
          </div>
          <p className="text-[11px] text-[#86868B] mb-4">
            {topByYearPlaying && displayTopYear
              ? `${t('countryTrade.playingYear') || 'Playing year'}: ${displayTopYear}`
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

