#!/usr/bin/env python3
"""
预处理脚本：从原始 CSV 生成 4 个表并保存到 processed_tables 目录
"""

import csv
import sys
import shutil
from pathlib import Path
from collections import defaultdict
from datetime import datetime

def get_month_key(date_str: str) -> str:
    """从日期字符串提取年月（YYYY-MM）"""
    try:
        date_obj = datetime.strptime(date_str, '%Y-%m-%d')
        return date_obj.strftime('%Y-%m')
    except:
        return ""

# 完整的 HS Code 2022 标准分类表（96个章节）
HS_CODE_CHAPTERS = {
    "01": "Live animals",
    "02": "Meat and edible meat offal",
    "03": "Fish and crustaceans, molluscs and other aquatic invertebrates",
    "04": "Dairy produce; birds' eggs; natural honey; edible products of animal origin",
    "05": "Products of animal origin, not elsewhere specified or included",
    "06": "Live trees and other plants; bulbs, roots and the like; cut flowers and ornamental foliage",
    "07": "Edible vegetables and certain roots and tubers",
    "08": "Edible fruit and nuts; peel of citrus fruit or melons",
    "09": "Coffee, tea, maté and spices",
    "10": "Cereals",
    "11": "Products of the milling industry; malt; starches; inulin; wheat gluten",
    "12": "Oil seeds and oleaginous fruits; miscellaneous grains, seeds and fruit",
    "13": "Lac; gums, resins and other vegetable saps and extracts",
    "14": "Vegetable plaiting materials; vegetable products not elsewhere specified or included",
    "15": "Animal or vegetable fats and oils and their cleavage products",
    "16": "Preparations of meat, of fish or of crustaceans, molluscs or other aquatic invertebrates",
    "17": "Sugars and sugar confectionery",
    "18": "Cocoa and cocoa preparations",
    "19": "Preparations of cereals, flour, starch or milk; pastrycooks' products",
    "20": "Preparations of vegetables, fruit, nuts or other parts of plants",
    "21": "Miscellaneous edible preparations",
    "22": "Beverages, spirits and vinegar",
    "23": "Residues and waste from the food industries; prepared animal fodder",
    "24": "Tobacco and manufactured tobacco substitutes",
    "25": "Salt; sulfur; earths and stone; plastering materials, lime and cement",
    "26": "Ores, slag and ash",
    "27": "Mineral fuels, mineral oils and products of their distillation",
    "28": "Inorganic chemicals; organic or inorganic compounds of precious metals",
    "29": "Organic chemicals",
    "30": "Pharmaceutical products",
    "31": "Fertilizers",
    "32": "Tanning or dyeing extracts; tannins and their derivatives; dyes, pigments and other coloring matter",
    "33": "Essential oils and resinoids; perfumery, cosmetic or toilet preparations",
    "34": "Soap, organic surface-active agents, washing preparations, lubricating preparations",
    "35": "Albuminoidal substances; modified starches; glues; enzymes",
    "36": "Explosives; pyrotechnic products; matches; pyrophoric alloys; certain combustible preparations",
    "37": "Photographic or cinematographic goods",
    "38": "Miscellaneous chemical products",
    "39": "Plastics and articles thereof",
    "40": "Rubber and articles thereof",
    "41": "Raw hides and skins (other than furskins) and leather",
    "42": "Articles of leather; saddlery and harness; travel goods, handbags and similar containers",
    "43": "Furskins and artificial fur; manufactures thereof",
    "44": "Wood and articles of wood; wood charcoal",
    "45": "Cork and articles of cork",
    "46": "Manufactures of straw, of esparto or of other plaiting materials; basketware and wickerwork",
    "47": "Pulp of wood or of other fibrous cellulosic material; recovered (waste and scrap) paper or paperboard",
    "48": "Paper and paperboard; articles of paper pulp, of paper or of paperboard",
    "49": "Printed books, newspapers, pictures and other products of the printing industry",
    "50": "Silk",
    "51": "Wool, fine or coarse animal hair; horsehair yarn and woven fabric",
    "52": "Cotton",
    "53": "Other vegetable textile fibers; paper yarn and woven fabrics of paper yarn",
    "54": "Man-made filaments; strip and the like of man-made textile materials",
    "55": "Man-made staple fibers",
    "56": "Wadding, felt and nonwovens; special yarns; twine, cordage, ropes and cables",
    "57": "Carpets and other textile floor coverings",
    "58": "Special woven fabrics; tufted textile fabrics; lace; tapestries; trimmings; embroidery",
    "59": "Impregnated, coated, covered or laminated textile fabrics; textile articles",
    "60": "Knitted or crocheted fabrics",
    "61": "Articles of apparel and clothing accessories, knitted or crocheted",
    "62": "Articles of apparel and clothing accessories, not knitted or crocheted",
    "63": "Other made up textile articles; sets; worn clothing and worn textile articles",
    "64": "Footwear, gaiters and the like; parts of such articles",
    "65": "Headgear and parts thereof",
    "66": "Umbrellas, sun umbrellas, walking sticks, seat-sticks, whips, riding-crops and parts thereof",
    "67": "Prepared feathers and down and articles made of feathers or of down; artificial flowers",
    "68": "Articles of stone, plaster, cement, asbestos, mica or similar materials",
    "69": "Ceramic products",
    "70": "Glass and glassware",
    "71": "Natural or cultured pearls, precious or semi-precious stones, precious metals",
    "72": "Iron and steel",
    "73": "Articles of iron or steel",
    "74": "Copper and articles thereof",
    "75": "Nickel and articles thereof",
    "76": "Aluminum and articles thereof",
    "78": "Lead and articles thereof",
    "79": "Zinc and articles thereof",
    "80": "Tin and articles thereof",
    "81": "Other base metals; cermets; articles thereof",
    "82": "Tools, implements, cutlery, spoons and forks, of base metal; parts thereof",
    "83": "Miscellaneous articles of base metal",
    "84": "Nuclear reactors, boilers, machinery and mechanical appliances; parts thereof",
    "85": "Electrical machinery and equipment and parts thereof; sound recorders and reproducers",
    "86": "Railway or tramway locomotives, rolling-stock and parts thereof",
    "87": "Vehicles other than railway or tramway rolling stock, and parts and accessories thereof",
    "88": "Aircraft, spacecraft, and parts thereof",
    "89": "Ships, boats and floating structures",
    "90": "Optical, photographic, cinematographic, measuring, checking, precision, medical or surgical instruments",
    "91": "Clocks and watches and parts thereof",
    "92": "Musical instruments; parts and accessories of such articles",
    "93": "Arms and ammunition; parts and accessories thereof",
    "94": "Furniture; bedding, mattresses, mattress supports, cushions and similar stuffed furnishings",
    "95": "Toys, games and sports requisites; parts and accessories thereof",
    "96": "Miscellaneous manufactured articles",
    "97": "Works of art, collectors' pieces and antiques",
}

def get_hs_code_category(hs_code: str) -> tuple:
    """根据 HS Code 前2位映射到品类"""
    if not hs_code or len(hs_code) < 2:
        return ("raw_material", "Raw Material")
    
    chapter = hs_code[:2]
    
    # Equipment 类别（机械设备、电子设备等）
    equipment_chapters = {
        "37", "38", "82", "83", "84", "85", "86", "87", "88", "89", 
        "90", "91", "92", "93", "94", "95", "96"
    }
    
    if chapter in equipment_chapters:
        return ("equipment", "Equipment")
    else:
        return ("raw_material", "Raw Material")

# 完整的 ISO 3166 国家列表（主要国家，包含坐标和地区信息）
ISO_3166_COUNTRIES = {
    "AF": {"name": "Afghanistan", "lat": 33.9391, "lng": 67.7100, "region": "South Asia", "continent": "Asia"},
    "AL": {"name": "Albania", "lat": 41.1533, "lng": 20.1683, "region": "Southeast Europe", "continent": "Europe"},
    "DZ": {"name": "Algeria", "lat": 28.0339, "lng": 1.6596, "region": "North Africa", "continent": "Africa"},
    "AR": {"name": "Argentina", "lat": -34.6118, "lng": -58.3960, "region": "South America", "continent": "Americas"},
    "AU": {"name": "Australia", "lat": -35.2809, "lng": 149.1300, "region": "Oceania", "continent": "Oceania"},
    "AT": {"name": "Austria", "lat": 48.2082, "lng": 16.3738, "region": "Central Europe", "continent": "Europe"},
    "BD": {"name": "Bangladesh", "lat": 23.8103, "lng": 90.4125, "region": "South Asia", "continent": "Asia"},
    "BE": {"name": "Belgium", "lat": 50.8503, "lng": 4.3517, "region": "Western Europe", "continent": "Europe"},
    "BR": {"name": "Brazil", "lat": -15.7942, "lng": -47.8822, "region": "South America", "continent": "Americas"},
    "BG": {"name": "Bulgaria", "lat": 42.6977, "lng": 23.3219, "region": "Southeast Europe", "continent": "Europe"},
    "CA": {"name": "Canada", "lat": 45.5017, "lng": -73.5673, "region": "North America", "continent": "Americas"},
    "CL": {"name": "Chile", "lat": -33.4489, "lng": -70.6693, "region": "South America", "continent": "Americas"},
    "CN": {"name": "China", "lat": 39.9042, "lng": 116.4074, "region": "East Asia", "continent": "Asia"},
    "CO": {"name": "Colombia", "lat": 4.7110, "lng": -74.0721, "region": "South America", "continent": "Americas"},
    "CR": {"name": "Costa Rica", "lat": 9.9281, "lng": -84.0907, "region": "Central America", "continent": "Americas"},
    "HR": {"name": "Croatia", "lat": 45.8150, "lng": 15.9819, "region": "Southeast Europe", "continent": "Europe"},
    "CZ": {"name": "Czech Republic", "lat": 50.0755, "lng": 14.4378, "region": "Central Europe", "continent": "Europe"},
    "DK": {"name": "Denmark", "lat": 55.6761, "lng": 12.5683, "region": "Northern Europe", "continent": "Europe"},
    "EG": {"name": "Egypt", "lat": 30.0444, "lng": 31.2357, "region": "Middle East", "continent": "Africa"},
    "FI": {"name": "Finland", "lat": 60.1699, "lng": 24.9384, "region": "Northern Europe", "continent": "Europe"},
    "FR": {"name": "France", "lat": 48.8566, "lng": 2.3522, "region": "Western Europe", "continent": "Europe"},
    "DE": {"name": "Germany", "lat": 52.5200, "lng": 13.4050, "region": "Central Europe", "continent": "Europe"},
    "GR": {"name": "Greece", "lat": 37.9838, "lng": 23.7275, "region": "Southeast Europe", "continent": "Europe"},
    "HK": {"name": "Hong Kong", "lat": 22.3193, "lng": 114.1694, "region": "East Asia", "continent": "Asia"},
    "HU": {"name": "Hungary", "lat": 47.4979, "lng": 19.0402, "region": "Central Europe", "continent": "Europe"},
    "IN": {"name": "India", "lat": 28.6139, "lng": 77.2090, "region": "South Asia", "continent": "Asia"},
    "ID": {"name": "Indonesia", "lat": -6.2088, "lng": 106.8456, "region": "Southeast Asia", "continent": "Asia"},
    "IE": {"name": "Ireland", "lat": 53.3498, "lng": -6.2603, "region": "Northern Europe", "continent": "Europe"},
    "IL": {"name": "Israel", "lat": 31.7683, "lng": 35.2137, "region": "Middle East", "continent": "Asia"},
    "IT": {"name": "Italy", "lat": 41.9028, "lng": 12.4964, "region": "Southern Europe", "continent": "Europe"},
    "JP": {"name": "Japan", "lat": 35.6762, "lng": 139.6503, "region": "East Asia", "continent": "Asia"},
    "JO": {"name": "Jordan", "lat": 31.9539, "lng": 35.9106, "region": "Middle East", "continent": "Asia"},
    "KE": {"name": "Kenya", "lat": -1.2921, "lng": 36.8219, "region": "East Africa", "continent": "Africa"},
    "KR": {"name": "South Korea", "lat": 37.5665, "lng": 126.9780, "region": "East Asia", "continent": "Asia"},
    "KW": {"name": "Kuwait", "lat": 29.3759, "lng": 47.9774, "region": "Middle East", "continent": "Asia"},
    "MY": {"name": "Malaysia", "lat": 3.1390, "lng": 101.6869, "region": "Southeast Asia", "continent": "Asia"},
    "MX": {"name": "Mexico", "lat": 19.4326, "lng": -99.1332, "region": "North America", "continent": "Americas"},
    "MA": {"name": "Morocco", "lat": 33.9716, "lng": -6.8498, "region": "North Africa", "continent": "Africa"},
    "NL": {"name": "Netherlands", "lat": 52.3676, "lng": 4.9041, "region": "Western Europe", "continent": "Europe"},
    "NZ": {"name": "New Zealand", "lat": -41.2865, "lng": 174.7762, "region": "Oceania", "continent": "Oceania"},
    "NG": {"name": "Nigeria", "lat": 6.5244, "lng": 3.3792, "region": "West Africa", "continent": "Africa"},
    "NO": {"name": "Norway", "lat": 59.9139, "lng": 10.7522, "region": "Northern Europe", "continent": "Europe"},
    "OM": {"name": "Oman", "lat": 23.5859, "lng": 58.4059, "region": "Middle East", "continent": "Asia"},
    "PK": {"name": "Pakistan", "lat": 33.6844, "lng": 73.0479, "region": "South Asia", "continent": "Asia"},
    "PE": {"name": "Peru", "lat": -12.0464, "lng": -77.0428, "region": "South America", "continent": "Americas"},
    "PH": {"name": "Philippines", "lat": 14.5995, "lng": 120.9842, "region": "Southeast Asia", "continent": "Asia"},
    "PL": {"name": "Poland", "lat": 52.2297, "lng": 21.0122, "region": "Central Europe", "continent": "Europe"},
    "PT": {"name": "Portugal", "lat": 38.7223, "lng": -9.1393, "region": "Southern Europe", "continent": "Europe"},
    "QA": {"name": "Qatar", "lat": 25.2854, "lng": 51.5310, "region": "Middle East", "continent": "Asia"},
    "RO": {"name": "Romania", "lat": 44.4268, "lng": 26.1025, "region": "Southeast Europe", "continent": "Europe"},
    "RU": {"name": "Russia", "lat": 55.7558, "lng": 37.6173, "region": "Eastern Europe", "continent": "Europe"},
    "SA": {"name": "Saudi Arabia", "lat": 24.7136, "lng": 46.6753, "region": "Middle East", "continent": "Asia"},
    "SG": {"name": "Singapore", "lat": 1.3521, "lng": 103.8198, "region": "Southeast Asia", "continent": "Asia"},
    "ZA": {"name": "South Africa", "lat": -26.2041, "lng": 28.0473, "region": "Southern Africa", "continent": "Africa"},
    "ES": {"name": "Spain", "lat": 40.4168, "lng": -3.7038, "region": "Southern Europe", "continent": "Europe"},
    "SE": {"name": "Sweden", "lat": 59.3293, "lng": 18.0686, "region": "Northern Europe", "continent": "Europe"},
    "CH": {"name": "Switzerland", "lat": 46.2044, "lng": 6.1432, "region": "Central Europe", "continent": "Europe"},
    "TW": {"name": "Taiwan", "lat": 25.0330, "lng": 121.5654, "region": "East Asia", "continent": "Asia"},
    "TH": {"name": "Thailand", "lat": 13.7563, "lng": 100.5018, "region": "Southeast Asia", "continent": "Asia"},
    "TR": {"name": "Turkey", "lat": 41.0082, "lng": 28.9784, "region": "Middle East", "continent": "Asia"},
    "AE": {"name": "United Arab Emirates", "lat": 24.4539, "lng": 54.3773, "region": "Middle East", "continent": "Asia"},
    "GB": {"name": "United Kingdom", "lat": 51.5074, "lng": -0.1278, "region": "Northern Europe", "continent": "Europe"},
    "US": {"name": "United States", "lat": 38.9072, "lng": -77.0369, "region": "North America", "continent": "Americas"},
    "VN": {"name": "Vietnam", "lat": 21.0285, "lng": 105.8542, "region": "Southeast Asia", "continent": "Asia"},
}

# 国家名称到代码的映射（处理常见变体）
COUNTRY_NAME_TO_CODE = {
    "United States": "US", "USA": "US", "United States of America": "US",
    "United Kingdom": "GB", "UK": "GB", "Great Britain": "GB",
    "China": "CN", "People's Republic of China": "CN",
    "Japan": "JP",
    "South Korea": "KR", "Korea, South": "KR", "Republic of Korea": "KR",
    "Germany": "DE",
    "France": "FR",
    "Italy": "IT",
    "Spain": "ES",
    "Netherlands": "NL", "Holland": "NL",
    "Brazil": "BR",
    "Mexico": "MX",
    "India": "IN",
    "Thailand": "TH",
    "Vietnam": "VN",
    "Philippines": "PH",
    "Indonesia": "ID",
    "Malaysia": "MY",
    "Singapore": "SG",
    "Bangladesh": "BD",
    "Pakistan": "PK",
    "Egypt": "EG",
    "Turkey": "TR",
    "Australia": "AU",
    "Dubai": "AE", "UAE": "AE", "United Arab Emirates": "AE",
    "Canada": "CA",
    "Russia": "RU",
    "South Africa": "ZA",
    "Argentina": "AR",
    "Chile": "CL",
    "Colombia": "CO",
    "Peru": "PE",
    "Saudi Arabia": "SA",
    "Israel": "IL",
    "Qatar": "QA",
    "Kuwait": "KW",
    "Oman": "OM",
    "Jordan": "JO",
    "Taiwan": "TW",
    "Hong Kong": "HK",
    "Switzerland": "CH",
    "Sweden": "SE",
    "Norway": "NO",
    "Denmark": "DK",
    "Finland": "FI",
    "Poland": "PL",
    "Belgium": "BE",
    "Austria": "AT",
    "Greece": "GR",
    "Portugal": "PT",
    "Ireland": "IE",
    "Czech Republic": "CZ",
    "Romania": "RO",
    "Hungary": "HU",
    "Croatia": "HR",
    "Bulgaria": "BG",
    "Albania": "AL",
}

def get_country_info(country_name: str) -> dict:
    """从国家名称获取完整信息（代码、坐标、地区、大洲）"""
    # 先尝试直接匹配
    code = COUNTRY_NAME_TO_CODE.get(country_name)
    if not code:
        # 尝试模糊匹配
        country_name_upper = country_name.upper()
        for name, c in COUNTRY_NAME_TO_CODE.items():
            if name.upper() == country_name_upper or name.upper().startswith(country_name_upper):
                code = c
                break
    
    if code and code in ISO_3166_COUNTRIES:
        info = ISO_3166_COUNTRIES[code]
        return {
            "code": code,
            "name": info["name"],
            "lat": info["lat"],
            "lng": info["lng"],
            "region": info["region"],
            "continent": info["continent"]
        }
    
    # 如果找不到，返回默认值
    return {
        "code": country_name[:2].upper() if len(country_name) >= 2 else "XX",
        "name": country_name,
        "lat": 0.0,
        "lng": 0.0,
        "region": "Unknown",
        "continent": "Unknown"
    }

# 港口位置映射（基于前端 portLocations.ts）
PORT_LOCATIONS = {
    # 中国港口
    'Shanghai': {'name': 'Shanghai', 'country': 'China', 'latitude': 31.2304, 'longitude': 121.4737},
    'Hong Kong': {'name': 'Hong Kong', 'country': 'China', 'latitude': 22.3193, 'longitude': 114.1694},
    'Shenzhen': {'name': 'Shenzhen', 'country': 'China', 'latitude': 22.5431, 'longitude': 114.0579},
    'Ningbo': {'name': 'Ningbo', 'country': 'China', 'latitude': 29.8683, 'longitude': 121.5440},
    'Qingdao': {'name': 'Qingdao', 'country': 'China', 'latitude': 36.0671, 'longitude': 120.3826},
    'Tianjin': {'name': 'Tianjin', 'country': 'China', 'latitude': 39.3434, 'longitude': 117.3616},
    'Guangzhou': {'name': 'Guangzhou', 'country': 'China', 'latitude': 23.1291, 'longitude': 113.2644},
    
    # 美国港口
    'Los Angeles': {'name': 'Los Angeles', 'country': 'United States', 'latitude': 33.7490, 'longitude': -118.2648},
    'New York': {'name': 'New York', 'country': 'United States', 'latitude': 40.7128, 'longitude': -74.0060},
    'Long Beach': {'name': 'Long Beach', 'country': 'United States', 'latitude': 33.7701, 'longitude': -118.1937},
    'Savannah': {'name': 'Savannah', 'country': 'United States', 'latitude': 32.0809, 'longitude': -81.0912},
    'Seattle': {'name': 'Seattle', 'country': 'United States', 'latitude': 47.6062, 'longitude': -122.3321},
    'Houston': {'name': 'Houston', 'country': 'United States', 'latitude': 29.7604, 'longitude': -95.3698},
    
    # 欧洲港口
    'Rotterdam': {'name': 'Rotterdam', 'country': 'Netherlands', 'latitude': 51.9225, 'longitude': 4.4792},
    'Hamburg': {'name': 'Hamburg', 'country': 'Germany', 'latitude': 53.5511, 'longitude': 9.9937},
    'Antwerp': {'name': 'Antwerp', 'country': 'Belgium', 'latitude': 51.2194, 'longitude': 4.4025},
    'Le Havre': {'name': 'Le Havre', 'country': 'France', 'latitude': 49.4944, 'longitude': 0.1079},
    'London': {'name': 'London', 'country': 'United Kingdom', 'latitude': 51.5074, 'longitude': -0.1278},
    'Genoa': {'name': 'Genoa', 'country': 'Italy', 'latitude': 44.4056, 'longitude': 8.9463},
    'Barcelona': {'name': 'Barcelona', 'country': 'Spain', 'latitude': 41.3851, 'longitude': 2.1734},
    
    # 亚洲港口
    'Singapore': {'name': 'Singapore', 'country': 'Singapore', 'latitude': 1.2897, 'longitude': 103.8501},
    'Busan': {'name': 'Busan', 'country': 'South Korea', 'latitude': 35.1796, 'longitude': 129.0756},
    'Tokyo': {'name': 'Tokyo', 'country': 'Japan', 'latitude': 35.6762, 'longitude': 139.6503},
    'Yokohama': {'name': 'Yokohama', 'country': 'Japan', 'latitude': 35.4437, 'longitude': 139.6380},
    'Osaka': {'name': 'Osaka', 'country': 'Japan', 'latitude': 34.6937, 'longitude': 135.5023},
    'Manila': {'name': 'Manila', 'country': 'Philippines', 'latitude': 14.5995, 'longitude': 120.9842},
    'Bangkok': {'name': 'Bangkok', 'country': 'Thailand', 'latitude': 13.7563, 'longitude': 100.5018},
    'Ho Chi Minh': {'name': 'Ho Chi Minh', 'country': 'Vietnam', 'latitude': 10.8231, 'longitude': 106.6297},
    'Chittagong': {'name': 'Chittagong', 'country': 'Bangladesh', 'latitude': 22.3569, 'longitude': 91.7832},
    'Jakarta': {'name': 'Jakarta', 'country': 'Indonesia', 'latitude': -6.2088, 'longitude': 106.8456},
    'Jebel Ali': {'name': 'Jebel Ali', 'country': 'United Arab Emirates', 'latitude': 25.0275, 'longitude': 55.0750},
    'Dubai': {'name': 'Dubai', 'country': 'United Arab Emirates', 'latitude': 25.2048, 'longitude': 55.2708},
    'Port Klang': {'name': 'Port Klang', 'country': 'Malaysia', 'latitude': 3.0000, 'longitude': 101.4000},
    'Karachi': {'name': 'Karachi', 'country': 'Pakistan', 'latitude': 24.8607, 'longitude': 67.0011},
    'Mumbai': {'name': 'Mumbai', 'country': 'India', 'latitude': 19.0760, 'longitude': 72.8777},
    'Istanbul': {'name': 'Istanbul', 'country': 'Turkey', 'latitude': 41.0082, 'longitude': 28.9784},
    'Alexandria': {'name': 'Alexandria', 'country': 'Egypt', 'latitude': 31.2001, 'longitude': 29.9187},
    
    # 其他港口
    'Veracruz': {'name': 'Veracruz', 'country': 'Mexico', 'latitude': 19.1738, 'longitude': -96.1342},
    'Santos': {'name': 'Santos', 'country': 'Brazil', 'latitude': -23.9608, 'longitude': -46.3336},
    'Sydney': {'name': 'Sydney', 'country': 'Australia', 'latitude': -33.8688, 'longitude': 151.2093},
    'Melbourne': {'name': 'Melbourne', 'country': 'Australia', 'latitude': -37.8136, 'longitude': 144.9631},
}

def get_port_info(port_name: str, country_name: str = None) -> dict:
    """获取港口位置信息"""
    if not port_name or not port_name.strip():
        return None
    
    port_name_clean = port_name.strip()
    
    # 尝试精确匹配
    if port_name_clean in PORT_LOCATIONS:
        port = PORT_LOCATIONS[port_name_clean]
        country_info = get_country_info(port['country'])
        return {
            'port_name': port['name'],
            'country_code': country_info['code'],
            'country_name': country_info['name'],
            'latitude': port['latitude'],
            'longitude': port['longitude'],
            'region': country_info['region'],
            'continent': country_info['continent'],
        }
    
    # 尝试不区分大小写匹配
    port_key = None
    for key in PORT_LOCATIONS.keys():
        if key.lower() == port_name_clean.lower():
            port_key = key
            break
    
    if port_key:
        port = PORT_LOCATIONS[port_key]
        country_info = get_country_info(port['country'])
        return {
            'port_name': port['name'],
            'country_code': country_info['code'],
            'country_name': country_info['name'],
            'latitude': port['latitude'],
            'longitude': port['longitude'],
            'region': country_info['region'],
            'continent': country_info['continent'],
        }
    
    # 如果找不到港口，使用国家位置作为回退
    if country_name:
        country_info = get_country_info(country_name)
        return {
            'port_name': port_name_clean,
            'country_code': country_info['code'],
            'country_name': country_info['name'],
            'latitude': country_info['lat'],
            'longitude': country_info['lng'],
            'region': country_info['region'],
            'continent': country_info['continent'],
        }
    
    # 最后回退
    return {
        'port_name': port_name_clean,
        'country_code': 'XX',
        'country_name': 'Unknown',
        'latitude': 0.0,
        'longitude': 0.0,
        'region': 'Unknown',
        'continent': 'Unknown',
    }

def preprocess_tables(input_csv: str, output_dir: str):
    """预处理数据，生成3个表"""
    print("=" * 60)
    print("数据预处理脚本")
    print("=" * 60)
    print()
    
    # 清空输出目录
    output_path = Path(output_dir)
    if output_path.exists():
        print(f"清空输出目录: {output_path}")
        shutil.rmtree(output_path)
    output_path.mkdir(parents=True, exist_ok=True)
    print("✓ 目录已清空\n")
    
    # 表1: shipments_raw.csv - 直接复制原文件
    print("生成表1: shipments_raw.csv (直接复制原文件)")
    shutil.copy2(input_csv, output_path / "shipments_raw.csv")
    print(f"✓ 已复制原文件\n")
    
    # 读取原始数据用于其他表的处理
    print(f"读取原始数据: {input_csv}")
    with open(input_csv, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        raw_rows = list(reader)
    print(f"✓ 读取到 {len(raw_rows)} 条记录\n")
    
    # 表2: hs_code_categories.csv - 使用完整的 HS 2022 标准分类表（96个章节）
    print("生成表2: hs_code_categories.csv (完整 HS 2022 标准)")
    hs_code_categories = []
    for chapter in sorted(HS_CODE_CHAPTERS.keys()):
        hs_code_categories.append({
            'hs_code': chapter,
            'chapter_name': HS_CODE_CHAPTERS[chapter],
        })
    
    with open(output_path / "hs_code_categories.csv", 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['hs_code', 'chapter_name'])
        writer.writeheader()
        writer.writerows(hs_code_categories)
    print(f"✓ {len(hs_code_categories)} 条记录（完整 HS 2022 标准）\n")
    
    # 表3: port_locations.csv - 从原始数据中提取港口位置
    print("生成表3: port_locations.csv (从原始数据提取港口)")
    
    # 从原始数据中提取所有唯一的港口（Port of Departure 和 Port of Arrival）
    ports_in_data = {}  # key: (port_name, country_name) -> port_info
    
    for row in raw_rows:
        # 处理出发港口
        port_departure = row.get('Port of Departure', '').strip()
        country_origin = row.get('Country of Origin', '').strip()
        if port_departure:
            key = (port_departure, country_origin)
            if key not in ports_in_data:
                port_info = get_port_info(port_departure, country_origin)
                if port_info:
                    ports_in_data[key] = port_info
        
        # 处理到达港口
        port_arrival = row.get('Port of Arrival', '').strip()
        country_dest = row.get('Destination Country', '').strip()
        if port_arrival:
            key = (port_arrival, country_dest)
            if key not in ports_in_data:
                port_info = get_port_info(port_arrival, country_dest)
                if port_info:
                    ports_in_data[key] = port_info
    
    # 转换为列表并按港口名称排序
    port_locations = []
    for port_info in ports_in_data.values():
        port_locations.append({
            'port_name': port_info['port_name'],
            'country_code': port_info['country_code'],
            'country_name': port_info['country_name'],
            'latitude': f"{port_info['latitude']:.7f}",
            'longitude': f"{port_info['longitude']:.7f}",
            'region': port_info['region'],
            'continent': port_info['continent'],
        })
    
    # 按港口名称排序
    port_locations = sorted(port_locations, key=lambda x: (x['country_name'], x['port_name']))
    
    with open(output_path / "port_locations.csv", 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['port_name', 'country_code', 'country_name', 'latitude', 'longitude', 'region', 'continent'])
        writer.writeheader()
        writer.writerows(port_locations)
    print(f"✓ {len(port_locations)} 条记录（从数据中提取的港口）\n")
    
    print("=" * 60)
    print("预处理完成!")
    print(f"输出目录: {output_path.absolute()}")

if __name__ == "__main__":
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    
    if len(sys.argv) >= 3:
        input_csv = sys.argv[1]
        output_dir = sys.argv[2]
    else:
        input_csv = str(project_root / "data" / "Factset_Extended_Shipment_Data_latest_10000.csv")
        output_dir = str(project_root / "processed_tables")
    
    preprocess_tables(input_csv, output_dir)
