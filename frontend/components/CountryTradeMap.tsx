import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { CountryMonthlyTradeStat, CountryLocation } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { resolveCountryIso3 } from '../utils/countryCodeMapping';
import { logger } from '../utils/logger';
import { loadWorldGeoJson } from '../utils/worldGeoJson';

interface CountryTradeMapProps {
  stats: CountryMonthlyTradeStat[];
  countries: CountryLocation[];
  selectedHSCodes?: string[];
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
  const [geoJsonLoaded, setGeoJsonLoaded] = useState(false);

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

  // 颜色比例尺 - 使用更明显的颜色（从浅蓝到深蓝，增强对比度）
  const colorScale = useMemo(() => {
    // 使用自定义插值，让颜色更明显
    return d3.scaleSequential((t: number) => {
      // 从浅蓝 (#E3F2FD) 到深蓝 (#1565C0)，增强对比度
      return d3.interpolateRgb('#E3F2FD', '#1565C0')(Math.pow(t, 0.6)); // 使用幂函数增强低值的颜色深度
    }).domain([0, maxTradeValue]);
  }, [maxTradeValue]);

  useEffect(() => {
    const countryLocationMap = new Map<string, CountryLocation>();
    countries.forEach(country => {
      countryLocationMap.set(country.countryCode, country);
    });
    countryLocationMapRef.current = countryLocationMap;
  }, [countries]);

  // 初始化：只执行一次（创建 SVG 结构、底图、zoom、tooltip、事件绑定）
  useEffect(() => {
    if (!svgRef.current || countries.length === 0) return;

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    if (width === 0 || height === 0) {
      logger.warn('[CountryTradeMap] SVG container has zero dimensions:', { width, height, parentHeight: svgRef.current.parentElement?.clientHeight });
      return;
    }

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

    // 使用 ref 持有最新国家映射，确保 hover 逻辑稳定
    const countryLocationMap = countryLocationMapRef.current;

    // 加载并绘制底图（只画一次）
    loadWorldGeoJson().then((data: any) => {
      // 缓存GeoJSON数据
      geoJsonDataRef.current = data;
      setGeoJsonLoaded(true);
      
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

      countryPaths.each(function(d: any) {
        const code = resolveCountryIso3(d.properties, countryLocationMap);
        if (code) {
          d3.select(this).attr('data-country-code', code);
        }
      });

      // 绑定事件监听器（只绑定一次）
      countryPaths.on('mouseover', function(event: MouseEvent, d: any) {
        const countryName = d.properties.name;
        const countryCode =
          d3.select(this).attr('data-country-code') ||
          resolveCountryIso3(d.properties, countryLocationMap);
        
        // 从ref获取最新的tradeData
        const tradeData = countryCode ? countryTradeDataRef.current.get(countryCode) : null;
        
        // 添加视觉特效：高亮当前国家
        d3.select(this)
          .attr('stroke', '#007AFF')
          .attr('stroke-width', 2.5)
          .attr('opacity', 0.9)
          .style('filter', 'brightness(1.2) drop-shadow(0 0 8px rgba(0, 122, 255, 0.6))');
        
        // 显示tooltip
        if (tradeData && tradeData.sumOfUsd > 0) {
          d3Tooltip
            .style('visibility', 'visible')
            .html(`
              <div style="font-weight: 600; margin-bottom: 6px; font-size: 14px;">${countryName || 'Unknown'}</div>
              <div style="margin-bottom: 4px;">${t('countryTrade.tradeValue')}: <strong>$${(tradeData.sumOfUsd / 1000000).toFixed(2)}M</strong></div>
              <div>${t('countryTrade.transactionCount')}: <strong>${tradeData.tradeCount.toLocaleString()}</strong></div>
            `);
        } else if (countryName) {
          d3Tooltip
            .style('visibility', 'visible')
            .html(`
              <div style="font-weight: 600; margin-bottom: 6px; font-size: 14px;">${countryName}</div>
              <div style="color: #86868B;">${t('countryTrade.noData')}</div>
            `);
        }
      })
      .on('mousemove', function(event: MouseEvent) {
        d3Tooltip
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', function() {
        // 移除视觉特效
        d3.select(this)
          .attr('stroke', '#FFFFFF')
          .attr('stroke-width', 1)
          .attr('opacity', 1)
          .style('filter', null);
        
        d3Tooltip.style('visibility', 'hidden');
      });
    }).catch((error) => {
      logger.error('CountryTradeMap: Error loading world map:', error);
    });

    // 设置缩放
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 15])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    
    svg.call(zoom);
    zoomRef.current = zoom;

  }, [countries.length, t]);

  // 更新：只更新国家颜色和节点（筛选时执行）
  useEffect(() => {
    if (!gMapRef.current || !projectionRef.current || !geoJsonLoaded || countries.length === 0) {
      return;
    }
    
    if (!geoJsonDataRef.current) return;
    const gMap = gMapRef.current;
    gMap.selectAll<SVGPathElement, any>('path.country').each(function() {
      const selection = d3.select(this);
      const countryCode = selection.attr('data-country-code');
      const tradeData = countryCode ? countryTradeData.get(countryCode) : undefined;
      const nextFill = tradeData && tradeData.sumOfUsd > 0 ? colorScale(tradeData.sumOfUsd) : '#EBEBEB';
      if (selection.attr('fill') !== nextFill) {
        selection.attr('fill', nextFill);
      }
    });

    // 更新国家节点（使用D3 data join模式，只更新变化的部分）
    // 移除圆形热力圈节点（不再显示）
    if (gNodesRef.current) {
      gNodesRef.current.selectAll('circle.country-node').remove();
    }

  }, [countryTradeData, colorScale, countries.length, geoJsonLoaded]);

  return (
    <div className="w-full h-full relative" style={{ minHeight: '400px' }}>
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ background: '#FAFAFA', minHeight: '400px' }}
      />
    </div>
  );
});

CountryTradeMap.displayName = 'CountryTradeMap';

export default CountryTradeMap;


