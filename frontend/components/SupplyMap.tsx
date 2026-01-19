
import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { Shipment, CountryLocation, Category, Transaction, CompanyWithLocation } from '../types';
import { translateMaterials } from '../utils/materialTranslations';
import { useLanguage } from '../contexts/LanguageContext';

interface SupplyMapProps {
  shipments: Shipment[];
  transactions: Transaction[];
  selectedCountries: string[];
  countries: CountryLocation[];
  companies: CompanyWithLocation[];
  categories: Category[];
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

    // 创建公司节点位置映射
      const companyNodePositions = new Map<string, [number, number]>();
      
      // 只在有交易数据时才显示公司节点
      if (shipments.length > 0 && activeCompanies.length > 0) {
        const companiesByLocation = new Map<string, CompanyWithLocation[]>();
        activeCompanies.forEach(company => {
          const key = `${company.countryCode}_${company.city}_${company.latitude}_${company.longitude}`;
          if (!companiesByLocation.has(key)) {
            companiesByLocation.set(key, []);
          }
          companiesByLocation.get(key)!.push(company);
        });

      companiesByLocation.forEach((cityCompanies) => {
          const baseCompany = cityCompanies[0];
          const basePos = projection([baseCompany.longitude, baseCompany.latitude])!;
          
          cityCompanies.forEach((company, index) => {
            const offset = cityCompanies.length > 1 ? {
            x: (index - (cityCompanies.length - 1) / 2) * 1.5,
              y: (index - (cityCompanies.length - 1) / 2) * 1.5
            } : { x: 0, y: 0 };
            
            const nodePos: [number, number] = [basePos[0] + offset.x, basePos[1] + offset.y];
            companyNodePositions.set(company.id, nodePos);
            
          const companyNode = gNodes.append('g')
              .attr('class', 'company-node')
            .datum(company)
              .attr('transform', `translate(${nodePos[0]}, ${nodePos[1]})`);

            const baseRadius = 2.2;
            const baseStrokeWidth = 1.2;
          const nodeFillColor = '#007AFF';
            const isSelected = selectedCountries.includes(company.countryCode);
            
          companyNode.append('circle')
              .attr('cx', 0)
              .attr('cy', 0)
              .attr('r', baseRadius)
            .attr('data-base-radius', baseRadius)
            .attr('data-base-stroke-width', baseStrokeWidth)
            .attr('data-fill-color', nodeFillColor)
            .attr('fill', nodeFillColor)
              .attr('stroke', '#007AFF')
              .attr('stroke-width', baseStrokeWidth)
            .style('fill', nodeFillColor)
            .style('filter', isSelected ? 'drop-shadow(0 0 6px rgba(0, 122, 255, 0.4))' : 'none');

          companyNode.on('mouseover', function(event, d) {
              const storedBaseRadius = parseFloat(d3.select(this).select('circle').attr('data-base-radius') || '2.2');
            const svgNode = svgRef.current;
            const currentScale = svgNode ? d3.zoomTransform(svgNode)?.k || 1 : 1;
              const currentRadius = Math.max(0.5, storedBaseRadius / currentScale);
              d3.select(this).select('circle').transition().duration(200).attr('r', currentRadius * 1.5);
              
            const companyType = (d as CompanyWithLocation).type || '未知';
            const companyData = d as CompanyWithLocation;
            // 翻译公司类型
            const companyTypeText = companyType === 'importer' ? t('map.companyType.importer') : 
                                   companyType === 'exporter' ? t('map.companyType.exporter') : 
                                   companyType === 'both' ? t('map.companyType.both') : companyType;
            const locationLabel = t('map.location');
            const unknownCompany = t('map.unknownCompany');
            const unknown = t('map.unknown');
            const companiesAtLocation = t('map.companiesAtLocation');
            const companiesAtLocationSuffix = t('map.companiesAtLocationSuffix');
              let tooltipHTML = `
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
                  <span style="font-weight: bold; font-size: 14px; color: #1D1D1F;">${companyData.name || unknownCompany}</span>
                    <span style="font-size: 10px; font-weight: bold; color: #86868B; text-transform: uppercase; letter-spacing: 0.05em;">${companyTypeText}</span>
                  </div>
                  <div style="height: 0.5px; background: rgba(0,0,0,0.05);"></div>
                  <div style="display: flex; flex-direction: column; gap: 2px;">
                    <span style="color: #86868B; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">${locationLabel}</span>
                  <span style="color: #1D1D1F; font-size: 12px; font-weight: 600;">${companyData.city || unknown}, ${companyData.countryName || companyData.countryCode || unknown}</span>
                  </div>
                  ${cityCompanies.length > 1 ? `
                    <div style="color: #86868B; font-size: 10px; font-style: italic;">
                      ${companiesAtLocation} ${cityCompanies.length} ${companiesAtLocationSuffix}
                    </div>
                  ` : ''}
                </div>
              `;
              
            if (tooltipRef.current) {
              tooltipRef.current.html(tooltipHTML)
                .style('visibility', 'visible')
                .style('top', (event.pageY - 10) + 'px')
                .style('left', (event.pageX + 20) + 'px');
            }
            })
            .on('mouseout', function() {
              const storedBaseRadius = parseFloat(d3.select(this).select('circle').attr('data-base-radius') || '2.2');
            const svgNode = svgRef.current;
            const currentScale = svgNode ? d3.zoomTransform(svgNode)?.k || 1 : 1;
              const scaledRadius = Math.max(0.5, storedBaseRadius / currentScale);
              d3.select(this).select('circle').transition().duration(200).attr('r', scaledRadius);
            if (tooltipRef.current) {
              tooltipRef.current.style('visibility', 'hidden');
            }
            });
          });
        });
      }

    // 绘制路径和粒子（preview 模式限制粒子数量）
      if (shipments.length > 0) {
      // 按公司对聚合交易（相同出口商和进口商的交易合并）
      const routeGroups = new Map<string, {
        exporterCompanyId?: string;
        importerCompanyId?: string;
        originId: string;
        destinationId: string;
        shipments: typeof shipments;
        count: number;
        totalValue: number;
        mainCategory: string;
        mainColor: string;
      }>();

      shipments.forEach(shipment => {
        const routeKey = `${shipment.exporterCompanyId || shipment.originId}-${shipment.importerCompanyId || shipment.destinationId}`;
        
        if (!routeGroups.has(routeKey)) {
          // 优先使用交易数据中的品类颜色，然后尝试从品类列表匹配，最后使用默认颜色
          const category = categories.find(c => c.displayName === shipment.category || c.name === shipment.category || c.id === shipment.category);
          const color = (shipment as any).categoryColor || category?.color || categoryColors[shipment.category] || '#8E8E93';
          
          routeGroups.set(routeKey, {
            exporterCompanyId: shipment.exporterCompanyId,
            importerCompanyId: shipment.importerCompanyId,
            originId: shipment.originId,
            destinationId: shipment.destinationId,
            shipments: [shipment],
            count: 1,
            totalValue: shipment.value,
            mainCategory: shipment.category,
            mainColor: color
          });
        } else {
          const group = routeGroups.get(routeKey)!;
          group.shipments.push(shipment);
          group.count += 1;
          group.totalValue += shipment.value;
          // 更新主要品类（选择出现最多的品类）
          const categoryCounts = new Map<string, number>();
          group.shipments.forEach(s => {
            categoryCounts.set(s.category, (categoryCounts.get(s.category) || 0) + 1);
          });
          const mostFrequentCategory = Array.from(categoryCounts.entries())
            .sort((a, b) => b[1] - a[1])[0][0];
          group.mainCategory = mostFrequentCategory;
          // 找到该品类对应的 shipment，使用其 categoryColor
          const categoryShipment = group.shipments.find(s => s.category === mostFrequentCategory);
          const category = categories.find(c => c.displayName === mostFrequentCategory || c.name === mostFrequentCategory || c.id === mostFrequentCategory);
          group.mainColor = (categoryShipment as any)?.categoryColor || category?.color || categoryColors[mostFrequentCategory] || '#8E8E93';
        }
      });

      // 按交易数量计算路径粗细
      const countExtent = d3.extent(Array.from(routeGroups.values()), d => d.count) as [number, number];
        const strokeScale = d3.scaleSqrt()
        .domain(countExtent[0] !== undefined ? countExtent : [1, 10])
        .range([1.2, 6]); // 根据交易数量，范围 1.2-6

      // preview 模式：只显示前 100 条路径，不画粒子
      // final 模式：显示所有路径，画粒子（但限制粒子数量）
      const routeGroupsArray = Array.from(routeGroups.values())
        .sort((a, b) => b.count - a.count); // 按交易数量降序
      const maxPaths = isPreview ? 100 : routeGroupsArray.length;
      const maxParticles = isPreview ? 0 : Math.min(50, shipments.length); // 最多 50 个粒子

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

        const origin = originCompany 
          ? { lng: originCompany.longitude, lat: originCompany.latitude, name: originCompany.name, country: originCompany.countryName }
          : countries.find(c => c.countryCode === routeGroup.originId) 
            ? { lng: countries.find(c => c.countryCode === routeGroup.originId)!.capitalLng, lat: countries.find(c => c.countryCode === routeGroup.originId)!.capitalLat, name: countries.find(c => c.countryCode === routeGroup.originId)!.countryName, country: countries.find(c => c.countryCode === routeGroup.originId)!.countryName }
            : null;
        const dest = destCompany
          ? { lng: destCompany.longitude, lat: destCompany.latitude, name: destCompany.name, country: destCompany.countryName }
          : countries.find(c => c.countryCode === routeGroup.destinationId)
            ? { lng: countries.find(c => c.countryCode === routeGroup.destinationId)!.capitalLng, lat: countries.find(c => c.countryCode === routeGroup.destinationId)!.capitalLat, name: countries.find(c => c.countryCode === routeGroup.destinationId)!.countryName, country: countries.find(c => c.countryCode === routeGroup.destinationId)!.countryName }
            : null;

        if (!origin || !dest) return;

          let sourcePos = projection([origin.lng, origin.lat])!;
          let targetPos = projection([dest.lng, dest.lat])!;
          
          if (originCompany && companyNodePositions.has(originCompany.id)) {
            sourcePos = companyNodePositions.get(originCompany.id)!;
          }
          
          if (destCompany && companyNodePositions.has(destCompany.id)) {
            targetPos = companyNodePositions.get(destCompany.id)!;
          }
          
          const midX = (sourcePos[0] + targetPos[0]) / 2;
          const midY = (sourcePos[1] + targetPos[1]) / 2 - 50; 
          const lineData = `M${sourcePos[0]},${sourcePos[1]} Q${midX},${midY} ${targetPos[0]},${targetPos[1]}`;
          
        const color = routeGroup.mainColor;
        const thickness = strokeScale(routeGroup.count); // 根据交易数量计算粗细

        const arc = gFlows.append('path')
            .attr('d', lineData)
            .attr('fill', 'none')
            .attr('stroke', color)
            .attr('stroke-width', thickness)
          .attr('data-base-stroke-width', thickness)
            .attr('stroke-linecap', 'round')
            .attr('opacity', 0.5)
          .attr('class', 'shipment-path');

          arc.on('mouseover', function(event) {
          const svgNode = svgRef.current;
          const currentScale = svgNode ? d3.zoomTransform(svgNode)?.k || 1 : 1;
            const baseStrokeWidth = parseFloat(d3.select(this).attr('data-base-stroke-width') || thickness.toString());
            const scaledThickness = Math.max(0.2, baseStrokeWidth / currentScale);
            d3.select(this).attr('opacity', 0.9).attr('stroke-width', scaledThickness + 1.5 / currentScale);
          
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
                  <span class="text-[#86868B] text-[10px] font-bold uppercase">${transactionCountLabel}</span>
                  <span class="text-[#1D1D1F] font-bold">${routeGroup.count}</span>
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
            d3.select(this).attr('opacity', 0.5).attr('stroke-width', scaledThickness);
          if (tooltipRef.current) {
            tooltipRef.current.style('visibility', 'hidden');
          }
        });

        // 只在 final 模式且未超过粒子限制时画粒子
        // 粒子数量根据交易数量，但限制总数
        if (!isPreview && routeIndex < maxParticles) {
          // 每个路径组的粒子数量 = min(交易数量, 5)
          const particleCountForRoute = Math.min(routeGroup.count, 5);
          
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
      {/* 固定图例 - 左上角 */}
      <div className="absolute top-6 left-6 z-20">
        <div className="bg-white/95 backdrop-blur-xl p-4 rounded-[18px] border border-black/[0.05] shadow-lg min-w-[160px] pointer-events-auto">
          <div className="mb-3 pb-2.5 border-b border-black/10">
            <span className="text-[10px] text-[#86868B] font-bold uppercase tracking-widest">{t('map.materialCategories')}</span>
          </div>
          <div className="flex flex-col gap-3">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-3">
                <div 
                  className="w-3.5 h-3.5 rounded-full flex-shrink-0 border border-black/10" 
                  style={{ backgroundColor: cat.color }}
                ></div>
                <span 
                  className="text-[11px] text-[#1D1D1F] font-semibold tracking-tight leading-tight"
                  style={{ 
                    color: '#1D1D1F',
                    display: 'block',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {cat.displayName || cat.name || cat.id}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
    </div>
  );
}, (prevProps, nextProps) => {
  // 自定义比较函数
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
    prevProps.isPreview === nextProps.isPreview
  );
});

SupplyMap.displayName = 'SupplyMap';

export default SupplyMap;
