#!/usr/bin/env python3
"""
Company-level data upload script.

Source:
  data/hkust_文件汇总/*.xlsx -> company_trade_flows (company counterparty monthly aggregates)
  company_trade_flows -> country_origin_trade_stats

Usage:
  python scripts/upload_company_trade_flows.py --clear
  python scripts/upload_company_trade_flows.py
"""

from __future__ import annotations

import csv
import io
import os
import re
import sys
import tempfile
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

import openpyxl
import pycountry
from sqlalchemy import create_engine, text


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    os.getenv(
        "DATABASE_PUBLIC_URL",
        "postgresql://postgres:HcVbYOkDrgXNZPaUpttdATshXWFJWWQe@tramway.proxy.rlwy.net:11626/railway",
    ),
)

EXPECTED_HEADERS = [
    "海关编码",
    "中文产品描述",
    "英文产品描述",
    "月度",
    "进口商",
    "进口商所在国家",
    "出口商",
    "出口商所在国家",
    "原产国",
    "数量",
    "数量单位",
    "金额美元",
    "公吨",
    "交易次数",
]

COMPANY_PLACEHOLDERS = {"", "N A", "NA", "N/A", "N.A.", "NULL", "NONE", "UNKNOWN", "NOT REGISTERED", "-", "--"}
COUNTRY_CODE_RE = re.compile(r"\(([A-Z]{2,3})\)")

ISO2_TO_ISO3_MANUAL = {
    "UK": "GBR",
    "EL": "GRC",
}

COUNTRY_NAME_TO_ISO3 = {
    "HONG KONG,CHINA": "HKG",
    "TAIWAN,CHINA": "TWN",
    "SOUTH KOREA": "KOR",
    "RUSSIA": "RUS",
    "VIETNAM": "VNM",
    "MACAU": "MAC",
    "MACAO": "MAC",
    "S. AFRICA": "ZAF",
    "MYANMA (FORMER REP. OF BIRMAN)": "MMR",
    "ST.PIERRE AND MIQUELON (SP)": "SPM",
}

COMPANY_FLOW_DDL = """
CREATE TABLE IF NOT EXISTS company_trade_flows (
    hs_code VARCHAR(6) NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    importer_name TEXT,
    importer_country_code VARCHAR(3) NOT NULL,
    exporter_name TEXT,
    exporter_country_code VARCHAR(3),
    origin_country_code VARCHAR(3),
    export_side_country_code VARCHAR(3) NOT NULL,
    amount_usd NUMERIC(24,2),
    metric_tons NUMERIC(24,6),
    trade_count INTEGER NOT NULL DEFAULT 0,
    product_desc_zh TEXT,
    product_desc_en TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""

COMPANY_INDEX_DDL = """
CREATE INDEX IF NOT EXISTS idx_ctf_hs_ym ON company_trade_flows(hs_code, year, month);
CREATE INDEX IF NOT EXISTS idx_ctf_importer ON company_trade_flows(importer_name);
CREATE INDEX IF NOT EXISTS idx_ctf_exporter ON company_trade_flows(exporter_name);
CREATE INDEX IF NOT EXISTS idx_ctf_importer_ym ON company_trade_flows(importer_name, year, month);
CREATE INDEX IF NOT EXISTS idx_ctf_exporter_ym ON company_trade_flows(exporter_name, year, month);
"""

COUNTRY_STATS_DDL = """
CREATE TABLE IF NOT EXISTS country_origin_trade_stats (
    hs_code                  VARCHAR(6)  NOT NULL,
    year                     INTEGER     NOT NULL,
    month                    INTEGER     NOT NULL,
    origin_country_code      VARCHAR(3)  NOT NULL,
    destination_country_code VARCHAR(3)  NOT NULL,
    sum_of_usd               NUMERIC(20,2),
    trade_count              INTEGER,
    product_desc_zh          TEXT,
    product_desc_en          TEXT,
    created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_pair UNIQUE (hs_code, year, month, origin_country_code, destination_country_code)
);
CREATE INDEX IF NOT EXISTS idx_cots_hs ON country_origin_trade_stats(hs_code);
CREATE INDEX IF NOT EXISTS idx_cots_ym ON country_origin_trade_stats(year, month);
CREATE INDEX IF NOT EXISTS idx_cots_origin ON country_origin_trade_stats(origin_country_code);
CREATE INDEX IF NOT EXISTS idx_cots_dest ON country_origin_trade_stats(destination_country_code);
CREATE INDEX IF NOT EXISTS idx_cots_hs_ym ON country_origin_trade_stats(hs_code, year, month);
CREATE INDEX IF NOT EXISTS idx_cots_dest_ym ON country_origin_trade_stats(destination_country_code, year, month);
CREATE INDEX IF NOT EXISTS idx_cots_origin_ym ON country_origin_trade_stats(origin_country_code, year, month);
"""

COPY_COLUMNS = [
    "hs_code",
    "year",
    "month",
    "importer_name",
    "importer_country_code",
    "exporter_name",
    "exporter_country_code",
    "origin_country_code",
    "export_side_country_code",
    "amount_usd",
    "metric_tons",
    "trade_count",
    "product_desc_zh",
    "product_desc_en",
]

COPY_BATCH_ROWS = 20_000
DB_CONNECT_ARGS = {
    "connect_timeout": 20,
    "keepalives": 1,
    "keepalives_idle": 30,
    "keepalives_interval": 10,
    "keepalives_count": 3,
    "options": "-c statement_timeout=180000",
}


def to_iso3(code: str) -> str | None:
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


def clean_country(raw: object) -> str | None:
    if raw is None:
        return None
    value = str(raw).strip()
    if not value:
        return None
    match = COUNTRY_CODE_RE.search(value)
    if match:
        iso3 = to_iso3(match.group(1))
        if iso3:
            return iso3
    upper = value.upper()
    if upper in COUNTRY_NAME_TO_ISO3:
        return COUNTRY_NAME_TO_ISO3[upper]
    return None


def clean_company(raw: object) -> str | None:
    if raw is None:
        return None
    value = re.sub(r"\s+", " ", str(raw)).strip()
    if value.upper() in COMPANY_PLACEHOLDERS:
        return None
    return value or None


def parse_decimal(raw: object) -> str | None:
    if raw is None or str(raw).strip() == "":
        return None
    try:
        return str(Decimal(str(raw).replace(",", "").strip()))
    except InvalidOperation:
        return None


def parse_decimal_value(raw: object) -> Decimal:
    value = parse_decimal(raw)
    return Decimal(value) if value is not None else Decimal("0")


def parse_int(raw: object, default: int = 0) -> int:
    if raw is None or str(raw).strip() == "":
        return default
    try:
        return int(Decimal(str(raw).replace(",", "").strip()))
    except InvalidOperation:
        return default


def parse_month(raw: object) -> tuple[int, int] | None:
    if raw is None:
        return None
    value = str(raw).strip()
    if re.fullmatch(r"\d+(\.0+)?", value):
        value = str(int(float(value)))
    if not re.fullmatch(r"\d{6}", value):
        return None
    year = int(value[:4])
    month = int(value[4:6])
    if month < 1 or month > 12:
        return None
    return year, month


def create_tables(engine, clear_first: bool) -> None:
    with engine.begin() as conn:
        if clear_first:
            conn.execute(text("DROP TABLE IF EXISTS company_trade_flows CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS country_origin_trade_stats CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS country_monthly_trade_stats CASCADE"))
        conn.execute(text(COMPANY_FLOW_DDL))
        conn.execute(text(COUNTRY_STATS_DDL))


def create_company_indexes(engine) -> None:
    with engine.begin() as conn:
        conn.execute(text(COMPANY_INDEX_DDL))


def iter_trade_files(data_dir: Path) -> list[Path]:
    return [
        path
        for path in sorted(data_dir.glob("*.xlsx"))
        if path.name != "国家对照表.xlsx" and not path.name.startswith("~$")
    ]


def build_csv(data_dir: Path, csv_path: Path) -> dict[str, int]:
    stats = {
        "rows_seen": 0,
        "rows_accepted": 0,
        "rows_written": 0,
        "rows_skipped": 0,
        "collapsed_rows": 0,
        "bad_header_sheets": 0,
        "bad_month_rows": 0,
        "bad_country_rows": 0,
    }
    aggregates: dict[tuple, dict[str, object]] = {}
    files = iter_trade_files(data_dir)
    print(f"找到 {len(files)} 个贸易文件")

    for file_path in files:
        print(f"处理 {file_path.name} ...", flush=True)
        wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
        for ws in wb.worksheets:
            headers = [ws.cell(1, col).value for col in range(1, ws.max_column + 1)]
            if headers[: len(EXPECTED_HEADERS)] != EXPECTED_HEADERS:
                stats["bad_header_sheets"] += 1
                print(f"  跳过 {ws.title}: 表头不匹配")
                continue

            sheet_accepted = 0
            sheet_skipped = 0
            for row in ws.iter_rows(min_row=2, values_only=True):
                if not any(value is not None and str(value).strip() for value in row):
                    continue
                stats["rows_seen"] += 1

                raw = list(row[: len(EXPECTED_HEADERS)])
                if len(raw) < len(EXPECTED_HEADERS):
                    raw.extend([None] * (len(EXPECTED_HEADERS) - len(raw)))

                month_pair = parse_month(raw[3])
                importer_country = clean_country(raw[5])
                exporter_country = clean_country(raw[7])
                origin_country = clean_country(raw[8])
                export_side_country = exporter_country or origin_country

                if not month_pair:
                    stats["bad_month_rows"] += 1
                    stats["rows_skipped"] += 1
                    sheet_skipped += 1
                    continue
                if not importer_country or not export_side_country:
                    stats["bad_country_rows"] += 1
                    stats["rows_skipped"] += 1
                    sheet_skipped += 1
                    continue

                year, month = month_pair
                hs_code = str(raw[0]).strip()
                if re.fullmatch(r"\d+(\.0+)?", hs_code):
                    hs_code = str(int(float(hs_code)))

                importer_name = clean_company(raw[4])
                exporter_name = clean_company(raw[6])
                key = (
                    hs_code,
                    year,
                    month,
                    importer_name,
                    importer_country,
                    exporter_name,
                    exporter_country,
                    origin_country,
                    export_side_country,
                )
                current = aggregates.get(key)
                if current is None:
                    current = {
                        "amount_usd": Decimal("0"),
                        "metric_tons": Decimal("0"),
                        "trade_count": 0,
                        "product_desc_zh": None if raw[1] is None else str(raw[1]).strip() or None,
                        "product_desc_en": None if raw[2] is None else str(raw[2]).strip() or None,
                    }
                    aggregates[key] = current

                current["amount_usd"] = current["amount_usd"] + parse_decimal_value(raw[11])
                current["metric_tons"] = current["metric_tons"] + parse_decimal_value(raw[12])
                current["trade_count"] = int(current["trade_count"]) + parse_int(raw[13])
                if not current["product_desc_zh"] and raw[1] is not None:
                    current["product_desc_zh"] = str(raw[1]).strip() or None
                if not current["product_desc_en"] and raw[2] is not None:
                    current["product_desc_en"] = str(raw[2]).strip() or None

                stats["rows_accepted"] += 1
                sheet_accepted += 1
            print(f"  {ws.title}: 接受 {sheet_accepted:,}，跳过 {sheet_skipped:,}")
        wb.close()

    with csv_path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        for key, aggregate in aggregates.items():
            record = [
                *key,
                aggregate["amount_usd"],
                aggregate["metric_tons"],
                aggregate["trade_count"],
                aggregate["product_desc_zh"],
                aggregate["product_desc_en"],
            ]
            writer.writerow(record)

    stats["rows_written"] = len(aggregates)
    stats["collapsed_rows"] = stats["rows_accepted"] - stats["rows_written"]
    return stats


def copy_company_flows(engine, csv_path: Path) -> None:
    cols = ", ".join(COPY_COLUMNS)
    copy_sql = f"COPY company_trade_flows ({cols}) FROM STDIN WITH (FORMAT CSV)"
    total = 0
    batch_no = 0

    def flush(rows: list[list[str]]) -> None:
        nonlocal total, batch_no
        if not rows:
            return

        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerows(rows)
        buffer.seek(0)

        raw = engine.raw_connection()
        try:
            with raw.cursor() as cur:
                cur.copy_expert(copy_sql, buffer)
            raw.commit()
        finally:
            raw.close()

        batch_no += 1
        total += len(rows)
        print(f"  COPY batch {batch_no}: {len(rows):,} rows, total {total:,}", flush=True)

    with csv_path.open("r", newline="", encoding="utf-8") as fh:
        reader = csv.reader(fh)
        batch: list[list[str]] = []
        for row in reader:
            batch.append(row)
            if len(batch) >= COPY_BATCH_ROWS:
                flush(batch)
                batch = []
        flush(batch)


def refresh_country_stats(engine) -> None:
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE country_origin_trade_stats"))
        conn.execute(
            text(
                """
                INSERT INTO country_origin_trade_stats (
                    hs_code, year, month,
                    origin_country_code, destination_country_code,
                    sum_of_usd, trade_count, product_desc_zh, product_desc_en
                )
                SELECT
                    hs_code,
                    year,
                    month,
                    export_side_country_code AS origin_country_code,
                    importer_country_code AS destination_country_code,
                    COALESCE(SUM(amount_usd), 0)::numeric(20,2) AS sum_of_usd,
                    COALESCE(SUM(trade_count), 0)::integer AS trade_count,
                    MAX(product_desc_zh) AS product_desc_zh,
                    MAX(product_desc_en) AS product_desc_en
                FROM company_trade_flows
                GROUP BY hs_code, year, month, export_side_country_code, importer_country_code
                """
            )
        )


def main() -> None:
    clear_first = "--clear" in sys.argv
    project_root = Path(__file__).resolve().parents[1]
    data_dir = project_root / "data" / "hkust_文件汇总"

    print("=" * 72)
    print("上传 hkust_文件汇总 公司级数据到数据库")
    print("=" * 72)
    print("模式:", "全量重建 (--clear)" if clear_first else "追加导入")
    print("数据目录:", data_dir)

    if not data_dir.exists():
        print(f"❌ 数据目录不存在: {data_dir}")
        sys.exit(1)

    engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args=DB_CONNECT_ARGS)
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("✓ 数据库连接成功")
    except Exception as exc:
        print(f"❌ 数据库连接失败: {exc}")
        sys.exit(1)

    start = datetime.now()
    create_tables(engine, clear_first=clear_first)

    with tempfile.TemporaryDirectory(prefix="company_flows_") as tmp:
        csv_path = Path(tmp) / "company_trade_flows.csv"
        stats = build_csv(data_dir, csv_path)
        print("CSV 生成完成:", stats)
        print("开始 COPY 导入 company_trade_flows ...")
        copy_company_flows(engine, csv_path)

    print("刷新 country_origin_trade_stats 聚合表 ...")
    refresh_country_stats(engine)
    print("创建 company_trade_flows 查询索引 ...")
    create_company_indexes(engine)

    elapsed = (datetime.now() - start).total_seconds()
    with engine.connect() as conn:
        company_count = conn.execute(text("SELECT COUNT(*) FROM company_trade_flows")).scalar()
        country_count = conn.execute(text("SELECT COUNT(*) FROM country_origin_trade_stats")).scalar()
        months = conn.execute(
            text(
                """
                SELECT MIN(year * 100 + month), MAX(year * 100 + month)
                FROM company_trade_flows
                """
            )
        ).fetchone()

    print("\n" + "=" * 72)
    print("上传完成")
    print("=" * 72)
    print(f"公司级记录数: {company_count:,}")
    print(f"国家聚合记录数: {country_count:,}")
    print(f"月份范围: {months[0]} ~ {months[1]}")
    print(f"耗时: {elapsed:.1f}s")


if __name__ == "__main__":
    main()
