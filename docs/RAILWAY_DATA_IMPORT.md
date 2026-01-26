# Railway 大数据量导入指南

## 概述

本文档说明如何将大量数据导入到 Railway 的 PostgreSQL 数据库中，以及可能遇到的问题和解决方案。

## 当前导入方式

目前使用 `backend/scripts/import_processed_tables.py` 脚本逐行插入数据：

```python
for row in rows:
    conn.execute(text(sql), values)
    imported += 1
```

这种方式对于小数据量（< 10万条）可以正常工作，但对于大数据量会有以下问题：

## 大数据量导入的问题

### 1. **性能问题**
- **逐行插入速度慢**：每条记录都需要单独执行一次 SQL，网络往返次数多
- **事务开销大**：如果使用 `engine.begin()`，所有插入在一个大事务中，可能导致：
  - 内存占用高
  - 锁表时间长
  - 回滚困难

### 2. **超时问题**
- **连接超时**：Railway 可能有连接超时限制（通常 30-60 秒）
- **请求超时**：长时间运行的脚本可能被中断

### 3. **内存问题**
- **一次性加载所有数据**：`rows = list(reader)` 会将所有数据加载到内存
- **大数据文件**：如果 CSV 文件很大（> 1GB），可能导致内存不足

### 4. **Railway 限制**
- **免费/基础套餐**：可能有资源限制（CPU、内存、存储）
- **数据库大小限制**：Railway PostgreSQL 可能有存储限制

## 解决方案

### 方案 1: 批量插入（推荐）

使用 PostgreSQL 的 `COPY` 命令或批量插入：

```python
def import_table_batch(engine, table_name: str, csv_path: Path, batch_size: int = 1000):
    """批量插入数据"""
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        batch = []
        
        for row in reader:
            batch.append(row)
            
            if len(batch) >= batch_size:
                # 批量插入
                with engine.begin() as conn:
                    conn.execute(text(f"""
                        INSERT INTO {table_name} (...)
                        VALUES {','.join(['(...)' for _ in batch])}
                    """), batch)
                batch = []
        
        # 插入剩余数据
        if batch:
            with engine.begin() as conn:
                conn.execute(text(f"""
                    INSERT INTO {table_name} (...)
                    VALUES {','.join(['(...)' for _ in batch])}
                """), batch)
```

**优点**：
- 减少网络往返次数
- 提高插入速度（通常快 10-100 倍）
- 可以控制批次大小，避免内存问题

### 方案 2: 使用 COPY 命令（最快）

PostgreSQL 的 `COPY` 命令是最快的导入方式：

```python
def import_table_copy(engine, table_name: str, csv_path: Path):
    """使用 COPY 命令导入（最快）"""
    with engine.raw_connection() as conn:
        cursor = conn.cursor()
        
        # 使用 COPY FROM 命令
        with open(csv_path, 'r', encoding='utf-8') as f:
            # 跳过表头
            next(f)
            
            cursor.copy_from(
                f,
                table_name,
                sep=',',
                null='',
                columns=(...)
            )
        
        conn.commit()
```

**优点**：
- 速度最快（比逐行插入快 100-1000 倍）
- 内存占用低（流式处理）
- PostgreSQL 原生支持

**注意**：
- 需要处理 CSV 转义字符
- 需要确保列顺序匹配

### 方案 3: 分批处理 + 进度保存

对于超大数据量，可以分批处理并保存进度：

```python
def import_table_with_checkpoint(engine, table_name: str, csv_path: Path, 
                                  batch_size: int = 10000, checkpoint_file: str = None):
    """分批导入，支持断点续传"""
    start_row = 0
    
    # 读取上次进度
    if checkpoint_file and Path(checkpoint_file).exists():
        with open(checkpoint_file, 'r') as f:
            start_row = int(f.read().strip())
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        # 跳过已处理的行
        for _ in range(start_row):
            next(reader, None)
        
        batch = []
        current_row = start_row
        
        for row in reader:
            batch.append(row)
            current_row += 1
            
            if len(batch) >= batch_size:
                # 批量插入
                with engine.begin() as conn:
                    # ... 插入逻辑 ...
                    pass
                
                # 保存进度
                if checkpoint_file:
                    with open(checkpoint_file, 'w') as f:
                        f.write(str(current_row))
                
                batch = []
                print(f"已处理 {current_row} 行...")
```

### 方案 4: 使用 psql 命令行工具

对于非常大的文件，可以直接使用 `psql` 的 `\COPY` 命令：

```bash
# 连接到 Railway 数据库
psql $DATABASE_URL

# 使用 COPY 命令导入
\COPY shipments_raw FROM '/path/to/shipments_raw.csv' WITH (FORMAT csv, HEADER true);
```

**优点**：
- 不需要 Python 脚本
- 速度最快
- 可以处理任意大小的文件

## Railway 特定建议

### 1. **使用 Railway CLI**

```bash
# 安装 Railway CLI
npm i -g @railway/cli

# 登录
railway login

# 连接到数据库
railway connect postgres
```

### 2. **环境变量**

确保在 Railway 项目设置中配置了正确的数据库连接：

```bash
DATABASE_URL=postgresql://user:password@host:port/dbname
```

### 3. **资源监控**

- 监控数据库大小：Railway 仪表板会显示数据库使用情况
- 监控内存使用：大数据导入时注意内存占用
- 设置超时：Railway 可能有执行时间限制

### 4. **分批导入**

如果数据量非常大（> 100万条），建议：

1. **分文件导入**：将大文件拆分成多个小文件（如每个 10 万条）
2. **分批执行**：每次导入一个文件，避免一次性导入所有数据
3. **监控进度**：使用进度保存机制，支持断点续传

## 实际导入步骤

### 步骤 1: 预处理数据

```bash
# 运行预处理脚本
cd backend
python scripts/preprocess_tables.py \
    data/Factset_Extended_Shipment_Data.csv \
    processed_tables/
```

### 步骤 2: 优化导入脚本

修改 `import_processed_tables.py`，使用批量插入：

```python
# 将逐行插入改为批量插入
batch_size = 1000
batch = []

for row in rows:
    batch.append(row)
    if len(batch) >= batch_size:
        # 批量插入
        bulk_insert(engine, table_name, batch)
        batch = []
```

### 步骤 3: 执行导入

```bash
# 本地测试
python backend/scripts/import_processed_tables.py

# 或直接在 Railway 环境中运行
railway run python backend/scripts/import_processed_tables.py
```

### 步骤 4: 验证数据

```python
# 检查导入的记录数
SELECT COUNT(*) FROM shipments_raw;
```

## 性能对比

| 方法 | 10万条 | 100万条 | 1000万条 |
|------|--------|---------|----------|
| 逐行插入 | ~10分钟 | ~100分钟 | 不可行 |
| 批量插入(1000) | ~1分钟 | ~10分钟 | ~100分钟 |
| COPY 命令 | ~10秒 | ~1分钟 | ~10分钟 |

## 常见问题

### Q: 导入时出现超时错误？

**A**: 
- 减小批次大小
- 增加超时时间设置
- 使用 COPY 命令（更快）

### Q: 内存不足？

**A**:
- 不要一次性加载所有数据：使用流式处理
- 减小批次大小
- 使用 COPY 命令（内存占用低）

### Q: 导入后查询很慢？

**A**:
- 创建索引：`CREATE INDEX idx_date ON shipments_raw(date);`
- 分析表：`ANALYZE shipments_raw;`
- 考虑分区表（如果数据量非常大）

### Q: Railway 数据库大小限制？

**A**:
- 免费套餐：通常有 1GB 限制
- 付费套餐：根据套餐不同，可能有更大限制
- 建议：定期清理旧数据，或使用数据归档

## 最佳实践

1. **测试小数据集**：先用小数据集（如 1000 条）测试导入流程
2. **监控性能**：导入时监控数据库 CPU、内存使用
3. **创建索引**：导入完成后创建必要的索引
4. **备份数据**：导入前备份数据库
5. **分批导入**：大数据量时分成多个批次导入
6. **验证数据**：导入后验证数据完整性和正确性

## 总结

对于大数据量导入 Railway：

- **< 10万条**：当前逐行插入方式可以接受
- **10万 - 100万条**：建议使用批量插入（批次大小 1000-10000）
- **> 100万条**：强烈建议使用 COPY 命令或分批导入

导入后通常不会出现问题，但需要注意：
- 数据库大小限制
- 查询性能（需要创建索引）
- 内存和 CPU 使用

