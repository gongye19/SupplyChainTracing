import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { CountryMonthlyTradeStat, CountryLocation } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface CountryTradeMapProps {
  stats: CountryMonthlyTradeStat[];
  countries: CountryLocation[];
  selectedHSCodes?: string[];
}

// GeoJSON 缓存（模块级）
let worldGeoJsonPromise: Promise<any> | null = null;
function loadWorldGeoJson() {
  if (!worldGeoJsonPromise) {
    worldGeoJsonPromise = d3.json('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson');
  }
  return worldGeoJsonPromise;
}

const CountryTradeMap: React.FC<CountryTradeMapProps> = React.memo(({ 
  stats,
  countries,
  selectedHSCodes = [],
}) => {
  const { t } = useLanguage();
  const svgRef = useRef<SVGSVGElement>(null);
  const projectionRef = useRef<d3.GeoProjection | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const gMapRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const gNodesRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const tooltipRef = useRef<d3.Selection<HTMLDivElement, unknown, null, undefined> | null>(null);
  
  // 缓存GeoJSON数据，避免每次更新都重新加载
  const geoJsonDataRef = useRef<any>(null);
  const countryLocationMapRef = useRef<Map<string, CountryLocation>>(new Map());
  const countryTradeDataRef = useRef<Map<string, { sumOfUsd: number; tradeCount: number }>>(new Map());

  // 计算每个国家的总贸易额
  const countryTradeData = useMemo(() => {
    const tradeMap = new Map<string, { sumOfUsd: number; tradeCount: number }>();
    
    stats.forEach(stat => {
      // 如果指定了HS编码筛选，只统计匹配的
      if (selectedHSCodes.length > 0 && !selectedHSCodes.includes(stat.hsCode)) {
        return;
      }
      
      const existing = tradeMap.get(stat.countryCode) || { sumOfUsd: 0, tradeCount: 0 };
      tradeMap.set(stat.countryCode, {
        sumOfUsd: existing.sumOfUsd + stat.sumOfUsd,
        tradeCount: existing.tradeCount + stat.tradeCount,
      });
    });
    
    // 更新ref，供事件监听器使用
    countryTradeDataRef.current = tradeMap;
    
    return tradeMap;
  }, [stats, selectedHSCodes]);

  // 获取最大贸易额用于颜色映射
  const maxTradeValue = useMemo(() => {
    if (countryTradeData.size === 0) return 1;
    return Math.max(...Array.from(countryTradeData.values()).map(d => d.sumOfUsd));
  }, [countryTradeData]);

  // 颜色比例尺
  const colorScale = useMemo(() => {
    return d3.scaleSequential(d3.interpolateBlues)
      .domain([0, maxTradeValue]);
  }, [maxTradeValue]);

  // 初始化：只执行一次（创建 SVG 结构、底图、zoom、tooltip、事件绑定）
  useEffect(() => {
    if (!svgRef.current || countries.length === 0) return;

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    if (width === 0 || height === 0) return;

    const svg = d3.select(svgRef.current);
    
    // 如果已经初始化过，跳过
    if (gMapRef.current) return;

    // 创建投影
    const projection = d3.geoMercator()
      .scale(width / 5.5)
      .center([0, 25])
      .translate([width / 2, height / 2]);
    projectionRef.current = projection;

    const pathGenerator = d3.geoPath().projection(projection);

    // 创建分层结构
    const g = svg.append('g');
    const gMap = g.append('g').attr('class', 'map-layer');
    const gNodes = g.append('g').attr('class', 'nodes-layer');
    
    gMapRef.current = gMap;
    gNodesRef.current = gNodes;

    // 创建 Tooltip（只创建一次）
    const d3Tooltip = d3.select('body').append('div')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background', 'rgba(255, 255, 255, 0.95)')
      .style('backdrop-filter', 'blur(10px)')
      .style('border', '1px solid rgba(0,0,0,0.1)')
      .style('padding', '12px')
      .style('border-radius', '12px')
      .style('color', '#1D1D1F')
      .style('font-size', '13px')
      .style('font-weight', '500')
      .style('pointer-events', 'none')
      .style('z-index', '100')
      .style('box-shadow', '0 10px 30px rgba(0,0,0,0.15)');
    tooltipRef.current = d3Tooltip;

    // 更新国家位置映射
    const countryLocationMap = new Map<string, CountryLocation>();
    countries.forEach(country => {
      countryLocationMap.set(country.countryCode, country);
    });
    countryLocationMapRef.current = countryLocationMap;

    // 加载并绘制底图（只画一次）
    loadWorldGeoJson().then((data: any) => {
      // 缓存GeoJSON数据
      geoJsonDataRef.current = data;
      
      const filteredFeatures = data.features.filter((f: any) => 
        f.properties.name !== "Antarctica"
      );

      // 绘制底图
      const countryPaths = gMap.selectAll('path.country')
        .data(filteredFeatures)
        .enter()
        .append('path')
        .attr('class', 'country')
        .attr('d', pathGenerator)
        .attr('fill', '#EBEBEB')
        .attr('stroke', '#FFFFFF')
        .attr('stroke-width', 1);

      // 绑定事件监听器（只绑定一次）
      countryPaths.on('mouseover', function(event: MouseEvent, d: any) {
        const countryName = d.properties.name;
        const countryCode = d.properties.ISO_A2 || d.properties.ISO_A3;
        
        // 查找匹配的国家数据
        let matchedCountry: CountryLocation | undefined;
        for (const [code, location] of countryLocationMap.entries()) {
          if (code === countryCode || location.countryName === countryName) {
            matchedCountry = location;
            break;
          }
        }
        
        if (matchedCountry) {
          // 从ref获取最新的tradeData（动态获取，不依赖闭包）
          const tradeData = countryTradeDataRef.current.get(matchedCountry.countryCode);
          if (tradeData) {
            d3Tooltip
              .style('visibility', 'visible')
              .html(`
                <div style="font-weight: 600; margin-bottom: 6px;">${matchedCountry.countryName}</div>
                <div>${t('countryTrade.tradeValue')}: $${(tradeData.sumOfUsd / 1000000).toFixed(2)}M</div>
                <div>${t('countryTrade.transactionCount')}: ${tradeData.tradeCount.toLocaleString()}</div>
              `);
          }
        }
      })
      .on('mousemove', function(event: MouseEvent) {
        d3Tooltip
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', function() {
        d3Tooltip.style('visibility', 'hidden');
      });
    }).catch((error) => {
      console.error('CountryTradeMap: Error loading world map:', error);
    });

    // 设置缩放
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 15])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    
    svg.call(zoom);
    zoomRef.current = zoom;

  }, [countries, t]);

  // 更新：只更新国家颜色和节点（筛选时执行）
  useEffect(() => {
    if (!gMapRef.current || !projectionRef.current || !geoJsonDataRef.current || countries.length === 0) return;

    const projection = projectionRef.current;
    const gMap = gMapRef.current;
    const countryLocationMap = countryLocationMapRef.current;

    // 更新国家颜色（只更新fill属性，不重新绑定事件）
    gMap.selectAll('path.country')
      .attr('fill', (d: any) => {
        const countryName = d.properties.name;
        const countryCode = d.properties.ISO_A2 || d.properties.ISO_A3;
        
        // 查找匹配的国家数据
        let matchedCountry: CountryLocation | undefined;
        for (const [code, location] of countryLocationMap.entries()) {
          if (code === countryCode || location.countryName === countryName) {
            matchedCountry = location;
            break;
          }
        }
        
        if (matchedCountry) {
          const tradeData = countryTradeData.get(matchedCountry.countryCode);
          if (tradeData && tradeData.sumOfUsd > 0) {
            return colorScale(tradeData.sumOfUsd);
          }
        }
        
        return '#EBEBEB';
      });

    // 更新国家节点（使用D3 data join模式，只更新变化的部分）
    const nodes = Array.from(countryTradeData.entries())
      .map(([code, data]) => {
        const location = countryLocationMap.get(code);
        if (!location || data.sumOfUsd === 0) return null;
        
        const [x, y] = projection([location.capitalLng, location.capitalLat]);
        if (!x || !y) return null;
        
        return {
          code,
          x,
          y,
          ...data,
          location,
        };
      })
      .filter((n): n is NonNullable<typeof n> => n !== null);

    const nodeSelection = gNodesRef.current!.selectAll('circle.country-node')
      .data(nodes, (d: any) => d.code);

    // 移除不再存在的节点
    nodeSelection.exit()
      .transition()
      .duration(200)
      .attr('r', 0)
      .remove();

    // 添加新节点
    const nodeEnter = nodeSelection.enter()
      .append('circle')
      .attr('class', 'country-node')
      .attr('r', 0)
      .attr('fill', '#007AFF')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .attr('opacity', 0.8);

    // 更新所有节点（包括新添加的）
    nodeSelection.merge(nodeEnter)
      .transition()
      .duration(200)
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', d => Math.max(3, Math.min(15, Math.sqrt(d.sumOfUsd / maxTradeValue) * 15)))
      .attr('fill', d => colorScale(d.sumOfUsd));

  }, [countryTradeData, maxTradeValue, colorScale, countries]);

  return (
    <div className="w-full h-full relative">
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ background: '#FAFAFA' }}
      />
      {/* 图例 */}
      <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm border border-black/10 rounded-lg p-4 shadow-lg">
        <div className="text-xs font-semibold text-[#1D1D1F] mb-2">{t('countryTrade.tradeValue')}</div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ background: colorScale(0) }}></div>
          <span className="text-xs text-[#86868B]">{t('countryTrade.low')}</span>
          <div className="flex-1 h-2 bg-gradient-to-r rounded" style={{ 
            background: `linear-gradient(to right, ${colorScale(0)}, ${colorScale(maxTradeValue)})` 
          }}></div>
          <div className="w-4 h-4 rounded" style={{ background: colorScale(maxTradeValue) }}></div>
          <span className="text-xs text-[#86868B]">{t('countryTrade.high')}</span>
        </div>
        <div className="text-xs text-[#86868B] mt-2">
          {t('countryTrade.maxValue')}: ${(maxTradeValue / 1000000).toFixed(2)}M
        </div>
      </div>
    </div>
  );
});

CountryTradeMap.displayName = 'CountryTradeMap';

export default CountryTradeMap;
