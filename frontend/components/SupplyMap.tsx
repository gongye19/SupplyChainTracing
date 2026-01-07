
import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { Shipment, CountryLocation, Category, Transaction, CompanyWithLocation } from '../types';

interface SupplyMapProps {
  shipments: Shipment[];
  transactions: Transaction[];
  selectedCountries: string[];
  countries: CountryLocation[];
  companies: CompanyWithLocation[];
  categories: Category[];
}

const SupplyMap: React.FC<SupplyMapProps> = React.memo(({ shipments, transactions, selectedCountries, countries, companies, categories }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  // 构建品类颜色映射
  const categoryColors = useMemo(() => {
    const colorMap: Record<string, string> = {};
    categories.forEach(cat => {
      colorMap[cat.displayName] = cat.color;
      colorMap[cat.name] = cat.color;
      colorMap[cat.id] = cat.color;
    });
    console.log('SupplyMap: Category colors map:', colorMap, 'Categories:', categories);
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

  useEffect(() => {
    if (!svgRef.current) {
      console.log('SupplyMap: svgRef.current is null');
      return;
    }

    if (countries.length === 0) {
      console.log('SupplyMap: No countries to display');
      return;
    }

    console.log('SupplyMap: Rendering map with', shipments.length, 'shipments and', countries.length, 'countries');

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    if (width === 0 || height === 0) {
      console.log('SupplyMap: SVG has zero dimensions', width, height);
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // 投影设置：居中显示，使中国和美国在地图两侧，非洲在中间
    // 经度中心：0度（本初子午线），使非洲居中，中国和美国分别在两侧
    // 纬度中心：约25度，使非洲大陆居中显示
    // scale值增大以缩小地图，使其能包含完整的亚洲和北美洲
    const projection = d3.geoMercator()
      .scale(width / 5.5)
      .center([0, 25])  // 经度0度，纬度25度，使非洲居中，中国和美国在两侧
      .translate([width / 2, height / 2]);

    const pathGenerator = d3.geoPath().projection(projection);

    const g = svg.append('g');

    // Apple Style Tooltip
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

    d3.json('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson').then((data: any) => {
      console.log('SupplyMap: World map data loaded');
      const filteredFeatures = data.features.filter((f: any) => 
        f.properties.name !== "Antarctica"
      );

      g.selectAll('path.country')
        .data(filteredFeatures)
        .enter()
        .append('path')
        .attr('class', 'country')
        .attr('d', pathGenerator)
        .attr('fill', '#EBEBEB')
        .attr('stroke', '#FFFFFF')
        .attr('stroke-width', 1);

      // 创建公司节点位置映射（先创建节点，存储位置，然后绘制路径）
      const companyNodePositions = new Map<string, [number, number]>();
      
      // 只在有交易数据时才显示公司节点
      if (shipments.length > 0 && activeCompanies.length > 0) {
        // 按城市分组公司，同一城市的公司稍微偏移位置
        const companiesByLocation = new Map<string, CompanyWithLocation[]>();
        activeCompanies.forEach(company => {
          const key = `${company.countryCode}_${company.city}_${company.latitude}_${company.longitude}`;
          if (!companiesByLocation.has(key)) {
            companiesByLocation.set(key, []);
          }
          companiesByLocation.get(key)!.push(company);
        });

        // 为每个位置创建节点组
        companiesByLocation.forEach((cityCompanies, locationKey) => {
          const baseCompany = cityCompanies[0];
          const basePos = projection([baseCompany.longitude, baseCompany.latitude])!;
          
          // 如果同一位置有多个公司，稍微偏移（缩小距离）
          cityCompanies.forEach((company, index) => {
            const offset = cityCompanies.length > 1 ? {
              x: (index - (cityCompanies.length - 1) / 2) * 1.5, // 从3px缩小到1.5px
              y: (index - (cityCompanies.length - 1) / 2) * 1.5
            } : { x: 0, y: 0 };
            
            const nodePos: [number, number] = [basePos[0] + offset.x, basePos[1] + offset.y];
            // 存储节点位置，第一个公司（index === 0）使用基础位置，其他公司使用偏移位置
            companyNodePositions.set(company.id, nodePos);
            
            const companyNode = g.append('g')
              .attr('class', 'company-node')
              .datum(company) // 存储公司数据，方便后续查找
              .attr('transform', `translate(${nodePos[0]}, ${nodePos[1]})`);

            const baseRadius = 2.2;
            const baseStrokeWidth = 1.2;
            const nodeFillColor = '#007AFF'; // 所有节点都使用蓝色填充
            const isSelected = selectedCountries.includes(company.countryCode);
            
            const circle = companyNode.append('circle')
              .attr('cx', 0)
              .attr('cy', 0)
              .attr('r', baseRadius)
              .attr('data-base-radius', baseRadius) // 存储基础半径
              .attr('data-base-stroke-width', baseStrokeWidth) // 存储基础边框宽度
              .attr('data-fill-color', nodeFillColor) // 存储填充颜色
              .attr('fill', nodeFillColor) // 设置填充颜色
              .attr('stroke', '#007AFF')
              .attr('stroke-width', baseStrokeWidth)
              .style('fill', nodeFillColor) // 使用 style 确保填充生效
              .style('filter', isSelected ? 'drop-shadow(0 0 6px rgba(0, 122, 255, 0.4))' : 'none'); // 只有选中时有阴影特效

            companyNode.on('mouseover', function(event) {
              const storedBaseRadius = parseFloat(d3.select(this).select('circle').attr('data-base-radius') || '2.2');
              const currentScale = d3.zoomTransform(svg.node() as Element)?.k || 1;
              const currentRadius = Math.max(0.5, storedBaseRadius / currentScale);
              d3.select(this).select('circle').transition().duration(200).attr('r', currentRadius * 1.5);
              
              // 构建 tooltip HTML
              const companyType = company.type || 'Unknown';
              let tooltipHTML = `
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
                    <span style="font-weight: bold; font-size: 14px; color: #1D1D1F;">${company.name || 'Unknown Company'}</span>
                    <span style="font-size: 10px; font-weight: bold; color: #86868B; text-transform: uppercase; letter-spacing: 0.05em;">${companyType}</span>
                  </div>
                  <div style="height: 0.5px; background: rgba(0,0,0,0.05);"></div>
                  <div style="display: flex; flex-direction: column; gap: 2px;">
                    <span style="color: #86868B; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">Location</span>
                    <span style="color: #1D1D1F; font-size: 12px; font-weight: 600;">${company.city || 'Unknown'}, ${company.countryName || company.countryCode || 'Unknown'}</span>
                  </div>
                  ${cityCompanies.length > 1 ? `
                    <div style="color: #86868B; font-size: 10px; font-style: italic;">
                      ${cityCompanies.length} companies at this location
                    </div>
                  ` : ''}
                </div>
              `;
              
              d3Tooltip.html(tooltipHTML)
                .style('visibility', 'visible')
                .style('top', (event.pageY - 10) + 'px')
                .style('left', (event.pageX + 20) + 'px');
            })
            .on('mouseout', function() {
              const storedBaseRadius = parseFloat(d3.select(this).select('circle').attr('data-base-radius') || '2.2');
              const currentScale = d3.zoomTransform(svg.node() as Element)?.k || 1;
              const scaledRadius = Math.max(0.5, storedBaseRadius / currentScale);
              d3.select(this).select('circle').transition().duration(200).attr('r', scaledRadius);
              d3Tooltip.style('visibility', 'hidden');
            });
          });
        });
      }

      // 只在有shipments时处理路径
      if (shipments.length > 0) {
        const sortedShipments = [...shipments].sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        const valueExtent = d3.extent(shipments, d => d.value) as [number, number];
        const strokeScale = d3.scaleSqrt()
          .domain(valueExtent[0] !== undefined ? valueExtent : [0, 1000])
          .range([1.2, 5]);

        console.log('SupplyMap: Processing', sortedShipments.length, 'shipments');
        
        sortedShipments.forEach((shipment, index) => {
        // 查找出口公司和进口公司
        const originCompany = shipment.exporterCompanyId 
          ? companies.find(c => c.id === shipment.exporterCompanyId)
          : null;
        const destCompany = shipment.importerCompanyId
          ? companies.find(c => c.id === shipment.importerCompanyId)
          : null;

        // 如果找不到公司，回退到国家位置
        const origin = originCompany 
          ? { lng: originCompany.longitude, lat: originCompany.latitude, name: originCompany.name, country: originCompany.countryName }
          : countries.find(c => c.countryCode === shipment.originId) 
            ? { lng: countries.find(c => c.countryCode === shipment.originId)!.capitalLng, lat: countries.find(c => c.countryCode === shipment.originId)!.capitalLat, name: countries.find(c => c.countryCode === shipment.originId)!.countryName, country: countries.find(c => c.countryCode === shipment.originId)!.countryName }
            : null;
        const dest = destCompany
          ? { lng: destCompany.longitude, lat: destCompany.latitude, name: destCompany.name, country: destCompany.countryName }
          : countries.find(c => c.countryCode === shipment.destinationId)
            ? { lng: countries.find(c => c.countryCode === shipment.destinationId)!.capitalLng, lat: countries.find(c => c.countryCode === shipment.destinationId)!.capitalLat, name: countries.find(c => c.countryCode === shipment.destinationId)!.countryName, country: countries.find(c => c.countryCode === shipment.destinationId)!.countryName }
            : null;

        if (!origin) {
          console.warn('SupplyMap: Origin not found for', shipment.originId, 'in shipment', shipment.id);
        }
        if (!dest) {
          console.warn('SupplyMap: Destination not found for', shipment.destinationId, 'in shipment', shipment.id);
        }

        if (origin && dest) {
          console.log(`SupplyMap: Drawing path ${index + 1}/${sortedShipments.length}: ${origin.name} -> ${dest.name}`);
          
          // 计算路径起点和终点位置
          // 如果是公司，优先使用节点位置（如果有），否则使用投影位置
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
          
          // 查找对应的品类颜色
          const category = categories.find(c => c.displayName === shipment.category);
          const color = category?.color || categoryColors[shipment.category] || '#8E8E93';
          console.log(`SupplyMap: Category "${shipment.category}" -> Color: ${color}`);
          const thickness = strokeScale(shipment.value);

          const arc = g.append('path')
            .attr('d', lineData)
            .attr('fill', 'none')
            .attr('stroke', color)
            .attr('stroke-width', thickness)
            .attr('data-base-stroke-width', thickness) // 存储基础线条宽度
            .attr('stroke-linecap', 'round')
            .attr('opacity', 0.5)
            .attr('class', 'shipment-path'); // 添加类名以便选择

          arc.on('mouseover', function(event) {
            const currentScale = d3.zoomTransform(svg.node() as Element)?.k || 1;
            const baseStrokeWidth = parseFloat(d3.select(this).attr('data-base-stroke-width') || thickness.toString());
            const scaledThickness = Math.max(0.2, baseStrokeWidth / currentScale);
            d3.select(this).attr('opacity', 0.9).attr('stroke-width', scaledThickness + 1.5 / currentScale);
            d3Tooltip.html(`
              <div class="space-y-2">
                <div class="flex items-center justify-between gap-4">
                  <span class="font-bold text-[14px]">${shipment.material}</span>
                  <div class="w-2.5 h-2.5 rounded-full" style="background-color: ${color}"></div>
                </div>
                <div class="text-[11px] font-semibold text-[#86868B] tracking-wide uppercase">
                  ${shipment.category}
                </div>
                <div class="h-[0.5px] bg-black/5"></div>
                <div class="flex flex-col gap-0.5">
                  <span class="text-[#86868B] text-[10px] font-bold uppercase">Logistics Path</span>
                  <span class="text-[#007AFF] font-semibold">${origin.name} &rarr; ${dest.name}</span>
                </div>
                <div class="flex justify-between items-center pt-1">
                   <span class="text-[#86868B] text-[10px] font-bold uppercase">Value Flow</span>
                   <span class="text-[#1D1D1F] font-bold">$${shipment.value}M</span>
                </div>
              </div>
            `)
            .style('visibility', 'visible')
            .style('top', (event.pageY - 10) + 'px')
            .style('left', (event.pageX + 20) + 'px');
          })
          .on('mousemove', (event) => {
            d3Tooltip.style('top', (event.pageY - 10) + 'px').style('left', (event.pageX + 20) + 'px');
          })
          .on('mouseout', function() {
            const currentScale = d3.zoomTransform(svg.node() as Element)?.k || 1;
            const baseStrokeWidth = parseFloat(d3.select(this).attr('data-base-stroke-width') || thickness.toString());
            const scaledThickness = Math.max(0.2, baseStrokeWidth / currentScale);
            d3.select(this).attr('opacity', 0.5).attr('stroke-width', scaledThickness);
            d3Tooltip.style('visibility', 'hidden');
          });

          const particleBaseRadius = Math.max(1.8, thickness / 1.8);
          const particleBaseStrokeWidth = 0.5;
          const particle = g.append('circle')
            .attr('r', particleBaseRadius)
            .attr('data-base-radius', particleBaseRadius) // 存储基础粒子半径
            .attr('data-base-stroke-width', particleBaseStrokeWidth) // 存储基础粒子边框宽度
            .attr('fill', '#FFFFFF')
            .attr('stroke', color)
            .attr('stroke-width', particleBaseStrokeWidth)
            .attr('class', 'shipment-particle') // 添加类名以便选择
            .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))');

          // 移除物料名称标签，信息已经在tooltip中显示

          const animate = () => {
            particle.transition()
              .duration(2500 + Math.random() * 2000)
              .ease(d3.easeLinear)
              .attrTween('transform', () => {
                const node = arc.node() as SVGPathElement;
                const l = node.getTotalLength();
                return (t) => {
                  const p = node.getPointAtLength(t * l);
                  return `translate(${p.x},${p.y})`;
                };
              })
              .on('end', animate);
          };
          animate();
        }
        });
      } else {
        console.log('SupplyMap: No shipments to display, showing map only');
      }

      console.log('SupplyMap: Map rendering complete');
      
      // 设置缩放（在then回调内部）
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([1, 15])
        .on('zoom', (event) => {
          g.attr('transform', event.transform);
          
          // 根据缩放级别调整节点大小（缩放越大，节点越小）
          const scale = event.transform.k;
          
          // 调整公司节点
          g.selectAll('.company-node circle').each(function() {
            const baseRadius = parseFloat(d3.select(this).attr('data-base-radius') || '2.2');
            const baseStrokeWidth = parseFloat(d3.select(this).attr('data-base-stroke-width') || '1.2');
            const fillColor = d3.select(this).attr('data-fill-color') || '#E3F2FD';
            const scaledRadius = Math.max(0.5, baseRadius / scale); // 最小半径为 0.5
            const scaledStrokeWidth = Math.max(0.3, baseStrokeWidth / scale); // 最小边框宽度为 0.3
            d3.select(this)
              .attr('r', scaledRadius)
              .attr('stroke-width', scaledStrokeWidth)
              .attr('fill', fillColor) // 确保缩放时保留填充颜色
              .style('fill', fillColor); // 使用 style 确保填充生效
          });
          
          // 调整流向线（路径）粗细
          g.selectAll('.shipment-path').each(function() {
            const baseStrokeWidth = parseFloat(d3.select(this).attr('data-base-stroke-width') || '1.2');
            const scaledStrokeWidth = Math.max(0.2, baseStrokeWidth / scale); // 最小线条宽度为 0.2
            d3.select(this).attr('stroke-width', scaledStrokeWidth);
          });
          
          // 调整粒子大小
          g.selectAll('.shipment-particle').each(function() {
            const baseRadius = parseFloat(d3.select(this).attr('data-base-radius') || '1.8');
            const baseStrokeWidth = parseFloat(d3.select(this).attr('data-base-stroke-width') || '0.5');
            const scaledRadius = Math.max(0.3, baseRadius / scale); // 最小粒子半径为 0.3
            const scaledStrokeWidth = Math.max(0.1, baseStrokeWidth / scale); // 最小粒子边框宽度为 0.1
            d3.select(this)
              .attr('r', scaledRadius)
              .attr('stroke-width', scaledStrokeWidth);
          });
        });

      // 设置初始视图：居中显示美国到东亚的路径区域
      // 由于投影已经设置了center，直接使用identity transform即可
      // 如果需要微调，可以稍微调整translate
      const initialTransform = d3.zoomIdentity
        .translate(0, 0)
        .scale(1);
      
      svg.call(zoom.transform, initialTransform);
      svg.call(zoom);
    }).catch((error) => {
      console.error('SupplyMap: Error loading world map:', error);
    });

    return () => {
      d3Tooltip.remove();
    };

  }, [shipments, selectedCountries, activeCompanies, companies, countries, categoryColors]);

  return (
    <div className="w-full h-full relative overflow-hidden rounded-[24px] border border-black/5 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
      {/* 固定图例 - 左上角 */}
      <div className="absolute top-6 left-6 z-20">
        <div className="bg-white/95 backdrop-blur-xl p-4 rounded-[18px] border border-black/[0.05] shadow-lg min-w-[160px] pointer-events-auto">
          <div className="mb-3 pb-2.5 border-b border-black/10">
            <span className="text-[10px] text-[#86868B] font-bold uppercase tracking-widest">Material Categories</span>
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
  // 自定义比较函数，只在关键数据变化时重新渲染
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
    prevProps.categories.length === nextProps.categories.length
  );
});

SupplyMap.displayName = 'SupplyMap';

export default SupplyMap;
