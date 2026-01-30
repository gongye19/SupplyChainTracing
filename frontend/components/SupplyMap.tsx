
import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { Shipment, CountryLocation, Category, Transaction, CompanyWithLocation, Filters } from '../types';
import { translateMaterials } from '../utils/materialTranslations';
import { useLanguage } from '../contexts/LanguageContext';
import { getPortLocation } from '../utils/portLocations';

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

// GeoJSON 缓存
let worldGeoJsonPromise: Promise<any> | null = null;
function loadWorldGeoJson() {
  if (!worldGeoJsonPromise) {
    worldGeoJsonPromise = d3.json('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson');
  }
  return worldGeoJsonPromise;
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
  const svgRef = useRef<SVGSVGElement>(null);
  const projectionRef = useRef<d3.GeoProjection | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const gMapRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const gNodesRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const gFlowsRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const tooltipRef = useRef<d3.Selection<HTMLDivElement, unknown, null, undefined> | null>(null);
  const particleAnimationsRef = useRef<Set<d3.Transition<SVGCircleElement, unknown, null, undefined>>>(new Set());

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

  // 获取活跃公司（在交易中出现的公司）
  const activeCompanies = useMemo(() => {
    const activeCompanyIds = new Set<string>();
    shipments.forEach(s => {
      if (s.exporterCompanyId) activeCompanyIds.add(s.exporterCompanyId);
      if (s.importerCompanyId) activeCompanyIds.add(s.importerCompanyId);
    });
    return companies.filter(c => activeCompanyIds.has(c.id));
  }, [shipments, companies]);

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
      console.error('SupplyMap: Error loading world map:', error);
    });

    // 设置缩放
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 15])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        
        const scale = event.transform.k;
        
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
        
        // 调整粒子大小
        gFlows.selectAll('.shipment-particle').each(function() {
          const baseRadius = parseFloat(d3.select(this).attr('data-base-radius') || '1.8');
          const baseStrokeWidth = parseFloat(d3.select(this).attr('data-base-stroke-width') || '0.5');
          const scaledRadius = Math.max(0.3, baseRadius / scale);
          const scaledStrokeWidth = Math.max(0.1, baseStrokeWidth / scale);
          d3.select(this)
            .attr('r', scaledRadius)
            .attr('stroke-width', scaledStrokeWidth);
        });
        
        // 调整港口图标和标签的大小
        gNodes.selectAll('.port-node').each(function() {
          // 调整港口图标（圆形）大小 - 放大时缩小
          const circle = d3.select(this).select('circle');
          if (!circle.empty()) {
            const baseRadius = parseFloat(circle.attr('data-base-radius') || '3');
            const baseStrokeWidth = parseFloat(circle.attr('data-stroke-width') || '1.5');
            const scaledRadius = Math.max(0.5, baseRadius / scale);
            const scaledStrokeWidth = Math.max(0.3, baseStrokeWidth / scale);
            circle
              .attr('r', scaledRadius)
              .attr('stroke-width', scaledStrokeWidth);
          }
          
          // 调整港口标签字体大小
          const text = d3.select(this).select('text');
          if (!text.empty()) {
            const baseFontSize = parseFloat(text.attr('data-base-font-size') || '10');
            // 根据缩放级别动态调整字体大小，范围从 8px 到 20px
            const scaledFontSize = Math.max(8, Math.min(20, baseFontSize * Math.sqrt(scale))); // 使用sqrt使变化更平滑
            text.attr('font-size', `${scaledFontSize}px`);
            
            // 根据文本宽度调整背景
            const rect = d3.select(this).select('rect');
            const textNode = text.node();
            if (textNode && !rect.empty()) {
              const bbox = textNode.getBBox();
              rect.attr('width', Math.max(40, bbox.width + 12))
                .attr('x', -(bbox.width + 12) / 2)
                .attr('height', bbox.height + 8)
                .attr('y', -(bbox.height + 8) / 2);
              text.attr('y', bbox.height / 2);
            }
          }
        });
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

    // 创建节点位置映射 - 只使用港口节点
    const portNodePositions = new Map<string, [number, number]>(); // 存储港口节点位置（使用 "portName_countryCode" 作为键）
    const portPositionsMap = new Map<string, { pos: [number, number]; portName: string; countryCode: string; countryName: string }>();
    
    // 从 shipments 中提取港口信息并创建港口节点位置
    shipments.forEach(shipment => {
      // 处理出发港口
      if (shipment.portOfDeparture && shipment.originId) {
        const portKey = `${shipment.portOfDeparture}_${shipment.originId}`;
        if (!portPositionsMap.has(portKey)) {
          const country = countries.find(c => c.countryCode === shipment.originId);
          const countryLocation = country ? {
            latitude: (country as any).capitalLat || (country as any).latitude || 0,
            longitude: (country as any).capitalLng || (country as any).longitude || 0
          } : undefined;
          
          const portLoc = getPortLocation(
            shipment.portOfDeparture,
            shipment.countryOfOrigin || '',
            countryLocation
          );
          
          const pos = projection([portLoc.longitude, portLoc.latitude]);
          if (pos) {
            portPositionsMap.set(portKey, {
              pos,
              portName: shipment.portOfDeparture,
              countryCode: shipment.originId,
              countryName: country?.countryName || shipment.countryOfOrigin || ''
            });
            portNodePositions.set(portKey, pos);
          }
        }
      }
      
      // 处理到达港口
      if (shipment.portOfArrival && shipment.destinationId) {
        const portKey = `${shipment.portOfArrival}_${shipment.destinationId}`;
        if (!portPositionsMap.has(portKey)) {
          const country = countries.find(c => c.countryCode === shipment.destinationId);
          const countryLocation = country ? {
            latitude: (country as any).capitalLat || (country as any).latitude || 0,
            longitude: (country as any).capitalLng || (country as any).longitude || 0
          } : undefined;
          
          const portLoc = getPortLocation(
            shipment.portOfArrival,
            shipment.destinationCountry || '',
            countryLocation
          );
          
          const pos = projection([portLoc.longitude, portLoc.latitude]);
          if (pos) {
            portPositionsMap.set(portKey, {
              pos,
              portName: shipment.portOfArrival,
              countryCode: shipment.destinationId,
              countryName: country?.countryName || shipment.destinationCountry || ''
            });
            portNodePositions.set(portKey, pos);
          }
        }
      }
    });
    
    // 显示港口节点（带标签和图标）
    // 获取当前缩放级别
    const svgNode = svgRef.current;
    const currentScale = svgNode ? d3.zoomTransform(svgNode)?.k || 1 : 1;
    
    portPositionsMap.forEach((portInfo, portKey) => {
      const portNode = gNodes.append('g')
        .attr('class', 'port-node')
        .attr('transform', `translate(${portInfo.pos[0]}, ${portInfo.pos[1]})`)
        .style('pointer-events', 'all')
        .style('cursor', 'pointer');
      
      // 港口图标（圆形）
      const baseRadius = 3;
      const baseStrokeWidth = 1.5;
      const scaledRadius = Math.max(0.5, baseRadius / currentScale);
      const scaledStrokeWidth = Math.max(0.3, baseStrokeWidth / currentScale);
      portNode.append('circle')
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', scaledRadius)
        .attr('data-base-radius', baseRadius)
        .attr('data-stroke-width', baseStrokeWidth)
        .attr('fill', '#007AFF')
        .attr('stroke', '#FFFFFF')
        .attr('stroke-width', scaledStrokeWidth)
        .style('filter', 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))');
      
      // 港口标签
      const displayName = `${portInfo.portName}, ${portInfo.countryName}`;
      const textBg = portNode.append('rect')
        .attr('x', -20)
        .attr('y', 8)
        .attr('width', 40)
        .attr('height', 16)
        .attr('rx', 4)
        .attr('fill', 'rgba(255, 255, 255, 0.95)')
        .attr('stroke', 'rgba(0, 0, 0, 0.15)')
        .attr('stroke-width', 0.5);
      
      const baseFontSize = 10;
      const text = portNode.append('text')
        .attr('x', 0)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .attr('font-size', `${baseFontSize}px`)
        .attr('data-base-font-size', baseFontSize)
        .attr('font-weight', '600')
        .attr('fill', '#1D1D1F')
        .text(displayName);
      
      const textNode = text.node();
      if (textNode) {
        const bbox = textNode.getBBox();
        textBg.attr('width', Math.max(40, bbox.width + 12))
          .attr('x', -(bbox.width + 12) / 2)
          .attr('height', bbox.height + 8)
          .attr('y', 8);
        text.attr('y', 8 + bbox.height / 2 + 4);
      }
      
      // 鼠标悬停效果
      portNode.on('mouseover', function(event) {
        const svgNode = svgRef.current;
        const currentScale = svgNode ? d3.zoomTransform(svgNode)?.k || 1 : 1;
        const scaledRadius = Math.max(0.5, baseRadius / currentScale);
        d3.select(this).select('circle')
          .transition().duration(200)
          .attr('r', scaledRadius * 1.5);
        
        if (tooltipRef.current) {
          const tooltipHTML = `
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <div style="font-weight: bold; font-size: 14px; color: #1D1D1F;">${portInfo.portName}</div>
              <div style="color: #86868B; font-size: 12px;">${portInfo.countryName}</div>
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
        const scaledRadius = Math.max(0.5, baseRadius / currentScale);
        d3.select(this).select('circle')
          .transition().duration(200)
          .attr('r', scaledRadius);
        if (tooltipRef.current) {
          tooltipRef.current.style('visibility', 'hidden');
        }
      });
    });

    // 绘制路径和粒子（preview 模式限制粒子数量）
    if (shipments.length > 0) {
      // shipments 已经是按公司对聚合的，每个公司对一条线
      // 直接使用 shipments 作为 routeGroups
      const routeGroups = shipments.map(shipment => {
        // 获取国家名称
        const originCountry = countries.find(c => c.countryCode === shipment.originId)?.countryName || shipment.originId;
        const destinationCountry = countries.find(c => c.countryCode === shipment.destinationId)?.countryName || shipment.destinationId;
        
        return {
          exporterCompanyId: shipment.exporterCompanyId,
          importerCompanyId: shipment.importerCompanyId,
          originId: shipment.originId,
          destinationId: shipment.destinationId,
          originCountry,
          destinationCountry,
          shipments: [shipment],
          count: 1, // 每个公司对算一条线
          totalValue: shipment.value,
          mainCategory: shipment.category,
          mainColor: (shipment as any).categoryColor || '#8E8E93'
        };
      });

      // 按交易价值计算路径粗细
      const valueExtent = d3.extent(routeGroups, d => d.totalValue) as [number, number];
      const strokeScale = d3.scaleSqrt()
        .domain(valueExtent[0] !== undefined ? valueExtent : [1, 100])
        .range([1.2, 6]); // 根据交易价值，范围 1.2-6

      // preview 模式：只显示前 100 条路径，不画粒子
      // final 模式：显示所有路径，画粒子（但限制粒子数量）
      const routeGroupsArray = routeGroups
        .sort((a, b) => b.totalValue - a.totalValue); // 按交易价值降序
      const maxPaths = isPreview ? 100 : routeGroupsArray.length;
      const maxParticles = isPreview ? 0 : Math.min(50, routeGroupsArray.length); // 最多 50 个粒子

      // 获取翻译文本（在循环外部）
      const materialNameLabel = t('map.materialName');
      const directionLabel = t('map.direction');
      const transactionCountLabel = t('map.transactionCount');
      const totalValueLabel = t('map.totalValue');
      
      routeGroupsArray.slice(0, maxPaths).forEach((routeGroup, routeIndex) => {
        // 使用第一个 shipment 来确定位置
        const firstShipment = routeGroup.shipments[0];
        const originCompany = routeGroup.exporterCompanyId 
          ? companies.find(c => c.id === routeGroup.exporterCompanyId)
          : null;
        const destCompany = routeGroup.importerCompanyId
          ? companies.find(c => c.id === routeGroup.importerCompanyId)
          : null;

        // 强制使用港口位置（如果没有港口信息则跳过该交易）
        let sourcePos: [number, number] | null = null;
        let targetPos: [number, number] | null = null;
        let origin: { lng: number; lat: number; name: string; country: string } | null = null;
        let dest: { lng: number; lat: number; name: string; country: string } | null = null;
        
        // 获取出发港口位置（必须）
        if (firstShipment.portOfDeparture && firstShipment.originId) {
          const portKey = `${firstShipment.portOfDeparture}_${firstShipment.originId}`;
          if (portNodePositions.has(portKey)) {
            sourcePos = portNodePositions.get(portKey)!;
            const portInfo = portPositionsMap.get(portKey);
            origin = {
              lng: 0, lat: 0, // 位置已通过 sourcePos 确定
              name: firstShipment.portOfDeparture,
              country: portInfo?.countryName || firstShipment.countryOfOrigin || ''
            };
          }
        }
        
        // 获取到达港口位置（必须）
        if (firstShipment.portOfArrival && firstShipment.destinationId) {
          const portKey = `${firstShipment.portOfArrival}_${firstShipment.destinationId}`;
          if (portNodePositions.has(portKey)) {
            targetPos = portNodePositions.get(portKey)!;
            const portInfo = portPositionsMap.get(portKey);
            dest = {
              lng: 0, lat: 0, // 位置已通过 targetPos 确定
              name: firstShipment.portOfArrival,
              country: portInfo?.countryName || firstShipment.destinationCountry || ''
            };
          }
        }

        // 如果缺少港口位置，跳过该交易
        if (!sourcePos || !targetPos || !origin || !dest) return;
          
          const midX = (sourcePos[0] + targetPos[0]) / 2;
          const midY = (sourcePos[1] + targetPos[1]) / 2 - 50; 
          const lineData = `M${sourcePos[0]},${sourcePos[1]} Q${midX},${midY} ${targetPos[0]},${targetPos[1]}`;
          
        const color = routeGroup.mainColor;
        const thickness = strokeScale(routeGroup.totalValue); // 根据交易价值计算粗细

        const arc = gFlows.append('path')
            .attr('d', lineData)
            .attr('fill', 'none')
            .attr('stroke', color)
            .attr('stroke-width', thickness)
          .attr('data-base-stroke-width', thickness)
            .attr('stroke-linecap', 'round')
            .attr('opacity', 0.3) // 降低默认透明度从 0.5 到 0.3
          .attr('class', 'shipment-path');

          arc.on('mouseover', function(event) {
          const svgNode = svgRef.current;
          const currentScale = svgNode ? d3.zoomTransform(svgNode)?.k || 1 : 1;
            const baseStrokeWidth = parseFloat(d3.select(this).attr('data-base-stroke-width') || thickness.toString());
            const scaledThickness = Math.max(0.2, baseStrokeWidth / currentScale);
            d3.select(this).attr('opacity', 1.0).attr('stroke-width', scaledThickness + 1.5 / currentScale); // 增加hover透明度从 0.9 到 1.0
          
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
                  <span class="text-[#86868B] text-[11px] mt-0.5">${routeGroup.originCountry} &rarr; ${routeGroup.destinationCountry}</span>
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
            d3.select(this).attr('opacity', 0.3).attr('stroke-width', scaledThickness); // 恢复默认透明度为 0.3
          if (tooltipRef.current) {
            tooltipRef.current.style('visibility', 'hidden');
          }
        });

        // 只在 final 模式且未超过粒子限制时画粒子
        // 粒子数量根据交易价值，但限制总数
        if (!isPreview && routeIndex < maxParticles) {
          // 每个路径组的粒子数量 = min(价值/10M, 5)
          const particleCountForRoute = Math.min(Math.max(1, Math.floor(routeGroup.totalValue / 10)), 5);
          
          for (let p = 0; p < particleCountForRoute; p++) {
          const particleBaseRadius = Math.max(1.8, thickness / 1.8);
          const particleBaseStrokeWidth = 0.5;
            const particle = gFlows.append('circle')
            .attr('r', particleBaseRadius)
              .attr('data-base-radius', particleBaseRadius)
              .attr('data-base-stroke-width', particleBaseStrokeWidth)
            .attr('fill', '#FFFFFF')
            .attr('stroke', color)
            .attr('stroke-width', particleBaseStrokeWidth)
              .attr('class', 'shipment-particle')
            .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))');

          const animate = () => {
              const anim = particle.transition()
                .duration(2500 + Math.random() * 2000 + p * 200) // 错开粒子动画时间
              .ease(d3.easeLinear)
              .attrTween('transform', () => {
                const node = arc.node() as SVGPathElement;
                const l = node.getTotalLength();
                return (t) => {
                  const p = node.getPointAtLength(t * l);
                  return `translate(${p.x},${p.y})`;
                };
              })
                .on('end', () => {
                  particleAnimationsRef.current.delete(anim);
                  if (!isPreview) {
                    animate();
                  }
                });
              
              particleAnimationsRef.current.add(anim);
          };
          animate();
        }
        }
      });
      }
  }, [shipments, selectedCountries, activeCompanies, companies, countries, categoryColors, categories, isPreview]);

  return (
    <div className="w-full h-full relative overflow-hidden rounded-[24px] border border-black/5 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
      {/* 固定筛选信息 - 左上角 */}
      <div className="absolute top-6 left-6 z-20">
        <div className="bg-white/95 backdrop-blur-xl p-4 rounded-[18px] border border-black/[0.05] shadow-lg min-w-[200px] max-w-[280px] pointer-events-auto">
          <div className="mb-3 pb-2.5 border-b border-black/10">
            <span className="text-[10px] text-[#86868B] font-bold uppercase tracking-widest">{t('map.activeFilters') || 'Active Filters'}</span>
          </div>
          <div className="flex flex-col gap-2.5 text-[11px]">
            {/* 时间范围 */}
            {filters && (
              <>
                <div className="flex items-start gap-2">
                  <span className="text-[#86868B] font-semibold min-w-[60px]">时间:</span>
                  <span className="text-[#1D1D1F]">{filters.startDate} ~ {filters.endDate}</span>
                </div>
                
                {/* 国家 */}
                {filters.selectedCountries.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="text-[#86868B] font-semibold min-w-[60px]">国家:</span>
                    <span className="text-[#1D1D1F]">
                      {filters.selectedCountries.length <= 2 
                        ? filters.selectedCountries.join(', ')
                        : `${filters.selectedCountries.slice(0, 2).join(', ')} +${filters.selectedCountries.length - 2}`}
                    </span>
                  </div>
                )}
                
                {/* 公司 */}
                {filters.selectedCompanies.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="text-[#86868B] font-semibold min-w-[60px]">公司:</span>
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
                    <span className="text-[#86868B] font-semibold min-w-[60px]">大类:</span>
                    <span className="text-[#1D1D1F]">
                      {filters.selectedHSCodeCategories.map(code => `HS${code}`).join(', ')}
                    </span>
                  </div>
                )}
                
                {/* 小类 */}
                {filters.selectedHSCodeSubcategories.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="text-[#86868B] font-semibold min-w-[60px]">小类:</span>
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
                  <div className="text-[#86868B] text-[10px] italic">无筛选条件</div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
    </div>
  );
}, (prevProps, nextProps) => {
  // 自定义比较函数
  const filtersEqual = prevProps.filters === nextProps.filters || (
    prevProps.filters && nextProps.filters &&
    prevProps.filters.startDate === nextProps.filters.startDate &&
    prevProps.filters.endDate === nextProps.filters.endDate &&
    prevProps.filters.selectedCountries.length === nextProps.filters.selectedCountries.length &&
    prevProps.filters.selectedCountries.every((c, i) => c === nextProps.filters.selectedCountries[i]) &&
    prevProps.filters.selectedCompanies.length === nextProps.filters.selectedCompanies.length &&
    prevProps.filters.selectedCompanies.every((c, i) => c === nextProps.filters.selectedCompanies[i]) &&
    prevProps.filters.selectedHSCodeCategories.length === nextProps.filters.selectedHSCodeCategories.length &&
    prevProps.filters.selectedHSCodeCategories.every((c, i) => c === nextProps.filters.selectedHSCodeCategories[i]) &&
    prevProps.filters.selectedHSCodeSubcategories.length === nextProps.filters.selectedHSCodeSubcategories.length &&
    prevProps.filters.selectedHSCodeSubcategories.every((c, i) => c === nextProps.filters.selectedHSCodeSubcategories[i])
  );
  
  return (
    prevProps.shipments.length === nextProps.shipments.length &&
    prevProps.shipments.every((s, i) => s.id === nextProps.shipments[i]?.id) &&
    prevProps.transactions.length === nextProps.transactions.length &&
    prevProps.transactions.every((t, i) => t.id === nextProps.transactions[i]?.id) &&
    prevProps.selectedCountries.length === nextProps.selectedCountries.length &&
    prevProps.selectedCountries.every((c, i) => c === nextProps.selectedCountries[i]) &&
    prevProps.countries.length === nextProps.countries.length &&
    prevProps.companies.length === nextProps.companies.length &&
    prevProps.companies.every((c, i) => c.id === nextProps.companies[i]?.id) &&
    prevProps.categories.length === nextProps.categories.length &&
    prevProps.isPreview === nextProps.isPreview &&
    filtersEqual
  );
});

SupplyMap.displayName = 'SupplyMap';

export default SupplyMap;
