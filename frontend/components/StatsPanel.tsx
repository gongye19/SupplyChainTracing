
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Transaction } from '../types';
import { TrendingUp, Package, DollarSign, Activity, Globe, Zap, ArrowUpRight } from 'lucide-react';

interface StatsPanelProps {
  transactions: Transaction[];
}

// Apple Sophisticated Palette
const COLORS = ['#5856D6', '#007AFF', '#34C759', '#FF9500', '#FF2D55'];

const StatsPanel: React.FC<StatsPanelProps> = ({ transactions }) => {
  const totalValue = transactions.reduce((sum, t) => sum + t.totalValue, 0) / 1000000; // 转换为百万美元
  const activeCount = transactions.filter(t => t.status === 'in-transit').length;

  const materialData = transactions.reduce((acc: any[], t) => {
    const existing = acc.find(a => a.name === t.categoryName);
    if (existing) {
      existing.value += t.totalValue / 1000000; // 转换为百万美元
    } else {
      acc.push({ name: t.categoryName, value: t.totalValue / 1000000 });
    }
    return acc;
  }, []);

  const topRoutes = transactions
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 5);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* High Level KPIs */}
      <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {[
          { label: 'Network Value', value: `$${totalValue}M`, color: '#007AFF', icon: <DollarSign className="w-5 h-5" /> },
          { label: 'Active Flows', value: activeCount, color: '#34C759', icon: <Activity className="w-5 h-5" /> },
          { label: 'Active Hubs', value: '8', color: '#5856D6', icon: <Globe className="w-5 h-5" /> },
          { label: 'Sync Status', value: 'Live', color: '#FF3B30', icon: <Zap className="w-5 h-5" /> },
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

      {/* Main Charts */}
      <div className="lg:col-span-2 bg-white border border-black/5 p-8 rounded-[28px] shadow-sm">
        <div className="flex items-center justify-between mb-10">
          <h3 className="text-[18px] font-bold text-[#1D1D1F] flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#007AFF]" /> Flow Momentum
          </h3>
          <div className="px-3 py-1 bg-[#F5F5F7] rounded-full text-[11px] font-bold text-[#86868B] uppercase">Quarterly</div>
        </div>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={[
              { name: 'Jan', val: 800 }, { name: 'Feb', val: 1200 }, { name: 'Mar', val: 950 }, { name: 'Apr', val: 1600 }
            ]}>
              <defs>
                <linearGradient id="appleGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#007AFF" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#007AFF" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="name" stroke="#86868B" fontSize={11} fontWeight={600} axisLine={false} tickLine={false} dy={10} />
              <YAxis stroke="#86868B" fontSize={11} fontWeight={600} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ 
                  background: 'rgba(255, 255, 255, 0.8)', 
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(0,0,0,0.05)', 
                  borderRadius: '14px', 
                  boxShadow: '0 10px 30px rgba(0,0,0,0.05)' 
                }} 
              />
              <Area type="monotone" dataKey="val" stroke="#007AFF" fill="url(#appleGradient)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Pie */}
      <div className="bg-white border border-black/5 p-8 rounded-[28px] shadow-sm">
        <h3 className="text-[18px] font-bold text-[#1D1D1F] mb-10 flex items-center gap-2">
          <Package className="w-5 h-5 text-[#34C759]" /> Material Mix
        </h3>
        <div className="h-[320px] flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={materialData} innerRadius={70} outerRadius={100} paddingAngle={8} dataKey="value" stroke="none">
                {materialData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                 contentStyle={{ 
                  background: 'rgba(255, 255, 255, 0.8)', 
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(0,0,0,0.05)', 
                  borderRadius: '12px'
                }} 
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Corridor Breakdown */}
      <div className="lg:col-span-3 bg-white border border-black/5 p-8 rounded-[28px] shadow-sm overflow-hidden">
        <div className="flex items-center justify-between mb-8">
           <h3 className="text-[18px] font-bold text-[#1D1D1F]">Strategic Corridor Priority</h3>
           <button className="text-[13px] font-semibold text-[#007AFF]">View All</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[#86868B] text-[11px] font-bold uppercase tracking-widest border-b border-black/5">
                <th className="pb-4 px-2">Logistics Route</th>
                <th className="pb-4 px-2">Material Specification</th>
                <th className="pb-4 px-2">Supply Status</th>
                <th className="pb-4 px-2 text-right">Throughput</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.03]">
              {topRoutes.map(s => (
                <tr key={s.id} className="group hover:bg-[#F5F5F7] transition-all">
                  <td className="py-6 px-2 font-bold text-[#007AFF] text-[15px]">{s.exporterCountryCode.toUpperCase()} &rarr; {s.importerCountryCode.toUpperCase()}</td>
                  <td className="py-6 px-2 text-[#1D1D1F] font-semibold text-[14px]">{s.material}</td>
                  <td className="py-6 px-2">
                    <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${s.status === 'in-transit' ? 'bg-[#007AFF]15 text-[#007AFF]' : s.status === 'pending' ? 'bg-[#FF9500]15 text-[#FF9500]' : 'bg-[#34C759]15 text-[#34C759]'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="py-6 px-2 text-right font-black text-[#1D1D1F] text-[16px] tracking-tight">${(s.totalValue / 1000000).toFixed(1)}M</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StatsPanel;
