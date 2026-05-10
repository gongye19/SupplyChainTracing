from __future__ import annotations

import csv
import io
import zipfile
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable

from .common import (
    add_amount,
    clean_company,
    clean_country,
    empty_amount_bucket,
    parse_decimal,
    parse_int,
    parse_month,
)


EXPECTED_HEADERS = [
    "月度",
    "进口商",
    "进口商所在国家",
    "目的国",
    "出口商",
    "出口商所在国家",
    "原产国",
    "金额美元",
    "交易次数",
    "进口商母品牌",
    "出口商母品牌",
]

PRODUCT_DESCRIPTIONS: dict[str, tuple[str, str]] = {
    "381800": ("半导体材料", "Chemical elements doped for electronics"),
    "848610": ("半导体制造设备", "Machines for manufacturing boules or wafers"),
    "848620": ("半导体制造设备", "Machines for manufacturing semiconductor devices"),
    "848630": ("平板显示制造设备", "Machines for manufacturing flat panel displays"),
    "848640": ("装配封装设备", "Machines for assembling semiconductor devices"),
    "848690": ("半导体设备零部件", "Parts and accessories for semiconductor equipment"),
    "854231": ("处理器及控制器", "Processors and controllers"),
    "854232": ("存储器", "Memories"),
    "854233": ("放大器", "Amplifiers"),
    "854239": ("其他集成电路", "Other electronic integrated circuits"),
    "903082": ("半导体测试仪器", "Instruments for measuring semiconductor wafers/devices"),
    "903141": ("光学检测仪器", "Optical instruments for inspecting semiconductor devices"),
}


def _iter_csv_streams(source: Path) -> Iterable[tuple[str, io.TextIOBase]]:
    if source.is_file() and source.suffix.lower() == ".zip":
        with zipfile.ZipFile(source) as archive:
            names = sorted(
                name
                for name in archive.namelist()
                if name.lower().endswith(".csv") and not name.startswith("__MACOSX/")
            )
            for name in names:
                with archive.open(name) as fh:
                    yield name, io.TextIOWrapper(fh, encoding="utf-8-sig", newline="")
        return

    files = sorted(source.glob("*.csv")) if source.is_dir() else [source]
    for file_path in files:
        with file_path.open("r", newline="", encoding="utf-8-sig") as fh:
            yield file_path.name, fh


def build_aggregates(source: Path) -> tuple[dict[str, int], dict[str, dict]]:
    stats = {
        "rows_seen": 0,
        "rows_accepted": 0,
        "rows_skipped": 0,
        "bad_header_files": 0,
        "bad_month_rows": 0,
        "bad_country_rows": 0,
        "branded_rows": 0,
        "branded_companies": 0,
    }

    monthly: dict[tuple, dict[str, Any]] = defaultdict(empty_amount_bucket)
    hs_stats: dict[tuple, dict[str, Any]] = defaultdict(empty_amount_bucket)
    counterparty: dict[tuple, dict[str, Any]] = defaultdict(empty_amount_bucket)
    country_stats: dict[tuple, dict[str, Any]] = defaultdict(empty_amount_bucket)
    branded_companies: set[str] = set()

    print(f"读取公司对 CSV 源: {source}")

    file_count = 0
    for file_name, fh in _iter_csv_streams(source):
        file_count += 1
        hs_code = Path(file_name).stem
        desc_zh, desc_en = PRODUCT_DESCRIPTIONS.get(hs_code, (None, None))
        print(f"处理 {file_name} ...", flush=True)

        reader = csv.DictReader(fh)
        if reader.fieldnames != EXPECTED_HEADERS:
            stats["bad_header_files"] += 1
            print(f"  跳过: 表头不匹配 {reader.fieldnames}")
            continue

        accepted = 0
        skipped = 0
        branded_rows = 0

        for row in reader:
            stats["rows_seen"] += 1

            month_pair = parse_month(row.get("月度"))
            importer_country = clean_country(row.get("进口商所在国家")) or clean_country(row.get("目的国"))
            destination_country = clean_country(row.get("目的国")) or importer_country
            exporter_country = clean_country(row.get("出口商所在国家"))
            origin_country = clean_country(row.get("原产国"))
            export_side_country = exporter_country or origin_country

            if not month_pair:
                stats["bad_month_rows"] += 1
                stats["rows_skipped"] += 1
                skipped += 1
                continue
            if not destination_country or not export_side_country:
                stats["bad_country_rows"] += 1
                stats["rows_skipped"] += 1
                skipped += 1
                continue

            year, month = month_pair
            importer_name = clean_company(row.get("进口商"))
            exporter_name = clean_company(row.get("出口商"))
            importer_brand = (row.get("进口商母品牌") or "").strip()
            exporter_brand = (row.get("出口商母品牌") or "").strip()
            amount = parse_decimal(row.get("金额美元"))
            trade_count = parse_int(row.get("交易次数"))

            add_amount(
                country_stats[(hs_code, year, month, export_side_country, destination_country)],
                amount,
                trade_count,
                desc_zh,
                desc_en,
            )

            if importer_name:
                add_amount(monthly[(importer_name, importer_country, "importer", year, month)], amount, trade_count)
                add_amount(hs_stats[(importer_name, importer_country, "importer", hs_code)], amount, trade_count, desc_zh, desc_en)
                if importer_brand:
                    branded_companies.add(importer_name)
                if exporter_name:
                    add_amount(
                        counterparty[(importer_name, importer_country, "importer", exporter_name, export_side_country)],
                        amount,
                        trade_count,
                    )

            if exporter_name:
                add_amount(monthly[(exporter_name, export_side_country, "exporter", year, month)], amount, trade_count)
                add_amount(hs_stats[(exporter_name, export_side_country, "exporter", hs_code)], amount, trade_count, desc_zh, desc_en)
                if exporter_brand:
                    branded_companies.add(exporter_name)
                if importer_name:
                    add_amount(
                        counterparty[(exporter_name, export_side_country, "exporter", importer_name, importer_country)],
                        amount,
                        trade_count,
                    )

            if importer_brand or exporter_brand:
                branded_rows += 1
                stats["branded_rows"] += 1

            stats["rows_accepted"] += 1
            accepted += 1

        print(f"  接受 {accepted:,}，跳过 {skipped:,}，品牌命中 {branded_rows:,}")

    print(f"找到 {file_count} 个 CSV 文件")
    stats["branded_companies"] = len(branded_companies)

    return stats, {
        "monthly": monthly,
        "hs": hs_stats,
        "counterparty": counterparty,
        "country": country_stats,
        "brand_companies": branded_companies,
    }
