#!/usr/bin/env python3
"""
Railway 数据库数据导入脚本
用于将 CSV 数据导入到 Railway 的 PostgreSQL 数据库
"""
import csv
import sys
import os
from datetime import datetime
from pathlib import Path

# 添加父目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.models import Category, Company, Transaction, Location

def generate_company_id(company_name: str, country_code: str) -> str:
    """生成公司ID"""
    name_part = company_name.lower().replace(' ', '_').replace('.', '').replace(',', '').replace('-', '_')
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
        'TW': {
            'Taipei': (25.0330, 121.5654),
            'Hsinchu': (24.8036, 120.9686),
            'Taichung': (24.1477, 120.6736),
        },
        'US': {
            'New York': (40.7128, -74.0060),
            'Cupertino': (37.3230, -122.0322),
            'Santa Clara': (37.3541, -121.9552),
            'Austin': (30.2672, -97.7431),
            'San Diego': (32.7157, -117.1611),
            'Boise': (43.6150, -116.2023),
        },
        'KR': {
            'Seoul': (37.5665, 126.9780),
            'Suwon': (37.2636, 127.0286),
            'Pyeongtaek': (36.9920, 127.1120),
        },
        'NL': {
            'Amsterdam': (52.3676, 4.9041),
            'Eindhoven': (51.4416, 5.4697),
            'Rotterdam': (51.9244, 4.4777),
        },
        'JP': {
            'Tokyo': (35.6762, 139.6503),
            'Osaka': (34.6937, 135.5023),
            'Kyoto': (35.0116, 135.7681),
        },
        'CN': {
            'Beijing': (39.9042, 116.4074),
            'Shanghai': (31.2304, 121.4737),
            'Shenzhen': (22.5431, 114.0579),
        },
        'DE': {
            'Berlin': (52.5200, 13.4050),
            'Munich': (48.1351, 11.5820),
            'Dresden': (51.0504, 13.7373),
        },
    }
    
    if country_code in city_coords and city in city_coords[country_code]:
        return city_coords[country_code][city]
    
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

def update_categories_chinese(engine):
    """更新品类显示名称为中文"""
    print("正在更新品类显示名称为中文...")
    try:
        with engine.connect() as conn:
            updates = [
                ("equipment", "设备"),
                ("raw_material", "原材料"),
                ("logic", "逻辑芯片"),
                ("memory", "存储"),
            ]
            
            for category_id, display_name in updates:
                result = conn.execute(
                    text("UPDATE categories SET display_name = :display_name WHERE id = :id"),
                    {"display_name": display_name, "id": category_id}
                )
                if result.rowcount > 0:
                    print(f"  ✓ 更新品类 '{category_id}': {display_name}")
                else:
                    # 如果品类不存在，尝试插入
                    try:
                        conn.execute(
                            text("""
                                INSERT INTO categories (id, name, display_name, color, icon, sort_order) 
                                VALUES (:id, :name, :display_name, :color, :icon, :sort_order)
                                ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name
                            """),
                            {
                                "id": category_id,
                                "name": category_id.replace('_', ' ').title(),
                                "display_name": display_name,
                                "color": {
                                    "equipment": "#5856D6",
                                    "raw_material": "#30B0C7",
                                    "logic": "#007AFF",
                                    "memory": "#FF9500"
                                }.get(category_id, "#8E8E93"),
                                "icon": {
                                    "equipment": "settings",
                                    "raw_material": "package",
                                    "logic": "cpu",
                                    "memory": "database"
                                }.get(category_id, "package"),
                                "sort_order": {
                                    "equipment": 1,
                                    "raw_material": 2,
                                    "logic": 3,
                                    "memory": 4
                                }.get(category_id, 0)
                            }
                        )
                        print(f"  ✓ 插入品类 '{category_id}': {display_name}")
                    except Exception as e:
                        print(f"  ⚠ 品类 '{category_id}' 处理失败: {e}")
            
            conn.commit()
        print("✓ 品类更新完成")
        return True
    except Exception as e:
        print(f"❌ 品类更新失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def init_database(engine):
    """初始化数据库表结构和种子数据"""
    print("正在初始化数据库表结构...")
    init_sql_path = Path(__file__).parent.parent / "init.sql"
    
    if not init_sql_path.exists():
        print(f"❌ 错误: init.sql 文件不存在: {init_sql_path}")
        return False
    
    with open(init_sql_path, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    try:
        with engine.connect() as conn:
            # 执行 SQL 语句（按分号分割）
            statements = [s.strip() for s in sql_content.split(';') if s.strip() and not s.strip().startswith('--')]
            for statement in statements:
                if statement:
                    try:
                        conn.execute(text(statement))
                    except Exception as e:
                        # 忽略已存在的错误（表已存在等）
                        if 'already exists' not in str(e).lower() and 'duplicate' not in str(e).lower():
                            print(f"警告: {e}")
            conn.commit()
        print("✓ 数据库表结构初始化完成")
        
        # 初始化完成后，更新品类为中文
        update_categories_chinese(engine)
        
        return True
    except Exception as e:
        print(f"❌ 初始化失败: {e}")
        return False

def import_data(csv_path: str, database_url: str):
    """导入CSV数据到数据库"""
    print(f"连接数据库: {database_url.split('@')[1] if '@' in database_url else '***'}")
    engine = create_engine(database_url, pool_pre_ping=True)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # 1. 先初始化数据库（如果表不存在）
        print("\n步骤 1: 检查并初始化数据库...")
        with engine.connect() as conn:
            result = conn.execute(text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'categories')"))
            tables_exist = result.scalar()
        
        if not tables_exist:
            print("数据库表不存在，开始初始化...")
            if not init_database(engine):
                print("❌ 数据库初始化失败，退出")
                return
        else:
            print("✓ 数据库表已存在")
            # 即使表已存在，也更新品类为中文
            update_categories_chinese(engine)
        
        # 2. 读取CSV文件
        print(f"\n步骤 2: 读取 CSV 文件: {csv_path}")
        if not os.path.exists(csv_path):
            print(f"❌ 错误: CSV文件不存在: {csv_path}")
            return
        
        rows = []
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
        
        print(f"✓ 读取到 {len(rows)} 条记录")
        
        # 3. 导入数据
        print(f"\n步骤 3: 开始导入数据...")
        companies_cache = {}
        cities_cache = set()
        imported_count = 0
        skipped_count = 0
        
        for idx, row in enumerate(rows, 1):
            if idx % 10 == 0:
                print(f"  处理进度: {idx}/{len(rows)}")
            
            # 处理品类
            category_name = row['category_name']
            # 先尝试用 display_name 查找（支持中文）
            category = session.query(Category).filter(Category.display_name == category_name).first()
            # 如果找不到，尝试用 name 字段查找（支持英文）
            if not category:
                category = session.query(Category).filter(Category.name == category_name).first()
            # 如果还是找不到，尝试用 ID 查找
            if not category:
                category_id_map = {
                    'Equipment': 'equipment',
                    'Raw Material': 'raw_material',
                    'Logic': 'logic',
                    'Memory': 'memory',
                    '设备': 'equipment',
                    '原材料': 'raw_material',
                    '逻辑芯片': 'logic',
                    '存储': 'memory',
                }
                category_id = category_id_map.get(category_name)
                if category_id:
                    category = session.query(Category).filter(Category.id == category_id).first()
            
            if not category:
                print(f"警告: 品类 '{category_name}' 不存在，跳过记录 {row.get('id', 'unknown')}")
                skipped_count += 1
                continue
            
            # 处理出口公司
            exporter_company_id = None
            if row['exporter_company']:
                exporter_id = generate_company_id(row['exporter_company'], row['exporter_country_code'])
                if exporter_id not in companies_cache:
                    company = session.query(Company).filter(Company.id == exporter_id).first()
                    if not company:
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
            
            # 处理进口公司
            importer_company_id = None
            if row['importer_company']:
                importer_id = generate_company_id(row['importer_company'], row['importer_country_code'])
                if importer_id not in companies_cache:
                    company = session.query(Company).filter(Company.id == importer_id).first()
                    if not company:
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
            
            # 处理国家位置
            for country_code, country_name in [
                (row['exporter_country_code'], row['exporter_country_name']),
                (row['importer_country_code'], row['importer_country_name'])
            ]:
                country_location = session.query(Location).filter(
                    Location.country_code == country_code,
                    Location.type == 'country'
                ).first()
                if not country_location:
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
            
            # 检查交易是否已存在
            existing_transaction = session.query(Transaction).filter(Transaction.id == row['id']).first()
            if existing_transaction:
                skipped_count += 1
                continue
            
            # 创建交易记录
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
            imported_count += 1
        
        # 提交所有更改
        session.commit()
        print(f"\n✓ 导入完成!")
        print(f"  - 成功导入: {imported_count} 条交易记录")
        print(f"  - 跳过: {skipped_count} 条（已存在）")
        print(f"  - 创建公司: {len(companies_cache)} 个")
        
    except Exception as e:
        session.rollback()
        print(f"❌ 导入失败: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        session.close()

if __name__ == "__main__":
    # 获取数据库连接字符串
    # 方式1: 从环境变量获取（Railway 会自动设置）
    database_url = os.getenv("DATABASE_URL")
    
    # 方式2: 从命令行参数获取
    if not database_url and len(sys.argv) > 1:
        database_url = sys.argv[1]
    
    # 方式3: 提示用户输入
    if not database_url:
        print("=" * 60)
        print("Railway 数据库导入工具")
        print("=" * 60)
        print("\n请提供数据库连接字符串")
        print("格式: postgresql://用户名:密码@主机:端口/数据库名")
        print("示例: postgresql://postgres:password@crossover.proxy.rlwy.net:42314/railway")
        print("\n你可以:")
        print("1. 设置环境变量: export DATABASE_URL='...'")
        print("2. 作为命令行参数: python import_railway.py 'postgresql://...'")
        print("3. 在 Railway Dashboard → PostgreSQL → Variables 中查看 DATABASE_URL")
        print()
        database_url = input("请输入 DATABASE_URL (或按 Ctrl+C 退出): ").strip()
    
    if not database_url:
        print("❌ 错误: 未提供数据库连接字符串")
        sys.exit(1)
    
    # 获取CSV文件路径
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    csv_path = os.getenv("CSV_PATH", str(project_root / "data" / "synthetic_data.csv"))
    
    # 如果提供了第二个参数，使用它作为CSV路径
    if len(sys.argv) > 2:
        csv_path = sys.argv[2]
    
    if not os.path.exists(csv_path):
        print(f"❌ 错误: CSV文件不存在: {csv_path}")
        print(f"当前工作目录: {os.getcwd()}")
        sys.exit(1)
    
    print(f"\n开始导入数据...")
    print(f"CSV文件: {csv_path}")
    import_data(csv_path, database_url)
    print("\n导入完成!")

