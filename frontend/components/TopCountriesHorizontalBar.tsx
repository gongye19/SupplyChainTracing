import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

export interface TopCountriesDatum {
  countryCode: string;
  countryName: string;
  value: number;
}

interface TopCountriesHorizontalBarProps {
  title: string;
  data: TopCountriesDatum[];
  valueFormatter?: (value: number) => string;
  barColor?: string;
}

const TopCountriesHorizontalBar: React.FC<TopCountriesHorizontalBarProps> = ({
  title,
  data,
  valueFormatter = (value) => value.toLocaleString(),
  barColor = '#007AFF',
}) => {
  return (
    <div className="bg-white border border-black/5 p-6 rounded-[24px] shadow-sm">
      <h3 className="text-[16px] font-bold text-[#1D1D1F] mb-4">{title}</h3>
      <div className="h-[320px]">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 12 }}>
              <XAxis
                type="number"
                stroke="#86868B"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={valueFormatter}
              />
              <YAxis
                type="category"
                dataKey="countryCode"
                width={56}
                stroke="#86868B"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #E5E5E7',
                  borderRadius: '12px',
                  padding: '10px',
                }}
                formatter={(value: number) => valueFormatter(value)}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.countryName || ''}
              />
              <Bar dataKey="value" fill={barColor} radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-[12px] text-[#86868B]">
            No data under current filters
          </div>
        )}
      </div>
    </div>
  );
};

export default TopCountriesHorizontalBar;


