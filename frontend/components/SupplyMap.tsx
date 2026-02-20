
import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { Shipment, CountryLocation, Category, Transaction, CompanyWithLocation, Filters } from '../types';
import { translateMaterials } from '../utils/materialTranslations';
import { useLanguage } from '../contexts/LanguageContext';
import { getPortLocation } from '../utils/portLocations';
import { loadWorldGeoJson } from '../utils/worldGeoJson';
import { areSupplyMapPropsEqual } from './supplyMapComparator';
import { logger } from '../utils/logger';

interface SupplyMapProps {
  shipments: Shipment[];
  transactions: Transaction[];
  selectedCountries: string[];
  countries: CountryLocation[];
  companies: CompanyWithLocation[];
  categories: Category[];
  filters?: Filters; // 添加 filters 属性
  isPreview?: boolean;
}

const SupplyMap: React.FC<SupplyMapProps> = React.memo(({ 
  shipments, 
  transactions, 
  selectedCountries, 
  countries, 
  companies, 
  categories,
  filters,
  isPreview = false 
}) => {
  const { t, language } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const filterCardRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const projectionRef = useRef<d3.GeoProjection | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const gMapRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const gNodesRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const gFlowsRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const tooltipRef = useRef<d3.Selection<HTMLDivElement, unknown, null, undefined> | null>(null);
  const particleAnimationsRef = useRef<Set<d3.Transition<any, unknown, null, undefined>>>(new Set());

  // 构建品类颜色映射
  const categoryColors = useMemo(() => {
    const colorMap: Record<string, string> = {};
    categories.forEach(cat => {
      colorMap[cat.displayName] = cat.color;
      colorMap[cat.name] = cat.color;
      colorMap[cat.id] = cat.color;
    });
    return colorMap;
  }, [categories]);

  // 注意：聚合数据不包含公司信息，所以返回空数组
  const activeCompanies = useMemo(() => {
    return [];
  }, []);

  const countryCodeToName = useMemo(() => {
    const map = new Map<string, string>();
    countries.forEach((country) => {
      map.set(country.countryCode, country.countryName);
    });
    return map;
  }, [countries]);

  // 初始化：只执行一次（创建 SVG 结构、底图、zoom、tooltip）
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
    const gFlows = g.append('g').attr('class', 'flows-layer');
    
    gMapRef.current = gMap;
    gNodesRef.current = gNodes;
    gFlowsRef.current = gFlows;

    // 创建 Tooltip（只创建一次）
    const d3Tooltip = d3.select('body').append('div')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background', 'rgba(255, 255, 255, 0.9)')
      .style('backdrop-filter', 'blur(10px)')
      .style('border', '1px solid rgba(0,0,0,0.05)')
      .style('padding', '14px')
      .style('border-radius', '14px')
      .style('color', '#1D1D1F')
      .style('font-size', '13px')
      .style('font-weight', '500')
      .style('pointer-events', 'none')
      .style('z-index', '100')
      .style('box-shadow', '0 10px 30px rgba(0,0,0,0.1)')
      .style('min-width', '200px')
      .style('max-width', '300px');
    tooltipRef.current = d3Tooltip;

    // 加载并绘制底图（只画一次）
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
      logger.error('SupplyMap: Error loading world map:', error);
    });

    // 设置缩放
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 15])
      .on('zoom', (event) => {
        // 对整个 g 组应用 transform（包括地图、节点、路径）
        g.attr('transform', event.transform);
        
        const scale = event.transform.k;
        
        // 由于整个 g 组被 transform 缩放，节点和路径也会被缩放
        // 我们需要反向调整它们的大小，使其在屏幕上保持固定大小
        
        // 调整节点大小
        gNodes.selectAll('.company-node circle').each(function() {
          const baseRadius = parseFloat(d3.select(this).attr('data-base-radius') || '2.2');
          const baseStrokeWidth = parseFloat(d3.select(this).attr('data-base-stroke-width') || '1.2');
          const fillColor = d3.select(this).attr('data-fill-color') || '#007AFF';
          const scaledRadius = Math.max(0.5, baseRadius / scale);
          const scaledStrokeWidth = Math.max(0.3, baseStrokeWidth / scale);
          d3.select(this)
            .attr('r', scaledRadius)
            .attr('stroke-width', scaledStrokeWidth)
            .attr('fill', fillColor)
            .style('fill', fillColor);
        });
        
        // 调整路径粗细
        gFlows.selectAll('.shipment-path').each(function() {
          const baseStrokeWidth = parseFloat(d3.select(this).attr('data-base-stroke-width') || '1.2');
          const scaledStrokeWidth = Math.max(0.2, baseStrokeWidth / scale);
          d3.select(this).attr('stroke-width', scaledStrokeWidth);
        });
        
        gFlows.selectAll('.shipment-highlight').each(function() {
          const baseStrokeWidth = parseFloat(d3.select(this).attr('data-base-stroke-width') || '1.2');
          const scaledStrokeWidth = Math.max(0.2, baseStrokeWidth / scale);
          d3.select(this).attr('stroke-width', scaledStrokeWidth);
        });
        
        // 调整港口图标大小
        gNodes.selectAll('.country-node .country-icon').each(function() {
          // 调整港口图标（锚点）大小 - 拉近时缩小，拉远时放大（保持屏幕视觉大小稳定）
          const iconGroup = d3.select(this);
          const baseSize = parseFloat(iconGroup.attr('data-base-size') || '5');
          const baseStrokeWidth = parseFloat(iconGroup.attr('data-stroke-width') || '1.2');
          // 拉近（scale增大）时图标缩小，拉远（scale减小）时图标放大
          // 由于整个 g 组被 transform 放大了 scale 倍，我们需要将图标缩小 scale 倍来补偿
          const scaledSize = Math.max(0.5, baseSize / scale);
          const scaledStrokeWidth = Math.max(0.3, baseStrokeWidth / scale);
          // 使用 transform scale 来缩放整个图标组
          iconGroup.attr('transform', `scale(${scaledSize / baseSize})`);
          // 调整 stroke-width（需要反向补偿，因为 transform scale 也会缩放 stroke）
          // circle 的 stroke-width
          iconGroup.select('circle')
            .attr('stroke-width', scaledStrokeWidth);
          // path 的 stroke-width
          iconGroup.select('path')
            .attr('stroke-width', scaledStrokeWidth * 0.8);
        });
        
        // 调整港口标签 - 使用反向 transform 保持固定屏幕尺寸
        gNodes.selectAll<SVGGElement, any>('.country-node .country-label')
          .attr('transform', `scale(${1 / scale})`);
        
        // 调整标签背景的 stroke-width（反向补偿）
        gNodes.selectAll('.country-node .country-label rect')
          .attr('stroke-width', 0.5 / scale);
      });

    const initialTransform = d3.zoomIdentity.translate(0, 0).scale(1);
    svg.call(zoom.transform, initialTransform);
    svg.call(zoom);
    zoomRef.current = zoom;

    // 清理函数
    return () => {
      if (tooltipRef.current) {
        tooltipRef.current.remove();
      }
      // 清理所有粒子动画
      particleAnimationsRef.current.forEach(anim => {
        try {
          anim.interrupt();
        } catch (e) {
          // ignore
        }
      });
      particleAnimationsRef.current.clear();
    };
  }, []); // 只在组件挂载时执行一次

  // 更新：每次 shipments/selectedCountries/isPreview 更新，只更新 nodes/flows
  useEffect(() => {
    if (!gNodesRef.current || !gFlowsRef.current || !projectionRef.current || countries.length === 0) return;

    const projection = projectionRef.current;
    const gNodes = gNodesRef.current;
    const gFlows = gFlowsRef.current;

    // 清理之前的粒子动画
    particleAnimationsRef.current.forEach(anim => {
      try {
        anim.interrupt();
      } catch (e) {
        // ignore
      }
    });
    particleAnimationsRef.current.clear();

    // 清理之前的 nodes 和 flows（保留底图）
    gNodes.selectAll('*').remove();
    gFlows.selectAll('*').remove();

    // 创建节点位置映射 - 使用国家中心点
    const countryNodePositions = new Map<string, [number, number]>(); // 存储国家节点位置（使用 countryCode 作为键）
    const countryPositionsMap = new Map<string, { pos: [number, number]; countryCode: string; countryName: string }>();
    
    // 从 shipments 中提取国家信息并创建国家节点位置
    shipments.forEach(shipment => {
      // 处理原产国
      const originCountryCode = shipment.originId || shipment.originCountryCode;
      if (originCountryCode) {
        if (!countryPositionsMap.has(originCountryCode)) {
          const country = countries.find(c => c.countryCode === originCountryCode);
          if (country) {
            const lat = country.capitalLat || (country as any).latitude || 0;
            const lng = country.capitalLng || (country as any).longitude || 0;
            const pos = projection([lng, lat]);
            if (pos) {
              countryPositionsMap.set(originCountryCode, {
                pos,
                countryCode: originCountryCode,
                countryName: country.countryName
              });
              countryNodePositions.set(originCountryCode, pos);
            }
          }
        }
      }
      
      // 处理目的地国家
      const destCountryCode = shipment.destinationId || shipment.destinationCountryCode;
      if (destCountryCode) {
        if (!countryPositionsMap.has(destCountryCode)) {
          const country = countries.find(c => c.countryCode === destCountryCode);
          if (country) {
            const lat = country.capitalLat || (country as any).latitude || 0;
            const lng = country.capitalLng || (country as any).longitude || 0;
            const pos = projection([lng, lat]);
            if (pos) {
              countryPositionsMap.set(destCountryCode, {
                pos,
                countryCode: destCountryCode,
                countryName: country.countryName
              });
              countryNodePositions.set(destCountryCode, pos);
            }
          }
        }
      }
    });
    
    // 显示国家节点（带标签和图标）
    // 获取当前缩放级别
    const svgNode = svgRef.current;
    const currentScale = svgNode ? d3.zoomTransform(svgNode)?.k || 1 : 1;
    
    countryPositionsMap.forEach((countryInfo, countryCode) => {
      const countryNode = gNodes.append('g')
        .attr('class', 'country-node')
        .attr('transform', `translate(${countryInfo.pos[0]}, ${countryInfo.pos[1]})`)
        .style('pointer-events', 'all')
        .style('cursor', 'pointer');
      
      // 国家标签 - 使用独立的 label 组，通过反向 transform 保持固定大小
      // 先创建标签，确保文字在最上方（图标在 y=0，标签在 y 负值区域）
      const displayName = countryInfo.countryName;
      const label = countryNode.append('g')
        .attr('class', 'country-label');
      
      const baseFontSize = 10;
      // 先创建文字，获取 bbox 后再调整位置
      const text = label.append('text')
        .attr('x', 0)
        .attr('y', 0) // 临时位置，稍后调整
        .attr('text-anchor', 'middle')
        .attr('font-size', `${baseFontSize}px`)
        .attr('font-weight', '600')
        .attr('fill', '#000000') // 确保是黑色
        .text(displayName);
      
      const textNode = text.node();
      if (textNode) {
        const bbox = textNode.getBBox();
        const padding = 6;
        const bgHeight = bbox.height + padding * 2;
        const bgWidth = Math.max(40, bbox.width + padding * 2);
        const iconOffset = 8; // 图标到标签的距离
        
        // 背景矩形（在文字下方，确保文字在上层）
        const textBg = label.insert('rect', 'text')
          .attr('x', -bgWidth / 2)
          .attr('y', -iconOffset - bgHeight) // 在图标上方
          .attr('width', bgWidth)
          .attr('height', bgHeight)
          .attr('rx', 4)
          .attr('fill', 'rgba(255, 255, 255, 0.95)')
          .attr('stroke', 'rgba(0, 0, 0, 0.15)')
          .attr('stroke-width', 0.5);
        
        // 调整文字位置，使其在背景中央
        text.attr('y', -iconOffset - bgHeight / 2 + bbox.height / 3); // 垂直居中
      }
      
      // 国家图标（圆形图标）- 在标签下方
      const iconSize = 6; // 图标基础大小（国家节点稍大）
      const baseStrokeWidth = 1.2;
      const scaledSize = Math.max(0.5, iconSize / currentScale);
      const scaledStrokeWidth = Math.max(0.3, baseStrokeWidth / currentScale);
      
      // 创建国家图标组
      const iconGroup = countryNode.append('g')
        .attr('class', 'country-icon')
        .attr('data-base-size', iconSize)
        .attr('data-stroke-width', baseStrokeWidth);
      
      // 国家节点图标：圆形
      iconGroup.append('circle')
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', scaledSize)
        .attr('fill', '#007AFF')
        .attr('stroke', '#FFFFFF')
        .attr('stroke-width', scaledStrokeWidth);
      
      // 添加阴影效果
      iconGroup.style('filter', 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.25))');
      
      // 鼠标悬停效果
      countryNode.on('mouseover', function(event) {
        const svgNode = svgRef.current;
        const currentScale = svgNode ? d3.zoomTransform(svgNode)?.k || 1 : 1;
        const scaledSize = Math.max(0.5, iconSize / currentScale);
        const iconGroup = d3.select(this).select('.country-icon');
        if (!iconGroup.empty()) {
          iconGroup.transition().duration(200)
            .attr('transform', `scale(${(scaledSize * 1.5) / iconSize})`);
        }
        
        if (tooltipRef.current) {
          const tooltipHTML = `
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <div style="font-weight: bold; font-size: 14px; color: #1D1D1F;">${countryInfo.countryName}</div>
              <div style="color: #86868B; font-size: 12px;">${countryInfo.countryCode}</div>
            </div>
          `;
          tooltipRef.current.html(tooltipHTML)
            .style('visibility', 'visible')
            .style('top', (event.pageY - 10) + 'px')
            .style('left', (event.pageX + 20) + 'px');
        }
      })
      .on('mouseout', function() {
        const svgNode = svgRef.current;
        const currentScale = svgNode ? d3.zoomTransform(svgNode)?.k || 1 : 1;
        const scaledSize = Math.max(0.5, iconSize / currentScale);
        const iconGroup = d3.select(this).select('.country-icon');
        if (!iconGroup.empty()) {
          iconGroup.transition().duration(200)
            .attr('transform', `scale(${scaledSize / iconSize})`);
        }
        if (tooltipRef.current) {
          tooltipRef.current.style('visibility', 'hidden');
        }
      });
    });

    // 绘制路径和粒子（preview 模式限制粒子数量）
    if (shipments.length > 0) {
      // shipments 已经是按国家对聚合的，每个国家对一条线
      // 直接使用 shipments 作为 routeGroups
      const countryLookup = new Map<string, CountryLocation>();
      countries.forEach((c) => countryLookup.set(c.countryCode, c));

      const routeGroups = shipments.map(shipment => {
        // 获取国家名称
        const originCountryCode = shipment.originId || shipment.originCountryCode;
        const destCountryCode = shipment.destinationId || shipment.destinationCountryCode;
        const originCountry = countryLookup.get(originCountryCode)?.countryName || originCountryCode;
        const destinationCountry = countryLookup.get(destCountryCode)?.countryName || destCountryCode;
        
        const focusCountry = selectedCountries[0];
        const flowType =
          focusCountry && originCountryCode === focusCountry
            ? 'outbound'
            : focusCountry && destCountryCode === focusCountry
              ? 'inbound'
              : 'transit';
        
        return {
          originId: originCountryCode,
          destinationId: destCountryCode,
          originCountry,
          destinationCountry,
          shipments: [shipment],
          count: shipment.tradeCount || 1, // 交易次数
          totalValue: shipment.value || (shipment.totalValueUsd ? shipment.totalValueUsd / 1000000 : 0),
          mainCategory: shipment.category,
          mainColor: (shipment as any).categoryColor || '#8E8E93',
          flowType,
        };
      });

      // 线粗细按交易量（tradeCount），颜色深浅按交易价值（totalValue）
      const countExtent = d3.extent(routeGroups, d => d.count) as [number, number];
      const countDomainMin = countExtent[0] ?? 1;
      const countDomainMax = countExtent[1] ?? 100;
      const safeCountDomainMax = countDomainMax <= countDomainMin ? countDomainMin + 1 : countDomainMax;
      const strokeScale = d3.scaleSqrt()
        .domain([countDomainMin, safeCountDomainMax])
        .range([1, 5]);

      const valueExtent = d3.extent(routeGroups, d => d.totalValue) as [number, number];
      const valueDomainMin = valueExtent[0] ?? 1;
      const valueDomainMax = valueExtent[1] ?? 100;
      const safeValueDomainMax = valueDomainMax <= valueDomainMin ? valueDomainMin + 1 : valueDomainMax;
      const colorScale = d3.scaleLinear()
        .domain([valueDomainMin, safeValueDomainMax])
        .range([0, 1]);

      // preview 模式：只显示少量路径，不画粒子
      // final 模式：限制最大路径数，避免大数据量时 SVG 过载
      const routeGroupsArray = routeGroups
        .sort((a, b) => b.totalValue - a.totalValue); // 按交易价值降序
      const maxPaths = isPreview
        ? Math.min(90, routeGroupsArray.length)
        : Math.min(420, routeGroupsArray.length);
      const isDenseMode = routeGroupsArray.length > 250;

      // 获取翻译文本（在循环外部）
      const materialNameLabel = t('map.materialName');
      const directionLabel = t('map.direction');
      const transactionCountLabel = t('map.transactionCount');
      const totalValueLabel = t('map.totalValue');
      
      routeGroupsArray.slice(0, maxPaths).forEach((routeGroup, routeIndex) => {
        // 使用第一个 shipment 来确定位置
        const firstShipment = routeGroup.shipments[0];

        // 强制使用港口位置（如果没有港口信息则跳过该交易）
        let sourcePos: [number, number] | null = null;
        let targetPos: [number, number] | null = null;
        let origin: { lng: number; lat: number; name: string; country: string } | null = null;
        let dest: { lng: number; lat: number; name: string; country: string } | null = null;
        
        // 获取原产国位置（必须）
        const originCountryCode = firstShipment.originId || firstShipment.originCountryCode;
        if (originCountryCode && countryNodePositions.has(originCountryCode)) {
          sourcePos = countryNodePositions.get(originCountryCode)!;
          const countryInfo = countryPositionsMap.get(originCountryCode);
          origin = {
            lng: 0, lat: 0, // 位置已通过 sourcePos 确定
            name: countryInfo?.countryName || firstShipment.countryOfOrigin || originCountryCode,
            country: countryInfo?.countryName || firstShipment.countryOfOrigin || ''
          };
        }
        
        // 获取目的地国家位置（必须）
        const destCountryCode = firstShipment.destinationId || firstShipment.destinationCountryCode;
        if (destCountryCode && countryNodePositions.has(destCountryCode)) {
          targetPos = countryNodePositions.get(destCountryCode)!;
          const countryInfo = countryPositionsMap.get(destCountryCode);
          dest = {
            lng: 0, lat: 0, // 位置已通过 targetPos 确定
            name: countryInfo?.countryName || firstShipment.destinationCountry || destCountryCode,
            country: countryInfo?.countryName || firstShipment.destinationCountry || ''
          };
        }

        // 如果缺少国家位置，跳过该交易
        if (!sourcePos || !targetPos || !origin || !dest) return;
          
        // 使用二次贝塞尔曲线连接，视觉更柔和，避免“硬直线”割裂感
        const sx = sourcePos[0];
        const sy = sourcePos[1];
        const tx = targetPos[0];
        const ty = targetPos[1];
        const dx = tx - sx;
        const dy = ty - sy;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const invDistance = distance > 0 ? 1 / distance : 0;
        const normalX = -dy * invDistance;
        const normalY = dx * invDistance;
        const curvature = Math.min(75, Math.max(18, distance * 0.17));
        const cx = (sx + tx) / 2 + normalX * curvature;
        const cy = (sy + ty) / 2 + normalY * curvature;
        const lineData = `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`;
          
        const colorDepth = Math.max(0, Math.min(1, colorScale(routeGroup.totalValue)));
        // 用非线性增强中低值区间的可见差异，避免“看起来都差不多”
        const enhancedDepth = Math.pow(colorDepth, 0.45);
        const color = d3.interpolateRgbBasis(['#EAF4FF', '#86BEFF', '#1E7BFF', '#003C99'])(enhancedDepth);
        const baseArcOpacity = 0.36 + enhancedDepth * 0.5;
        const haloOpacity = 0.08 + enhancedDepth * 0.2;
        const directionText =
          routeGroup.flowType === 'inbound'
            ? (language === 'zh' ? '流入' : 'Inbound')
            : routeGroup.flowType === 'outbound'
              ? (language === 'zh' ? '流出' : 'Outbound')
              : (language === 'zh' ? '中转' : 'Transit');
        const thickness = strokeScale(routeGroup.count); // 根据交易量计算粗细

        // 底层光晕，增强层次感
        gFlows.append('path')
          .attr('d', lineData)
          .attr('fill', 'none')
          .attr('stroke', color)
          .attr('stroke-width', thickness * 2.2)
          .attr('stroke-linecap', 'round')
          .attr('opacity', haloOpacity)
          .style('pointer-events', 'none');

        const arc = gFlows.append('path')
            .attr('d', lineData)
            .attr('fill', 'none')
            .attr('stroke', color)
            .attr('stroke-width', thickness)
          .attr('data-base-stroke-width', thickness)
            .attr('stroke-linecap', 'round')
            .attr('opacity', baseArcOpacity)
          .attr('class', 'shipment-path');

        if (!isDenseMode && routeIndex < 120) {
          const breathUpOpacity = Math.min(0.96, baseArcOpacity + 0.18);
          const breathDownOpacity = Math.max(0.28, baseArcOpacity - 0.1);
          const breath = () => {
            const up = arc.transition()
              .duration(1300 + Math.random() * 500)
              .attr('opacity', breathUpOpacity)
              .on('end', () => {
                particleAnimationsRef.current.delete(up);
                const down = arc.transition()
                  .duration(1300 + Math.random() * 500)
                  .attr('opacity', breathDownOpacity)
                  .on('end', () => {
                    particleAnimationsRef.current.delete(down);
                    if (!isPreview) {
                      breath();
                    }
                  });
                particleAnimationsRef.current.add(down);
              });
            particleAnimationsRef.current.add(up);
          };
          breath();
        }

        // 线内流光：通过沿路径移动的高亮段表达方向（起点 -> 终点）
        const pathLength = (arc.node() as SVGPathElement).getTotalLength();
        const glowLength = Math.max(16, Math.min(72, pathLength * 0.22));
        const glowStrokeWidth = Math.max(1.0, thickness * 0.72);
        const highlight = gFlows.append('path')
          .attr('d', lineData)
          .attr('fill', 'none')
          .attr('stroke', '#A7DEFF')
          .attr('stroke-width', glowStrokeWidth)
          .attr('data-base-stroke-width', glowStrokeWidth)
          .attr('stroke-linecap', 'round')
          .attr('opacity', 0.92)
          .attr('stroke-dasharray', `${glowLength} ${Math.max(8, pathLength)}`)
          .attr('stroke-dashoffset', pathLength)
          .attr('class', 'shipment-highlight')
          .style('pointer-events', 'none');

        if (!isDenseMode && !isPreview && routeIndex < 140) {
          const flow = () => {
            const transition = highlight.transition()
              .duration(2200 + Math.random() * 1100)
              .ease(d3.easeLinear)
              .attr('stroke-dashoffset', 0)
              .on('end', () => {
                particleAnimationsRef.current.delete(transition);
                if (!isPreview) {
                  highlight.attr('stroke-dashoffset', pathLength);
                  flow();
                }
              });
            particleAnimationsRef.current.add(transition);
          };
          flow();
        }

          arc.on('mouseover', function(event) {
          const svgNode = svgRef.current;
          const currentScale = svgNode ? d3.zoomTransform(svgNode)?.k || 1 : 1;
            const baseStrokeWidth = parseFloat(d3.select(this).attr('data-base-stroke-width') || thickness.toString());
            const scaledThickness = Math.max(0.2, baseStrokeWidth / currentScale);
            d3.select(this)
              .attr('opacity', 0.95)
              .attr('stroke-width', scaledThickness + 1.2 / currentScale);
          
          if (tooltipRef.current) {
            // 获取所有物料（去重）
            const uniqueMaterials = Array.from(new Set(routeGroup.shipments.map(s => s.material)));
            // 翻译物料名称
            const translatedMaterials = translateMaterials(uniqueMaterials);
            const materialsText = translatedMaterials.length > 3 
              ? `${translatedMaterials.slice(0, 3).join('、')}，...`
              : translatedMaterials.join('、');
            
            // 获取品类显示名称
            const category = categories.find(c => c.displayName === routeGroup.mainCategory);
            const categoryDisplayName = category?.displayName || routeGroup.mainCategory;
            
            // 计算实际交易数量（从原始shipments数据中统计）
            const actualTransactionCount = routeGroup.shipments.length;
            
            tooltipRef.current.html(`
              <div class="space-y-3">
                <div class="flex items-center justify-between gap-4 pb-2 border-b border-black/5">
                  <div class="flex items-center gap-2">
                    <div class="w-3 h-3 rounded-full" style="background-color: ${color}"></div>
                    <span class="font-bold text-[16px] text-[#1D1D1F]">${categoryDisplayName}</span>
                  </div>
                </div>
                <div class="flex flex-col gap-1">
                  <span class="text-[#86868B] text-[10px] font-bold uppercase">${materialNameLabel}</span>
                  <span class="text-[#1D1D1F] font-semibold text-[13px]">${materialsText}</span>
                </div>
                <div class="flex flex-col gap-1">
                  <span class="text-[#86868B] text-[10px] font-bold uppercase">${directionLabel}</span>
                  <span class="text-[#007AFF] font-semibold text-[13px]">${origin.name} &rarr; ${dest.name}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-[#86868B] text-[10px] font-bold uppercase">${language === 'zh' ? '方向类型' : 'Flow Type'}</span>
                  <span class="font-bold text-[#1D1D1F]">${directionText}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-[#86868B] text-[10px] font-bold uppercase">${transactionCountLabel}</span>
                  <span class="text-[#1D1D1F] font-bold">${actualTransactionCount}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-[#86868B] text-[10px] font-bold uppercase">${totalValueLabel}</span>
                  <span class="text-[#1D1D1F] font-bold">$${routeGroup.totalValue.toFixed(1)}M</span>
                </div>
              </div>
            `)
            .style('visibility', 'visible')
            .style('top', (event.pageY - 10) + 'px')
            .style('left', (event.pageX + 20) + 'px');
          }
          })
          .on('mousemove', (event) => {
          if (tooltipRef.current) {
            tooltipRef.current.style('top', (event.pageY - 10) + 'px').style('left', (event.pageX + 20) + 'px');
          }
          })
          .on('mouseout', function() {
          const svgNode = svgRef.current;
          const currentScale = svgNode ? d3.zoomTransform(svgNode)?.k || 1 : 1;
            const baseStrokeWidth = parseFloat(d3.select(this).attr('data-base-stroke-width') || thickness.toString());
            const scaledThickness = Math.max(0.2, baseStrokeWidth / currentScale);
            d3.select(this).attr('opacity', baseArcOpacity).attr('stroke-width', scaledThickness);
          if (tooltipRef.current) {
            tooltipRef.current.style('visibility', 'hidden');
          }
        });

      });
      }
  }, [shipments, selectedCountries, activeCompanies, companies, countries, categoryColors, categories, isPreview, countryCodeToName]);

  // 将筛选卡片做成“随滚动吸顶”的浮层，避免下滑后看不到配置
  useEffect(() => {
    const updateFilterCardPosition = () => {
      const container = containerRef.current;
      const card = filterCardRef.current;
      if (!container || !card) return;

      const rect = container.getBoundingClientRect();
      const stickyTop = 80; // 顶部导航下方安全距离
      const targetTop = Math.max(stickyTop, rect.top + 24);
      const targetLeft = Math.max(16, rect.left + 24);
      const isVisible = rect.bottom > stickyTop + 40 && rect.top < window.innerHeight - 40;

      card.style.top = `${targetTop}px`;
      card.style.left = `${targetLeft}px`;
      card.style.opacity = isVisible ? '1' : '0';
      card.style.visibility = isVisible ? 'visible' : 'hidden';
    };

    updateFilterCardPosition();
    window.addEventListener('scroll', updateFilterCardPosition, { passive: true });
    window.addEventListener('resize', updateFilterCardPosition);

    return () => {
      window.removeEventListener('scroll', updateFilterCardPosition);
      window.removeEventListener('resize', updateFilterCardPosition);
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden rounded-[24px] border border-black/5 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
      {/* 固定筛选信息 - 左上角 */}
      <div ref={filterCardRef} className="fixed z-20 transition-opacity duration-150">
        <div className="bg-white/95 backdrop-blur-xl p-4 rounded-[18px] border border-black/[0.05] shadow-lg min-w-[200px] max-w-[280px] pointer-events-auto">
          <div className="mb-3 pb-2.5 border-b border-black/10">
            <span className="text-[12px] text-[#1D1D1F] font-bold uppercase tracking-widest">{t('map.activeFilters') || 'Filter Control'}</span>
          </div>
          <div className="flex flex-col gap-2.5 text-[11px]">
            {/* 时间范围 */}
            {filters && (
              <>
                <div className="flex items-start gap-2">
                  <span className="text-[#86868B] font-semibold min-w-[60px]">Time:</span>
                  <span className="text-[#1D1D1F]">{filters.startDate} ~ {filters.endDate}</span>
                </div>
                
                {/* 国家 */}
                {filters.selectedCountries.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="text-[#86868B] font-semibold min-w-[60px]">Country:</span>
                    <span className="text-[#1D1D1F]">
                      {(() => {
                        const selectedCountryNames = filters.selectedCountries.map(
                          (code) => countryCodeToName.get(code) || code
                        );
                        return selectedCountryNames.length <= 2
                          ? selectedCountryNames.join(', ')
                          : `${selectedCountryNames.slice(0, 2).join(', ')} +${selectedCountryNames.length - 2}`;
                      })()}
                    </span>
                  </div>
                )}
                
                {/* 公司 */}
                {filters.selectedCompanies.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="text-[#86868B] font-semibold min-w-[60px]">Company:</span>
                    <span className="text-[#1D1D1F]">
                      {filters.selectedCompanies.length <= 1 
                        ? filters.selectedCompanies.join(', ')
                        : `${filters.selectedCompanies[0]} +${filters.selectedCompanies.length - 1}`}
                    </span>
                  </div>
                )}
                
                {/* 大类 */}
                {filters.selectedHSCodeCategories.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="text-[#86868B] font-semibold min-w-[60px]">Category:</span>
                    <span className="text-[#1D1D1F]">
                      {filters.selectedHSCodeCategories.map(code => `HS${code}`).join(', ')}
                    </span>
                  </div>
                )}
                
                {/* 小类 */}
                {filters.selectedHSCodeSubcategories.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="text-[#86868B] font-semibold min-w-[60px]">Subcategory:</span>
                    <span className="text-[#1D1D1F]">
                      {filters.selectedHSCodeSubcategories.join(', ')}
                    </span>
                  </div>
                )}
                
                {/* 无筛选时显示 */}
                {filters.selectedCountries.length === 0 && 
                 filters.selectedCompanies.length === 0 && 
                 filters.selectedHSCodeCategories.length === 0 && 
                 filters.selectedHSCodeSubcategories.length === 0 && (
                  <div className="text-[#86868B] text-[10px] italic">No filters selected</div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
    </div>
  );
}, areSupplyMapPropsEqual);

SupplyMap.displayName = 'SupplyMap';

export default SupplyMap;
