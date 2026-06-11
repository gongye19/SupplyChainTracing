from __future__ import annotations

import csv
from collections import defaultdict
from decimal import Decimal
from pathlib import Path


def write_csvs(
    aggregates: dict[str, dict],
    output_dir: Path,
    *,
    top_companies: int,
    top_counterparties_per_company_role: int,
    force_company_names: set[str] | None = None,
    brand_by_company: dict[str, str] | None = None,
) -> dict[str, Path]:
    paths = {
        "company_monthly_trade_stats": output_dir / "company_monthly_trade_stats.csv",
        "company_hs_trade_stats": output_dir / "company_hs_trade_stats.csv",
        "company_counterparty_trade_stats": output_dir / "company_counterparty_trade_stats.csv",
        "country_origin_trade_stats": output_dir / "country_origin_trade_stats.csv",
        "company_search_stats": output_dir / "company_search_stats.csv",
    }

    name_totals: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    for (company, _country, _role, _year, _month, _hs_code), bucket in aggregates["monthly"].items():
        name_totals[company] += bucket["sum_of_usd"]

    top_company_names = set()
    if top_companies > 0:
        top_company_names = {
            company
            for company, _value in sorted(name_totals.items(), key=lambda item: item[1], reverse=True)[:top_companies]
        }
    forced_company_names = force_company_names or set()
    company_brands = brand_by_company or {}
    included_company_names = top_company_names | forced_company_names
    if top_company_names:
        print(
            "公司看板导入范围: "
            f"品牌白名单 {len(forced_company_names):,} 公司"
            f" + 额外交易额 Top {len(top_company_names):,} 公司"
            f" = 去重后 {len(included_company_names):,} 公司"
        )
    else:
        print(f"公司看板导入范围: 仅215品牌白名单 {len(included_company_names):,} 公司")

    role_totals: dict[tuple, dict[str, Decimal | int]] = defaultdict(
        lambda: {"import": Decimal("0"), "export": Decimal("0"), "trade_count": 0}
    )

    with paths["company_monthly_trade_stats"].open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        for (company, country, role, year, month, hs_code), bucket in aggregates["monthly"].items():
            if company not in included_company_names:
                continue
            writer.writerow([company, country, role, year, month, hs_code, bucket["sum_of_usd"], bucket["trade_count"]])
            totals = role_totals[(company, country)]
            if role == "importer":
                totals["import"] = totals["import"] + bucket["sum_of_usd"]
                totals["import_count"] = int(totals.get("import_count", 0)) + bucket["trade_count"]
                totals["import_rows"] = int(totals.get("import_rows", 0)) + bucket.get("row_count", 1)
            else:
                totals["export"] = totals["export"] + bucket["sum_of_usd"]
                totals["export_count"] = int(totals.get("export_count", 0)) + bucket["trade_count"]
                totals["export_rows"] = int(totals.get("export_rows", 0)) + bucket.get("row_count", 1)
            totals["trade_count"] = int(totals["trade_count"]) + bucket["trade_count"]

    with paths["company_search_stats"].open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        for (company, country), totals in role_totals.items():
            import_value = totals["import"]
            export_value = totals["export"]
            import_rows = int(totals.get("import_rows", 0))
            export_rows = int(totals.get("export_rows", 0))
            role = "both" if import_rows and export_rows else "importer" if import_rows else "exporter"
            writer.writerow([
                company,
                company_brands.get(company, ""),
                country,
                role,
                import_value + export_value,
                totals["trade_count"],
                import_value,
                export_value,
            ])

    with paths["company_hs_trade_stats"].open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        for (company, country, role, year, month, hs_code), bucket in aggregates["hs"].items():
            if company not in included_company_names:
                continue
            writer.writerow([
                company,
                country,
                role,
                year,
                month,
                hs_code,
                bucket["product_desc_zh"],
                bucket["product_desc_en"],
                bucket["sum_of_usd"],
                bucket["trade_count"],
            ])

    with paths["company_counterparty_trade_stats"].open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        grouped_counterparties: dict[tuple, list[tuple[tuple, dict]]] = defaultdict(list)
        for key, bucket in aggregates["counterparty"].items():
            company, country, role, _year, _month, _hs_code, counterparty_name, counterparty_country = key
            if company not in included_company_names:
                continue
            grouped_counterparties[(company, country, role, counterparty_name, counterparty_country)].append((key, bucket))

        selected_pairs: set[tuple] | None = None
        if top_counterparties_per_company_role > 0:
            pair_totals: dict[tuple, dict[str, Decimal | int]] = defaultdict(
                lambda: {"sum_of_usd": Decimal("0"), "trade_count": 0}
            )
            for pair_key, rows in grouped_counterparties.items():
                for _key, bucket in rows:
                    pair_totals[pair_key]["sum_of_usd"] = pair_totals[pair_key]["sum_of_usd"] + bucket["sum_of_usd"]
                    pair_totals[pair_key]["trade_count"] = int(pair_totals[pair_key]["trade_count"]) + bucket["trade_count"]

            by_company_role: dict[tuple, list[tuple[tuple, dict[str, Decimal | int]]]] = defaultdict(list)
            for pair_key, totals in pair_totals.items():
                company, country, role, _counterparty_name, _counterparty_country = pair_key
                by_company_role[(company, country, role)].append((pair_key, totals))

            selected_pairs = set()
            for rows in by_company_role.values():
                rows.sort(key=lambda item: (item[1]["sum_of_usd"], item[1]["trade_count"]), reverse=True)
                selected_pairs.update(pair_key for pair_key, _totals in rows[:top_counterparties_per_company_role])

        for pair_key, rows in grouped_counterparties.items():
            if selected_pairs is not None and pair_key not in selected_pairs:
                continue
            rows.sort(key=lambda item: (item[0][3], item[0][4], item[0][5], item[1]["sum_of_usd"]), reverse=False)
            for (company, country, role, year, month, hs_code, counterparty_name, counterparty_country), bucket in rows:
                writer.writerow([
                    company,
                    country,
                    role,
                    year,
                    month,
                    hs_code,
                    counterparty_name,
                    counterparty_country,
                    bucket["sum_of_usd"],
                    bucket["trade_count"],
                ])

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
