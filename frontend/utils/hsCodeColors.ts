/**
 * HS Code 颜色生成工具
 * 为96个HS Code大类（01-97）生成唯一的颜色
 */

/**
 * 将HSL颜色转换为十六进制
 */
function hslToHex(h: number, s: number, l: number): string {
  h = h % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;

  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x;
  }

  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * 根据HS Code（2位，01-97）生成颜色
 * 使用HSL颜色空间，将97个HS Code均匀分布在色相环上
 * 
 * @param hsCode 2位HS Code（如 "01", "42", "85"）
 * @returns 十六进制颜色代码（如 "#FF5733"）
 */
export function getHSCodeColor(hsCode: string): string {
  if (!hsCode || hsCode.length < 2) {
    return '#8E8E93'; // 默认灰色
  }

  // 将HS Code转换为数字（01 -> 1, 42 -> 42, 97 -> 97）
  const codeNum = parseInt(hsCode.slice(0, 2), 10);
  
  if (isNaN(codeNum) || codeNum < 1 || codeNum > 97) {
    return '#8E8E93'; // 默认灰色
  }

  // 将97个HS Code均匀分布在360度色相环上
  // 使用 (codeNum - 1) 确保从0开始，97个代码分布在0-360度
  const hue = ((codeNum - 1) * 360) / 97;
  
  // 饱和度：根据category_id调整
  // equipment类别使用较高饱和度，raw_material使用中等饱和度
  // 这里可以根据需要调整，目前使用统一的饱和度
  const saturation = 65; // 65% 饱和度，确保颜色鲜艳但不刺眼
  
  // 亮度：根据category_id调整
  // equipment类别稍暗，raw_material稍亮
  let lightness = 50; // 默认50%
  
  // 根据HS Code范围调整亮度（可选，用于区分equipment和raw_material）
  // Equipment章节：37, 38, 82-96
  const equipmentChapters = [37, 38, ...Array.from({length: 15}, (_, i) => i + 82)];
  if (equipmentChapters.includes(codeNum)) {
    lightness = 45; // Equipment稍暗
  } else {
    lightness = 52; // Raw Material稍亮
  }

  return hslToHex(hue, saturation, lightness);
}

/**
 * 预生成所有HS Code的颜色映射（用于缓存）
 */
const colorCache: Record<string, string> = {};

/**
 * 获取HS Code颜色（带缓存）
 */
export function getHSCodeColorCached(hsCode: string): string {
  const key = hsCode.slice(0, 2);
  if (!colorCache[key]) {
    colorCache[key] = getHSCodeColor(key);
  }
  return colorCache[key];
}

/**
 * 获取所有HS Code的颜色映射
 */
export function getAllHSCodeColors(): Record<string, string> {
  const colors: Record<string, string> = {};
  for (let i = 1; i <= 97; i++) {
    const code = String(i).padStart(2, '0');
    colors[code] = getHSCodeColor(code);
  }
  return colors;
}

