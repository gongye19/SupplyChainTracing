#!/usr/bin/env python3
"""
Upload HKUST company-level trade data as compact dashboard aggregates.

Source:
  data/hkust_文件汇总/*.xlsx

Targets:
  company_search_stats
  company_monthly_trade_stats
  company_hs_trade_stats
  company_counterparty_trade_stats
  country_origin_trade_stats

Usage:
  python scripts/upload_company_trade_flows.py --clear
"""

from __future__ import annotations

import csv
import io
import argparse
import os
import re
import sys
import tempfile
from collections import defaultdict
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

import openpyxl
import pycountry
from sqlalchemy import create_engine, text

from importers.schema import TABLE_COLUMNS, create_indexes, create_tables, drop_tables, swap_staging_tables


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    os.getenv(
        "DATABASE_PUBLIC_URL",
        "postgresql://postgres:HcVbYOkDrgXNZPaUpttdATshXWFJWWQe@tramway.proxy.rlwy.net:11626/railway",
    ),
)

DB_CONNECT_ARGS = {
    "connect_timeout": 20,
    "keepalives": 1,
    "keepalives_idle": 30,
    "keepalives_interval": 10,
    "keepalives_count": 3,
    "options": "-c statement_timeout=180000",
}

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

COPY_BATCH_ROWS = 20_000
TOP_COMPANIES = int(os.getenv("COMPANY_IMPORT_TOP_COMPANIES", "2000"))
TOP_COUNTERPARTIES_PER_COMPANY_ROLE = int(os.getenv("COMPANY_IMPORT_TOP_COUNTERPARTIES", "25"))


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


def parse_decimal(raw: object) -> Decimal:
    if raw is None or str(raw).strip() == "":
        return Decimal("0")
    try:
        return Decimal(str(raw).replace(",", "").strip())
    except InvalidOperation:
        return Decimal("0")


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


def normalize_hs(raw: object) -> str:
    hs_code = str(raw).strip()
    if re.fullmatch(r"\d+(\.0+)?", hs_code):
        return str(int(float(hs_code)))
    return hs_code


def add_amount(bucket: dict[str, Any], amount: Decimal, trade_count: int, desc_zh: str | None = None, desc_en: str | None = None) -> None:
    bucket["sum_of_usd"] += amount
    bucket["trade_count"] += trade_count
    if desc_zh and not bucket.get("product_desc_zh"):
        bucket["product_desc_zh"] = desc_zh
    if desc_en and not bucket.get("product_desc_en"):
        bucket["product_desc_en"] = desc_en


def empty_amount_bucket() -> dict[str, Any]:
    return {"sum_of_usd": Decimal("0"), "trade_count": 0, "product_desc_zh": None, "product_desc_en": None}


def iter_trade_files(data_dir: Path) -> list[Path]:
    return [
        path
        for path in sorted(data_dir.glob("*.xlsx"))
        if path.name != "国家对照表.xlsx" and not path.name.startswith("~$")
    ]


def build_aggregates(data_dir: Path) -> tuple[dict[str, int], dict[str, dict]]:
    stats = {
        "rows_seen": 0,
        "rows_accepted": 0,
        "rows_skipped": 0,
        "bad_header_sheets": 0,
        "bad_month_rows": 0,
        "bad_country_rows": 0,
    }

    monthly: dict[tuple, dict[str, Any]] = defaultdict(empty_amount_bucket)
    hs_stats: dict[tuple, dict[str, Any]] = defaultdict(empty_amount_bucket)
    counterparty: dict[tuple, dict[str, Any]] = defaultdict(empty_amount_bucket)
    country_stats: dict[tuple, dict[str, Any]] = defaultdict(empty_amount_bucket)

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
                hs_code = normalize_hs(raw[0])
                desc_zh = None if raw[1] is None else str(raw[1]).strip() or None
                desc_en = None if raw[2] is None else str(raw[2]).strip() or None
                importer_name = clean_company(raw[4])
                exporter_name = clean_company(raw[6])
                exporter_company_country = exporter_country or export_side_country
                amount = parse_decimal(raw[11])
                trade_count = parse_int(raw[13])

                add_amount(
                    country_stats[(hs_code, year, month, export_side_country, importer_country)],
                    amount,
                    trade_count,
                    desc_zh,
                    desc_en,
                )

                if importer_name:
                    add_amount(monthly[(importer_name, importer_country, "importer", year, month)], amount, trade_count)
                    add_amount(hs_stats[(importer_name, importer_country, "importer", hs_code)], amount, trade_count, desc_zh, desc_en)
                    if exporter_name:
                        add_amount(
                            counterparty[(importer_name, importer_country, "importer", exporter_name, exporter_company_country)],
                            amount,
                            trade_count,
                        )

                if exporter_name:
                    add_amount(monthly[(exporter_name, exporter_company_country, "exporter", year, month)], amount, trade_count)
                    add_amount(hs_stats[(exporter_name, exporter_company_country, "exporter", hs_code)], amount, trade_count, desc_zh, desc_en)
                    if importer_name:
                        add_amount(
                            counterparty[(exporter_name, exporter_company_country, "exporter", importer_name, importer_country)],
                            amount,
                            trade_count,
                        )

                stats["rows_accepted"] += 1
                sheet_accepted += 1

            print(f"  {ws.title}: 接受 {sheet_accepted:,}，跳过 {sheet_skipped:,}")
        wb.close()

    return stats, {
        "monthly": monthly,
        "hs": hs_stats,
        "counterparty": counterparty,
        "country": country_stats,
    }


def write_csvs(aggregates: dict[str, dict], output_dir: Path) -> dict[str, Path]:
    paths = {
        "company_monthly_trade_stats": output_dir / "company_monthly_trade_stats.csv",
        "company_hs_trade_stats": output_dir / "company_hs_trade_stats.csv",
        "company_counterparty_trade_stats": output_dir / "company_counterparty_trade_stats.csv",
        "country_origin_trade_stats": output_dir / "country_origin_trade_stats.csv",
        "company_search_stats": output_dir / "company_search_stats.csv",
    }

    name_totals: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    for (company, _country, _role, _year, _month), bucket in aggregates["monthly"].items():
        name_totals[company] += bucket["sum_of_usd"]

    top_company_names = {
        company
        for company, _value in sorted(name_totals.items(), key=lambda item: item[1], reverse=True)[:TOP_COMPANIES]
    }
    print(f"公司看板仅导入交易额 Top {len(top_company_names):,} 公司")

    role_totals: dict[tuple, dict[str, Decimal | int]] = defaultdict(
        lambda: {"import": Decimal("0"), "export": Decimal("0"), "trade_count": 0}
    )

    with paths["company_monthly_trade_stats"].open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        for (company, country, role, year, month), bucket in aggregates["monthly"].items():
            if company not in top_company_names:
                continue
            writer.writerow([company, country, role, year, month, bucket["sum_of_usd"], bucket["trade_count"]])
            totals = role_totals[(company, country)]
            if role == "importer":
                totals["import"] = totals["import"] + bucket["sum_of_usd"]
            else:
                totals["export"] = totals["export"] + bucket["sum_of_usd"]
            totals["trade_count"] = int(totals["trade_count"]) + bucket["trade_count"]

    with paths["company_search_stats"].open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        for (company, country), totals in role_totals.items():
            import_value = totals["import"]
            export_value = totals["export"]
            role = "both" if import_value and export_value else "importer" if import_value else "exporter"
            writer.writerow([
                company,
                country,
                role,
                import_value + export_value,
                totals["trade_count"],
                import_value,
                export_value,
            ])

    with paths["company_hs_trade_stats"].open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        for (company, country, role, hs_code), bucket in aggregates["hs"].items():
            if company not in top_company_names:
                continue
            writer.writerow([
                company,
                country,
                role,
                hs_code,
                bucket["product_desc_zh"],
                bucket["product_desc_en"],
                bucket["sum_of_usd"],
                bucket["trade_count"],
            ])

    with paths["company_counterparty_trade_stats"].open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        grouped_counterparties: dict[tuple, list[tuple[tuple, dict[str, Any]]]] = defaultdict(list)
        for key, bucket in aggregates["counterparty"].items():
            company, country, role, _counterparty_name, _counterparty_country = key
            if company not in top_company_names:
                continue
            grouped_counterparties[(company, country, role)].append((key, bucket))

        for rows in grouped_counterparties.values():
            rows.sort(key=lambda item: (item[1]["sum_of_usd"], item[1]["trade_count"]), reverse=True)
            for (company, country, role, counterparty_name, counterparty_country), bucket in rows[:TOP_COUNTERPARTIES_PER_COMPANY_ROLE]:
                writer.writerow([company, country, role, counterparty_name, counterparty_country, bucket["sum_of_usd"], bucket["trade_count"]])

    with paths["country_origin_trade_stats"].open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        for (hs_code, year, month, origin_country, destination_country), bucket in aggregates["country"].items():
            writer.writerow([
                hs_code,
                year,
                month,
                origin_country,
                destination_country,
                bucket["sum_of_usd"],
                bucket["trade_count"],
                bucket["product_desc_zh"],
                bucket["product_desc_en"],
            ])

    return paths


def copy_csv(engine, table: str, columns: list[str], csv_path: Path) -> int:
    total = 0
    batch_no = 0
    cols = ", ".join(columns)
    copy_sql = f"COPY {table} ({cols}) FROM STDIN WITH (FORMAT CSV)"

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
        print(f"  {table} batch {batch_no}: {len(rows):,} rows, total {total:,}", flush=True)

    with csv_path.open("r", newline="", encoding="utf-8") as fh:
        reader = csv.reader(fh)
        batch: list[list[str]] = []
        for row in reader:
            batch.append(row)
            if len(batch) >= COPY_BATCH_ROWS:
                flush(batch)
                batch = []
        flush(batch)

    return total


def validate_loaded_tables(engine, table_suffix: str) -> dict[str, int]:
    tables = {
        "company_search_stats": f"company_search_stats{table_suffix}",
        "company_monthly_trade_stats": f"company_monthly_trade_stats{table_suffix}",
        "company_hs_trade_stats": f"company_hs_trade_stats{table_suffix}",
        "company_counterparty_trade_stats": f"company_counterparty_trade_stats{table_suffix}",
        "country_origin_trade_stats": f"country_origin_trade_stats{table_suffix}",
    }
    with engine.connect() as conn:
        counts = {
            logical_name: conn.execute(text(f"SELECT COUNT(*) FROM {table_name}")).scalar() or 0
            for logical_name, table_name in tables.items()
        }
        months = conn.execute(
            text(
                f"""
                SELECT MIN(year * 100 + month), MAX(year * 100 + month)
                FROM company_monthly_trade_stats{table_suffix}
                """
            )
        ).fetchone()

    required = ["company_search_stats", "company_monthly_trade_stats", "country_origin_trade_stats"]
    empty_required = [name for name in required if counts[name] <= 0]
    if empty_required:
        raise RuntimeError(f"导入结果异常，关键表为空: {', '.join(empty_required)}")
    if not months or months[0] is None or months[1] is None:
        raise RuntimeError("导入结果异常，无法读取月份范围")

    print("staging 数据库记录数:", counts)
    print(f"staging 月份范围: {months[0]} ~ {months[1]}")
    return counts


def main() -> None:
    parser = argparse.ArgumentParser(description="Upload HKUST company-level trade data as compact aggregates.")
    parser.add_argument("--data-dir", default=None, help="Directory containing HKUST XLSX files")
    parser.add_argument("--database-url", default=None, help="PostgreSQL connection URL")
    parser.add_argument("--clear", action="store_true", help="Backward compatible no-op; imports always rebuild via staging")
    args = parser.parse_args()

    project_root = Path(__file__).resolve().parents[1]
    data_dir = Path(args.data_dir).expanduser().resolve() if args.data_dir else project_root / "data" / "hkust_文件汇总"
    database_url = args.database_url or DATABASE_URL

    print("=" * 72)
    print("上传 hkust_文件汇总 公司级聚合数据到数据库")
    print("=" * 72)
    print("模式: 全量重建")
    print("数据目录:", data_dir)

    if not data_dir.exists():
        print(f"❌ 数据目录不存在: {data_dir}")
        sys.exit(1)

    engine = create_engine(database_url, pool_pre_ping=True, connect_args=DB_CONNECT_ARGS)
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("✓ 数据库连接成功")
    except Exception as exc:
        print(f"❌ 数据库连接失败: {exc}")
        sys.exit(1)

    start = datetime.now()
    stats, aggregates = build_aggregates(data_dir)
    print("聚合完成:", stats)
    print(
        "聚合行数:",
        {
            "company_search_stats": "derived",
            "company_monthly_trade_stats": len(aggregates["monthly"]),
            "company_hs_trade_stats": len(aggregates["hs"]),
            "company_counterparty_trade_stats": len(aggregates["counterparty"]),
            "country_origin_trade_stats": len(aggregates["country"]),
        },
    )

    with tempfile.TemporaryDirectory(prefix="company_aggregates_") as tmp:
        paths = write_csvs(aggregates, Path(tmp))
        csv_counts = {table: sum(1 for _ in path.open("r", encoding="utf-8")) for table, path in paths.items()}
        print("CSV 行数:", csv_counts)

        staging_suffix = "__import_" + datetime.now().strftime("%Y%m%d%H%M%S")
        print(f"创建 staging 表 {staging_suffix} ...")
        try:
            create_tables(engine, suffix=staging_suffix)

            for table, path in paths.items():
                copy_csv(engine, f"{table}{staging_suffix}", TABLE_COLUMNS[table], path)

            print("创建 staging 查询索引 ...")
            create_indexes(engine, suffix=staging_suffix)
            validate_loaded_tables(engine, staging_suffix)

            print("切换 staging 表为正式表 ...")
            swap_staging_tables(engine, staging_suffix=staging_suffix)
        except Exception:
            print("导入失败，正式表未切换，正在清理 staging 表 ...")
            drop_tables(engine, suffix=staging_suffix)
            raise

    elapsed = (datetime.now() - start).total_seconds()
    with engine.connect() as conn:
        counts = {
            table: conn.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
            for table in [
                "company_search_stats",
                "company_monthly_trade_stats",
                "company_hs_trade_stats",
                "company_counterparty_trade_stats",
                "country_origin_trade_stats",
            ]
        }
        months = conn.execute(
            text("SELECT MIN(year * 100 + month), MAX(year * 100 + month) FROM company_monthly_trade_stats")
        ).fetchone()

    print("\n" + "=" * 72)
    print("上传完成")
    print("=" * 72)
    print("数据库记录数:", counts)
    print(f"月份范围: {months[0]} ~ {months[1]}")
    print(f"耗时: {elapsed:.1f}s")


if __name__ == "__main__":
    main()
