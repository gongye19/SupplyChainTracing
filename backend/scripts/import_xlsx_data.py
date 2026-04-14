#!/usr/bin/env python3
"""
从 data/pure_country_pair_usd_count/ 导入 XLSX 数据到 country_origin_trade_stats 表。
用法:
  python import_xlsx_data.py          # 增量导入
  python import_xlsx_data.py --clear  # 先清库再导入
"""

import re
import sys
import os
from pathlib import Path
from datetime import datetime

import openpyxl
import pycountry
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    os.getenv(
        "DATABASE_PUBLIC_URL",
        "postgresql://postgres:123456@localhost:5433/supplychain",
    ),
)

BATCH_SIZE = 3000

# ── 国家名称清洗 ──────────────────────────────────────────────

COUNTRY_NAME_MAP: dict[str, str | None] = {
    "SOUTH KOREA": "KOR",
    "TAIWAN": "TWN",
    "NEW TAIWAN": "TWN",
    "BURMA": "MMR",
    "FORMER REP. OF BIRMAN": "MMR",
    "HOLANDA": "NLD",
    "HRVATSKA": "HRV",
    "SLOVAK REP.": "SVK",
    "DEMOCRATIC PEOPLES REP.": "PRK",
    "U S": "USA",
    "PANAMA": "PAN",
    "KEELING": "CCK",
    "DO SUL": "KOR",
    "SP": "ESP",
    "REPUBLIC": None,
    "REP.": None,
    "IN EUROPE": None,
    "ATTENZA ELECTRONICS": None,
    "ZZZ": None,
}

_CODE_RE = re.compile(r"\(([A-Z]{2,3})\)")

ISO2_TO_ISO3_MANUAL: dict[str, str] = {
    "UK": "GBR",
    "EL": "GRC",
}


def _to_iso3(code: str) -> str | None:
    code = (code or "").strip().upper()
    if not code:
        return None
    if len(code) == 3:
        return code
    if len(code) == 2:
        if code in ISO2_TO_ISO3_MANUAL:
            return ISO2_TO_ISO3_MANUAL[code]
        country = pycountry.countries.get(alpha_2=code)
        return country.alpha_3 if country else None
    return None


def _clean_country(raw: str) -> str | None:
    """从 XLSX 的进口国/出口国列提取 ISO3 代码。"""
    if not raw:
        return None
    raw = raw.strip()
    m = _CODE_RE.search(raw)
    if m:
        iso3 = _to_iso3(m.group(1))
        if iso3:
            return iso3
    up = raw.upper()
    if up in COUNTRY_NAME_MAP:
        return COUNTRY_NAME_MAP[up]
    if re.fullmatch(r"[A-Z]{2,3}", raw):
        iso3 = _to_iso3(raw)
        if iso3:
            return iso3
    print(f"  ⚠ unknown country: {raw!r}")
    return None


# ── DDL ───────────────────────────────────────────────────────

_DDL = """
CREATE TABLE IF NOT EXISTS country_origin_trade_stats (
    hs_code                 VARCHAR(6)  NOT NULL,
    year                    INTEGER     NOT NULL,
    month                   INTEGER     NOT NULL,
    origin_country_code     VARCHAR(3)  NOT NULL,
    destination_country_code VARCHAR(3) NOT NULL,
    sum_of_usd              NUMERIC(20,2),
    trade_count             INTEGER,
    product_desc_zh         TEXT,
    product_desc_en         TEXT,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_pair UNIQUE (hs_code, year, month, origin_country_code, destination_country_code)
);
CREATE INDEX IF NOT EXISTS idx_cots_hs     ON country_origin_trade_stats(hs_code);
CREATE INDEX IF NOT EXISTS idx_cots_ym     ON country_origin_trade_stats(year, month);
CREATE INDEX IF NOT EXISTS idx_cots_origin ON country_origin_trade_stats(origin_country_code);
CREATE INDEX IF NOT EXISTS idx_cots_dest   ON country_origin_trade_stats(destination_country_code);
CREATE INDEX IF NOT EXISTS idx_cots_hs_ym  ON country_origin_trade_stats(hs_code, year, month);
"""


def create_tables(engine):
    with engine.begin() as conn:
        conn.execute(text(_DDL))
    print("✓ 表创建完成")


def clean_database(engine):
    with engine.begin() as conn:
        for t in ["country_origin_trade_stats", "country_monthly_trade_stats"]:
            conn.execute(text(f'DROP TABLE IF EXISTS "{t}" CASCADE'))
    print("✓ 旧表已清理")


# ── 导入逻辑 ──────────────────────────────────────────────────

_INSERT_COLS = [
    "hs_code", "year", "month",
    "origin_country_code", "destination_country_code",
    "sum_of_usd", "trade_count",
    "product_desc_zh", "product_desc_en",
]
_KEY_COLS = {"hs_code", "year", "month", "origin_country_code", "destination_country_code"}


def _batch_upsert(engine, batch: list[dict]):
    if not batch:
        return
    update_cols = [c for c in _INSERT_COLS if c not in _KEY_COLS]
    set_clause = ", ".join(f"{c} = EXCLUDED.{c}" for c in update_cols)
    all_params: dict = {}
    values_clauses: list[str] = []
    for i, rec in enumerate(batch):
        ph = ", ".join(f":{c}_{i}" for c in _INSERT_COLS)
        values_clauses.append(f"({ph})")
        for c in _INSERT_COLS:
            all_params[f"{c}_{i}"] = rec.get(c)

    cols_str = ", ".join(_INSERT_COLS)
    sql = text(f"""
        INSERT INTO country_origin_trade_stats ({cols_str})
        VALUES {', '.join(values_clauses)}
        ON CONFLICT (hs_code, year, month, origin_country_code, destination_country_code)
        DO UPDATE SET {set_clause}, updated_at = CURRENT_TIMESTAMP
    """)
    with engine.begin() as conn:
        conn.execute(sql, all_params)


def import_xlsx(engine, data_dir: Path):
    xlsx_files = sorted(data_dir.glob("*.xlsx"))
    if not xlsx_files:
        print(f"❌ 未找到 XLSX 文件: {data_dir}")
        return 0

    print(f"找到 {len(xlsx_files)} 个文件\n")
    total = 0
    skipped = 0

    for fpath in xlsx_files:
        print(f"处理 {fpath.name} ...", end=" ", flush=True)
        t0 = datetime.now()
        wb = openpyxl.load_workbook(fpath, read_only=True)
        ws = wb.active

        batch: list[dict] = []
        count = 0
        skip = 0

        for row in ws.iter_rows(min_row=2, values_only=True):
            hs_code_raw, month_raw, desc_zh, desc_en, imp_raw, exp_raw, usd, cnt = row[:8]

            month_str = str(int(month_raw))
            year = int(month_str[:4])
            month = int(month_str[4:6])

            origin = _clean_country(str(exp_raw)) if exp_raw else None
            dest = _clean_country(str(imp_raw)) if imp_raw else None
            if not origin or not dest:
                skip += 1
                continue

            batch.append({
                "hs_code": str(int(hs_code_raw)),
                "year": year,
                "month": month,
                "origin_country_code": origin,
                "destination_country_code": dest,
                "sum_of_usd": float(usd) if usd else 0,
                "trade_count": int(cnt) if cnt else 0,
                "product_desc_zh": str(desc_zh) if desc_zh else None,
                "product_desc_en": str(desc_en) if desc_en else None,
            })
            count += 1

            if len(batch) >= BATCH_SIZE:
                _batch_upsert(engine, batch)
                batch = []

        if batch:
            _batch_upsert(engine, batch)

        wb.close()
        elapsed = (datetime.now() - t0).total_seconds()
        print(f"✓ {count} 条 ({skip} 跳过) [{elapsed:.1f}s]")
        total += count
        skipped += skip

    print(f"\n总计: {total} 条导入, {skipped} 条跳过\n")
    return total


def main():
    clear = "--clear" in sys.argv
    print("=" * 60)
    print("导入 XLSX 数据到 country_origin_trade_stats")
    print("=" * 60)
    if clear:
        print("模式: 全量重建\n")

    data_dir = Path(__file__).parent.parent.parent / "data" / "pure_country_pair_usd_count"
    if not data_dir.exists():
        print(f"❌ 数据目录不存在: {data_dir}")
        sys.exit(1)

    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("✓ 数据库连接成功\n")
    except Exception as e:
        print(f"❌ 数据库连接失败: {e}")
        sys.exit(1)

    if clear:
        clean_database(engine)

    create_tables(engine)

    t0 = datetime.now()
    total = import_xlsx(engine, data_dir)
    elapsed = (datetime.now() - t0).total_seconds()

    print("=" * 60)
    print("导入完成！")
    print("=" * 60)
    print(f"总记录: {total:,}")
    print(f"耗时: {elapsed:.1f}s")

    with engine.connect() as conn:
        r = conn.execute(text("SELECT COUNT(*) FROM country_origin_trade_stats"))
        print(f"数据库当前: {r.scalar():,} 条记录")


if __name__ == "__main__":
    main()
