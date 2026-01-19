// 物料名称中英文映射
const materialTranslations: Record<string, string> = {
  // Raw Material
  'Silicon Wafer': '硅晶圆',
  'Photoresist': '光刻胶',
  'Chemical Precursors': '化学前驱体',
  'Metal Alloys': '金属合金',
  
  // Memory
  'DRAM Modules': 'DRAM 模块',
  'NAND Flash': 'NAND 闪存',
  'SSD Controllers': 'SSD 控制器',
  'Memory Chips': '内存芯片',
  'Storage Modules': '存储模块',
  
  // Logic
  'CPU Chips': 'CPU 芯片',
  'GPU Processors': 'GPU 处理器',
  'ASIC Chips': 'ASIC 芯片',
  'FPGA Devices': 'FPGA 器件',
  'SoC Components': 'SoC 组件',
  
  // Equipment
  'EUV Lithography System': 'EUV 光刻系统',
  'Etching Equipment': '蚀刻设备',
  'Deposition Tools': '沉积工具',
  'Wafer Inspection Tools': '晶圆检测工具',
  'Assembly Machines': '组装机器',
  'Testing Equipment': '测试设备',
};

/**
 * 将物料名称翻译为中文
 * @param materialName 英文物料名称
 * @returns 中文物料名称，如果没有翻译则返回原名称
 */
export function translateMaterial(materialName: string): string {
  return materialTranslations[materialName] || materialName;
}

/**
 * 批量翻译物料名称列表
 * @param materials 物料名称数组
 * @returns 翻译后的物料名称数组
 */
export function translateMaterials(materials: string[]): string[] {
  return materials.map(m => translateMaterial(m));
}

