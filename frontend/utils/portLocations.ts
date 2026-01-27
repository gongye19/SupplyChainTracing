// 港口位置映射
// 如果港口不在这个映射中，将使用国家位置作为回退

interface PortLocation {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
}

// 常见港口位置映射（可以根据实际数据扩展）
const portLocations: Record<string, PortLocation> = {
  // 中国港口
  'Shanghai': { name: 'Shanghai', country: 'China', latitude: 31.2304, longitude: 121.4737 },
  'Hong Kong': { name: 'Hong Kong', country: 'China', latitude: 22.3193, longitude: 114.1694 },
  'Shenzhen': { name: 'Shenzhen', country: 'China', latitude: 22.5431, longitude: 114.0579 },
  'Ningbo': { name: 'Ningbo', country: 'China', latitude: 29.8683, longitude: 121.5440 },
  'Qingdao': { name: 'Qingdao', country: 'China', latitude: 36.0671, longitude: 120.3826 },
  'Tianjin': { name: 'Tianjin', country: 'China', latitude: 39.3434, longitude: 117.3616 },
  'Guangzhou': { name: 'Guangzhou', country: 'China', latitude: 23.1291, longitude: 113.2644 },
  
  // 美国港口
  'Los Angeles': { name: 'Los Angeles', country: 'United States', latitude: 33.7490, longitude: -118.2648 },
  'New York': { name: 'New York', country: 'United States', latitude: 40.7128, longitude: -74.0060 },
  'Long Beach': { name: 'Long Beach', country: 'United States', latitude: 33.7701, longitude: -118.1937 },
  'Savannah': { name: 'Savannah', country: 'United States', latitude: 32.0809, longitude: -81.0912 },
  'Seattle': { name: 'Seattle', country: 'United States', latitude: 47.6062, longitude: -122.3321 },
  'Houston': { name: 'Houston', country: 'United States', latitude: 29.7604, longitude: -95.3698 },
  
  // 欧洲港口
  'Rotterdam': { name: 'Rotterdam', country: 'Netherlands', latitude: 51.9225, longitude: 4.4792 },
  'Hamburg': { name: 'Hamburg', country: 'Germany', latitude: 53.5511, longitude: 9.9937 },
  'Antwerp': { name: 'Antwerp', country: 'Belgium', latitude: 51.2194, longitude: 4.4025 },
  'Le Havre': { name: 'Le Havre', country: 'France', latitude: 49.4944, longitude: 0.1079 },
  'London': { name: 'London', country: 'United Kingdom', latitude: 51.5074, longitude: -0.1278 },
  'Genoa': { name: 'Genoa', country: 'Italy', latitude: 44.4056, longitude: 8.9463 },
  'Barcelona': { name: 'Barcelona', country: 'Spain', latitude: 41.3851, longitude: 2.1734 },
  
  // 亚洲港口
  'Singapore': { name: 'Singapore', country: 'Singapore', latitude: 1.2897, longitude: 103.8501 },
  'Busan': { name: 'Busan', country: 'South Korea', latitude: 35.1796, longitude: 129.0756 },
  'Tokyo': { name: 'Tokyo', country: 'Japan', latitude: 35.6762, longitude: 139.6503 },
  'Yokohama': { name: 'Yokohama', country: 'Japan', latitude: 35.4437, longitude: 139.6380 },
  'Osaka': { name: 'Osaka', country: 'Japan', latitude: 34.6937, longitude: 135.5023 },
  'Manila': { name: 'Manila', country: 'Philippines', latitude: 14.5995, longitude: 120.9842 },
  'Bangkok': { name: 'Bangkok', country: 'Thailand', latitude: 13.7563, longitude: 100.5018 },
  'Ho Chi Minh': { name: 'Ho Chi Minh', country: 'Vietnam', latitude: 10.8231, longitude: 106.6297 },
  'Chittagong': { name: 'Chittagong', country: 'Bangladesh', latitude: 22.3569, longitude: 91.7832 },
  'Jakarta': { name: 'Jakarta', country: 'Indonesia', latitude: -6.2088, longitude: 106.8456 },
  'Jebel Ali': { name: 'Jebel Ali', country: 'United Arab Emirates', latitude: 25.0275, longitude: 55.0750 },
  'Dubai': { name: 'Dubai', country: 'United Arab Emirates', latitude: 25.2048, longitude: 55.2708 },
  
  // 其他港口
  'Veracruz': { name: 'Veracruz', country: 'Mexico', latitude: 19.1738, longitude: -96.1342 },
  'Santos': { name: 'Santos', country: 'Brazil', latitude: -23.9608, longitude: -46.3336 },
  'Sydney': { name: 'Sydney', country: 'Australia', latitude: -33.8688, longitude: 151.2093 },
  'Melbourne': { name: 'Melbourne', country: 'Australia', latitude: -37.8136, longitude: 144.9631 },
};

/**
 * 获取港口位置
 * @param portName 港口名称
 * @param countryName 国家名称（用于回退）
 * @param countryLocation 国家位置信息（用于回退）
 * @returns 港口位置或国家位置
 */
export function getPortLocation(
  portName: string | undefined,
  countryName: string,
  countryLocation?: { latitude: number; longitude: number }
): { latitude: number; longitude: number; isPort: boolean } {
  if (!portName) {
    // 如果没有港口名称，使用国家位置
    if (countryLocation) {
      return {
        latitude: countryLocation.latitude,
        longitude: countryLocation.longitude,
        isPort: false
      };
    }
    // 如果连国家位置都没有，返回默认位置
    return { latitude: 0, longitude: 0, isPort: false };
  }

  // 尝试精确匹配
  const normalizedPortName = portName.trim();
  if (portLocations[normalizedPortName]) {
    const port = portLocations[normalizedPortName];
    return {
      latitude: port.latitude,
      longitude: port.longitude,
      isPort: true
    };
  }

  // 尝试不区分大小写匹配
  const portKey = Object.keys(portLocations).find(
    key => key.toLowerCase() === normalizedPortName.toLowerCase()
  );
  if (portKey) {
    const port = portLocations[portKey];
    return {
      latitude: port.latitude,
      longitude: port.longitude,
      isPort: true
    };
  }

  // 如果找不到港口位置，使用国家位置作为回退
  if (countryLocation) {
    return {
      latitude: countryLocation.latitude,
      longitude: countryLocation.longitude,
      isPort: false
    };
  }

  // 最后回退到默认位置
  return { latitude: 0, longitude: 0, isPort: false };
}

/**
 * 获取所有已知港口列表
 */
export function getAllPorts(): PortLocation[] {
  return Object.values(portLocations);
}

