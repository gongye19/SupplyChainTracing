import json
import os
import shutil

def clean_country_monthly_data():
    """清理 country_monthly_industry_data 中 countryCode 为 N/A 的数据"""
    path = "/Users/han/Desktop/code/supplychain/data/country_monthly_industry_data/SemiConductor"
    backup_path = "/Users/han/Desktop/code/supplychain/data/country_monthly_industry_data/SemiConductor_backup"

    # 备份原数据
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
            for month, countries in data.items():
                before_count = len(countries)
                # 过滤掉 countryCode 为 N/A 的记录
                cleaned_countries = [c for c in countries if isinstance(c, dict) and c.get('countryCode') != 'N/A']
                after_count = len(cleaned_countries)

                total_before += before_count
                total_after += after_count
                total_na += before_count - after_count

                data[month] = cleaned_countries

            # 写回文件
            with open(filepath, 'w') as f:
                json.dump(data, f)

    print(f"\ncountry_monthly_industry_data 清理完成:")
    print(f"  清理前总记录数: {total_before}")
    print(f"  N/A 记录数: {total_na}")
    print(f"  清理后总记录数: {total_after}")
    print(f"  清理比例: {total_na/total_before*100:.2f}%")

def clean_country_of_origin():
    """清理 CountryOfOrigin 中值为 0.0 或 N/A 的数据"""
    path = "/Users/han/Desktop/code/supplychain/data/SemiConductor/CountryOfOrigin"
    backup_path = "/Users/han/Desktop/code/supplychain/data/SemiConductor/CountryOfOrigin_backup"

    # 备份原数据
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

            # 清理数据
            for origin, destinations in data.items():
                for dest, records in destinations.items():
                    before_count = len(records)

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

                    after_count = len(cleaned_records)
                    total_before += before_count
                    total_after += after_count
                    total_invalid += before_count - after_count

                    destinations[dest] = cleaned_records

            # 写回文件
            with open(filepath, 'w') as f:
                json.dump(data, f)

    print(f"\nCountryOfOrigin 清理完成:")
    print(f"  清理前总记录数: {total_before}")
    print(f"  无效记录数 (0.0或N/A): {total_invalid}")
    print(f"  清理后总记录数: {total_after}")
    print(f"  清理比例: {total_invalid/total_before*100:.2f}%")

if __name__ == "__main__":
    print("="*60)
    print("开始清理数据...")
    print("="*60)

    clean_country_monthly_data()
    clean_country_of_origin()

    print("\n" + "="*60)
    print("数据清理完成!")
    print("="*60)
