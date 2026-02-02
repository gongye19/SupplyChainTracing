import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { CountryMonthlyTradeStat, CountryLocation, Shipment } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { getPortLocation } from '../utils/portLocations';

interface CountryTradeMapProps {
  stats: CountryMonthlyTradeStat[];
  countries: CountryLocation[];
  selectedHSCodes?: string[];
  shipments?: Shipment[];
}

// GeoJSON 缓存
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
  shipments = [],
}) => {
  const { t } = useLanguage();
  const svgRef = useRef<SVGSVGElement>(null);
  const projectionRef = useRef<d3.GeoProjection | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const gMapRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const gNodesRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const gFlowsRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const tooltipRef = useRef<d3.Selection<HTMLDivElement, unknown, null, undefined> | null>(null);

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

  // 初始化地图
  useEffect(() => {
    if (!svgRef.current || countries.length === 0) return;

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    if (width === 0 || height === 0) return;

    const svg = d3.select(svgRef.current);
    
    if (gMapRef.current) return;

    const projection = d3.geoMercator()
      .scale(width / 5.5)
      .center([0, 25])
      .translate([width / 2, height / 2]);
    projectionRef.current = projection;

    const pathGenerator = d3.geoPath().projection(projection);

    const g = svg.append('g');
    const gMap = g.append('g').attr('class', 'map-layer');
    const gNodes = g.append('g').attr('class', 'nodes-layer');
    const gFlows = g.append('g').attr('class', 'flows-layer');
    
    gMapRef.current = gMap;
    gNodesRef.current = gNodes;
    gFlowsRef.current = gFlows;

    // 创建 Tooltip
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

    // 加载并绘制底图
    loadWorldGeoJson().then((data: any) => {
      const filteredFeatures = data.features.filter((f: any) => 
        f.properties.name !== "Antarctica"
      );

      gMap.selectAll('path.country')
        .data(filteredFeatures)
        .enter()
        .append('path')
        .attr('class', 'country')
        .attr('d', pathGenerator)
        .attr('fill', '#EBEBEB')
        .attr('stroke', '#FFFFFF')
        .attr('stroke-width', 1);
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

  }, [countries]);

  // 更新国家节点和颜色
  useEffect(() => {
    if (!gMapRef.current || !projectionRef.current || countries.length === 0) return;

    const projection = projectionRef.current;
    const gMap = gMapRef.current;
    const tooltip = tooltipRef.current;

    // 创建国家代码到位置的映射
    const countryLocationMap = new Map<string, CountryLocation>();
    countries.forEach(country => {
      countryLocationMap.set(country.countryCode, country);
    });

    // 更新国家颜色
    loadWorldGeoJson().then((data: any) => {
      gMap.selectAll('path.country')
        .attr('fill', (d: any) => {
          // 尝试匹配国家代码
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
        })
        .on('mouseover', function(event: MouseEvent, d: any) {
          const countryName = d.properties.name;
          const countryCode = d.properties.ISO_A2 || d.properties.ISO_A3;
          
          let matchedCountry: CountryLocation | undefined;
          for (const [code, location] of countryLocationMap.entries()) {
            if (code === countryCode || location.countryName === countryName) {
              matchedCountry = location;
              break;
            }
          }
          
            if (matchedCountry) {
            const tradeData = countryTradeData.get(matchedCountry.countryCode);
            if (tradeData) {
              tooltip
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
          tooltip
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function() {
          tooltip.style('visibility', 'hidden');
        });
    });

    // 绘制国家节点（圆点）
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

    nodeSelection.exit().remove();

    const nodeEnter = nodeSelection.enter()
      .append('circle')
      .attr('class', 'country-node')
      .attr('r', 0)
      .attr('fill', '#007AFF')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .attr('opacity', 0.8);

    nodeSelection.merge(nodeEnter)
      .transition()
      .duration(300)
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', d => Math.max(3, Math.min(15, Math.sqrt(d.sumOfUsd / maxTradeValue) * 15)))
      .attr('fill', d => colorScale(d.sumOfUsd));

    // 绘制流向线（基于 shipments 数据）
    if (shipments.length > 0 && gFlowsRef.current && projection) {
      const gFlows = gFlowsRef.current;
      
      // 筛选 shipments：如果指定了 HS 编码，只显示匹配的
      const filteredShipments = shipments.filter(s => {
        if (selectedHSCodes.length === 0) return true;
        // 检查 HS 编码是否匹配（前6位）
        return selectedHSCodes.some(code => s.hsCode?.startsWith(code));
      });

      // 创建国家名称到代码的映射（用于匹配）
      const countryNameToCodeMap = new Map<string, string>();
      countries.forEach(country => {
        countryNameToCodeMap.set(country.countryName.toLowerCase(), country.countryCode);
        countryNameToCodeMap.set(country.countryCode.toLowerCase(), country.countryCode);
      });

      // 按国家对聚合流向
      const flowMap = new Map<string, { origin: string; dest: string; value: number; count: number }>();
      
      filteredShipments.forEach(shipment => {
        // 尝试从国家名称或代码获取国家代码
        const originName = shipment.countryOfOrigin || shipment.originId || '';
        const destName = shipment.destinationCountry || shipment.destinationId || '';
        
        const originCode = countryNameToCodeMap.get(originName.toLowerCase()) || originName;
        const destCode = countryNameToCodeMap.get(destName.toLowerCase()) || destName;
        
        if (!originCode || !destCode || originCode === destCode) return;
        
        // 确保国家代码在 countryLocationMap 中存在
        if (!countryLocationMap.has(originCode) || !countryLocationMap.has(destCode)) return;
        
        const key = `${originCode}_${destCode}`;
        const existing = flowMap.get(key) || { origin: originCode, dest: destCode, value: 0, count: 0 };
        flowMap.set(key, {
          origin: originCode,
          dest: destCode,
          value: existing.value + (shipment.totalValueUsd || shipment.value || 0),
          count: existing.count + 1,
        });
      });

      // 获取港口位置映射
      const portPositionsMap = new Map<string, { lat: number; lng: number; countryCode: string }>();
      filteredShipments.forEach(s => {
        if (s.portOfDeparture && s.countryOfOrigin) {
          const portKey = `${s.portOfDeparture}_${s.countryOfOrigin}`;
          const portLoc = getPortLocation(s.portOfDeparture, s.countryOfOrigin);
          if (portLoc) {
            portPositionsMap.set(portKey, { lat: portLoc.lat, lng: portLoc.lng, countryCode: s.countryOfOrigin });
          }
        }
        if (s.portOfArrival && s.destinationCountry) {
          const portKey = `${s.portOfArrival}_${s.destinationCountry}`;
          const portLoc = getPortLocation(s.portOfArrival, s.destinationCountry);
          if (portLoc) {
            portPositionsMap.set(portKey, { lat: portLoc.lat, lng: portLoc.lng, countryCode: s.destinationCountry });
          }
        }
      });

      // 计算路径粗细（根据交易量动态调整）
      const flows = Array.from(flowMap.values());
      if (flows.length === 0) return;
      
      const valueExtent = d3.extent(flows, d => d.value) as [number, number];
      const strokeScale = d3.scaleSqrt()
        .domain(valueExtent[0] !== undefined ? valueExtent : [1, 100])
        .range([1, 5]); // 增加线条粗细范围，使差异更明显

      // 清空现有流向
      gFlows.selectAll('path.flow-path').remove();

      // 绘制流向线
      flows.slice(0, 200).forEach(flow => {
        // 尝试找到源国家和目标国家的位置
        const originCountry = countryLocationMap.get(flow.origin);
        const destCountry = countryLocationMap.get(flow.dest);
        
        if (!originCountry || !destCountry) return;
        
        const sourcePos = projection([originCountry.capitalLng, originCountry.capitalLat]);
        const targetPos = projection([destCountry.capitalLng, destCountry.capitalLat]);
        
        if (!sourcePos || !targetPos) return;
        
        const midX = (sourcePos[0] + targetPos[0]) / 2;
        const midY = (sourcePos[1] + targetPos[1]) / 2 - 50;
        const lineData = `M${sourcePos[0]},${sourcePos[1]} Q${midX},${midY} ${targetPos[0]},${targetPos[1]}`;
        
        const baseStrokeWidth = strokeScale(flow.value);
        const path = gFlows.append('path')
          .attr('d', lineData)
          .attr('fill', 'none')
          .attr('stroke', '#007AFF')
          .attr('stroke-width', 0) // 初始为0，通过动画显示
          .attr('stroke-linecap', 'round')
          .attr('opacity', 0)
          .attr('class', 'flow-path');
        
        // 先绑定事件，再执行动画
        path.on('mouseover', function(event: MouseEvent) {
          d3.select(this)
            .transition()
            .duration(200)
            .attr('opacity', 0.8)
            .attr('stroke-width', baseStrokeWidth * 1.5);
          if (tooltip) {
            tooltip
              .style('visibility', 'visible')
              .html(`
                <div style="font-weight: 600; margin-bottom: 6px;">${originCountry.countryName} → ${destCountry.countryName}</div>
                <div>${t('countryTrade.tradeValue')}: $${(flow.value / 1000000).toFixed(2)}M</div>
                <div>${t('countryTrade.transactionCount')}: ${flow.count}</div>
              `);
          }
        })
        .on('mousemove', function(event: MouseEvent) {
          if (tooltip) {
            tooltip
              .style('left', (event.pageX + 10) + 'px')
              .style('top', (event.pageY - 10) + 'px');
          }
        })
        .on('mouseout', function() {
          d3.select(this)
            .transition()
            .duration(200)
            .attr('opacity', 0.4)
            .attr('stroke-width', baseStrokeWidth);
          if (tooltip) {
            tooltip.style('visibility', 'hidden');
          }
        });
        
        // 在事件绑定后执行动画
        path.transition()
          .duration(500)
          .delay(Math.random() * 300) // 随机延迟，产生动态效果
          .attr('stroke-width', baseStrokeWidth)
          .attr('opacity', 0.4);
      });
    }

  }, [stats, countries, countryTradeData, maxTradeValue, colorScale, shipments, selectedHSCodes, t]);

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

