
import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Transaction } from '../types';
import { TrendingUp, Package, DollarSign, Activity, ArrowUpRight } from 'lucide-react';
import { translateMaterial } from '../utils/materialTranslations';
import { useLanguage } from '../contexts/LanguageContext';

interface StatsPanelProps {
  transactions: Transaction[];
}

// Apple Sophisticated Palette
const COLORS = ['#5856D6', '#007AFF', '#34C759', '#FF9500', '#FF2D55'];

const StatsPanel: React.FC<StatsPanelProps> = ({ transactions }) => {
  const { t } = useLanguage();
  // 1. Network Value: 当前筛选范围内交易总价值
  const totalValue = useMemo(() => {
    return transactions.reduce((sum, t) => sum + t.totalValue, 0) / 1000000; // 转换为百万美元
  }, [transactions]);

  // 2. Active Flows: 当前筛选范围内总交易数
  const totalTransactions = transactions.length;

  // 4. Flow Momentum: 按月份聚合总价值变化
  const flowMomentumData = useMemo(() => {
    // 按月份分组
    const monthlyData = new Map<string, { month: string; value: number; key: string }>();
    
    transactions.forEach(t => {
      const date = new Date(t.transactionDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { month: monthName, value: 0, key: monthKey });
      }
      const data = monthlyData.get(monthKey)!;
      data.value += t.totalValue / 1000000; // 转换为百万美元
    });

    // 转换为数组并按时间排序
    return Array.from(monthlyData.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(({ month, value }) => ({ name: month, val: Number(value.toFixed(1)) }));
  }, [transactions]);

  // 5. Material Mix: 各品类总价值占比
  const materialData = useMemo(() => {
    const categoryMap = new Map<string, number>();
    let total = 0;

    transactions.forEach(t => {
      const value = t.totalValue / 1000000; // 转换为百万美元
      total += value;
      const current = categoryMap.get(t.categoryName) || 0;
      categoryMap.set(t.categoryName, current + value);
    });

    // 转换为数组并计算占比
    return Array.from(categoryMap.entries())
      .map(([name, value]) => ({
        name,
        value: Number(value.toFixed(1)),
        percentage: total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0
      }))
      .sort((a, b) => b.value - a.value); // 按价值降序
  }, [transactions]);

  // 6. Strategic Corridor Priority: 显示所有交易（按价值降序）
  const allRoutes = useMemo(() => {
    return [...transactions]
      .sort((a, b) => b.totalValue - a.totalValue);
  }, [transactions]);

  // 自定义 Tooltip 格式化函数
  const formatTooltipValue = (value: number) => {
    return `$${value.toFixed(1)}M`;
  };

  const formatPieTooltip = (entry: any) => {
    return [
      { name: entry.name, value: `$${entry.value}M` },
      { name: '占比', value: `${entry.percentage}%` }
    ];
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* High Level KPIs - 只显示2个 */}
      <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-6">
        {[
          { label: t('stats.networkValue'), value: `$${totalValue.toFixed(1)}M`, color: '#007AFF', icon: <DollarSign className="w-5 h-5" /> },
          { label: t('stats.totalTransactions'), value: totalTransactions, color: '#34C759', icon: <Activity className="w-5 h-5" /> },
        ].map((kpi, i) => (
          <div key={i} className="bg-white border border-black/5 p-8 rounded-[28px] shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-2xl" style={{ backgroundColor: `${kpi.color}10`, color: kpi.color }}>{kpi.icon}</div>
              <ArrowUpRight className="w-4 h-4 text-[#86868B]" />
            </div>
            <p className="text-[12px] text-[#86868B] uppercase font-bold tracking-widest mb-1">{kpi.label}</p>
            <p className="text-[32px] font-bold text-[#1D1D1F] tracking-tight">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Flow Momentum Chart */}
      <div className="lg:col-span-2 bg-white border border-black/5 p-8 rounded-[28px] shadow-sm">
        <div className="flex items-center justify-between mb-10">
          <h3 className="text-[18px] font-bold text-[#1D1D1F] flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#007AFF]" /> {t('stats.transactionTrends')}
          </h3>
          <div className="px-3 py-1 bg-[#F5F5F7] rounded-full text-[11px] font-bold text-[#86868B] uppercase">
            {flowMomentumData.length > 0 ? `${flowMomentumData.length} ${t('stats.periods')}` : t('stats.noData')}
          </div>
        </div>
        <div className="h-[320px]">
          {flowMomentumData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={flowMomentumData}>
              <defs>
                <linearGradient id="appleGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#007AFF" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#007AFF" stopOpacity={0}/>
                </linearGradient>
              </defs>
                <XAxis 
                  dataKey="name" 
                  stroke="#86868B" 
                  fontSize={11} 
                  fontWeight={600} 
                  axisLine={false} 
                  tickLine={false} 
                  dy={10}
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
                  tickFormatter={(value) => `$${value}M`}
                />
              <Tooltip 
                contentStyle={{ 
                    background: 'rgba(255, 255, 255, 0.9)', 
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(0,0,0,0.05)', 
                  borderRadius: '14px', 
                    boxShadow: '0 10px 30px rgba(0,0,0,0.1)' 
                }} 
                  formatter={(value: number) => formatTooltipValue(value)}
              />
                <Area 
                  type="monotone" 
                  dataKey="val" 
                  stroke="#007AFF" 
                  fill="url(#appleGradient)" 
                  strokeWidth={3}
                  dot={{ fill: '#007AFF', r: 4 }}
                  activeDot={{ r: 6 }}
                />
            </AreaChart>
          </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-[#86868B] text-sm">
              {t('stats.noData')}
            </div>
          )}
        </div>
      </div>

      {/* Material Mix Pie Chart */}
      <div className="bg-white border border-black/5 p-8 rounded-[28px] shadow-sm">
        <h3 className="text-[18px] font-bold text-[#1D1D1F] mb-10 flex items-center gap-2">
          <Package className="w-5 h-5 text-[#34C759]" /> {t('stats.materialMix')}
        </h3>
        <div className="h-[320px] flex items-center justify-center">
          {materialData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
                <Pie 
                  data={materialData} 
                  innerRadius={70} 
                  outerRadius={100} 
                  paddingAngle={8} 
                  dataKey="value" 
                  stroke="none"
                  label={({ percentage }) => `${percentage}%`}
                  labelLine={false}
                >
                {materialData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                 contentStyle={{ 
                    background: 'rgba(255, 255, 255, 0.9)', 
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(0,0,0,0.05)', 
                  borderRadius: '12px'
                }} 
                  formatter={(value: number, name: string, props: any) => [
                    `$${value}M (${props.payload.percentage}%)`,
                    props.payload.name
                  ]}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  formatter={(value) => value}
              />
            </PieChart>
          </ResponsiveContainer>
          ) : (
            <div className="text-[#86868B] text-sm">{t('stats.noData')}</div>
          )}
        </div>
      </div>

      {/* Strategic Corridor Priority - 显示所有交易 */}
      <div className="lg:col-span-3 bg-white border border-black/5 p-8 rounded-[28px] shadow-sm overflow-hidden">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-[18px] font-bold text-[#1D1D1F]">{t('stats.allTransactions')}</h3>
          <span className="text-[13px] text-[#86868B] font-medium">
            {allRoutes.length} {t('stats.transactions')}
          </span>
        </div>
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="text-[#86868B] text-[11px] font-bold uppercase tracking-widest border-b border-black/5">
                <th className="pb-4 px-2">{t('stats.logisticsRoute')}</th>
                <th className="pb-4 px-2">{t('stats.materialSpec')}</th>
                <th className="pb-4 px-2">{t('stats.supplyStatus')}</th>
                <th className="pb-4 px-2 text-right">{t('stats.transactionAmount')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.03]">
              {allRoutes.length > 0 ? (
                allRoutes.map(s => (
                <tr key={s.id} className="group hover:bg-[#F5F5F7] transition-all">
                    <td className="py-6 px-2 font-bold text-[#007AFF] text-[15px]">
                      {s.exporterCountryCode.toUpperCase()} &rarr; {s.importerCountryCode.toUpperCase()}
                    </td>
                  <td className="py-6 px-2 text-[#1D1D1F] font-semibold text-[14px]">{translateMaterial(s.material)}</td>
                  <td className="py-6 px-2">
                      <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        s.status === 'in-transit' 
                          ? 'bg-[#007AFF]15 text-[#007AFF]' 
                          : s.status === 'pending' 
                            ? 'bg-[#FF9500]15 text-[#FF9500]' 
                            : 'bg-[#34C759]15 text-[#34C759]'
                      }`}>
                      {s.status === 'completed' ? t('stats.status.completed') : s.status === 'in-transit' ? t('stats.status.inTransit') : s.status === 'pending' ? t('stats.status.pending') : s.status === 'cancelled' ? t('stats.status.cancelled') : s.status}
                    </span>
                    </td>
                    <td className="py-6 px-2 text-right font-black text-[#1D1D1F] text-[16px] tracking-tight">
                      ${(s.totalValue / 1000000).toFixed(1)}M
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-[#86868B] text-sm">
                    {t('stats.noTransactionsFound')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StatsPanel;
