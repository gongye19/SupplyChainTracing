#!/usr/bin/env python3
"""
CSV数据导入脚本
将synthetic_data.csv中的数据导入到PostgreSQL数据库
"""
import csv
import sys
import os
from datetime import datetime
from pathlib import Path

# 添加父目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base, Category, Company, Transaction, Location
from app.database import DATABASE_URL

def generate_company_id(company_name: str, country_code: str) -> str:
    """生成公司ID"""
    # 简化公司名称，移除特殊字符，转换为小写
    name_part = company_name.lower().replace(' ', '_').replace('.', '').replace(',', '').replace('-', '_')
    # 限制长度
    name_part = name_part[:30]
    return f"{country_code.lower()}_{name_part}"

def generate_city_from_country(country_code: str) -> str:
    """根据国家代码生成默认城市"""
    default_cities = {
        'TW': 'Taipei',
        'KR': 'Seoul',
        'US': 'New York',
        'NL': 'Amsterdam',
        'CN': 'Beijing',
        'DE': 'Berlin',
        'JP': 'Tokyo',
    }
    return default_cities.get(country_code, 'Unknown')

def get_city_coordinates(country_code: str, city: str) -> tuple:
    """获取城市坐标"""
    city_coords = {
        # Taiwan
        'TW': {
            'Taipei': (25.0330, 121.5654),
            'Hsinchu': (24.8036, 120.9686),
            'Taichung': (24.1477, 120.6736),
        },
        # United States
        'US': {
            'New York': (40.7128, -74.0060),
            'Cupertino': (37.3230, -122.0322),
            'Santa Clara': (37.3541, -121.9552),
            'Austin': (30.2672, -97.7431),
            'San Diego': (32.7157, -117.1611),
            'Boise': (43.6150, -116.2023),
        },
        # South Korea
        'KR': {
            'Seoul': (37.5665, 126.9780),
            'Suwon': (37.2636, 127.0286),
            'Pyeongtaek': (36.9920, 127.1120),
        },
        # Netherlands
        'NL': {
            'Amsterdam': (52.3676, 4.9041),
            'Eindhoven': (51.4416, 5.4697),
            'Rotterdam': (51.9244, 4.4777),
        },
        # Japan
        'JP': {
            'Tokyo': (35.6762, 139.6503),
            'Osaka': (34.6937, 135.5023),
            'Kyoto': (35.0116, 135.7681),
        },
        # China
        'CN': {
            'Beijing': (39.9042, 116.4074),
            'Shanghai': (31.2304, 121.4737),
            'Shenzhen': (22.5431, 114.0579),
        },
        # Germany
        'DE': {
            'Berlin': (52.5200, 13.4050),
            'Munich': (48.1351, 11.5820),
            'Dresden': (51.0504, 13.7373),
        },
    }
    
    # 先尝试获取城市坐标
    if country_code in city_coords and city in city_coords[country_code]:
        return city_coords[country_code][city]
    
    # 如果没有找到，使用国家首都坐标作为默认值
    default_coords = {
        'TW': (25.0330, 121.5654),
        'KR': (37.5665, 126.9780),
        'US': (38.9072, -77.0369),
        'NL': (52.3676, 4.9041),
        'CN': (39.9042, 116.4074),
        'DE': (52.5200, 13.4050),
        'JP': (35.6762, 139.6503),
    }
    return default_coords.get(country_code, (0.0, 0.0))

def import_data(csv_path: str):
    """导入CSV数据到数据库"""
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # 读取CSV文件
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            companies_cache = {}  # 缓存已创建的公司
            cities_cache = set()  # 缓存已创建的城市位置
            
            for row in reader:
                # 1. 处理品类（应该已经存在，但检查一下）
                category_name = row['category_name']
                category = session.query(Category).filter(Category.display_name == category_name).first()
                if not category:
                    print(f"警告: 品类 '{category_name}' 不存在，跳过该记录")
                    continue
                
                # 2. 处理出口公司
                exporter_company_id = None
                if row['exporter_company']:
                    exporter_id = generate_company_id(row['exporter_company'], row['exporter_country_code'])
                    if exporter_id not in companies_cache:
                        company = session.query(Company).filter(Company.id == exporter_id).first()
                        if not company:
                            # 生成默认城市（如果 CSV 中没有）
                            city = row.get('exporter_city') or generate_city_from_country(row['exporter_country_code'])
                            company = Company(
                                id=exporter_id,
                                name=row['exporter_company'],
                                country_code=row['exporter_country_code'],
                                country_name=row['exporter_country_name'],
                                city=city,
                                type='exporter'
                            )
                            session.add(company)
                            session.flush()
                            
                            # 创建城市位置（如果不存在）
                            city_key = (row['exporter_country_code'], city)
                            if city_key not in cities_cache:
                                city_location = session.query(Location).filter(
                                    Location.country_code == row['exporter_country_code'],
                                    Location.city == city,
                                    Location.type == 'city'
                                ).first()
                                if not city_location:
                                    lat, lng = get_city_coordinates(row['exporter_country_code'], city)
                                    city_location = Location(
                                        id=f"{row['exporter_country_code']}_{city}",
                                        type='city',
                                        country_code=row['exporter_country_code'],
                                        country_name=row['exporter_country_name'],
                                        city=city,
                                        latitude=lat,
                                        longitude=lng
                                    )
                                    session.add(city_location)
                                cities_cache.add(city_key)
                        companies_cache[exporter_id] = company
                    exporter_company_id = exporter_id
                
                # 3. 处理进口公司
                importer_company_id = None
                if row['importer_company']:
                    importer_id = generate_company_id(row['importer_company'], row['importer_country_code'])
                    if importer_id not in companies_cache:
                        company = session.query(Company).filter(Company.id == importer_id).first()
                        if not company:
                            # 生成默认城市（如果 CSV 中没有）
                            city = row.get('importer_city') or generate_city_from_country(row['importer_country_code'])
                            company = Company(
                                id=importer_id,
                                name=row['importer_company'],
                                country_code=row['importer_country_code'],
                                country_name=row['importer_country_name'],
                                city=city,
                                type='importer'
                            )
                            session.add(company)
                            session.flush()
                            
                            # 创建城市位置（如果不存在）
                            city_key = (row['importer_country_code'], city)
                            if city_key not in cities_cache:
                                city_location = session.query(Location).filter(
                                    Location.country_code == row['importer_country_code'],
                                    Location.city == city,
                                    Location.type == 'city'
                                ).first()
                                if not city_location:
                                    lat, lng = get_city_coordinates(row['importer_country_code'], city)
                                    city_location = Location(
                                        id=f"{row['importer_country_code']}_{city}",
                                        type='city',
                                        country_code=row['importer_country_code'],
                                        country_name=row['importer_country_name'],
                                        city=city,
                                        latitude=lat,
                                        longitude=lng
                                    )
                                    session.add(city_location)
                                cities_cache.add(city_key)
                        companies_cache[importer_id] = company
                    importer_company_id = importer_id
                
                # 4. 处理位置（如果不存在则创建国家位置）
                for country_code, country_name in [
                    (row['exporter_country_code'], row['exporter_country_name']),
                    (row['importer_country_code'], row['importer_country_name'])
                ]:
                    # 检查国家位置是否存在
                    country_location = session.query(Location).filter(
                        Location.country_code == country_code,
                        Location.type == 'country'
                    ).first()
                    if not country_location:
                        # 使用默认坐标（首都坐标，这里简化处理）
                        # 实际应该从外部数据源获取
                        default_coords = {
                            'TW': (25.0330, 121.5654),
                            'KR': (37.5665, 126.9780),
                            'US': (38.9072, -77.0369),
                            'NL': (52.3676, 4.9041),
                            'CN': (39.9042, 116.4074),
                            'DE': (52.5200, 13.4050),
                            'JP': (35.6762, 139.6503),
                        }
                        lat, lng = default_coords.get(country_code, (0.0, 0.0))
                        country_location = Location(
                            id=country_code,
                            type='country',
                            country_code=country_code,
                            country_name=country_name,
                            city=None,
                            latitude=lat,
                            longitude=lng
                        )
                        session.add(country_location)
                
                # 5. 创建交易记录
                transaction_date = datetime.fromisoformat(row['transaction_date'].replace('Z', '+00:00'))
                
                transaction = Transaction(
                    id=row['id'],
                    exporter_company_id=exporter_company_id,
                    importer_company_id=importer_company_id,
                    origin_country_code=row['exporter_country_code'],
                    origin_country_name=row['exporter_country_name'],
                    destination_country_code=row['importer_country_code'],
                    destination_country_name=row['importer_country_name'],
                    material=row['material'],
                    category_id=category.id,
                    quantity=float(row['quantity']),
                    unit=row.get('unit'),
                    price=float(row['price']),
                    total_value=float(row['total_value']),
                    transaction_date=transaction_date,
                    status=row.get('status', 'completed')
                )
                
                session.add(transaction)
            
            # 提交所有更改
            session.commit()
            print(f"成功导入数据")
            
    except Exception as e:
        session.rollback()
        print(f"导入失败: {e}")
        raise
    finally:
        session.close()

if __name__ == "__main__":
    # 获取CSV文件路径
    csv_path = os.getenv("CSV_PATH", "/app/data/synthetic_data.csv")
    
    if not os.path.exists(csv_path):
        print(f"错误: CSV文件不存在: {csv_path}")
        sys.exit(1)
    
    print(f"开始导入数据从: {csv_path}")
    import_data(csv_path)
    print("导入完成!")

