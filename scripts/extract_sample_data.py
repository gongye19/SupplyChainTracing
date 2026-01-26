#!/usr/bin/env python3
"""
从原始数据文件中提取前1000条数据，保存到指定位置
"""
import csv
import os
from pathlib import Path

def extract_sample_data(input_file: str, output_file: str, num_rows: int = 1000):
    """
    从输入文件中提取前N条数据（包括表头），保存到输出文件
    
    Args:
        input_file: 输入文件路径
        output_file: 输出文件路径
        num_rows: 要提取的行数（包括表头，所以实际数据是 num_rows - 1 条）
    """
    input_path = Path(input_file)
    output_path = Path(output_file)
    
    # 检查输入文件是否存在
    if not input_path.exists():
        print(f"错误：输入文件不存在: {input_file}")
        return False
    
    # 确保输出目录存在
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    try:
        with open(input_path, 'r', encoding='utf-8') as infile:
            reader = csv.reader(infile)
            
            # 读取表头
            header = next(reader)
            
            # 读取指定数量的数据行
            rows = [header]  # 先添加表头
            for i, row in enumerate(reader):
                if i >= num_rows - 1:  # num_rows - 1 因为已经包含了表头
                    break
                rows.append(row)
            
            # 写入输出文件
            with open(output_path, 'w', encoding='utf-8', newline='') as outfile:
                writer = csv.writer(outfile)
                writer.writerows(rows)
            
            actual_data_rows = len(rows) - 1  # 减去表头
            print(f"成功提取 {actual_data_rows} 条数据（共 {len(rows)} 行，包括表头）")
            print(f"输入文件: {input_file}")
            print(f"输出文件: {output_file}")
            return True
            
    except Exception as e:
        print(f"错误：处理文件时发生异常: {e}")
        return False

if __name__ == '__main__':
    # 设置文件路径
    input_file = '/Users/han/Desktop/code/supplychain/data/Factset_Extended_Shipment_Data.csv'
    output_file = '/Users/han/Desktop/code/supplychain/data/Factset_Extended_Shipment_Data_sample_1000.csv'
    num_rows = 1000
    
    print(f"开始提取前 {num_rows} 条数据...")
    success = extract_sample_data(input_file, output_file, num_rows)
    
    if success:
        print("完成！")
    else:
        print("失败！")
        exit(1)

