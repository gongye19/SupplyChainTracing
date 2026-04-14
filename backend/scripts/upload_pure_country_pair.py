#!/usr/bin/env python3
"""
独立上传脚本：
data/pure_country_pair_usd_count/*.xlsx -> country_origin_trade_stats

说明：
- 默认使用脚本内明文 Railway 连接串
- 也可被 DATABASE_URL / DATABASE_PUBLIC_URL 覆盖
"""

import os
import sys
from datetime import datetime
from pathlib import Path

from sqlalchemy import create_engine, text

from import_xlsx_data import create_tables, clean_database, import_xlsx


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    os.getenv(
        "DATABASE_PUBLIC_URL",
        "postgresql://postgres:MWXAjkGpQgosJuCgIPcRdudhiyAiXCRl@crossover.proxy.rlwy.net:42314/railway",
    ),
)


def main() -> None:
    clear_first = "--clear" in sys.argv

    print("=" * 60)
    print("上传 pure_country_pair_usd_count 数据到 Railway")
    print("=" * 60)
    print("模式:", "全量重建 (--clear)" if clear_first else "增量导入 (upsert)")
    print()

    project_root = Path(__file__).resolve().parents[2]
    data_dir = project_root / "data" / "pure_country_pair_usd_count"
    if not data_dir.exists():
        print(f"❌ 数据目录不存在: {data_dir}")
        sys.exit(1)

    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("✓ 数据库连接成功")
    except Exception as exc:
        print(f"❌ 数据库连接失败: {exc}")
        sys.exit(1)

    if clear_first:
        clean_database(engine)
    create_tables(engine)

    start = datetime.now()
    total = import_xlsx(engine, data_dir)
    elapsed = (datetime.now() - start).total_seconds()

    print("\n" + "=" * 60)
    print("上传完成")
    print("=" * 60)
    print(f"导入记录: {total:,}")
    print(f"耗时: {elapsed:.1f}s")

    with engine.connect() as conn:
        count = conn.execute(text("SELECT COUNT(*) FROM country_origin_trade_stats")).scalar()
    print(f"数据库记录数: {count:,}")


if __name__ == "__main__":
    main()

