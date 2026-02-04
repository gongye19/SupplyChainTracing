import json
import os
import shutil

def format_json_file(filepath):
    """格式化 JSON 文件"""
    with open(filepath, 'r') as f:
        data = json.load(f)

    with open(filepath, 'w') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

def clean_and_format_country_of_origin():
    """清理并格式化 CountryOfOrigin 数据"""
    path = "/Users/han/Desktop/code/supplychain/data/SemiConductor/CountryOfOrigin"
    backup_path = "/Users/han/Desktop/code/supplychain/data/SemiConductor/CountryOfOrigin_backup"

    # 备份原数据（如果还没有备份）
    if not os.path.exists(backup_path):
        shutil.copytree(path, backup_path)
        print(f"已备份到: {backup_path}")

    total_before = 0
    total_after = 0
    total_invalid = 0

    for file in sorted(os.listdir(path)):
        if file.endswith('.json'):
            filepath = os.path.join(path, file)
            with open(filepath, 'r') as f:
                data = json.load(f)

            # 清理数据并移除空的键
            cleaned_data = {}
            for origin, destinations in data.items():
                cleaned_destinations = {}
                for dest, records in destinations.items():
                    # 过滤掉包含 0.0 或 "N/A" 的记录
                    cleaned_records = []
                    for record in records:
                        has_invalid = False
                        for key, val in record.items():
                            if val == 0.0 or val == "N/A":
                                has_invalid = True
                                break
                        if not has_invalid:
                            cleaned_records.append(record)

                    total_before += len(records)
                    total_after += len(cleaned_records)
                    total_invalid += len(records) - len(cleaned_records)

                    # 只保留有记录的目的国
                    if cleaned_records:
                        cleaned_destinations[dest] = cleaned_records

                # 只保留有数据的目的国
                if cleaned_destinations:
                    cleaned_data[origin] = cleaned_destinations

            # 写回文件（格式化）
            with open(filepath, 'w') as f:
                json.dump(cleaned_data, f, indent=4, ensure_ascii=False)

    print(f"\nCountryOfOrigin 清理并格式化完成:")
    print(f"  清理前总记录数: {total_before}")
    print(f"  无效记录数 (0.0或N/A): {total_invalid}")
    print(f"  清理后总记录数: {total_after}")
    print(f"  清理比例: {total_invalid/total_before*100:.2f}%")

def clean_and_format_country_monthly():
    """清理并格式化 country_monthly_industry_data 数据"""
    path = "/Users/han/Desktop/code/supplychain/data/country_monthly_industry_data/SemiConductor"
    backup_path = "/Users/han/Desktop/code/supplychain/data/country_monthly_industry_data/SemiConductor_backup"

    # 备份原数据（如果还没有备份）
    if not os.path.exists(backup_path):
        shutil.copytree(path, backup_path)
        print(f"已备份到: {backup_path}")

    total_before = 0
    total_after = 0
    total_na = 0

    for file in sorted(os.listdir(path)):
        if file.endswith('.json'):
            filepath = os.path.join(path, file)
            with open(filepath, 'r') as f:
                data = json.load(f)

            # 清理数据
            cleaned_data = {}
            for month, countries in data.items():
                # 过滤掉 countryCode 为 N/A 的记录
                cleaned_countries = [c for c in countries if isinstance(c, dict) and c.get('countryCode') != 'N/A']

                total_before += len(countries)
                total_after += len(cleaned_countries)
                total_na += len(countries) - len(cleaned_countries)

                cleaned_data[month] = cleaned_countries

            # 写回文件（格式化）
            with open(filepath, 'w') as f:
                json.dump(cleaned_data, f, indent=4, ensure_ascii=False)

    print(f"\ncountry_monthly_industry_data 清理并格式化完成:")
    print(f"  清理前总记录数: {total_before}")
    print(f"  N/A 记录数: {total_na}")
    print(f"  清理后总记录数: {total_after}")
    print(f"  清理比例: {total_na/total_before*100:.2f}%")

if __name__ == "__main__":
    print("="*60)
    print("开始清理并格式化数据...")
    print("="*60)

    clean_and_format_country_monthly()
    clean_and_format_country_of_origin()

    print("\n" + "="*60)
    print("数据清理和格式化完成!")
    print("="*60)
